import { SlaAlertStatus } from "@prisma/client"
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"

import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import {
  evaluateSlaWindow,
  resolveSlaAlertDelta,
  resolveSlaPolicy,
} from "@/lib/sla-monitoring"
import { getUserEntitlementSnapshot } from "@/lib/subscription-entitlements"

function resolveWindowHours(value: string | null, fallback: number) {
  const parsed = Number(value || "")
  if (!Number.isFinite(parsed)) {
    return fallback
  }
  const normalized = Math.floor(parsed)
  if (normalized < 1) {
    return 1
  }
  if (normalized > 24 * 30) {
    return 24 * 30
  }
  return normalized
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 })
  }

  try {
    const entitlement = await getUserEntitlementSnapshot(session.user.id)
    const policy = resolveSlaPolicy(entitlement.plan.id)
    const { searchParams } = new URL(request.url)
    const windowHours = resolveWindowHours(searchParams.get("windowHours"), policy.reportWindowHours)
    const windowStart = new Date(Date.now() - windowHours * 60 * 60 * 1000)
    const now = new Date()

    const evalRuns = await prisma.promptEvalRun.findMany({
      where: {
        triggeredById: session.user.id,
        createdAt: {
          gte: windowStart,
        },
      },
      select: {
        id: true,
        status: true,
        totalCases: true,
        failedCases: true,
        averageLatencyMs: true,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 500,
    })

    const totalChecks = evalRuns.reduce((sum, run) => {
      if (run.totalCases > 0) {
        return sum + run.totalCases
      }
      return sum + 1
    }, 0)

    const failedChecks = evalRuns.reduce((sum, run) => {
      if (run.failedCases > 0) {
        return sum + run.failedCases
      }
      if (run.status === "FAILED") {
        return sum + 1
      }
      return sum
    }, 0)

    const latenciesMs = evalRuns
      .map((run) => run.averageLatencyMs)
      .filter((value) => Number.isFinite(value) && value > 0)

    const metrics = evaluateSlaWindow({
      policy,
      totalChecks,
      failedChecks,
      latenciesMs,
    })

    const snapshot = await prisma.slaSnapshot.create({
      data: {
        userId: session.user.id,
        planId: entitlement.plan.id,
        windowStart,
        windowEnd: now,
        availabilityRate: metrics.availabilityRate,
        errorRate: metrics.errorRate,
        latencyP95Ms: metrics.latencyP95Ms,
        totalChecks: metrics.totalChecks,
        failedChecks: metrics.failedChecks,
        metadata: {
          source: "runtime",
          evalRunCount: evalRuns.length,
          windowHours,
        },
      },
    })

    const openAlerts = await prisma.slaAlert.findMany({
      where: {
        userId: session.user.id,
        status: SlaAlertStatus.OPEN,
      },
      select: {
        id: true,
        metric: true,
      },
    })

    const delta = resolveSlaAlertDelta({
      openAlerts,
      breaches: metrics.breaches,
    })

    const [triggeredAlerts, recoveredCount] = await prisma.$transaction(async (tx) => {
      const created = await Promise.all(
        delta.createAlerts.map((breach) =>
          tx.slaAlert.create({
            data: {
              userId: session.user.id,
              metric: breach.metric,
              status: SlaAlertStatus.OPEN,
              threshold: breach.threshold,
              observed: breach.observed,
              summary: breach.summary,
              triggeredAt: now,
              metadata: {
                source: "runtime",
                windowHours,
              },
            },
          })
        )
      )

      let recovered = 0
      if (delta.recoverAlertIds.length > 0) {
        const updated = await tx.slaAlert.updateMany({
          where: {
            id: {
              in: delta.recoverAlertIds,
            },
            status: SlaAlertStatus.OPEN,
          },
          data: {
            status: SlaAlertStatus.RECOVERED,
            recoveredAt: now,
          },
        })
        recovered = updated.count
      }

      return [created, recovered] as const
    })

    return NextResponse.json({
      plan: entitlement.plan.id,
      policy,
      window: {
        start: windowStart.toISOString(),
        end: now.toISOString(),
        hours: windowHours,
      },
      metrics: {
        ...metrics,
        breaches: metrics.breaches,
      },
      snapshot,
      alerts: {
        triggered: triggeredAlerts.length,
        recovered: recoveredCount,
      },
    })
  } catch (error) {
    console.error("Build SLA report failed:", error)
    return NextResponse.json({ error: "生成 SLA 报表失败" }, { status: 500 })
  }
}
