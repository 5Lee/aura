import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { type Prisma } from "@prisma/client"

import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { recordPromptAuditLog } from "@/lib/prompt-audit-log"
import { resolvePromptPermission } from "@/lib/prompt-permissions"
import {
  sanitizePromptTestCases,
  serializePromptTestCaseExport,
  type PromptTestCasePayload,
} from "@/lib/prompt-test-case-utils"

async function ensurePromptAccess(promptId: string, userId: string, mode: "view" | "edit") {
  const prompt = await prisma.prompt.findUnique({
    where: { id: promptId },
    select: { id: true, authorId: true, title: true, isPublic: true, publishStatus: true },
  })

  if (!prompt) {
    return { ok: false, status: 404, error: "提示词不存在" } as const
  }

  const permission = await resolvePromptPermission(
    {
      promptId: prompt.id,
      isPublic: prompt.isPublic,
      publishStatus: prompt.publishStatus,
      authorId: prompt.authorId,
    },
    userId
  )

  if (mode === "view" && !permission.canView) {
    return { ok: false, status: 403, error: "无权限操作此提示词" } as const
  }

  if (mode === "edit" && !permission.canEdit) {
    return { ok: false, status: 403, error: "无权限操作此提示词" } as const
  }

  return { ok: true, prompt } as const
}

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 })
  }

  const ownership = await ensurePromptAccess(params.id, session.user.id, "view")
  if (!ownership.ok) {
    return NextResponse.json({ error: ownership.error }, { status: ownership.status })
  }

  const testCases = await prisma.promptTestCase.findMany({
    where: { promptId: params.id },
    orderBy: { createdAt: "asc" },
  })

  const { searchParams } = new URL(request.url)
  const format = searchParams.get("format")

  if (format === "export") {
    const payload = serializePromptTestCaseExport(
      params.id,
      testCases.map((item) => ({
        name: item.name,
        description: item.description,
        assertionType: item.assertionType,
        expectedOutput: item.expectedOutput,
        inputVariables: item.inputVariables
          ? (JSON.parse(JSON.stringify(item.inputVariables)) as Prisma.InputJsonValue)
          : undefined,
        enabled: item.enabled,
      }))
    )

    return NextResponse.json(payload)
  }

  return NextResponse.json(testCases)
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 })
  }

  const ownership = await ensurePromptAccess(params.id, session.user.id, "edit")
  if (!ownership.ok) {
    return NextResponse.json({ error: ownership.error }, { status: ownership.status })
  }

  try {
    const body = await request.json()
    const testCasesRaw = Array.isArray(body?.testCases)
      ? body.testCases
      : body?.testCase
        ? [body.testCase]
        : Array.isArray(body)
          ? body
          : [body as PromptTestCasePayload]

    const testCases = sanitizePromptTestCases(testCasesRaw)
    if (testCases.length === 0) {
      return NextResponse.json({ error: "至少需要一个有效测试用例" }, { status: 400 })
    }

    const replaceAll = Boolean(body?.replaceAll)

    const createdCount = await prisma.$transaction(async (tx) => {
      if (replaceAll) {
        await tx.promptTestCase.deleteMany({
          where: { promptId: params.id },
        })
      }

      for (const testCase of testCases) {
        await tx.promptTestCase.create({
          data: {
            promptId: params.id,
            ...testCase,
          },
        })
      }

      return testCases.length
    })

    await recordPromptAuditLog({
      promptId: params.id,
      actorId: session.user.id,
      action: replaceAll ? "prompt.test-case.import" : "prompt.test-case.create",
      metadata: {
        promptTitle: ownership.prompt.title,
        createdCount,
        replaceAll,
      },
    })

    return NextResponse.json({
      message: replaceAll ? "测试用例已导入并替换" : "测试用例创建成功",
      createdCount,
    })
  } catch (error) {
    console.error("Create prompt test cases failed:", error)
    return NextResponse.json({ error: "保存测试用例失败" }, { status: 500 })
  }
}
