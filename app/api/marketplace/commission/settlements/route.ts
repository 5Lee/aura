import { BillingEventProcessStatus, MarketplaceSettlementStatus } from "@prisma/client"
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"

import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import {
  sanitizeMarketplaceMetadata,
  sanitizeMarketplaceSummary,
  summarizeMarketplaceSettlement,
} from "@/lib/marketplace-commission"
import { recordPromptAuditLog } from "@/lib/prompt-audit-log"
import {
  getUserEntitlementSnapshot,
  hasMarketplaceCommissionAccess,
} from "@/lib/subscription-entitlements"

function resolveDate(value: unknown, fallback: Date) {
  if (typeof value !== "string") {
    return fallback
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return fallback
  }

  return parsed
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 })
  }

  const entitlement = await getUserEntitlementSnapshot(session.user.id)
  if (!hasMarketplaceCommissionAccess(entitlement.plan.id)) {
    return NextResponse.json(
      {
        error: "应用市场佣金体系仅对 Pro / Team / Enterprise 套餐开放",
        upgradeRequired: true,
      },
      { status: 403 }
    )
  }

  const [batches, pendingRows] = await prisma.$transaction([
    prisma.marketplaceSettlementBatch.findMany({
      where: {
        userId: session.user.id,
      },
      orderBy: [{ createdAt: "desc" }],
      take: 50,
    }),
    prisma.marketplaceCommissionLedger.findMany({
      where: {
        userId: session.user.id,
        status: "ACCRUED",
      },
      select: {
        grossAmountCents: true,
        creatorCommissionCents: true,
        platformCommissionCents: true,
      },
    }),
  ])

  return NextResponse.json({
    settlements: batches,
    pendingSummary: summarizeMarketplaceSettlement(pendingRows),
  })
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 })
  }

  const entitlement = await getUserEntitlementSnapshot(session.user.id)
  if (!hasMarketplaceCommissionAccess(entitlement.plan.id)) {
    return NextResponse.json(
      {
        error: "应用市场佣金体系仅对 Pro / Team / Enterprise 套餐开放",
        upgradeRequired: true,
      },
      { status: 403 }
    )
  }

  try {
    const body = await request.json().catch(() => ({}))
    const now = new Date()
    const periodEnd = resolveDate(body.periodEnd, now)

    const ledgers = await prisma.marketplaceCommissionLedger.findMany({
      where: {
        userId: session.user.id,
        status: "ACCRUED",
        settlementPeriodEnd: {
          lte: periodEnd,
        },
      },
      include: {
        rule: {
          select: {
            minimumPayoutCents: true,
            currency: true,
          },
        },
      },
      orderBy: [{ settlementPeriodEnd: "asc" }],
      take: 2000,
    })

    if (ledgers.length === 0) {
      return NextResponse.json({ error: "当前没有可结算的佣金台账" }, { status: 400 })
    }

    const summary = summarizeMarketplaceSettlement(ledgers)
    const minimumPayoutCents = Math.max(
      ...ledgers.map((item) => item.rule.minimumPayoutCents),
      0
    )

    if (summary.payoutAmountCents < minimumPayoutCents) {
      return NextResponse.json(
        {
          error: `未达到最小结算金额（${(minimumPayoutCents / 100).toFixed(2)}）`,
          minimumPayoutCents,
          payoutAmountCents: summary.payoutAmountCents,
        },
        { status: 400 }
      )
    }

    const periodStart = ledgers.reduce(
      (acc, row) => (row.settlementPeriodStart < acc ? row.settlementPeriodStart : acc),
      ledgers[0].settlementPeriodStart
    )
    const batchCurrency = ledgers[0].currency
    const payoutReference = `MKT-${Date.now()}`

    const createdBatch = await prisma.$transaction(async (tx) => {
      const created = await tx.marketplaceSettlementBatch.create({
        data: {
          userId: session.user.id,
          status: MarketplaceSettlementStatus.PROCESSING,
          currency: batchCurrency,
          periodStart,
          periodEnd,
          ledgerCount: ledgers.length,
          grossAmountCents: summary.grossAmountCents,
          creatorCommissionCents: summary.creatorCommissionCents,
          platformCommissionCents: summary.platformCommissionCents,
          payoutAmountCents: summary.payoutAmountCents,
          payoutReference,
          summary: sanitizeMarketplaceSummary(body.summary) || "Auto settlement batch",
          metadata: sanitizeMarketplaceMetadata(body.metadata),
        },
      })

      await tx.marketplaceCommissionLedger.updateMany({
        where: {
          id: {
            in: ledgers.map((item) => item.id),
          },
        },
        data: {
          settlementBatchId: created.id,
          status: "SETTLED",
          settledAt: now,
        },
      })

      const finalized = await tx.marketplaceSettlementBatch.update({
        where: {
          id: created.id,
        },
        data: {
          status: MarketplaceSettlementStatus.PAID,
          processedAt: now,
        },
      })

      await tx.billingEvent.create({
        data: {
          userId: session.user.id,
          provider: "MOCKPAY",
          providerEventId: `marketplace_settlement_${created.id}`,
          type: "marketplace.settlement.paid",
          status: BillingEventProcessStatus.PROCESSED,
          payload: {
            batchId: created.id,
            payoutReference,
            payoutAmountCents: summary.payoutAmountCents,
          },
          processedAt: now,
        },
      })

      return finalized
    })

    await recordPromptAuditLog({
      actorId: session.user.id,
      action: "marketplace.settlement.create",
      resource: "marketplace",
      request,
      metadata: {
        batchId: createdBatch.id,
        payoutAmountCents: createdBatch.payoutAmountCents,
        ledgerCount: createdBatch.ledgerCount,
      },
    })

    return NextResponse.json({ settlement: createdBatch }, { status: 201 })
  } catch (error) {
    console.error("Create marketplace settlement failed:", error)
    return NextResponse.json({ error: "创建佣金结算失败" }, { status: 500 })
  }
}
