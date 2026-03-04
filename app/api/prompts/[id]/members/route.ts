import { PromptRole } from "@prisma/client"
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"

import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { recordPromptAuditLog } from "@/lib/prompt-audit-log"
import { resolvePromptPermission } from "@/lib/prompt-permissions"

interface PromptMemberPayload {
  userId: string
  role: PromptRole | string
}

const MANAGED_ROLES = [PromptRole.EDITOR, PromptRole.REVIEWER, PromptRole.VIEWER] as const
type ManagedPromptRole = (typeof MANAGED_ROLES)[number]

function resolveRole(value: unknown) {
  if (typeof value !== "string") {
    return null
  }

  const normalized = value.trim().toUpperCase()
  if (!MANAGED_ROLES.includes(normalized as ManagedPromptRole)) {
    return null
  }

  return normalized as ManagedPromptRole
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
      authorId: true,
      isPublic: true,
      publishStatus: true,
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
    return NextResponse.json({ error: "无权限查看协作者" }, { status: 403 })
  }

  const members = await prisma.promptMember.findMany({
    where: {
      promptId: params.id,
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      invitedBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
    orderBy: {
      createdAt: "asc",
    },
  })

  return NextResponse.json(members)
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 })
  }

  const prompt = await prisma.prompt.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      authorId: true,
      isPublic: true,
      publishStatus: true,
      title: true,
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

  if (!permission.canManageMembers) {
    return NextResponse.json({ error: "仅 Owner 可管理协作者" }, { status: 403 })
  }

  try {
    const { members } = await request.json()
    if (!Array.isArray(members)) {
      return NextResponse.json({ error: "成员格式不正确" }, { status: 400 })
    }

    const normalizedMembers = (members as PromptMemberPayload[])
      .map((item) => {
        const userId = String(item.userId || "").trim()
        const role = resolveRole(item.role)

        if (!userId || !role) {
          return null
        }

        return {
          userId,
          role,
        }
      })
      .filter((item): item is { userId: string; role: ManagedPromptRole } => item !== null)

    const uniqueMap = new Map<string, { userId: string; role: ManagedPromptRole }>()
    for (const item of normalizedMembers) {
      if (item.userId === prompt.authorId) {
        continue
      }
      uniqueMap.set(item.userId, item)
    }

    const nextMembers = Array.from(uniqueMap.values())
    const userIds = nextMembers.map((item) => item.userId)

    if (userIds.length > 0) {
      const existingUsers = await prisma.user.findMany({
        where: {
          id: { in: userIds },
        },
        select: { id: true },
      })
      const userSet = new Set(existingUsers.map((item) => item.id))
      const missingUserIds = userIds.filter((item) => !userSet.has(item))
      if (missingUserIds.length > 0) {
        return NextResponse.json(
          { error: `以下用户不存在: ${missingUserIds.join(", ")}` },
          { status: 400 }
        )
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.promptMember.deleteMany({
        where: {
          promptId: params.id,
          userId: {
            not: prompt.authorId || undefined,
          },
        },
      })

      if (prompt.authorId) {
        await tx.promptMember.upsert({
          where: {
            promptId_userId: {
              promptId: params.id,
              userId: prompt.authorId,
            },
          },
          update: {
            role: PromptRole.OWNER,
          },
          create: {
            promptId: params.id,
            userId: prompt.authorId,
            role: PromptRole.OWNER,
            invitedById: session.user.id,
          },
        })
      }

      for (const member of nextMembers) {
        await tx.promptMember.create({
          data: {
            promptId: params.id,
            userId: member.userId,
            role: member.role,
            invitedById: session.user.id,
          },
        })
      }
    })

    await recordPromptAuditLog({
      promptId: params.id,
      actorId: session.user.id,
      action: "prompt.members.update",
      metadata: {
        promptTitle: prompt.title,
        memberCount: nextMembers.length,
      },
    })

    const updatedMembers = await prisma.promptMember.findMany({
      where: { promptId: params.id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    })

    return NextResponse.json(updatedMembers)
  } catch (error) {
    console.error("Update prompt members failed:", error)
    return NextResponse.json({ error: "更新协作者失败" }, { status: 500 })
  }
}
