import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"

import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { getUserEntitlementSnapshot, hasApiPricingAccess } from "@/lib/subscription-entitlements"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 })
  }

  const snapshot = await getUserEntitlementSnapshot(session.user.id)
  if (!hasApiPricingAccess(snapshot.plan.id)) {
    return NextResponse.json(
      {
        error: "API 定价与配额策略仅对 Pro / Team / Enterprise 套餐开放",
        upgradeRequired: true,
      },
      { status: 403 }
    )
  }

  const [records, alerts, purchases] = await Promise.all([
    prisma.apiUsageRecord.findMany({
      where: {
        userId: session.user.id,
      },
      orderBy: [{ createdAt: "desc" }],
      take: 200,
    }),
    prisma.apiQuotaAlert.findMany({
      where: {
        userId: session.user.id,
      },
      orderBy: [{ createdAt: "desc" }],
      take: 100,
    }),
    prisma.apiOveragePurchase.findMany({
      where: {
        userId: session.user.id,
      },
      orderBy: [{ createdAt: "desc" }],
      take: 100,
    }),
  ])

  const byModel = records.reduce(
    (acc, row) => {
      const current = acc[row.modelTier] || { requestCount: 0, amountCents: 0 }
      current.requestCount += row.requestCount
      current.amountCents += row.amountCents
      acc[row.modelTier] = current
      return acc
    },
    {} as Record<string, { requestCount: number; amountCents: number }>
  )

  const blockedCount = records.filter((row) => row.blocked).length

  return NextResponse.json({
    usage: {
      totalRequestCount: records.reduce((sum, row) => sum + row.requestCount, 0),
      totalAmountCents: records.reduce((sum, row) => sum + row.amountCents, 0),
      blockedCount,
      byModel,
    },
    alerts,
    purchases,
  })
}
