import { AuditRiskLevel } from "@prisma/client"
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"

import { authOptions } from "@/lib/auth"
import {
  DEFAULT_AUDIT_RETENTION_DAYS,
  exportAuditLogsAsCsv,
  getOrCreateAuditRetentionPolicy,
} from "@/lib/compliance-audit"
import { prisma } from "@/lib/db"
import {
  resolveAuditLogResourceMatch,
  resolveGovernanceIntegritySummary,
} from "@/lib/integration-governance"
import { sanitizeTextInput } from "@/lib/security"

export const dynamic = "force-dynamic"

function resolvePositiveInt(value: string | null, fallback: number, min: number, max: number) {
  const parsed = Number(value || "")
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

function normalizeRiskLevel(value: string | null) {
  const normalized = sanitizeTextInput(value, 16).toUpperCase()
  if (normalized === AuditRiskLevel.CRITICAL) {
    return AuditRiskLevel.CRITICAL
  }
  if (normalized === AuditRiskLevel.HIGH) {
    return AuditRiskLevel.HIGH
  }
  if (normalized === AuditRiskLevel.MEDIUM) {
    return AuditRiskLevel.MEDIUM
  }
  if (normalized === AuditRiskLevel.LOW) {
    return AuditRiskLevel.LOW
  }
  return null
}

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const promptId = sanitizeTextInput(searchParams.get("promptId"), 64)
    const actorId = sanitizeTextInput(searchParams.get("actorId"), 64)
    const action = sanitizeTextInput(searchParams.get("action"), 120)
    const status = sanitizeTextInput(searchParams.get("status"), 20)
    const resource = sanitizeTextInput(searchParams.get("resource"), 40)
    const requestId = sanitizeTextInput(searchParams.get("requestId"), 120)
    const resourceId = sanitizeTextInput(searchParams.get("resourceId"), 120)
    const format = sanitizeTextInput(searchParams.get("format"), 12).toLowerCase() || "json"
    const includeExpired = sanitizeTextInput(searchParams.get("includeExpired"), 8) === "true"
    const includeAnomalies = sanitizeTextInput(searchParams.get("includeAnomalies"), 8) === "true"

    const page = resolvePositiveInt(searchParams.get("page"), 1, 1, 1000)
    const take = resolvePositiveInt(searchParams.get("take"), 50, 1, 500)
    const skip = (page - 1) * take

    const policy = await getOrCreateAuditRetentionPolicy(session.user.id)
    const effectiveRetentionDays = policy?.retentionDays || DEFAULT_AUDIT_RETENTION_DAYS
    const retentionCutoff = new Date(Date.now() - effectiveRetentionDays * 24 * 60 * 60 * 1000)

    const where: Record<string, unknown> = {
      OR: [{ actorId: session.user.id }, { prompt: { authorId: session.user.id } }],
      ...(promptId ? { promptId } : {}),
      ...(actorId ? { actorId } : {}),
      ...(action ? { action: { contains: action } } : {}),
      ...(status ? { status } : {}),
      ...(resource ? { resource } : {}),
      ...(requestId ? { requestId } : {}),
      ...(includeExpired ? {} : { createdAt: { gte: retentionCutoff } }),
    }

    const riskLevel = normalizeRiskLevel(searchParams.get("riskLevel"))
    if (riskLevel) {
      where.riskLevel = riskLevel
    }

    const [logs, total] = await Promise.all([
      prisma.promptAuditLog.findMany({
        where,
        include: {
          actor: {
            select: { id: true, name: true, email: true },
          },
          prompt: {
            select: { id: true, title: true, authorId: true },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: resourceId ? Math.max(take, 300) : take,
      }),
      prisma.promptAuditLog.count({ where }),
    ])

    const filteredLogs = resourceId ? logs.filter((item) => resolveAuditLogResourceMatch(item, resourceId)) : logs
    const integrity = resolveGovernanceIntegritySummary(filteredLogs)

    if (format === "csv") {
      const csv = exportAuditLogsAsCsv(filteredLogs)
      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="audit-logs-${Date.now()}.csv"`,
        },
      })
    }

    const anomalyMeta = includeAnomalies
      ? await prisma.auditAnomaly.groupBy({
          by: ["status"],
          where: {
            userId: session.user.id,
          },
          _count: {
            status: true,
          },
        })
      : []

    return NextResponse.json({
      data: filteredLogs,
      policy: {
        retentionDays: effectiveRetentionDays,
        exportEnabled: policy.exportEnabled,
      },
      anomalies: includeAnomalies
        ? {
            openCount:
              anomalyMeta.find((item) => item.status === "OPEN")?._count.status || 0,
            resolvedCount:
              anomalyMeta.find((item) => item.status === "RESOLVED")?._count.status || 0,
          }
        : null,
      integrity,
      meta: {
        page,
        take,
        total: resourceId ? filteredLogs.length : total,
        totalPages: Math.max(1, Math.ceil((resourceId ? filteredLogs.length : total) / take)),
        includeExpired,
        resourceId,
      },
    })
  } catch (error) {
    console.error("Fetch audit logs failed:", error)
    return NextResponse.json({ error: "获取审计日志失败" }, { status: 500 })
  }
}
