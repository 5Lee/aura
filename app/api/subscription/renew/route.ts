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
      where: {
        userId: session.user.id,
      },
      orderBy: { createdAt: "desc" },
    })

    if (!subscription || !subscription.externalSubscriptionId) {
      return NextResponse.json({ error: "未找到可续费的订阅" }, { status: 404 })
    }

    const provider = getBillingProvider(subscription.provider)
    const renewResult = await provider.renewSubscription({
      externalSubscriptionId: subscription.externalSubscriptionId,
    })

    const updated = await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        status: renewResult.status,
        currentPeriodStart: renewResult.currentPeriodStart,
        currentPeriodEnd: renewResult.currentPeriodEnd,
        cancelAtPeriodEnd: false,
        canceledAt: renewResult.status === SubscriptionStatus.CANCELED ? new Date() : null,
      },
    })

    await prisma.billingEvent.create({
      data: {
        userId: session.user.id,
        subscriptionId: subscription.id,
        provider: subscription.provider,
        providerEventId: `local_renew_${Date.now()}`,
        type: "subscription.renew.requested",
        status: BillingEventProcessStatus.PROCESSED,
        payload: {
          status: renewResult.status,
          currentPeriodEnd: renewResult.currentPeriodEnd.toISOString(),
        },
        processedAt: new Date(),
      },
    })

    return NextResponse.json({
      subscription: updated,
      renewed: true,
    })
  } catch (error) {
    console.error("Renew subscription failed:", error)
    return NextResponse.json({ error: "续费失败，请稍后重试" }, { status: 500 })
  }
}
