import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"

import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { recordPromptAuditLog } from "@/lib/prompt-audit-log"
import { resolvePromptPermission } from "@/lib/prompt-permissions"
import { sanitizePromptTestCases } from "@/lib/prompt-test-case-utils"

async function ensurePromptOwner(promptId: string, userId: string) {
  const prompt = await prisma.prompt.findUnique({
    where: { id: promptId },
    select: { id: true, authorId: true, isPublic: true, publishStatus: true },
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
  if (!permission.canEdit) {
    return { ok: false, status: 403, error: "无权限操作此提示词" } as const
  }

  return { ok: true } as const
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string; caseId: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 })
  }

  const ownership = await ensurePromptOwner(params.id, session.user.id)
  if (!ownership.ok) {
    return NextResponse.json({ error: ownership.error }, { status: ownership.status })
  }

  try {
    const body = await request.json()
    const sanitized = sanitizePromptTestCases([body])
    if (sanitized.length !== 1) {
      return NextResponse.json({ error: "测试用例内容不合法" }, { status: 400 })
    }

    const testCase = await prisma.promptTestCase.findUnique({
      where: { id: params.caseId },
      select: { id: true, promptId: true },
    })

    if (!testCase || testCase.promptId !== params.id) {
      return NextResponse.json({ error: "测试用例不存在" }, { status: 404 })
    }

    const updated = await prisma.promptTestCase.update({
      where: { id: params.caseId },
      data: sanitized[0],
    })

    await recordPromptAuditLog({
      promptId: params.id,
      actorId: session.user.id,
      action: "prompt.test-case.update",
      metadata: {
        testCaseId: params.caseId,
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error("Update prompt test case failed:", error)
    return NextResponse.json({ error: "更新测试用例失败" }, { status: 500 })
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string; caseId: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 })
  }

  const ownership = await ensurePromptOwner(params.id, session.user.id)
  if (!ownership.ok) {
    return NextResponse.json({ error: ownership.error }, { status: ownership.status })
  }

  try {
    const testCase = await prisma.promptTestCase.findUnique({
      where: { id: params.caseId },
      select: { id: true, promptId: true },
    })

    if (!testCase || testCase.promptId !== params.id) {
      return NextResponse.json({ error: "测试用例不存在" }, { status: 404 })
    }

    await prisma.promptTestCase.delete({
      where: { id: params.caseId },
    })

    await recordPromptAuditLog({
      promptId: params.id,
      actorId: session.user.id,
      action: "prompt.test-case.delete",
      metadata: {
        testCaseId: params.caseId,
      },
    })

    return NextResponse.json({ message: "测试用例已删除" })
  } catch (error) {
    console.error("Delete prompt test case failed:", error)
    return NextResponse.json({ error: "删除测试用例失败" }, { status: 500 })
  }
}
