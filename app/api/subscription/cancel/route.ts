import { BillingEventProcessStatus, SubscriptionStatus } from "@prisma/client"
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"

import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { getBillingProvider } from "@/lib/subscription-billing"

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 })
  }

  try {
    const body = await request.json().catch(() => ({}))
    const atPeriodEnd = body.atPeriodEnd !== false

    const subscription = await prisma.subscription.findFirst({
      where: {
        userId: session.user.id,
        status: {
          in: [SubscriptionStatus.TRIALING, SubscriptionStatus.ACTIVE, SubscriptionStatus.PAST_DUE],
        },
      },
      orderBy: { createdAt: "desc" },
    })

    if (!subscription || !subscription.externalSubscriptionId) {
      return NextResponse.json({ error: "未找到可取消的订阅" }, { status: 404 })
    }

    const provider = getBillingProvider(subscription.provider)
    const cancelResult = await provider.cancelSubscription({
      externalSubscriptionId: subscription.externalSubscriptionId,
      atPeriodEnd,
      currentStatus: subscription.status,
    })

    const updated = await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        status: cancelResult.status,
        cancelAtPeriodEnd: cancelResult.cancelAtPeriodEnd,
        canceledAt: cancelResult.canceledAt,
      },
    })

    await prisma.billingEvent.create({
      data: {
        userId: session.user.id,
        subscriptionId: subscription.id,
        provider: subscription.provider,
        providerEventId: `local_cancel_${Date.now()}`,
        type: atPeriodEnd ? "subscription.cancel.scheduled" : "subscription.cancel.immediate",
        status: BillingEventProcessStatus.PROCESSED,
        payload: {
          atPeriodEnd,
          status: cancelResult.status,
        },
        processedAt: new Date(),
      },
    })

    return NextResponse.json({
      subscription: updated,
      canceled: true,
    })
  } catch (error) {
    console.error("Cancel subscription failed:", error)
    return NextResponse.json({ error: "取消订阅失败，请稍后重试" }, { status: 500 })
  }
}
