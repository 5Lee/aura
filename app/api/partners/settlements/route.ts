import { PartnerLeadStatus, PartnerSettlementStatus } from "@prisma/client"
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"

import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import {
  calculatePartnerRevenueShare,
  normalizePartnerSettlementStatus,
  reconcilePartnerSettlement,
  summarizePartnerSettlement,
} from "@/lib/partner-program"
import { recordPromptAuditLog } from "@/lib/prompt-audit-log"
import { sanitizeTextInput } from "@/lib/security"
import { getUserEntitlementSnapshot, hasPartnerProgramAccess } from "@/lib/subscription-entitlements"

function parseDate(value: unknown, fallback: Date) {
  if (typeof value !== "string") {
    return fallback
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return fallback
  }

  return parsed
}

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

export async function GET() {
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

  const settlements = await prisma.partnerSettlement.findMany({
    where: {
      userId: session.user.id,
    },
    include: {
      tier: {
        select: {
          id: true,
          name: true,
          level: true,
          revenueShareBasisPoints: true,
        },
      },
    },
    orderBy: [{ createdAt: "desc" }],
    take: 60,
  })

  return NextResponse.json({ settlements })
}

export async function POST(request: Request) {
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
    const tierId = sanitizeTextInput(body.tierId, 80)
    if (!tierId) {
      return NextResponse.json({ error: "请选择合作伙伴等级" }, { status: 400 })
    }

    const tier = await prisma.partnerTier.findFirst({
      where: {
        id: tierId,
        userId: session.user.id,
      },
    })

    if (!tier) {
      return NextResponse.json({ error: "合作伙伴等级不存在" }, { status: 404 })
    }

    const now = new Date()
    const periodEnd = parseDate(body.periodEnd, now)
    const periodStartFallback = new Date(periodEnd)
    periodStartFallback.setDate(periodStartFallback.getDate() - tier.settlementCycleDays)
    const periodStart = parseDate(body.periodStart, periodStartFallback)

    if (periodStart.getTime() >= periodEnd.getTime()) {
      return NextResponse.json({ error: "结算周期不合法" }, { status: 400 })
    }

    const candidates = await prisma.partnerLead.findMany({
      where: {
        userId: session.user.id,
        tierId: tier.id,
        settlementId: null,
        createdAt: {
          gte: periodStart,
          lte: periodEnd,
        },
        status: {
          in: [PartnerLeadStatus.QUALIFIED, PartnerLeadStatus.WON],
        },
      },
      orderBy: [{ createdAt: "asc" }],
      take: 500,
    })

    if (candidates.length === 0) {
      return NextResponse.json({ error: "当前周期暂无可结算线索" }, { status: 400 })
    }

    const summary = summarizePartnerSettlement(
      candidates.map((item) => ({
        status: item.status,
        estimatedDealCents: item.estimatedDealCents,
        closedDealCents: item.closedDealCents,
        commissionBasisPoints: item.commissionBasisPoints,
      }))
    )

    const revenue = calculatePartnerRevenueShare({
      grossRevenueCents: summary.totalClosedRevenueCents,
      revenueShareBasisPoints: tier.revenueShareBasisPoints,
    })

    const actualPayoutCents = resolvePositiveInt(body.actualPayoutCents, revenue.payoutAmountCents, 0, 5_000_000_000)
    const reconciliation = reconcilePartnerSettlement({
      expectedPayoutCents: revenue.payoutAmountCents,
      actualPayoutCents,
    })

    const initialStatus = normalizePartnerSettlementStatus(body.status)
    const status =
      initialStatus === PartnerSettlementStatus.DRAFT ? PartnerSettlementStatus.PENDING : initialStatus

    const settlement = await prisma.$transaction(async (tx) => {
      const created = await tx.partnerSettlement.create({
        data: {
          userId: session.user.id,
          tierId: tier.id,
          status,
          periodStart,
          periodEnd,
          leadCount: summary.totalLeads,
          qualifiedLeadCount: summary.qualifiedLeads,
          wonLeadCount: summary.wonLeads,
          grossRevenueCents: revenue.grossRevenueCents,
          payoutRateBasisPoints: revenue.revenueShareBasisPoints,
          payoutAmountCents: revenue.payoutAmountCents,
          reconciledDeltaCents: reconciliation.deltaCents,
          payoutReference: sanitizeTextInput(body.payoutReference, 120) || null,
          summary: {
            expectedPayoutCents: revenue.payoutAmountCents,
            actualPayoutCents,
            matched: reconciliation.matched,
            estimatedRevenueCents: summary.totalEstimatedRevenueCents,
          },
          processedAt: status === PartnerSettlementStatus.PAID ? now : null,
        },
      })

      await tx.partnerLead.updateMany({
        where: {
          id: {
            in: candidates.map((item) => item.id),
          },
        },
        data: {
          settlementId: created.id,
        },
      })

      return created
    })

    await recordPromptAuditLog({
      actorId: session.user.id,
      action: "partners.settlement.create",
      resource: "partners",
      request,
      metadata: {
        settlementId: settlement.id,
        leadCount: settlement.leadCount,
        payoutAmountCents: settlement.payoutAmountCents,
      },
    })

    return NextResponse.json({ settlement }, { status: 201 })
  } catch (error) {
    console.error("Create partner settlement failed:", error)
    return NextResponse.json({ error: "创建合作伙伴结算失败" }, { status: 500 })
  }
}
