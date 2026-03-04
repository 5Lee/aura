import { PartnerSettlementStatus } from "@prisma/client"
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"

import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { normalizePartnerSettlementStatus, reconcilePartnerSettlement } from "@/lib/partner-program"
import { recordPromptAuditLog } from "@/lib/prompt-audit-log"
import { sanitizeMultilineTextInput, sanitizeTextInput } from "@/lib/security"
import { getUserEntitlementSnapshot, hasPartnerProgramAccess } from "@/lib/subscription-entitlements"

function resolvePositiveInt(value: unknown, fallback: number, min: number, max: number) {
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

function isSettlementTransitionAllowed(from: PartnerSettlementStatus, to: PartnerSettlementStatus) {
  if (from === to) {
    return true
  }

  const matrix: Record<PartnerSettlementStatus, PartnerSettlementStatus[]> = {
    [PartnerSettlementStatus.DRAFT]: [PartnerSettlementStatus.PENDING, PartnerSettlementStatus.DISPUTED],
    [PartnerSettlementStatus.PENDING]: [
      PartnerSettlementStatus.PROCESSING,
      PartnerSettlementStatus.PAID,
      PartnerSettlementStatus.DISPUTED,
    ],
    [PartnerSettlementStatus.PROCESSING]: [PartnerSettlementStatus.PAID, PartnerSettlementStatus.DISPUTED],
    [PartnerSettlementStatus.PAID]: [PartnerSettlementStatus.DISPUTED],
    [PartnerSettlementStatus.DISPUTED]: [PartnerSettlementStatus.PROCESSING, PartnerSettlementStatus.PAID],
  }

  return matrix[from].includes(to)
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 })
  }

  const snapshot = await getUserEntitlementSnapshot(session.user.id)
  if (!hasPartnerProgramAccess(snapshot.plan.id)) {
    return NextResponse.json(
      {
        error: "合作伙伴分层与结算仅对 Pro / Team / Enterprise 套餐开放",
        upgradeRequired: true,
      },
      { status: 403 }
    )
  }

  try {
    const body = await request.json().catch(() => ({}))

    const settlement = await prisma.partnerSettlement.findFirst({
      where: {
        id: params.id,
        userId: session.user.id,
      },
    })

    if (!settlement) {
      return NextResponse.json({ error: "合作伙伴结算不存在" }, { status: 404 })
    }

    const nextStatus = body.status
      ? normalizePartnerSettlementStatus(body.status)
      : settlement.status

    if (!isSettlementTransitionAllowed(settlement.status, nextStatus)) {
      return NextResponse.json({ error: "不允许的结算状态流转" }, { status: 400 })
    }

    const actualPayoutCents = resolvePositiveInt(
      body.actualPayoutCents,
      settlement.payoutAmountCents + settlement.reconciledDeltaCents,
      0,
      5_000_000_000
    )
    const reconciliation = reconcilePartnerSettlement({
      expectedPayoutCents: settlement.payoutAmountCents,
      actualPayoutCents,
    })

    const note = sanitizeMultilineTextInput(body.note, 600).trim()
    const payoutReference = sanitizeTextInput(body.payoutReference, 120)

    const now = new Date()
    const updated = await prisma.partnerSettlement.update({
      where: {
        id: settlement.id,
      },
      data: {
        status: nextStatus,
        payoutReference: payoutReference || settlement.payoutReference,
        reconciledDeltaCents: reconciliation.deltaCents,
        summary: {
          ...(settlement.summary && typeof settlement.summary === "object" && !Array.isArray(settlement.summary)
            ? (settlement.summary as Record<string, unknown>)
            : {}),
          expectedPayoutCents: reconciliation.expectedPayoutCents,
          actualPayoutCents: reconciliation.actualPayoutCents,
          matched: reconciliation.matched,
          note,
        },
        processedAt: nextStatus === PartnerSettlementStatus.PAID ? now : settlement.processedAt,
      },
    })

    await recordPromptAuditLog({
      actorId: session.user.id,
      action: "partners.settlement.update",
      resource: "partners",
      request,
      metadata: {
        settlementId: updated.id,
        status: updated.status,
        reconciledDeltaCents: updated.reconciledDeltaCents,
      },
    })

    return NextResponse.json({ settlement: updated, reconciliation })
  } catch (error) {
    console.error("Update partner settlement failed:", error)
    return NextResponse.json({ error: "更新合作伙伴结算失败" }, { status: 500 })
  }
}
