import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"

import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import {
  buildOpsAnalyticsSeed,
  buildOpsCohortComparison,
  buildOpsFunnelSummary,
  resolveOpsFunnelConsistency,
  sanitizeOpsAnalyticsInput,
} from "@/lib/ops-analytics"
import { recordPromptAuditLog } from "@/lib/prompt-audit-log"
import { getUserEntitlementSnapshot, hasOpsAnalyticsAccess } from "@/lib/subscription-entitlements"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 })
  }

  const snapshot = await getUserEntitlementSnapshot(session.user.id)
  if (!hasOpsAnalyticsAccess(snapshot.plan.id)) {
    return NextResponse.json(
      {
        error: "运营漏斗与留存分析仅对 Pro / Team / Enterprise 套餐开放",
        upgradeRequired: true,
      },
      { status: 403 }
    )
  }

  const count = await prisma.opsAnalyticsSnapshot.count({
    where: {
      userId: session.user.id,
    },
  })

  if (count === 0) {
    await prisma.opsAnalyticsSnapshot.createMany({
      data: buildOpsAnalyticsSeed(session.user.id),
    })
  }

  const [snapshots, experiments] = await Promise.all([
    prisma.opsAnalyticsSnapshot.findMany({
      where: {
        userId: session.user.id,
      },
      orderBy: [{ windowEnd: "desc" }],
      take: 240,
    }),
    prisma.growthExperiment.findMany({
      where: {
        userId: session.user.id,
      },
      select: {
        id: true,
        name: true,
        status: true,
      },
      orderBy: [{ updatedAt: "desc" }],
      take: 30,
    }),
  ])

  const funnel = buildOpsFunnelSummary(snapshots)
  const cohorts = buildOpsCohortComparison(snapshots)
  const consistency = resolveOpsFunnelConsistency(snapshots)

  return NextResponse.json({
    snapshots,
    experiments,
    funnel,
    cohorts,
    consistency,
  })
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 })
  }

  const snapshot = await getUserEntitlementSnapshot(session.user.id)
  if (!hasOpsAnalyticsAccess(snapshot.plan.id)) {
    return NextResponse.json(
      {
        error: "运营漏斗与留存分析仅对 Pro / Team / Enterprise 套餐开放",
        upgradeRequired: true,
      },
      { status: 403 }
    )
  }

  try {
    const body = await request.json().catch(() => ({}))
    const sanitized = sanitizeOpsAnalyticsInput(body)

    if (!sanitized.cohortKey || !sanitized.traceToken) {
      return NextResponse.json({ error: "cohortKey 与 traceToken 不能为空" }, { status: 400 })
    }

    const created = await prisma.opsAnalyticsSnapshot.create({
      data: {
        userId: session.user.id,
        cohortKey: sanitized.cohortKey,
        metricType: sanitized.metricType,
        stage: sanitized.stage,
        windowStart: sanitized.windowStart,
        windowEnd: sanitized.windowEnd,
        activatedUsers: sanitized.activatedUsers,
        retainedUsers: sanitized.retainedUsers,
        revisitUsers: sanitized.revisitUsers,
        conversionUsers: sanitized.conversionUsers,
        experimentId: sanitized.experimentId || null,
        traceToken: sanitized.traceToken,
      },
    })

    await recordPromptAuditLog({
      actorId: session.user.id,
      action: "ops.analytics.snapshot.create",
      resource: "ops-analytics",
      request,
      metadata: {
        snapshotId: created.id,
        cohortKey: created.cohortKey,
        traceToken: created.traceToken,
        experimentId: created.experimentId,
      },
    })

    return NextResponse.json({ snapshot: created }, { status: 201 })
  } catch (error) {
    console.error("Create ops analytics snapshot failed:", error)
    return NextResponse.json({ error: "保存运营漏斗快照失败" }, { status: 500 })
  }
}
