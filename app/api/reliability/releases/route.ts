import { ReleaseStageStatus } from "@prisma/client"
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"

import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import {
  buildReleasePlanSeed,
  resolveRollbackImpact,
  sanitizeReleasePlanInput,
} from "@/lib/release-orchestration"
import { recordPromptAuditLog } from "@/lib/prompt-audit-log"
import { sanitizeJsonValue, sanitizeMultilineTextInput, sanitizeTextInput } from "@/lib/security"
import { getUserEntitlementSnapshot, hasReleaseOrchestrationAccess } from "@/lib/subscription-entitlements"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 })
  }

  const snapshot = await getUserEntitlementSnapshot(session.user.id)
  if (!hasReleaseOrchestrationAccess(snapshot.plan.id)) {
    return NextResponse.json(
      {
        error: "发布演练与灰度回滚编排仅对 Pro / Team / Enterprise 套餐开放",
        upgradeRequired: true,
      },
      { status: 403 }
    )
  }

  const count = await prisma.releaseOrchestrationPlan.count({
    where: {
      userId: session.user.id,
    },
  })

  if (count === 0) {
    await prisma.releaseOrchestrationPlan.create({
      data: buildReleasePlanSeed(session.user.id),
    })
  }

  const [plans, rollbackEvents] = await Promise.all([
    prisma.releaseOrchestrationPlan.findMany({
      where: {
        userId: session.user.id,
      },
      orderBy: [{ updatedAt: "desc" }],
      take: 80,
    }),
    prisma.releaseRollbackEvent.findMany({
      where: {
        userId: session.user.id,
      },
      include: {
        plan: {
          select: {
            id: true,
            name: true,
            status: true,
            canaryTrafficPercent: true,
          },
        },
      },
      orderBy: [{ rollbackAt: "desc" }],
      take: 120,
    }),
  ])

  return NextResponse.json({ plans, rollbackEvents })
}

export async function PUT(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 })
  }

  const snapshot = await getUserEntitlementSnapshot(session.user.id)
  if (!hasReleaseOrchestrationAccess(snapshot.plan.id)) {
    return NextResponse.json(
      {
        error: "发布演练与灰度回滚编排仅对 Pro / Team / Enterprise 套餐开放",
        upgradeRequired: true,
      },
      { status: 403 }
    )
  }

  try {
    const body = await request.json().catch(() => ({}))
    const sanitized = sanitizeReleasePlanInput(body)

    if (!sanitized.name) {
      return NextResponse.json({ error: "发布计划名称不能为空" }, { status: 400 })
    }

    if (sanitized.releaseWindowStart.getTime() >= sanitized.releaseWindowEnd.getTime()) {
      return NextResponse.json({ error: "发布窗口时间不合法" }, { status: 400 })
    }

    const current = sanitized.id
      ? await prisma.releaseOrchestrationPlan.findFirst({
          where: {
            id: sanitized.id,
            userId: session.user.id,
          },
        })
      : null

    const plan = await prisma.releaseOrchestrationPlan.upsert({
      where: {
        id: current?.id || "__create_release_plan__",
      },
      create: {
        userId: session.user.id,
        name: sanitized.name,
        status: sanitized.status,
        releaseWindowStart: sanitized.releaseWindowStart,
        releaseWindowEnd: sanitized.releaseWindowEnd,
        canaryTrafficPercent: sanitized.canaryTrafficPercent,
        rollbackThresholdPercent: sanitized.rollbackThresholdPercent,
        checklist: sanitized.checklist,
        rehearsalScript: sanitized.rehearsalScript || null,
        impactSummary: sanitized.impactSummary || null,
      },
      update: {
        name: sanitized.name,
        status: sanitized.status,
        releaseWindowStart: sanitized.releaseWindowStart,
        releaseWindowEnd: sanitized.releaseWindowEnd,
        canaryTrafficPercent: sanitized.canaryTrafficPercent,
        rollbackThresholdPercent: sanitized.rollbackThresholdPercent,
        checklist: sanitized.checklist,
        rehearsalScript: sanitized.rehearsalScript || null,
        impactSummary: sanitized.impactSummary || null,
      },
    })

    await recordPromptAuditLog({
      actorId: session.user.id,
      action: "release.plan.upsert",
      resource: "release-orchestration",
      request,
      metadata: {
        planId: plan.id,
        status: plan.status,
        canaryTrafficPercent: plan.canaryTrafficPercent,
      },
    })

    return NextResponse.json({ plan })
  } catch (error) {
    console.error("Save release plan failed:", error)
    return NextResponse.json({ error: "保存发布编排计划失败" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 })
  }

  const snapshot = await getUserEntitlementSnapshot(session.user.id)
  if (!hasReleaseOrchestrationAccess(snapshot.plan.id)) {
    return NextResponse.json(
      {
        error: "发布演练与灰度回滚编排仅对 Pro / Team / Enterprise 套餐开放",
        upgradeRequired: true,
      },
      { status: 403 }
    )
  }

  try {
    const body = await request.json().catch(() => ({}))
    const planId = sanitizeTextInput(body.planId, 80)
    const reason = sanitizeMultilineTextInput(body.reason, 500).trim()
    const estimatedUsers = Number(body.estimatedUsers || 0)

    if (!planId || !reason) {
      return NextResponse.json({ error: "planId 与 reason 不能为空" }, { status: 400 })
    }

    const plan = await prisma.releaseOrchestrationPlan.findFirst({
      where: {
        id: planId,
        userId: session.user.id,
      },
    })

    if (!plan) {
      return NextResponse.json({ error: "发布计划不存在" }, { status: 404 })
    }

    const impact = resolveRollbackImpact({
      canaryTrafficPercent: plan.canaryTrafficPercent,
      estimatedUsers: Number.isFinite(estimatedUsers) ? estimatedUsers : 0,
    })

    const rollback = await prisma.$transaction(async (tx) => {
      const created = await tx.releaseRollbackEvent.create({
        data: {
          userId: session.user.id,
          planId: plan.id,
          reason,
          impactedServices:
            (sanitizeJsonValue(body.impactedServices, {
              maxDepth: 4,
              maxArrayLength: 20,
              maxKeysPerObject: 20,
              maxStringLength: 200,
            }) as string[] | undefined) || [],
          estimatedUsers: Number.isFinite(estimatedUsers) ? Math.max(0, Math.floor(estimatedUsers)) : 0,
          impactScore: impact.impactScore,
          metadata: {
            recommendation: impact.recommendation,
          },
          completedAt: new Date(),
        },
      })

      await tx.releaseOrchestrationPlan.update({
        where: {
          id: plan.id,
        },
        data: {
          status: ReleaseStageStatus.ROLLED_BACK,
          impactSummary: impact.recommendation,
        },
      })

      return created
    })

    await recordPromptAuditLog({
      actorId: session.user.id,
      action: "release.plan.rollback",
      resource: "release-orchestration",
      request,
      metadata: {
        planId: plan.id,
        rollbackId: rollback.id,
        impactScore: rollback.impactScore,
      },
    })

    return NextResponse.json({ rollback })
  } catch (error) {
    console.error("Rollback release plan failed:", error)
    return NextResponse.json({ error: "执行灰度回滚失败" }, { status: 500 })
  }
}
