import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"

import { AdStrategyPanel } from "@/components/ads/ad-strategy-panel"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { buildDefaultAdPlacementSeed, resolveAdConversionMetrics } from "@/lib/ad-strategy"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { getUserEntitlementSnapshot, hasAdStrategyAccess } from "@/lib/subscription-entitlements"

export default async function AdsPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    redirect("/login")
  }

  const snapshot = await getUserEntitlementSnapshot(session.user.id)
  const hasAccess = hasAdStrategyAccess(snapshot.plan.id)

  const [ruleCount, rules, campaigns] = await Promise.all([
    hasAccess
      ? prisma.adPlacementRule.count({
          where: {
            userId: session.user.id,
          },
        })
      : Promise.resolve(0),
    hasAccess
      ? prisma.adPlacementRule.findMany({
          where: {
            userId: session.user.id,
          },
          orderBy: [{ active: "desc" }, { updatedAt: "desc" }],
          take: 20,
        })
      : Promise.resolve([]),
    hasAccess
      ? prisma.adCampaign.findMany({
          where: {
            userId: session.user.id,
          },
          orderBy: [{ createdAt: "desc" }],
          take: 80,
        })
      : Promise.resolve([]),
  ])

  if (hasAccess && ruleCount === 0) {
    await prisma.adPlacementRule.createMany({
      data: buildDefaultAdPlacementSeed(session.user.id),
    })
  }

  const summaryCore = campaigns.reduce(
    (acc, campaign) => {
      acc.totalBudgetCents += campaign.budgetCents
      acc.totalSpentCents += campaign.spentCents
      acc.totalImpressions += campaign.impressions
      acc.totalClicks += campaign.clicks
      acc.totalConversions += campaign.conversions
      acc.totalUnsafeBlocks += campaign.blockedBySafetyCount
      return acc
    },
    {
      totalBudgetCents: 0,
      totalSpentCents: 0,
      totalImpressions: 0,
      totalClicks: 0,
      totalConversions: 0,
      totalUnsafeBlocks: 0,
    }
  )

  const conversion = resolveAdConversionMetrics({
    impressions: summaryCore.totalImpressions,
    clicks: summaryCore.totalClicks,
    conversions: summaryCore.totalConversions,
    spendCents: summaryCore.totalSpentCents,
  })

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-3">
            <CardTitle>广告与推荐位商业策略</CardTitle>
            <Badge variant="secondary">Week20-003</Badge>
            <Badge>{snapshot.plan.name}</Badge>
          </div>
          <CardDescription>
            建立推荐位投放规则与审核流程，支持广告统计与转化追踪，实现预算时段控制并确保内容安全兼容。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AdStrategyPanel
            hasAccess={hasAccess}
            planId={snapshot.plan.id}
            rules={rules.map((item) => ({
              id: item.id,
              name: item.name,
              placementType: item.placementType,
              audienceSegment: item.audienceSegment,
              biddingModel: item.biddingModel,
              bidPriceCents: item.bidPriceCents,
              dailyBudgetCapCents: item.dailyBudgetCapCents,
              conversionTarget: item.conversionTarget,
              active: item.active,
            }))}
            campaigns={campaigns.map((item) => ({
              id: item.id,
              ruleId: item.ruleId,
              title: item.title,
              advertiser: item.advertiser,
              status: item.status,
              budgetCents: item.budgetCents,
              spentCents: item.spentCents,
              impressions: item.impressions,
              clicks: item.clicks,
              conversions: item.conversions,
              blockedBySafetyCount: item.blockedBySafetyCount,
              startAt: item.startAt.toISOString(),
              endAt: item.endAt.toISOString(),
              reviewNote: item.reviewNote,
            }))}
            summary={{
              ...summaryCore,
              ...conversion,
            }}
          />
        </CardContent>
      </Card>
    </div>
  )
}
