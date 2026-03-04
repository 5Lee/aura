import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"

import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { recordPromptAuditLog } from "@/lib/prompt-audit-log"
import {
  replacePromptTemplateVariablesWithClient,
  sanitizeTemplateVariables,
} from "@/lib/prompt-template-variable-utils"

async function ensurePromptOwner(promptId: string, userId: string) {
  const prompt = await prisma.prompt.findUnique({
    where: { id: promptId },
    select: { id: true, authorId: true },
  })
  if (!prompt) {
    return { ok: false, status: 404, error: "提示词不存在" } as const
  }
  if (prompt.authorId !== userId) {
    return { ok: false, status: 403, error: "无权限操作此提示词" } as const
  }
  return { ok: true } as const
}

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 })
  }

  const ownership = await ensurePromptOwner(params.id, session.user.id)
  if (!ownership.ok) {
    return NextResponse.json({ error: ownership.error }, { status: ownership.status })
  }

  const variables = await prisma.promptTemplateVariable.findMany({
    where: { promptId: params.id },
    orderBy: { name: "asc" },
  })
  return NextResponse.json(variables)
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 })
  }

  const ownership = await ensurePromptOwner(params.id, session.user.id)
  if (!ownership.ok) {
    return NextResponse.json({ error: ownership.error }, { status: ownership.status })
  }

  try {
    const { variables } = await request.json()
    if (!Array.isArray(variables)) {
      return NextResponse.json({ error: "变量格式不正确" }, { status: 400 })
    }

    const sanitizedVariables = sanitizeTemplateVariables(variables)

    await prisma.$transaction(async (tx) => {
      await replacePromptTemplateVariablesWithClient(tx, params.id, sanitizedVariables)
    })

    await recordPromptAuditLog({
      promptId: params.id,
      actorId: session.user.id,
      action: "prompt.template-variables.update",
      metadata: {
        variableCount: sanitizedVariables.length,
      },
    })

    return NextResponse.json({ message: "模板变量已更新" })
  } catch (error) {
    console.error("Update template variables failed:", error)
    return NextResponse.json({ error: "更新模板变量失败" }, { status: 500 })
  }
}
