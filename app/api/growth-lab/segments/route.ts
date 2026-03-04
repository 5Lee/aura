import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"

import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import {
  DEFAULT_GROWTH_AUDIENCE_SEGMENTS,
  buildGrowthAudienceSegmentSeed,
  sanitizeGrowthAudienceSegmentInput,
} from "@/lib/growth-segmentation"
import { recordPromptAuditLog } from "@/lib/prompt-audit-log"
import { sanitizeTextInput } from "@/lib/security"
import { getUserEntitlementSnapshot, hasGrowthLabAccess } from "@/lib/subscription-entitlements"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 })
  }

  const snapshot = await getUserEntitlementSnapshot(session.user.id)
  if (!hasGrowthLabAccess(snapshot.plan.id)) {
    return NextResponse.json(
      {
        error: "增长实验中心仅对 Pro / Team / Enterprise 套餐开放",
        upgradeRequired: true,
      },
      { status: 403 }
    )
  }

  const count = await prisma.growthAudienceSegment.count({
    where: {
      userId: session.user.id,
    },
  })

  if (count === 0) {
    await prisma.growthAudienceSegment.createMany({
      data: buildGrowthAudienceSegmentSeed(session.user.id),
    })
  }

  const segments = await prisma.growthAudienceSegment.findMany({
    where: {
      userId: session.user.id,
    },
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
    take: 80,
  })

  return NextResponse.json({ segments })
}

export async function PUT(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 })
  }

  const snapshot = await getUserEntitlementSnapshot(session.user.id)
  if (!hasGrowthLabAccess(snapshot.plan.id)) {
    return NextResponse.json(
      {
        error: "增长实验中心仅对 Pro / Team / Enterprise 套餐开放",
        upgradeRequired: true,
      },
      { status: 403 }
    )
  }

  try {
    const body = await request.json().catch(() => ({}))
    const segmentId = sanitizeTextInput(body.id, 80)

    const current = segmentId
      ? await prisma.growthAudienceSegment.findFirst({
          where: {
            id: segmentId,
            userId: session.user.id,
          },
        })
      : null

    const fallback = current
      ? {
          name: current.name,
          key: current.key,
          description: current.description || DEFAULT_GROWTH_AUDIENCE_SEGMENTS[0].description,
          matchMode: current.matchMode,
          ruleConfig: {
            logic: current.matchMode,
            rules:
              current.ruleConfig && typeof current.ruleConfig === "object" && !Array.isArray(current.ruleConfig)
                ? ((current.ruleConfig as Record<string, unknown>).rules as Array<{
                    field: string
                    operator: string
                    value: string | number
                  }> | undefined) || DEFAULT_GROWTH_AUDIENCE_SEGMENTS[0].ruleConfig.rules
                : DEFAULT_GROWTH_AUDIENCE_SEGMENTS[0].ruleConfig.rules,
          },
          estimatedUsers: current.estimatedUsers,
        }
      : DEFAULT_GROWTH_AUDIENCE_SEGMENTS[0]

    const sanitized = sanitizeGrowthAudienceSegmentInput(body, fallback)

    const existingKeySegment = await prisma.growthAudienceSegment.findFirst({
      where: {
        userId: session.user.id,
        key: sanitized.key,
        NOT: current ? { id: current.id } : undefined,
      },
      select: {
        id: true,
      },
    })

    if (existingKeySegment) {
      return NextResponse.json({ error: "分群 Key 已存在，请更换" }, { status: 400 })
    }

    const segment = await prisma.growthAudienceSegment.upsert({
      where: {
        id: current?.id || "__create_growth_segment__",
      },
      create: {
        userId: session.user.id,
        name: sanitized.name,
        key: sanitized.key,
        description: sanitized.description,
        status: sanitized.status,
        matchMode: sanitized.matchMode,
        ruleConfig: sanitized.ruleConfig,
        estimatedUsers: sanitized.estimatedUsers,
        lastMatchedAt: new Date(),
      },
      update: {
        name: sanitized.name,
        key: sanitized.key,
        description: sanitized.description,
        status: sanitized.status,
        matchMode: sanitized.matchMode,
        ruleConfig: sanitized.ruleConfig,
        estimatedUsers: sanitized.estimatedUsers,
        version: {
          increment: 1,
        },
        lastMatchedAt: new Date(),
      },
    })

    await recordPromptAuditLog({
      actorId: session.user.id,
      action: "growth.segment.upsert",
      resource: "growth-lab",
      request,
      metadata: {
        segmentId: segment.id,
        key: segment.key,
        status: segment.status,
      },
    })

    return NextResponse.json({ segment })
  } catch (error) {
    console.error("Save growth segment failed:", error)
    return NextResponse.json({ error: "保存用户分群失败" }, { status: 500 })
  }
}
