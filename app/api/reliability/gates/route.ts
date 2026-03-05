import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"

import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import {
  buildReliabilityGateSummary,
  resolveReliabilityGateStatus,
  sanitizeReliabilityGateInput,
} from "@/lib/reliability-gates"
import { recordPromptAuditLog } from "@/lib/prompt-audit-log"
import { getUserEntitlementSnapshot, hasReliabilityGateAccess } from "@/lib/subscription-entitlements"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 })
  }

  const snapshot = await getUserEntitlementSnapshot(session.user.id)
  if (!hasReliabilityGateAccess(snapshot.plan.id)) {
    return NextResponse.json(
      {
        error: "全链路质量闸门仅对 Pro / Team / Enterprise 套餐开放",
        upgradeRequired: true,
      },
      { status: 403 }
    )
  }

  const runs = await prisma.reliabilityGateRun.findMany({
    where: {
      userId: session.user.id,
    },
    orderBy: [{ createdAt: "desc" }],
    take: 200,
  })

  const summary = buildReliabilityGateSummary(runs)

  return NextResponse.json({ runs, summary })
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 })
  }

  const snapshot = await getUserEntitlementSnapshot(session.user.id)
  if (!hasReliabilityGateAccess(snapshot.plan.id)) {
    return NextResponse.json(
      {
        error: "全链路质量闸门仅对 Pro / Team / Enterprise 套餐开放",
        upgradeRequired: true,
      },
      { status: 403 }
    )
  }

  try {
    const body = await request.json().catch(() => ({}))
    const sanitized = sanitizeReliabilityGateInput(body)

    const status = resolveReliabilityGateStatus({
      gateType: sanitized.gateType,
      severity: sanitized.severity,
      findings: sanitized.findings,
      blockReason: sanitized.blockReason,
    })

    const run = await prisma.reliabilityGateRun.create({
      data: {
        userId: session.user.id,
        releaseKey: sanitized.releaseKey,
        gateType: sanitized.gateType,
        severity: sanitized.severity,
        status,
        branchName: sanitized.branchName,
        commitSha: sanitized.commitSha || null,
        environment: sanitized.environment,
        findings: sanitized.findings,
        blockReason: sanitized.blockReason || null,
        endedAt: new Date(),
      },
    })

    await recordPromptAuditLog({
      actorId: session.user.id,
      action: "reliability.gate.run",
      resource: "reliability-gate",
      request,
      metadata: {
        gateRunId: run.id,
        releaseKey: run.releaseKey,
        gateType: run.gateType,
        status: run.status,
      },
    })

    return NextResponse.json({ run }, { status: 201 })
  } catch (error) {
    console.error("Run reliability gate failed:", error)
    return NextResponse.json({ error: "执行质量闸门失败" }, { status: 500 })
  }
}
