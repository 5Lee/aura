import { BillingEventProcessStatus, SubscriptionStatus } from "@prisma/client"
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"

import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { getBillingProvider } from "@/lib/subscription-billing"

export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 })
  }

  try {
    const subscription = await prisma.subscription.findFirst({
      where: { userId: session.user.id },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    })

    if (!subscription) {
      return NextResponse.json({ error: "未找到可恢复的订阅" }, { status: 404 })
    }

    let status = subscription.status
    let currentPeriodStart = subscription.currentPeriodStart
    let currentPeriodEnd = subscription.currentPeriodEnd

    if (subscription.externalSubscriptionId) {
      const provider = getBillingProvider(subscription.provider)
      const renewed = await provider.renewSubscription({
        externalSubscriptionId: subscription.externalSubscriptionId,
      })
      status = renewed.status
      currentPeriodStart = renewed.currentPeriodStart
      currentPeriodEnd = renewed.currentPeriodEnd
    } else if (
      subscription.status === SubscriptionStatus.CANCELED ||
      subscription.status === SubscriptionStatus.EXPIRED
    ) {
      status = SubscriptionStatus.ACTIVE
    }

    const updated = await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        status,
        cancelAtPeriodEnd: false,
        canceledAt: null,
        currentPeriodStart,
        currentPeriodEnd,
      },
    })

    await prisma.billingEvent.create({
      data: {
        userId: session.user.id,
        subscriptionId: subscription.id,
        provider: subscription.provider,
        providerEventId: `local_resume_${Date.now()}`,
        type: "subscription.resume.requested",
        status: BillingEventProcessStatus.PROCESSED,
        payload: {
          previousStatus: subscription.status,
          status: updated.status,
        },
        processedAt: new Date(),
      },
    })

    return NextResponse.json({
      subscription: updated,
      resumed: true,
    })
  } catch (error) {
    console.error("Resume subscription failed:", error)
    return NextResponse.json({ error: "恢复订阅失败，请稍后重试" }, { status: 500 })
  }
}
