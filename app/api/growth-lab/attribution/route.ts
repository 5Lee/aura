import { GrowthAttributionStatus } from "@prisma/client"
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"

import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import {
  buildGrowthAttributionAggregate,
  buildGrowthAttributionSeed,
  detectGrowthAttributionAnomaly,
  normalizeGrowthAttributionChannel,
  normalizeGrowthAttributionStatus,
  resolveGrowthAttributionConsistency,
  resolveGrowthAttributionMetrics,
  sanitizeGrowthAttributionInput,
} from "@/lib/growth-attribution"
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

export async function GET(request: Request) {
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

  const { searchParams } = new URL(request.url)
  const experimentId = sanitizeTextInput(searchParams.get("experimentId"), 80)
  const channel = normalizeGrowthAttributionChannel(searchParams.get("channel"))
  const channelFilter = searchParams.get("channel") ? channel : ""
  const windowDays = resolvePositiveInt(searchParams.get("windowDays"), 30, 1, 120)
  const windowStart = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000)

  const baseWhere: Record<string, unknown> = {
    userId: session.user.id,
    windowEnd: {
      gte: windowStart,
    },
    ...(experimentId ? { experimentId } : {}),
    ...(channelFilter ? { channel: channelFilter } : {}),
  }

  const count = await prisma.growthAttributionSnapshot.count({
    where: {
      userId: session.user.id,
    },
  })

  if (count === 0) {
    const experiments = await prisma.growthExperiment.findMany({
      where: {
        userId: session.user.id,
      },
      select: {
        id: true,
        startAt: true,
        endAt: true,
      },
      orderBy: [{ createdAt: "asc" }],
      take: 6,
    })

    if (experiments.length > 0) {
      await prisma.growthAttributionSnapshot.createMany({
        data: buildGrowthAttributionSeed(session.user.id, experiments),
      })
    }
  }

  const [snapshots, metricRows] = await Promise.all([
    prisma.growthAttributionSnapshot.findMany({
      where: baseWhere,
      include: {
        experiment: {
          select: {
            id: true,
            name: true,
            status: true,
          },
        },
      },
      orderBy: [{ windowEnd: "desc" }],
      take: 240,
    }),
    prisma.growthMetricSnapshot.findMany({
      where: {
        userId: session.user.id,
        windowEnd: {
          gte: windowStart,
        },
        ...(experimentId ? { experimentId } : {}),
      },
      select: {
        experimentId: true,
        exposures: true,
        conversions: true,
      },
      orderBy: [{ windowEnd: "desc" }],
      take: 400,
    }),
  ])

  const aggregate = buildGrowthAttributionAggregate(snapshots)
  const anomalies = snapshots.filter((item) => item.status === GrowthAttributionStatus.ANOMALY)
  const consistency = resolveGrowthAttributionConsistency({
    attributionRows: snapshots,
    metricRows,
  })

  return NextResponse.json({
    snapshots,
    aggregate,
    anomalies,
    consistency,
  })
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
    const sanitized = sanitizeGrowthAttributionInput(body)

    if (!sanitized.experimentId) {
      return NextResponse.json({ error: "请选择实验" }, { status: 400 })
    }

    const experiment = await prisma.growthExperiment.findFirst({
      where: {
        id: sanitized.experimentId,
        userId: session.user.id,
      },
      select: {
        id: true,
        name: true,
      },
    })

    if (!experiment) {
      return NextResponse.json({ error: "实验不存在" }, { status: 404 })
    }

    const metrics = resolveGrowthAttributionMetrics({
      exposures: sanitized.exposures,
      clicks: sanitized.clicks,
      conversions: sanitized.conversions,
      costCents: sanitized.costCents,
    })

    const anomaly = detectGrowthAttributionAnomaly({
      exposures: sanitized.exposures,
      clicks: sanitized.clicks,
      conversions: sanitized.conversions,
      costCents: sanitized.costCents,
      conversionRate: metrics.conversionRate,
    })

    const attribution = await prisma.growthAttributionSnapshot.upsert({
      where: {
        experimentId_channel_windowStart_windowEnd: {
          experimentId: sanitized.experimentId,
          channel: sanitized.channel,
          windowStart: sanitized.windowStart,
          windowEnd: sanitized.windowEnd,
        },
      },
      create: {
        userId: session.user.id,
        experimentId: sanitized.experimentId,
        channel: sanitized.channel,
        windowStart: sanitized.windowStart,
        windowEnd: sanitized.windowEnd,
        exposures: sanitized.exposures,
        clicks: sanitized.clicks,
        conversions: sanitized.conversions,
        costCents: sanitized.costCents,
        revenueCents: sanitized.revenueCents,
        ctr: metrics.ctr,
        conversionRate: metrics.conversionRate,
        anomalyReason: anomaly.reason,
        anomalyScore: anomaly.score,
        status: anomaly.hasAnomaly ? GrowthAttributionStatus.ANOMALY : GrowthAttributionStatus.NORMAL,
        correctionTag: sanitized.correctionTag || undefined,
        metadata: {
          source: "manual",
          costPerAcquisition: metrics.costPerAcquisition,
        },
      },
      update: {
        exposures: sanitized.exposures,
        clicks: sanitized.clicks,
        conversions: sanitized.conversions,
        costCents: sanitized.costCents,
        revenueCents: sanitized.revenueCents,
        ctr: metrics.ctr,
        conversionRate: metrics.conversionRate,
        anomalyReason: anomaly.reason,
        anomalyScore: anomaly.score,
        status: anomaly.hasAnomaly ? GrowthAttributionStatus.ANOMALY : GrowthAttributionStatus.NORMAL,
        correctionTag: sanitized.correctionTag || undefined,
        correctedAt: anomaly.hasAnomaly ? null : undefined,
        metadata: {
          source: "manual",
          costPerAcquisition: metrics.costPerAcquisition,
        },
      },
      include: {
        experiment: {
          select: {
            id: true,
            name: true,
            status: true,
          },
        },
      },
    })

    await recordPromptAuditLog({
      actorId: session.user.id,
      action: "growth.attribution.upsert",
      resource: "growth-lab",
      request,
      metadata: {
        attributionId: attribution.id,
        experimentId: attribution.experimentId,
        channel: attribution.channel,
        status: attribution.status,
      },
    })

    return NextResponse.json({
      attribution,
      anomaly,
      metrics,
    })
  } catch (error) {
    console.error("Save growth attribution snapshot failed:", error)
    return NextResponse.json({ error: "保存归因快照失败" }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
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
    const id = sanitizeTextInput(body.id, 80)
    if (!id) {
      return NextResponse.json({ error: "归因快照 id 不能为空" }, { status: 400 })
    }

    const record = await prisma.growthAttributionSnapshot.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
    })

    if (!record) {
      return NextResponse.json({ error: "归因快照不存在" }, { status: 404 })
    }

    const nextStatus = normalizeGrowthAttributionStatus(body.status)
    const correctionTag = sanitizeTextInput(body.correctionTag, 120)

    const updated = await prisma.growthAttributionSnapshot.update({
      where: {
        id: record.id,
      },
      data: {
        status: nextStatus,
        correctionTag: correctionTag || null,
        correctedAt:
          nextStatus === GrowthAttributionStatus.CORRECTED || nextStatus === GrowthAttributionStatus.NORMAL
            ? new Date()
            : null,
      },
      include: {
        experiment: {
          select: {
            id: true,
            name: true,
            status: true,
          },
        },
      },
    })

    await recordPromptAuditLog({
      actorId: session.user.id,
      action: "growth.attribution.correct",
      resource: "growth-lab",
      request,
      metadata: {
        attributionId: updated.id,
        status: updated.status,
        correctionTag: updated.correctionTag,
      },
    })

    return NextResponse.json({ attribution: updated })
  } catch (error) {
    console.error("Mark growth attribution correction failed:", error)
    return NextResponse.json({ error: "归因纠偏标记失败" }, { status: 500 })
  }
}
