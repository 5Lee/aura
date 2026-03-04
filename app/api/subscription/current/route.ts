import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"

import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { getSubscriptionPlanById, isSubscriptionPlanId } from "@/lib/subscription-plans"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 })
  }

  const subscription = await prisma.subscription.findFirst({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  })

  if (!subscription) {
    return NextResponse.json({ subscription: null, plan: getSubscriptionPlanById("free") })
  }

  const planId = isSubscriptionPlanId(subscription.planId) ? subscription.planId : "free"

  return NextResponse.json({
    subscription,
    plan: getSubscriptionPlanById(planId),
  })
}
