import { type Prisma } from "@prisma/client"
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"

import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import {
  buildDefaultMarketplaceRuleSeed,
  calculateMarketplaceCommission,
  resolveSettlementWindow,
  summarizeMarketplaceSettlement,
} from "@/lib/marketplace-commission"
import { recordPromptAuditLog } from "@/lib/prompt-audit-log"
import { sanitizeTextInput } from "@/lib/security"
import {
  getUserEntitlementSnapshot,
  hasMarketplaceCommissionAccess,
} from "@/lib/subscription-entitlements"

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

async function getOrCreateActiveRule(userId: string) {
  let rule = await prisma.marketplaceCommissionRule.findFirst({
    where: {
      userId,
      active: true,
    },
    orderBy: [{ updatedAt: "desc" }],
  })

  if (rule) {
    return rule
  }

  await prisma.marketplaceCommissionRule.createMany({
    data: buildDefaultMarketplaceRuleSeed(userId),
  })

  rule = await prisma.marketplaceCommissionRule.findFirst({
    where: {
      userId,
      active: true,
    },
    orderBy: [{ updatedAt: "desc" }],
  })

  return rule
}

export async function GET(request: Request) {
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

  const { searchParams } = new URL(request.url)
  const page = resolvePositiveInt(searchParams.get("page"), 1, 1, 1000)
  const pageSize = resolvePositiveInt(searchParams.get("pageSize"), 20, 10, 100)
  const skip = (page - 1) * pageSize

  const where = {
    userId: session.user.id,
  }

  const [rows, total, accruedRows] = await prisma.$transaction([
    prisma.marketplaceCommissionLedger.findMany({
      where,
      include: {
        rule: {
          select: {
            id: true,
            name: true,
            category: true,
          },
        },
        sourceInvoice: {
          select: {
            id: true,
            invoiceNo: true,
            totalCents: true,
            status: true,
          },
        },
      },
      orderBy: [{ createdAt: "desc" }],
      skip,
      take: pageSize,
    }),
    prisma.marketplaceCommissionLedger.count({ where }),
    prisma.marketplaceCommissionLedger.findMany({
      where: {
        ...where,
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
    data: rows,
    summary: summarizeMarketplaceSettlement(accruedRows),
    meta: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
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
    const ruleId = sanitizeTextInput(body.ruleId, 80)

    const defaultRule = await getOrCreateActiveRule(session.user.id)
    if (!defaultRule) {
      return NextResponse.json({ error: "未找到可用佣金规则" }, { status: 400 })
    }

    const selectedRule = ruleId
      ? await prisma.marketplaceCommissionRule.findFirst({
          where: {
            id: ruleId,
            userId: session.user.id,
            active: true,
          },
        })
      : defaultRule

    const rule = selectedRule || defaultRule

    const invoices = await prisma.billingInvoice.findMany({
      where: {
        userId: session.user.id,
        status: {
          in: ["ISSUED", "PAID"],
        },
        totalCents: {
          gt: 0,
        },
      },
      select: {
        id: true,
        issuedAt: true,
        totalCents: true,
        invoiceNo: true,
        type: true,
      },
      orderBy: [{ issuedAt: "desc" }],
      take: 300,
    })

    if (invoices.length === 0) {
      return NextResponse.json({ created: 0, skipped: 0 })
    }

    const existing = await prisma.marketplaceCommissionLedger.findMany({
      where: {
        userId: session.user.id,
        sourceInvoiceId: {
          in: invoices.map((item) => item.id),
        },
      },
      select: {
        sourceInvoiceId: true,
      },
    })
    const existingSet = new Set(existing.map((item) => item.sourceInvoiceId).filter(Boolean))

    const rows = invoices
      .filter((invoice) => !existingSet.has(invoice.id))
      .map((invoice) => {
        const breakdown = calculateMarketplaceCommission(invoice.totalCents, {
          creatorRateBasisPoints: rule.creatorRateBasisPoints,
          platformRateBasisPoints: rule.platformRateBasisPoints,
        })
        const settlementWindow = resolveSettlementWindow(invoice.issuedAt, rule.settlementCycleDays)

        return {
          userId: session.user.id,
          ruleId: rule.id,
          sourceInvoiceId: invoice.id,
          status: "ACCRUED" as const,
          currency: rule.currency,
          grossAmountCents: breakdown.grossAmountCents,
          creatorCommissionCents: breakdown.creatorCommissionCents,
          platformCommissionCents: breakdown.platformCommissionCents,
          settlementPeriodStart: settlementWindow.periodStart,
          settlementPeriodEnd: settlementWindow.periodEnd,
          metadata: {
            invoiceNo: invoice.invoiceNo,
            invoiceType: invoice.type,
          } as Prisma.InputJsonValue,
        }
      })

    if (rows.length > 0) {
      await prisma.marketplaceCommissionLedger.createMany({
        data: rows,
      })
    }

    await recordPromptAuditLog({
      actorId: session.user.id,
      action: "marketplace.ledger.sync",
      resource: "marketplace",
      request,
      metadata: {
        created: rows.length,
        skipped: invoices.length - rows.length,
        ruleId: rule.id,
      },
    })

    return NextResponse.json({
      created: rows.length,
      skipped: invoices.length - rows.length,
      ruleId: rule.id,
    })
  } catch (error) {
    console.error("Sync marketplace ledger failed:", error)
    return NextResponse.json({ error: "同步佣金台账失败" }, { status: 500 })
  }
}
