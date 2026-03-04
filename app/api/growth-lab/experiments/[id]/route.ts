import { GrowthExperimentStatus } from "@prisma/client"
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"

import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import {
  normalizeGrowthExperimentStatus,
  resolveGrowthScheduleWindow,
  resolveGrowthSnapshotInput,
  resolveGrowthSnapshotMetrics,
} from "@/lib/growth-lab"
import { recordPromptAuditLog } from "@/lib/prompt-audit-log"
import { getUserEntitlementSnapshot, hasGrowthLabAccess } from "@/lib/subscription-entitlements"

function isStatusTransitionAllowed(from: GrowthExperimentStatus, to: GrowthExperimentStatus) {
  if (from === to) {
    return true
  }

  const matrix: Record<GrowthExperimentStatus, GrowthExperimentStatus[]> = {
    [GrowthExperimentStatus.DRAFT]: [GrowthExperimentStatus.RUNNING, GrowthExperimentStatus.ARCHIVED],
    [GrowthExperimentStatus.RUNNING]: [
      GrowthExperimentStatus.PAUSED,
      GrowthExperimentStatus.COMPLETED,
      GrowthExperimentStatus.ARCHIVED,
    ],
    [GrowthExperimentStatus.PAUSED]: [
      GrowthExperimentStatus.RUNNING,
      GrowthExperimentStatus.COMPLETED,
      GrowthExperimentStatus.ARCHIVED,
    ],
    [GrowthExperimentStatus.COMPLETED]: [GrowthExperimentStatus.ARCHIVED],
    [GrowthExperimentStatus.ARCHIVED]: [],
  }

  return matrix[from].includes(to)
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

    const nextStatus = body.status ? normalizeGrowthExperimentStatus(body.status) : experiment.status
    if (!isStatusTransitionAllowed(experiment.status, nextStatus)) {
      return NextResponse.json({ error: "不允许的实验状态流转" }, { status: 400 })
    }

    if (nextStatus === GrowthExperimentStatus.RUNNING) {
      const schedule = resolveGrowthScheduleWindow(experiment.startAt, experiment.endAt)
      if (!schedule.active) {
        return NextResponse.json({ error: "当前不在实验运行时段" }, { status: 400 })
      }
    }

    const metricsInputProvided =
      body.exposures !== undefined ||
      body.conversions !== undefined ||
      body.retainedUsers !== undefined ||
      body.revenueCents !== undefined ||
      body.metricType !== undefined

    let finalStatus = nextStatus
    if (experiment.endAt.getTime() < Date.now() && nextStatus === GrowthExperimentStatus.RUNNING) {
      finalStatus = GrowthExperimentStatus.COMPLETED
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (metricsInputProvided) {
        const metrics = resolveGrowthSnapshotInput(body)
        const conversion = resolveGrowthSnapshotMetrics({
          baselineMetric: experiment.baselineMetric,
          targetMetric: experiment.targetMetric,
          exposures: metrics.exposures,
          conversions: metrics.conversions,
        })

        await tx.growthMetricSnapshot.create({
          data: {
            userId: session.user.id,
            experimentId: experiment.id,
            metricType: metrics.metricType,
            windowStart: metrics.windowStart,
            windowEnd: metrics.windowEnd,
            exposures: metrics.exposures,
            conversions: metrics.conversions,
            retainedUsers: metrics.retainedUsers,
            revenueCents: metrics.revenueCents,
            conversionRate: conversion.conversionRate,
            liftPercent: conversion.liftPercent,
            metadata: {
              targetGap: conversion.targetGap,
            },
          },
        })
      }

      return tx.growthExperiment.update({
        where: {
          id: experiment.id,
        },
        data: {
          status: finalStatus,
        },
      })
    })

    await recordPromptAuditLog({
      actorId: session.user.id,
      action: "growth.experiment.update",
      resource: "growth-lab",
      request,
      metadata: {
        experimentId: updated.id,
        status: updated.status,
        metricsInputProvided,
      },
    })

    return NextResponse.json({ experiment: updated })
  } catch (error) {
    console.error("Update growth experiment failed:", error)
    return NextResponse.json({ error: "更新增长实验失败" }, { status: 500 })
  }
}
