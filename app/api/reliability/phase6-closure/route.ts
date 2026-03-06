import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"

import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { PhaseClosureStatus } from "@prisma/client"

import {
  canTransitionPhaseClosureStatus,
  resolvePhase6ClosureScore,
  resolvePhase6FreezeTimestamp,
  sanitizePhaseClosureInput,
} from "@/lib/phase6-closure"
import { recordPromptAuditLog } from "@/lib/prompt-audit-log"
import { getUserEntitlementSnapshot, hasPhase6ClosureAccess } from "@/lib/subscription-entitlements"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 })
  }

  const snapshot = await getUserEntitlementSnapshot(session.user.id)
  if (!hasPhase6ClosureAccess(snapshot.plan.id)) {
    return NextResponse.json(
      {
        error: "Phase6 终验与运营化交付仅对 Pro / Team / Enterprise 套餐开放",
        upgradeRequired: true,
      },
      { status: 403 }
    )
  }

  const report =
    (await prisma.phase6ClosureReport.findFirst({
      where: {
        userId: session.user.id,
      },
      orderBy: {
        updatedAt: "desc",
      },
    })) ||
    (await prisma.phase6ClosureReport.create({
      data: {
        userId: session.user.id,
      },
    }))

  const score = resolvePhase6ClosureScore({
    functionalGatePassed: report.functionalGatePassed,
    performanceGatePassed: report.performanceGatePassed,
    securityGatePassed: report.securityGatePassed,
    runbookUrl: report.runbookUrl || "",
    emergencyPlanUrl: report.emergencyPlanUrl || "",
    trainingMaterialUrl: report.trainingMaterialUrl || "",
  })

  return NextResponse.json({ report, score })
}

export async function PUT(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 })
  }

  const snapshot = await getUserEntitlementSnapshot(session.user.id)
  if (!hasPhase6ClosureAccess(snapshot.plan.id)) {
    return NextResponse.json(
      {
        error: "Phase6 终验与运营化交付仅对 Pro / Team / Enterprise 套餐开放",
        upgradeRequired: true,
      },
      { status: 403 }
    )
  }

  try {
    const body = await request.json().catch(() => ({}))
    const sanitized = sanitizePhaseClosureInput(body)

    const current = await prisma.phase6ClosureReport.findFirst({
      where: {
        userId: session.user.id,
      },
      orderBy: {
        updatedAt: "desc",
      },
    })

    const nextScore = resolvePhase6ClosureScore({
      functionalGatePassed: sanitized.functionalGatePassed,
      performanceGatePassed: sanitized.performanceGatePassed,
      securityGatePassed: sanitized.securityGatePassed,
      runbookUrl: sanitized.runbookUrl || "",
      emergencyPlanUrl: sanitized.emergencyPlanUrl || "",
      trainingMaterialUrl: sanitized.trainingMaterialUrl || "",
    })
    const currentStatus = current?.status || PhaseClosureStatus.DRAFT

    if (!canTransitionPhaseClosureStatus(currentStatus, sanitized.status, nextScore.readyToFreeze)) {
      return NextResponse.json({ error: "不允许的 Phase6 终验状态流转" }, { status: 400 })
    }

    if (sanitized.status === PhaseClosureStatus.FROZEN && !sanitized.baselineTag) {
      return NextResponse.json({ error: "冻结基线前请填写基线标记" }, { status: 400 })
    }

    const report = await prisma.phase6ClosureReport.upsert({
      where: {
        id: current?.id || "__create_phase6_closure__",
      },
      create: {
        userId: session.user.id,
        ...sanitized,
        frozenAt: resolvePhase6FreezeTimestamp(sanitized.status, null),
      },
      update: {
        ...sanitized,
        frozenAt: resolvePhase6FreezeTimestamp(sanitized.status, current?.frozenAt || null),
      },
    })

    const score = resolvePhase6ClosureScore({
      functionalGatePassed: report.functionalGatePassed,
      performanceGatePassed: report.performanceGatePassed,
      securityGatePassed: report.securityGatePassed,
      runbookUrl: report.runbookUrl || "",
      emergencyPlanUrl: report.emergencyPlanUrl || "",
      trainingMaterialUrl: report.trainingMaterialUrl || "",
    })

    await recordPromptAuditLog({
      actorId: session.user.id,
      action: "phase6.closure.update",
      resource: "phase6-closure",
      request,
      metadata: {
        reportId: report.id,
        fromStatus: currentStatus,
        status: report.status,
        readinessPercent: score.percent,
        readyToFreeze: score.readyToFreeze,
      },
    })

    return NextResponse.json({ report, score })
  } catch (error) {
    console.error("Update phase6 closure report failed:", error)
    return NextResponse.json({ error: "更新 Phase6 终验报告失败" }, { status: 500 })
  }
}
