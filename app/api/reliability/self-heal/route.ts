import { SelfHealSuggestionStatus } from "@prisma/client"
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"

import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { recordPromptAuditLog } from "@/lib/prompt-audit-log"
import { sanitizeTextInput } from "@/lib/security"
import {
  buildSelfHealPatternSeed,
  normalizeSelfHealSuggestionStatus,
  resolveSelfHealEfficiency,
  resolveSelfHealSuggestion,
  sanitizeSelfHealPatternInput,
} from "@/lib/self-heal"
import { getUserEntitlementSnapshot, hasSelfHealAccess } from "@/lib/subscription-entitlements"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 })
  }

  const snapshot = await getUserEntitlementSnapshot(session.user.id)
  if (!hasSelfHealAccess(snapshot.plan.id)) {
    return NextResponse.json(
      {
        error: "回归资产与自愈修复仅对 Pro / Team / Enterprise 套餐开放",
        upgradeRequired: true,
      },
      { status: 403 }
    )
  }

  const patternCount = await prisma.selfHealPattern.count({
    where: {
      userId: session.user.id,
    },
  })

  if (patternCount === 0) {
    await prisma.selfHealPattern.createMany({
      data: buildSelfHealPatternSeed(session.user.id),
    })
  }

  const [patterns, executions] = await Promise.all([
    prisma.selfHealPattern.findMany({
      where: {
        userId: session.user.id,
      },
      orderBy: [{ updatedAt: "desc" }],
      take: 80,
    }),
    prisma.selfHealExecution.findMany({
      where: {
        userId: session.user.id,
      },
      include: {
        pattern: {
          select: {
            id: true,
            name: true,
            defectSignature: true,
          },
        },
      },
      orderBy: [{ createdAt: "desc" }],
      take: 200,
    }),
  ])

  const efficiency = resolveSelfHealEfficiency(
    executions.map((item) => ({
      status: item.status,
      createdAt: item.createdAt,
      appliedAt: item.appliedAt,
    }))
  )

  return NextResponse.json({ patterns, executions, efficiency })
}

export async function PUT(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 })
  }

  const snapshot = await getUserEntitlementSnapshot(session.user.id)
  if (!hasSelfHealAccess(snapshot.plan.id)) {
    return NextResponse.json(
      {
        error: "回归资产与自愈修复仅对 Pro / Team / Enterprise 套餐开放",
        upgradeRequired: true,
      },
      { status: 403 }
    )
  }

  try {
    const body = await request.json().catch(() => ({}))
    const sanitized = sanitizeSelfHealPatternInput(body)

    const current = sanitized.id
      ? await prisma.selfHealPattern.findFirst({
          where: {
            id: sanitized.id,
            userId: session.user.id,
          },
        })
      : null

    const pattern = await prisma.selfHealPattern.upsert({
      where: {
        id: current?.id || "__create_self_heal_pattern__",
      },
      create: {
        userId: session.user.id,
        name: sanitized.name,
        defectSignature: sanitized.defectSignature,
        fixTemplate: sanitized.fixTemplate,
        regressionScript: sanitized.regressionScript,
        confidenceScore: sanitized.confidenceScore,
        enabled: sanitized.enabled,
      },
      update: {
        name: sanitized.name,
        defectSignature: sanitized.defectSignature,
        fixTemplate: sanitized.fixTemplate,
        regressionScript: sanitized.regressionScript,
        confidenceScore: sanitized.confidenceScore,
        enabled: sanitized.enabled,
      },
    })

    await recordPromptAuditLog({
      actorId: session.user.id,
      action: "reliability.selfheal.pattern.upsert",
      resource: "self-heal",
      request,
      metadata: {
        patternId: pattern.id,
        defectSignature: pattern.defectSignature,
      },
    })

    return NextResponse.json({ pattern })
  } catch (error) {
    console.error("Save self-heal pattern failed:", error)
    return NextResponse.json({ error: "保存自愈模式失败" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 })
  }

  const snapshot = await getUserEntitlementSnapshot(session.user.id)
  if (!hasSelfHealAccess(snapshot.plan.id)) {
    return NextResponse.json(
      {
        error: "回归资产与自愈修复仅对 Pro / Team / Enterprise 套餐开放",
        upgradeRequired: true,
      },
      { status: 403 }
    )
  }

  try {
    const body = await request.json().catch(() => ({}))
    const patternId = sanitizeTextInput(body.patternId, 80)
    const defectReference = sanitizeTextInput(body.defectReference, 120)

    if (!patternId || !defectReference) {
      return NextResponse.json({ error: "patternId 与 defectReference 不能为空" }, { status: 400 })
    }

    const pattern = await prisma.selfHealPattern.findFirst({
      where: {
        id: patternId,
        userId: session.user.id,
      },
    })

    if (!pattern) {
      return NextResponse.json({ error: "自愈模式不存在" }, { status: 404 })
    }

    if (!pattern.enabled) {
      return NextResponse.json({ error: "自愈模式已禁用" }, { status: 400 })
    }

    const existingExecution = await prisma.selfHealExecution.findFirst({
      where: {
        userId: session.user.id,
        patternId: pattern.id,
        defectReference,
        status: {
          in: [SelfHealSuggestionStatus.OPEN, SelfHealSuggestionStatus.APPLIED],
        },
      },
      include: {
        pattern: {
          select: {
            id: true,
            name: true,
            defectSignature: true,
          },
        },
      },
      orderBy: [{ createdAt: "desc" }],
    })

    if (existingExecution) {
      await recordPromptAuditLog({
        actorId: session.user.id,
        action: "reliability.selfheal.suggestion.deduped",
        resource: "self-heal",
        request,
        metadata: {
          patternId: pattern.id,
          executionId: existingExecution.id,
          defectReference,
          status: existingExecution.status,
        },
      })

      return NextResponse.json({ execution: existingExecution, deduped: true })
    }

    const suggestion = resolveSelfHealSuggestion({
      pattern,
      defectReference,
    })

    const execution = await prisma.selfHealExecution.create({
      data: {
        userId: session.user.id,
        patternId: pattern.id,
        status: suggestion.status,
        defectReference,
        suggestion: suggestion.suggestion,
        patchPreview: suggestion.patchPreview,
      },
      include: {
        pattern: {
          select: {
            id: true,
            name: true,
            defectSignature: true,
          },
        },
      },
    })

    await recordPromptAuditLog({
      actorId: session.user.id,
      action: "reliability.selfheal.suggestion.create",
      resource: "self-heal",
      request,
      metadata: {
        patternId: pattern.id,
        executionId: execution.id,
        defectReference,
        confidence: suggestion.confidence,
      },
    })

    return NextResponse.json({ execution }, { status: 201 })
  } catch (error) {
    console.error("Create self-heal suggestion failed:", error)
    return NextResponse.json({ error: "生成自愈建议失败" }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 })
  }

  const snapshot = await getUserEntitlementSnapshot(session.user.id)
  if (!hasSelfHealAccess(snapshot.plan.id)) {
    return NextResponse.json(
      {
        error: "回归资产与自愈修复仅对 Pro / Team / Enterprise 套餐开放",
        upgradeRequired: true,
      },
      { status: 403 }
    )
  }

  try {
    const body = await request.json().catch(() => ({}))
    const executionId = sanitizeTextInput(body.executionId, 80)
    const nextStatus = normalizeSelfHealSuggestionStatus(body.status)

    if (!executionId) {
      return NextResponse.json({ error: "executionId 不能为空" }, { status: 400 })
    }

    const execution = await prisma.selfHealExecution.findFirst({
      where: {
        id: executionId,
        userId: session.user.id,
      },
    })

    if (!execution) {
      return NextResponse.json({ error: "自愈建议不存在" }, { status: 404 })
    }

    const updated = await prisma.selfHealExecution.update({
      where: {
        id: execution.id,
      },
      data: {
        status: nextStatus,
        confirmedBy:
          nextStatus === SelfHealSuggestionStatus.APPLIED
            ? sanitizeTextInput(session.user.email, 120) || session.user.id
            : null,
        appliedAt: nextStatus === SelfHealSuggestionStatus.APPLIED ? new Date() : null,
      },
    })

    await recordPromptAuditLog({
      actorId: session.user.id,
      action: "reliability.selfheal.suggestion.update",
      resource: "self-heal",
      request,
      metadata: {
        executionId: updated.id,
        status: updated.status,
      },
    })

    return NextResponse.json({ execution: updated })
  } catch (error) {
    console.error("Update self-heal suggestion failed:", error)
    return NextResponse.json({ error: "更新自愈建议状态失败" }, { status: 500 })
  }
}
