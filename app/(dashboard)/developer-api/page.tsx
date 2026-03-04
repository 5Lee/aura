import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"

import { ApiPricingQuotaPanel } from "@/components/developer/api-pricing-quota-panel"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { authOptions } from "@/lib/auth"
import { resolveApiQuotaPolicy } from "@/lib/api-pricing"
import { prisma } from "@/lib/db"
import { getUserEntitlementSnapshot, hasApiPricingAccess } from "@/lib/subscription-entitlements"

export default async function DeveloperApiPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    redirect("/login")
  }

  const snapshot = await getUserEntitlementSnapshot(session.user.id)
  const hasAccess = hasApiPricingAccess(snapshot.plan.id)
  const policy = resolveApiQuotaPolicy(snapshot.plan.id)

  const [apiKeys, usageRecords, alerts, purchases] = await Promise.all([
    hasAccess
      ? prisma.apiKey.findMany({
          where: {
            userId: session.user.id,
          },
          orderBy: [{ createdAt: "desc" }],
          take: 30,
        })
      : Promise.resolve([]),
    hasAccess
      ? prisma.apiUsageRecord.findMany({
          where: {
            userId: session.user.id,
          },
          orderBy: [{ createdAt: "desc" }],
          take: 1000,
        })
      : Promise.resolve([]),
    hasAccess
      ? prisma.apiQuotaAlert.findMany({
          where: {
            userId: session.user.id,
          },
          orderBy: [{ createdAt: "desc" }],
          take: 100,
        })
      : Promise.resolve([]),
    hasAccess
      ? prisma.apiOveragePurchase.findMany({
          where: {
            userId: session.user.id,
          },
          orderBy: [{ createdAt: "desc" }],
          take: 100,
        })
      : Promise.resolve([]),
  ])

  const usageSummary = {
    totalRequestCount: usageRecords.reduce((sum, row) => sum + row.requestCount, 0),
    totalAmountCents: usageRecords.reduce((sum, row) => sum + row.amountCents, 0),
    blockedCount: usageRecords.filter((row) => row.blocked).length,
    byModel: usageRecords.reduce(
      (acc, row) => {
        const current = acc[row.modelTier] || { requestCount: 0, amountCents: 0 }
        current.requestCount += row.requestCount
        current.amountCents += row.amountCents
        acc[row.modelTier] = current
        return acc
      },
      {} as Record<string, { requestCount: number; amountCents: number }>
    ),
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-3">
            <CardTitle>API 定价与配额策略</CardTitle>
            <Badge variant="secondary">Week20-002</Badge>
            <Badge>{snapshot.plan.name}</Badge>
          </div>
          <CardDescription>
            按调用量与模型级别计费，联动 API Key 配额与限流策略，支持超量预警、自动扩容与滥用防护。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ApiPricingQuotaPanel
            hasAccess={hasAccess}
            planId={snapshot.plan.id}
            policy={{
              maxApiKeys: policy.maxApiKeys,
              maxApiCallsPerMonth: policy.maxApiCallsPerMonth,
              defaultOveragePackUnits: policy.defaultOveragePackUnits,
              overagePackPriceCents: policy.overagePackPriceCents,
            }}
            apiKeys={apiKeys.map((item) => ({
              id: item.id,
              name: item.name,
              keyPrefix: `${item.keyPrefix}********`,
              status: item.status,
              planId: item.planId,
              monthlyQuota: item.monthlyQuota,
              consumedCallsMonth: item.consumedCallsMonth,
              rateLimitPerMinute: item.rateLimitPerMinute,
              overageAutoPackEnabled: item.overageAutoPackEnabled,
              overagePackSize: item.overagePackSize,
              monthWindowStart: item.monthWindowStart.toISOString(),
              monthWindowEnd: item.monthWindowEnd.toISOString(),
              lastUsedAt: item.lastUsedAt?.toISOString() || null,
            }))}
            usageSummary={usageSummary}
            alerts={alerts.map((item) => ({
              id: item.id,
              type: item.type,
              status: item.status,
              thresholdPercent: item.thresholdPercent,
              observedPercent: item.observedPercent,
              message: item.message,
              createdAt: item.createdAt.toISOString(),
            }))}
            purchases={purchases.map((item) => ({
              id: item.id,
              units: item.units,
              amountCents: item.amountCents,
              status: item.status,
              createdAt: item.createdAt.toISOString(),
            }))}
          />
        </CardContent>
      </Card>
    </div>
  )
}
