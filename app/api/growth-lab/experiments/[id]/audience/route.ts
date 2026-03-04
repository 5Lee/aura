import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"

import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import {
  resolveGrowthAudienceEstimate,
  sanitizeExcludedSegmentKeys,
} from "@/lib/growth-segmentation"
import { recordPromptAuditLog } from "@/lib/prompt-audit-log"
import { sanitizeTextInput } from "@/lib/security"
import { getUserEntitlementSnapshot, hasGrowthLabAccess } from "@/lib/subscription-entitlements"

function resolvePositiveInt(value: unknown, fallback: number, min: number, max: number) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    return fallback
  }

  const rounded = Math.floor(parsed)
  if (rounded < min) {
    return min
  }
  if (rounded > max) {
    return max
  }

  return rounded
}

export async function GET(_request: Request, { params }: { params: { id: string } }) {
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

  const [experiment, audiences] = await Promise.all([
    prisma.growthExperiment.findFirst({
      where: {
        id: params.id,
        userId: session.user.id,
      },
    }),
    prisma.growthExperimentAudience.findMany({
      where: {
        experimentId: params.id,
        userId: session.user.id,
      },
      include: {
        segment: {
          select: {
            id: true,
            name: true,
            key: true,
            estimatedUsers: true,
            status: true,
          },
        },
      },
      orderBy: [{ updatedAt: "desc" }],
      take: 40,
    }),
  ])

  if (!experiment) {
    return NextResponse.json({ error: "实验不存在" }, { status: 404 })
  }

  return NextResponse.json({ audiences })
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
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

    const experiment = await prisma.growthExperiment.findFirst({
      where: {
        id: params.id,
        userId: session.user.id,
      },
    })

    if (!experiment) {
      return NextResponse.json({ error: "实验不存在" }, { status: 404 })
    }

    const segmentId = sanitizeTextInput(body.segmentId, 80)
    if (!segmentId) {
      return NextResponse.json({ error: "请选择用户分群" }, { status: 400 })
    }

    const segment = await prisma.growthAudienceSegment.findFirst({
      where: {
        id: segmentId,
        userId: session.user.id,
      },
    })

    if (!segment) {
      return NextResponse.json({ error: "用户分群不存在" }, { status: 404 })
    }

    if (segment.status === "ARCHIVED") {
      return NextResponse.json({ error: "归档分群不可参与实验" }, { status: 400 })
    }

    const rolloutPercent = resolvePositiveInt(body.rolloutPercent, 100, 1, 100)
    const excludedSegmentKeys = sanitizeExcludedSegmentKeys(body.excludedSegmentKeys)
    const estimate = resolveGrowthAudienceEstimate({
      estimatedUsers: segment.estimatedUsers,
      rolloutPercent,
      excludedSegments: excludedSegmentKeys.length,
    })

    const audience = await prisma.growthExperimentAudience.upsert({
      where: {
        experimentId_segmentId: {
          experimentId: experiment.id,
          segmentId: segment.id,
        },
      },
      create: {
        userId: session.user.id,
        experimentId: experiment.id,
        segmentId: segment.id,
        rolloutPercent,
        excludedSegmentKeys,
        status: "ACTIVE",
      },
      update: {
        rolloutPercent,
        excludedSegmentKeys,
        status: "ACTIVE",
      },
      include: {
        segment: {
          select: {
            id: true,
            name: true,
            key: true,
            estimatedUsers: true,
            status: true,
          },
        },
      },
    })

    await prisma.growthExperiment.update({
      where: {
        id: experiment.id,
      },
      data: {
        segmentKey: segment.key,
        payload: {
          ...(experiment.payload && typeof experiment.payload === "object" && !Array.isArray(experiment.payload)
            ? (experiment.payload as Record<string, unknown>)
            : {}),
          audienceEstimate: estimate,
          latestAudienceSegment: segment.key,
        },
      },
    })

    await recordPromptAuditLog({
      actorId: session.user.id,
      action: "growth.audience.upsert",
      resource: "growth-lab",
      request,
      metadata: {
        experimentId: experiment.id,
        segmentId: segment.id,
        rolloutPercent,
        finalUsers: estimate.finalUsers,
      },
    })

    return NextResponse.json({
      audience,
      estimate,
    })
  } catch (error) {
    console.error("Update growth audience failed:", error)
    return NextResponse.json({ error: "更新实验受众失败" }, { status: 500 })
  }
}
