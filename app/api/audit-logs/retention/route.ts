import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"

import { authOptions } from "@/lib/auth"
import {
  AUDIT_RETENTION_MAX_DAYS,
  AUDIT_RETENTION_MIN_DAYS,
  getOrCreateAuditRetentionPolicy,
  resolveRetentionDays,
  resolveRetentionUntil,
} from "@/lib/compliance-audit"
import { prisma } from "@/lib/db"
import { recordPromptAuditLog } from "@/lib/prompt-audit-log"

function resolveThreshold(value: unknown, fallback: number, min: number, max: number) {
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

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 })
  }

  try {
    const policy = await getOrCreateAuditRetentionPolicy(session.user.id)
    const cutoff = new Date(Date.now() - policy.retentionDays * 24 * 60 * 60 * 1000)

    const [activeCount, expiredCount] = await Promise.all([
      prisma.promptAuditLog.count({
        where: {
          actorId: session.user.id,
          createdAt: {
            gte: cutoff,
          },
        },
      }),
      prisma.promptAuditLog.count({
        where: {
          actorId: session.user.id,
          createdAt: {
            lt: cutoff,
          },
        },
      }),
    ])

    return NextResponse.json({
      policy,
      constraints: {
        minDays: AUDIT_RETENTION_MIN_DAYS,
        maxDays: AUDIT_RETENTION_MAX_DAYS,
      },
      summary: {
        activeCount,
        expiredCount,
      },
    })
  } catch (error) {
    console.error("Get audit retention policy failed:", error)
    return NextResponse.json({ error: "获取审计保留策略失败" }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 })
  }

  try {
    const body = await request.json().catch(() => ({}))
    const current = await getOrCreateAuditRetentionPolicy(session.user.id)

    const retentionDays = resolveRetentionDays(body.retentionDays, current.retentionDays)
    const exportEnabled =
      typeof body.exportEnabled === "boolean" ? body.exportEnabled : current.exportEnabled
    const failureBurstThreshold = resolveThreshold(
      body.failureBurstThreshold,
      current.failureBurstThreshold,
      2,
      100
    )
    const multiIpBurstThreshold = resolveThreshold(
      body.multiIpBurstThreshold,
      current.multiIpBurstThreshold,
      2,
      50
    )
    const sensitiveBurstThreshold = resolveThreshold(
      body.sensitiveBurstThreshold,
      current.sensitiveBurstThreshold,
      2,
      100
    )

    const updated = await prisma.auditRetentionPolicy.update({
      where: {
        userId: session.user.id,
      },
      data: {
        retentionDays,
        exportEnabled,
        failureBurstThreshold,
        multiIpBurstThreshold,
        sensitiveBurstThreshold,
      },
    })

    await prisma.promptAuditLog.updateMany({
      where: {
        actorId: session.user.id,
      },
      data: {
        retentionUntil: resolveRetentionUntil(updated.retentionDays),
      },
    })

    await recordPromptAuditLog({
      actorId: session.user.id,
      action: "audit.retention.update",
      resource: "compliance",
      request,
      metadata: {
        retentionDays: updated.retentionDays,
        exportEnabled: updated.exportEnabled,
        failureBurstThreshold: updated.failureBurstThreshold,
        multiIpBurstThreshold: updated.multiIpBurstThreshold,
        sensitiveBurstThreshold: updated.sensitiveBurstThreshold,
      },
    })

    return NextResponse.json({ policy: updated })
  } catch (error) {
    console.error("Update audit retention policy failed:", error)
    return NextResponse.json({ error: "更新审计保留策略失败" }, { status: 500 })
  }
}
