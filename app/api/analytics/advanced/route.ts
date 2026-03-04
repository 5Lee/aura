import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"

import { getAdvancedAnalyticsDashboard } from "@/lib/advanced-analytics"
import { authOptions } from "@/lib/auth"
import { getUserEntitlementSnapshot, hasAdvancedAnalyticsAccess } from "@/lib/subscription-entitlements"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 })
  }

  try {
    const entitlement = await getUserEntitlementSnapshot(session.user.id)
    const hasAccess = hasAdvancedAnalyticsAccess(entitlement.plan.id)

    if (!hasAccess) {
      return NextResponse.json(
        {
          error: "高级分析仅对 Pro / Team 套餐开放",
          currentPlan: entitlement.plan.id,
          upgradeRequired: true,
        },
        { status: 403 }
      )
    }

    const data = await getAdvancedAnalyticsDashboard(session.user.id)
    return NextResponse.json({
      data,
      currentPlan: entitlement.plan.id,
      upgradeRequired: false,
    })
  } catch (error) {
    console.error("Fetch advanced analytics failed:", error)
    return NextResponse.json({ error: "获取高级分析失败" }, { status: 500 })
  }
}
