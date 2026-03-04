import { SlaAlertStatus } from "@prisma/client"
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"

import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import {
  buildFaultInjectionSample,
  evaluateSlaWindow,
  normalizeSlaFaultScenario,
  resolveSlaAlertDelta,
  resolveSlaPolicy,
} from "@/lib/sla-monitoring"
import { getUserEntitlementSnapshot } from "@/lib/subscription-entitlements"

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 })
  }

  try {
    const body = await request.json().catch(() => ({}))
    const entitlement = await getUserEntitlementSnapshot(session.user.id)
    const policy = resolveSlaPolicy(entitlement.plan.id)
    const scenario = normalizeSlaFaultScenario(body.scenario)
    const injected = buildFaultInjectionSample(scenario)
    const now = new Date()
    const windowStart = new Date(now.getTime() - policy.reportWindowHours * 60 * 60 * 1000)

    const metrics = evaluateSlaWindow({
      policy,
      totalChecks: injected.totalChecks,
      failedChecks: injected.failedChecks,
      latenciesMs: injected.latenciesMs,
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
          source: "fault_injection",
          scenario,
          note: injected.note,
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
              summary: `[Fault] ${breach.summary}`,
              triggeredAt: now,
              metadata: {
                source: "fault_injection",
                scenario,
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
      scenario,
      note: injected.note,
      metrics,
      snapshot,
      alerts: {
        triggered: triggeredAlerts.length,
        recovered: recoveredCount,
      },
    })
  } catch (error) {
    console.error("Inject SLA fault failed:", error)
    return NextResponse.json({ error: "故障注入执行失败" }, { status: 500 })
  }
}
