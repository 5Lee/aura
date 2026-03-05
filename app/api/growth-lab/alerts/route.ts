import { GrowthAlertStatus } from "@prisma/client"
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"

import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import {
  buildGrowthAlertEvaluations,
  normalizeGrowthAlertStatus,
  resolveGrowthAlertAutoPause,
} from "@/lib/growth-alerting"
import { resolveGrowthScheduleWindow } from "@/lib/growth-lab"
import { recordPromptAuditLog } from "@/lib/prompt-audit-log"
import { sanitizeTextInput } from "@/lib/security"
import { getUserEntitlementSnapshot, hasGrowthLabAccess } from "@/lib/subscription-entitlements"

function resolveTake(value: unknown, fallback: number, min: number, max: number) {
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
  const statusText = sanitizeTextInput(searchParams.get("status"), 20).toUpperCase()
  const status = statusText ? normalizeGrowthAlertStatus(statusText) : null
  const take = resolveTake(searchParams.get("take"), 120, 10, 300)

  const alerts = await prisma.growthExperimentAlert.findMany({
    where: {
      userId: session.user.id,
      ...(status ? { status } : {}),
    },
    include: {
      experiment: {
        select: {
          id: true,
          name: true,
          status: true,
          segmentKey: true,
        },
      },
    },
    orderBy: [{ triggeredAt: "desc" }],
    take,
  })

  return NextResponse.json({
    alerts,
    summary: {
      open: alerts.filter((item) => item.status === GrowthAlertStatus.OPEN).length,
      acknowledged: alerts.filter((item) => item.status === GrowthAlertStatus.ACKNOWLEDGED).length,
      resolved: alerts.filter((item) => item.status === GrowthAlertStatus.RESOLVED).length,
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
    const experimentId = sanitizeTextInput(body.experimentId, 80)

    const experiments = await prisma.growthExperiment.findMany({
      where: {
        userId: session.user.id,
        ...(experimentId ? { id: experimentId } : {}),
      },
      select: {
        id: true,
        name: true,
        status: true,
        baselineMetric: true,
        startAt: true,
        endAt: true,
      },
      orderBy: [{ updatedAt: "desc" }],
      take: 80,
    })

    if (experiments.length === 0) {
      return NextResponse.json({ error: "未找到可评估实验" }, { status: 404 })
    }

    const createdOrUpdated: Array<{ id: string; type: string; autoPaused: boolean; experimentId: string }> = []
    const pausedExperimentIds: string[] = []

    for (const experiment of experiments) {
      const [latestSnapshot, latestAttribution] = await Promise.all([
        prisma.growthMetricSnapshot.findFirst({
          where: {
            userId: session.user.id,
            experimentId: experiment.id,
          },
          orderBy: [{ windowEnd: "desc" }],
          select: {
            exposures: true,
            conversionRate: true,
          },
        }),
        prisma.growthAttributionSnapshot.findFirst({
          where: {
            userId: session.user.id,
            experimentId: experiment.id,
          },
          orderBy: [{ windowEnd: "desc" }],
          select: {
            costCents: true,
            conversions: true,
          },
        }),
      ])

      const evaluations = buildGrowthAlertEvaluations({
        experiment,
        latestSnapshot,
        latestAttribution,
      })

      for (const evaluation of evaluations) {
        const shouldAutoPause = resolveGrowthAlertAutoPause(evaluation.type)

        const openAlert = await prisma.growthExperimentAlert.findFirst({
          where: {
            userId: session.user.id,
            experimentId: experiment.id,
            type: evaluation.type,
            status: {
              in: [GrowthAlertStatus.OPEN, GrowthAlertStatus.ACKNOWLEDGED],
            },
          },
          orderBy: [{ triggeredAt: "desc" }],
          select: {
            id: true,
          },
        })

        const alert = openAlert
          ? await prisma.growthExperimentAlert.update({
              where: {
                id: openAlert.id,
              },
              data: {
                status: GrowthAlertStatus.OPEN,
                severity: evaluation.severity,
                message: evaluation.message,
                triggerValue: evaluation.triggerValue,
                thresholdValue: evaluation.thresholdValue,
                autoPaused: shouldAutoPause,
                triggeredAt: new Date(),
                resolvedAt: null,
                metadata: {
                  score: evaluation.score,
                },
              },
            })
          : await prisma.growthExperimentAlert.create({
              data: {
                userId: session.user.id,
                experimentId: experiment.id,
                type: evaluation.type,
                status: GrowthAlertStatus.OPEN,
                severity: evaluation.severity,
                message: evaluation.message,
                triggerValue: evaluation.triggerValue,
                thresholdValue: evaluation.thresholdValue,
                autoPaused: shouldAutoPause,
                metadata: {
                  score: evaluation.score,
                },
              },
            })

        if (shouldAutoPause && experiment.status === "RUNNING") {
          await prisma.growthExperiment.update({
            where: {
              id: experiment.id,
            },
            data: {
              status: "PAUSED",
              payload: {
                latestCircuitBreaker: {
                  alertId: alert.id,
                  alertType: alert.type,
                  triggeredAt: new Date().toISOString(),
                },
              },
            },
          })

          if (!pausedExperimentIds.includes(experiment.id)) {
            pausedExperimentIds.push(experiment.id)
          }
        }

        createdOrUpdated.push({
          id: alert.id,
          type: alert.type,
          autoPaused: alert.autoPaused,
          experimentId: experiment.id,
        })
      }
    }

    await recordPromptAuditLog({
      actorId: session.user.id,
      action: "growth.alert.evaluate",
      resource: "growth-lab",
      request,
      metadata: {
        evaluatedExperiments: experiments.length,
        alertsCreatedOrUpdated: createdOrUpdated.length,
        pausedExperimentIds,
      },
    })

    return NextResponse.json({
      alerts: createdOrUpdated,
      evaluatedExperiments: experiments.length,
      pausedExperimentIds,
    })
  } catch (error) {
    console.error("Evaluate growth alerts failed:", error)
    return NextResponse.json({ error: "评估实验告警失败" }, { status: 500 })
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
      return NextResponse.json({ error: "告警 id 不能为空" }, { status: 400 })
    }

    const alert = await prisma.growthExperimentAlert.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
      include: {
        experiment: {
          select: {
            id: true,
            status: true,
            startAt: true,
            endAt: true,
          },
        },
      },
    })

    if (!alert) {
      return NextResponse.json({ error: "告警不存在" }, { status: 404 })
    }

    const nextStatus = normalizeGrowthAlertStatus(body.status)
    const resumeExperiment = body.resumeExperiment === true
    const responseMeta: Record<string, unknown> = {}

    if (resumeExperiment && nextStatus === GrowthAlertStatus.RESOLVED && alert.experiment.status === "PAUSED") {
      const schedule = resolveGrowthScheduleWindow(alert.experiment.startAt, alert.experiment.endAt)

      if (schedule.active) {
        await prisma.growthExperiment.update({
          where: {
            id: alert.experiment.id,
          },
          data: {
            status: "RUNNING",
          },
        })
        responseMeta.experimentResumed = true
      } else {
        responseMeta.experimentResumed = false
        responseMeta.resumeBlockedReason = schedule.reason
      }
    }

    const updated = await prisma.growthExperimentAlert.update({
      where: {
        id: alert.id,
      },
      data: {
        status: nextStatus,
        resolvedAt: nextStatus === GrowthAlertStatus.RESOLVED ? new Date() : null,
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
      action: "growth.alert.resolve",
      resource: "growth-lab",
      request,
      metadata: {
        alertId: updated.id,
        status: updated.status,
        resumeExperiment,
        ...responseMeta,
      },
    })

    return NextResponse.json({
      alert: updated,
      ...responseMeta,
    })
  } catch (error) {
    console.error("Update growth alert failed:", error)
    return NextResponse.json({ error: "更新告警状态失败" }, { status: 500 })
  }
}
