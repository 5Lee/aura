import { PromptEvalRunMode } from "@prisma/client"
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"

import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { executePromptEvalRun } from "@/lib/prompt-evals"
import { recordPromptAuditLog } from "@/lib/prompt-audit-log"
import { resolvePromptPermission } from "@/lib/prompt-permissions"

async function ensurePromptOwner(promptId: string, userId: string) {
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
  if (!permission.canReview) {
    return { ok: false, status: 403, error: "无权限执行评测" } as const
  }

  return { ok: true, prompt } as const
}

const MODE_MAP: Record<string, PromptEvalRunMode> = {
  manual: PromptEvalRunMode.MANUAL,
  scheduled: PromptEvalRunMode.SCHEDULED,
  ci: PromptEvalRunMode.CI,
}

function resolveMode(value: unknown) {
  if (typeof value !== "string") {
    return PromptEvalRunMode.MANUAL
  }

  return MODE_MAP[value.trim().toLowerCase()] || PromptEvalRunMode.MANUAL
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 })
  }

  const ownership = await ensurePromptOwner(params.id, session.user.id)
  if (!ownership.ok) {
    return NextResponse.json({ error: ownership.error }, { status: ownership.status })
  }

  try {
    const { mode, summary } = await request.json().catch(() => ({ mode: "manual" }))

    const run = await executePromptEvalRun({
      promptId: params.id,
      mode: resolveMode(mode),
      triggeredById: session.user.id,
      summary: typeof summary === "string" ? summary : "Prompt regression run",
    })

    await recordPromptAuditLog({
      promptId: params.id,
      actorId: session.user.id,
      action: "prompt.eval.run",
      metadata: {
        promptTitle: ownership.prompt.title,
        runId: run.id,
        mode: run.mode,
        passRate: run.passRate,
        failedCases: run.failedCases,
      },
    })

    return NextResponse.json(run)
  } catch (error) {
    console.error("Execute prompt eval failed:", error)

    await recordPromptAuditLog({
      promptId: params.id,
      actorId: session.user.id,
      action: "prompt.eval.run",
      status: "failure",
      metadata: {
        error: String(error),
      },
    })

    return NextResponse.json({ error: "执行提示词回归评测失败" }, { status: 500 })
  }
}
