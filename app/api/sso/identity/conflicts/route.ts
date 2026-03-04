import { IdentityConflictStatus } from "@prisma/client"
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"

import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { sanitizeTextInput } from "@/lib/security"
import { getUserEntitlementSnapshot, hasEnterpriseSsoAccess } from "@/lib/subscription-entitlements"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 })
  }

  const entitlement = await getUserEntitlementSnapshot(session.user.id)
  if (!hasEnterpriseSsoAccess(entitlement.plan.id)) {
    return NextResponse.json(
      {
        error: "SSO 与企业身份集成仅对 Enterprise 套餐开放",
        upgradeRequired: true,
      },
      { status: 403 }
    )
  }

  const conflicts = await prisma.identityConflict.findMany({
    where: {
      provider: {
        userId: session.user.id,
      },
    },
    include: {
      provider: {
        select: {
          id: true,
          name: true,
          type: true,
        },
      },
      existingUser: {
        select: {
          id: true,
          email: true,
          name: true,
        },
      },
    },
    orderBy: [{ createdAt: "desc" }],
    take: 100,
  })

  const openCount = conflicts.filter((item) => item.status === IdentityConflictStatus.OPEN).length

  return NextResponse.json({
    conflicts: conflicts.map((item) => ({
      id: item.id,
      provider: item.provider,
      externalUserId: item.externalUserId,
      incomingEmail: item.incomingEmail,
      incomingName: item.incomingName,
      existingUser: item.existingUser,
      reason: item.reason,
      status: item.status,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    })),
    meta: {
      openCount,
      total: conflicts.length,
    },
  })
}

export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 })
  }

  const entitlement = await getUserEntitlementSnapshot(session.user.id)
  if (!hasEnterpriseSsoAccess(entitlement.plan.id)) {
    return NextResponse.json(
      {
        error: "SSO 与企业身份集成仅对 Enterprise 套餐开放",
        upgradeRequired: true,
      },
      { status: 403 }
    )
  }

  try {
    const body = await request.json().catch(() => ({}))
    const id = sanitizeTextInput(body.id, 64)
    const status = sanitizeTextInput(body.status, 20).toUpperCase()

    if (!id) {
      return NextResponse.json({ error: "冲突记录 id 不能为空" }, { status: 400 })
    }

    if (status !== IdentityConflictStatus.RESOLVED && status !== IdentityConflictStatus.OPEN) {
      return NextResponse.json({ error: "status 非法" }, { status: 400 })
    }

    const conflict = await prisma.identityConflict.findFirst({
      where: {
        id,
        provider: {
          userId: session.user.id,
        },
      },
      select: {
        id: true,
      },
    })

    if (!conflict) {
      return NextResponse.json({ error: "冲突记录不存在" }, { status: 404 })
    }

    const updated = await prisma.identityConflict.update({
      where: {
        id: conflict.id,
      },
      data: {
        status,
      },
    })

    return NextResponse.json({
      conflict: {
        id: updated.id,
        status: updated.status,
        updatedAt: updated.updatedAt,
      },
    })
  } catch (error) {
    console.error("Update identity conflict failed:", error)
    return NextResponse.json({ error: "更新冲突状态失败" }, { status: 500 })
  }
}
