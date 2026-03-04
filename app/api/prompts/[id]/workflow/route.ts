import { PromptPublishStatus, PromptVersionSource } from "@prisma/client"
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"

import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { recordPromptAuditLog } from "@/lib/prompt-audit-log"
import { canTransitionPublishStatus, resolvePromptPermission } from "@/lib/prompt-permissions"
import { createPromptVersionSnapshot } from "@/lib/prompt-versioning"

function listTransitions(from: PromptPublishStatus) {
  switch (from) {
    case PromptPublishStatus.DRAFT:
      return [PromptPublishStatus.IN_REVIEW, PromptPublishStatus.ARCHIVED]
    case PromptPublishStatus.IN_REVIEW:
      return [PromptPublishStatus.DRAFT, PromptPublishStatus.PUBLISHED, PromptPublishStatus.ARCHIVED]
    case PromptPublishStatus.PUBLISHED:
      return [PromptPublishStatus.IN_REVIEW, PromptPublishStatus.ARCHIVED]
    case PromptPublishStatus.ARCHIVED:
      return [PromptPublishStatus.DRAFT]
    default:
      return []
  }
}

function resolveNextStatus(value: unknown) {
  if (typeof value !== "string") {
    return null
  }

  const normalized = value.trim().toUpperCase()
  if (!Object.values(PromptPublishStatus).includes(normalized as PromptPublishStatus)) {
    return null
  }

  return normalized as PromptPublishStatus
}

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 })
  }

  const prompt = await prisma.prompt.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      title: true,
      isPublic: true,
      publishStatus: true,
      publishedAt: true,
      authorId: true,
      updatedAt: true,
    },
  })

  if (!prompt) {
    return NextResponse.json({ error: "提示词不存在" }, { status: 404 })
  }

  const permission = await resolvePromptPermission(
    {
      promptId: prompt.id,
      isPublic: prompt.isPublic,
      publishStatus: prompt.publishStatus,
      authorId: prompt.authorId,
    },
    session.user.id
  )

  if (!permission.canView) {
    return NextResponse.json({ error: "无权限查看发布状态" }, { status: 403 })
  }

  const transitions = listTransitions(prompt.publishStatus).filter((target) =>
    canTransitionPublishStatus(prompt.publishStatus, target, permission, prompt.isPublic)
  )
  const history = await prisma.promptAuditLog.findMany({
    where: {
      promptId: params.id,
      action: "prompt.workflow.transition",
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 20,
    include: {
      actor: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  })

  return NextResponse.json({
    ...prompt,
    transitions,
    history: history.map((item) => {
      const metadata =
        item.metadata && typeof item.metadata === "object" && !Array.isArray(item.metadata)
          ? (item.metadata as Record<string, unknown>)
          : {}

      return {
        id: item.id,
        from: typeof metadata.from === "string" ? metadata.from : null,
        to: typeof metadata.to === "string" ? metadata.to : null,
        note: typeof metadata.note === "string" ? metadata.note : null,
        createdAt: item.createdAt,
        actor: item.actor
          ? {
              id: item.actor.id,
              name: item.actor.name,
              email: item.actor.email,
            }
          : null,
      }
    }),
    permission,
  })
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 })
  }

  const prompt = await prisma.prompt.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      title: true,
      authorId: true,
      isPublic: true,
      publishStatus: true,
      publishedAt: true,
    },
  })

  if (!prompt) {
    return NextResponse.json({ error: "提示词不存在" }, { status: 404 })
  }

  const permission = await resolvePromptPermission(
    {
      promptId: prompt.id,
      isPublic: prompt.isPublic,
      publishStatus: prompt.publishStatus,
      authorId: prompt.authorId,
    },
    session.user.id
  )

  if (!permission.canReview) {
    return NextResponse.json({ error: "无权限变更发布状态" }, { status: 403 })
  }

  const { status, note } = await request.json().catch(() => ({}))
  const nextStatus = resolveNextStatus(status)
  if (!nextStatus) {
    return NextResponse.json({ error: "目标状态无效" }, { status: 400 })
  }

  if (!canTransitionPublishStatus(prompt.publishStatus, nextStatus, permission, prompt.isPublic)) {
    return NextResponse.json({ error: "当前角色无权限执行该状态流转" }, { status: 403 })
  }

  if (nextStatus === PromptPublishStatus.PUBLISHED && !prompt.isPublic) {
    return NextResponse.json({ error: "未公开提示词无法发布，请先开启公开可见" }, { status: 400 })
  }

  const publishedAt = nextStatus === PromptPublishStatus.PUBLISHED ? prompt.publishedAt || new Date() : null

  const updated = await prisma.prompt.update({
    where: { id: params.id },
    data: {
      publishStatus: nextStatus,
      publishedAt,
    },
  })

  await createPromptVersionSnapshot({
    promptId: params.id,
    source: PromptVersionSource.UPDATE,
    actorId: session.user.id,
    changeSummary: `Workflow transition ${prompt.publishStatus} -> ${nextStatus}`,
  })

  await recordPromptAuditLog({
    promptId: params.id,
    actorId: session.user.id,
    action: "prompt.workflow.transition",
    metadata: {
      from: prompt.publishStatus,
      to: nextStatus,
      note: typeof note === "string" ? note : null,
    },
  })

  return NextResponse.json(updated)
}
