import { BillingEventProcessStatus, SubscriptionStatus } from "@prisma/client"
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"

import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { getBillingProvider } from "@/lib/subscription-billing"
import { normalizeBillingCycle } from "@/lib/subscription-lifecycle"
import { getSubscriptionPlanById, isSubscriptionPlanId } from "@/lib/subscription-plans"

function normalizePlanId(value: unknown) {
  const planId = String(value ?? "free").trim().toLowerCase()
  if (isSubscriptionPlanId(planId)) {
    return planId
  }
  return "free"
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || !session.user.email) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 })
  }

  try {
    const body = await request.json().catch(() => ({}))
    const planId = normalizePlanId(body.planId)
    const cycle = normalizeBillingCycle(body.cycle)
    const plan = getSubscriptionPlanById(planId)

    if (plan.id === "free") {
      return NextResponse.json({ error: "免费套餐无需结算" }, { status: 400 })
    }

    const provider = getBillingProvider()
    const createResult = await provider.createSubscription({
      userId: session.user.id,
      email: session.user.email,
      planId,
      cycle,
      trialDays: plan.trialDays,
      metadata: {
        source: "checkout",
      },
    })

    const subscription = await prisma.subscription.upsert({
      where: {
        externalSubscriptionId: createResult.externalSubscriptionId,
      },
      create: {
        userId: session.user.id,
        provider: createResult.provider,
        externalCustomerId: createResult.externalCustomerId,
        externalSubscriptionId: createResult.externalSubscriptionId,
        planId,
        cycle,
        status: createResult.status,
        trialEndsAt: createResult.trialEndsAt,
        currentPeriodStart: createResult.currentPeriodStart,
        currentPeriodEnd: createResult.currentPeriodEnd,
        cancelAtPeriodEnd: false,
        metadata: createResult.metadata,
      },
      update: {
        status: createResult.status,
        planId,
        cycle,
        externalCustomerId: createResult.externalCustomerId,
        trialEndsAt: createResult.trialEndsAt,
        currentPeriodStart: createResult.currentPeriodStart,
        currentPeriodEnd: createResult.currentPeriodEnd,
        cancelAtPeriodEnd: false,
        canceledAt: null,
      },
    })

    await prisma.billingEvent.create({
      data: {
        userId: session.user.id,
        subscriptionId: subscription.id,
        provider: createResult.provider,
        providerEventId: `local_create_${Date.now()}`,
        type: "subscription.create.requested",
        status: BillingEventProcessStatus.PROCESSED,
        payload: {
          planId,
          cycle,
          status: createResult.status,
        },
        processedAt: new Date(),
      },
    })

    if (subscription.status === SubscriptionStatus.PAST_DUE) {
      return NextResponse.json({ error: "订阅创建失败，请检查支付方式" }, { status: 402 })
    }

    return NextResponse.json({
      subscription,
      checkout: {
        provider: provider.name,
        billingCycle: cycle,
        nextAction: "await_webhook_confirmation",
      },
    })
  } catch (error) {
    console.error("Create subscription failed:", error)
    return NextResponse.json({ error: "订阅创建失败，请稍后重试" }, { status: 500 })
  }
}
