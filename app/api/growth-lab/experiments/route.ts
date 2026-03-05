import { GrowthExperimentStatus } from "@prisma/client"
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"

import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import {
  buildGrowthAttributionAggregate,
  resolveGrowthAttributionConsistency,
} from "@/lib/growth-attribution"
import {
  buildGrowthExperimentSeed,
  resolveGrowthScheduleWindow,
  resolveGrowthSnapshotMetrics,
  sanitizeGrowthExperimentInput,
} from "@/lib/growth-lab"
import { recordPromptAuditLog } from "@/lib/prompt-audit-log"
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

  const count = await prisma.growthExperiment.count({
    where: {
      userId: session.user.id,
    },
  })

  if (count === 0) {
    await prisma.growthExperiment.createMany({
      data: buildGrowthExperimentSeed(session.user.id),
    })
  }

  const [experiments, snapshots, segments, audiences, attributionSnapshots, alerts] = await Promise.all([
    prisma.growthExperiment.findMany({
      where: {
        userId: session.user.id,
      },
      orderBy: [{ updatedAt: "desc" }],
      take: 80,
    }),
    prisma.growthMetricSnapshot.findMany({
      where: {
        userId: session.user.id,
      },
      orderBy: [{ windowEnd: "desc" }],
      take: 300,
    }),
    prisma.growthAudienceSegment.findMany({
      where: {
        userId: session.user.id,
      },
      orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
      take: 80,
    }),
    prisma.growthExperimentAudience.findMany({
      where: {
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
      take: 160,
    }),
    prisma.growthAttributionSnapshot.findMany({
      where: {
        userId: session.user.id,
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
      orderBy: [{ windowEnd: "desc" }],
      take: 240,
    }),
    prisma.growthExperimentAlert.findMany({
      where: {
        userId: session.user.id,
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
      orderBy: [{ triggeredAt: "desc" }],
      take: 200,
    }),
  ])

  const summary = snapshots.reduce(
    (acc, item) => {
      acc.totalExposures += item.exposures
      acc.totalConversions += item.conversions
      acc.totalRetainedUsers += item.retainedUsers
      acc.totalRevenueCents += item.revenueCents
      return acc
    },
    {
      totalExposures: 0,
      totalConversions: 0,
      totalRetainedUsers: 0,
      totalRevenueCents: 0,
    }
  )

  const averageBaselineMetric =
    experiments.length === 0
      ? 0
      : Number(
          (experiments.reduce((acc, item) => acc + item.baselineMetric, 0) / experiments.length).toFixed(2)
        )

  const averageTargetMetric =
    experiments.length === 0
      ? 0
      : Number((experiments.reduce((acc, item) => acc + item.targetMetric, 0) / experiments.length).toFixed(2))

  const conversion = resolveGrowthSnapshotMetrics({
    baselineMetric: averageBaselineMetric,
    targetMetric: averageTargetMetric,
    exposures: summary.totalExposures,
    conversions: summary.totalConversions,
  })

  const attributionAggregate = buildGrowthAttributionAggregate(attributionSnapshots)
  const attributionConsistency = resolveGrowthAttributionConsistency({
    attributionRows: attributionSnapshots,
    metricRows: snapshots,
  })

  return NextResponse.json({
    experiments,
    snapshots,
    segments,
    audiences,
    attributionSnapshots,
    attributionAggregate,
    attributionConsistency,
    alerts,
    summary: {
      ...summary,
      ...conversion,
    },
  })
}

export async function POST(request: Request) {
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
    const sanitized = sanitizeGrowthExperimentInput(body)

    if (!sanitized.name || !sanitized.hypothesis || !sanitized.segmentKey) {
      return NextResponse.json({ error: "请填写实验名称、假设与受众分群" }, { status: 400 })
    }

    const schedule = resolveGrowthScheduleWindow(sanitized.startAt, sanitized.endAt, sanitized.startAt)
    if (schedule.reason === "invalid-window") {
      return NextResponse.json({ error: "实验时间窗口不合法" }, { status: 400 })
    }

    const shouldStart = body.startNow === true
    const nextStatus = shouldStart ? GrowthExperimentStatus.RUNNING : GrowthExperimentStatus.DRAFT

    const experiment = await prisma.growthExperiment.create({
      data: {
        userId: session.user.id,
        name: sanitized.name,
        hypothesis: sanitized.hypothesis,
        segmentKey: sanitized.segmentKey,
        status: nextStatus,
        baselineMetric: sanitized.baselineMetric,
        targetMetric: sanitized.targetMetric,
        liftTargetPercent: sanitized.liftTargetPercent,
        startAt: sanitized.startAt,
        endAt: sanitized.endAt,
        payload: {
          source: "manual",
        },
      },
    })

    await recordPromptAuditLog({
      actorId: session.user.id,
      action: "growth.experiment.create",
      resource: "growth-lab",
      request,
      metadata: {
        experimentId: experiment.id,
        status: experiment.status,
        segmentKey: experiment.segmentKey,
      },
    })

    return NextResponse.json({ experiment }, { status: 201 })
  } catch (error) {
    console.error("Create growth experiment failed:", error)
    return NextResponse.json({ error: "创建增长实验失败" }, { status: 500 })
  }
}
