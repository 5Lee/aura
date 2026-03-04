import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"

import { CommissionManagementPanel } from "@/components/marketplace/commission-management-panel"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import {
  buildDefaultMarketplaceRuleSeed,
  summarizeMarketplaceSettlement,
} from "@/lib/marketplace-commission"
import {
  getUserEntitlementSnapshot,
  hasMarketplaceCommissionAccess,
} from "@/lib/subscription-entitlements"

export default async function MarketplacePage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    redirect("/login")
  }

  const snapshot = await getUserEntitlementSnapshot(session.user.id)
  const hasAccess = hasMarketplaceCommissionAccess(snapshot.plan.id)

  const [ruleCount, ledgers, settlements] = await Promise.all([
    hasAccess
      ? prisma.marketplaceCommissionRule.count({
          where: {
            userId: session.user.id,
          },
        })
      : Promise.resolve(0),
    hasAccess
      ? prisma.marketplaceCommissionLedger.findMany({
          where: {
            userId: session.user.id,
          },
          include: {
            sourceInvoice: {
              select: {
                id: true,
                invoiceNo: true,
                status: true,
              },
            },
          },
          orderBy: [{ createdAt: "desc" }],
          take: 50,
        })
      : Promise.resolve([]),
    hasAccess
      ? prisma.marketplaceSettlementBatch.findMany({
          where: {
            userId: session.user.id,
          },
          orderBy: [{ createdAt: "desc" }],
          take: 30,
        })
      : Promise.resolve([]),
  ])

  if (hasAccess && ruleCount === 0) {
    await prisma.marketplaceCommissionRule.createMany({
      data: buildDefaultMarketplaceRuleSeed(session.user.id),
    })
  }

  const rules = hasAccess
    ? await prisma.marketplaceCommissionRule.findMany({
        where: {
          userId: session.user.id,
        },
        orderBy: [{ active: "desc" }, { updatedAt: "desc" }],
        take: 20,
      })
    : []

  const pendingSummary = summarizeMarketplaceSettlement(
    ledgers
      .filter((item) => item.status === "ACCRUED")
      .map((item) => ({
        grossAmountCents: item.grossAmountCents,
        creatorCommissionCents: item.creatorCommissionCents,
        platformCommissionCents: item.platformCommissionCents,
      }))
  )

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-3">
            <CardTitle>应用市场佣金体系</CardTitle>
            <Badge variant="secondary">Week20-001</Badge>
            <Badge>{snapshot.plan.name}</Badge>
          </div>
          <CardDescription>
            定义市场分成规则与结算周期，支持创作者收益统计、结算状态追踪，并校验佣金计算与账务一致性。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CommissionManagementPanel
            hasAccess={hasAccess}
            planId={snapshot.plan.id}
            rules={rules.map((item) => ({
              id: item.id,
              name: item.name,
              category: item.category,
              creatorRateBasisPoints: item.creatorRateBasisPoints,
              platformRateBasisPoints: item.platformRateBasisPoints,
              settlementCycleDays: item.settlementCycleDays,
              minimumPayoutCents: item.minimumPayoutCents,
              currency: item.currency,
              active: item.active,
            }))}
            ledgers={ledgers.map((item) => ({
              id: item.id,
              status: item.status,
              grossAmountCents: item.grossAmountCents,
              creatorCommissionCents: item.creatorCommissionCents,
              platformCommissionCents: item.platformCommissionCents,
              settlementPeriodStart: item.settlementPeriodStart.toISOString(),
              settlementPeriodEnd: item.settlementPeriodEnd.toISOString(),
              sourceInvoice: item.sourceInvoice,
            }))}
            settlements={settlements.map((item) => ({
              id: item.id,
              status: item.status,
              currency: item.currency,
              periodStart: item.periodStart.toISOString(),
              periodEnd: item.periodEnd.toISOString(),
              ledgerCount: item.ledgerCount,
              grossAmountCents: item.grossAmountCents,
              payoutAmountCents: item.payoutAmountCents,
              payoutReference: item.payoutReference,
              summary: item.summary,
              processedAt: item.processedAt?.toISOString() ?? null,
              createdAt: item.createdAt.toISOString(),
            }))}
            pendingSummary={pendingSummary}
          />
        </CardContent>
      </Card>
    </div>
  )
}
