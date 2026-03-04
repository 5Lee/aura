import { AuditRiskLevel } from "@prisma/client"
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"

import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { recordPromptAuditLog } from "@/lib/prompt-audit-log"
import { sanitizeTextInput } from "@/lib/security"

function normalizeSeverity(value: string | null) {
  const normalized = sanitizeTextInput(value, 20).toUpperCase()
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
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const status = sanitizeTextInput(searchParams.get("status"), 20).toUpperCase()
    const take = Math.min(Math.max(Number(searchParams.get("take") || 50), 1), 200)
    const severity = normalizeSeverity(searchParams.get("severity"))

    const where: Record<string, unknown> = {
      userId: session.user.id,
      ...(status ? { status } : {}),
      ...(severity ? { severity } : {}),
    }

    const anomalies = await prisma.auditAnomaly.findMany({
      where,
      orderBy: [{ lastSeenAt: "desc" }],
      take,
    })

    return NextResponse.json({
      data: anomalies,
      meta: {
        openCount: anomalies.filter((item) => item.status === "OPEN").length,
        total: anomalies.length,
      },
    })
  } catch (error) {
    console.error("Fetch audit anomalies failed:", error)
    return NextResponse.json({ error: "获取异常审计事件失败" }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 })
  }

  try {
    const body = await request.json().catch(() => ({}))
    const id = sanitizeTextInput(body.id, 64)
    const status = sanitizeTextInput(body.status, 20).toUpperCase() || "RESOLVED"

    if (!id) {
      return NextResponse.json({ error: "id 不能为空" }, { status: 400 })
    }

    const anomaly = await prisma.auditAnomaly.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
    })

    if (!anomaly) {
      return NextResponse.json({ error: "异常事件不存在" }, { status: 404 })
    }

    const updated = await prisma.auditAnomaly.update({
      where: {
        id,
      },
      data: {
        status,
      },
    })

    await recordPromptAuditLog({
      actorId: session.user.id,
      action: "audit.anomaly.resolve",
      resource: "compliance",
      request,
      metadata: {
        anomalyId: updated.id,
        type: updated.type,
        status: updated.status,
      },
    })

    return NextResponse.json({ anomaly: updated })
  } catch (error) {
    console.error("Update audit anomaly failed:", error)
    return NextResponse.json({ error: "更新异常状态失败" }, { status: 500 })
  }
}
