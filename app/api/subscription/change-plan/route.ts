import {
  BillingCycle,
  BillingEventProcessStatus,
  SubscriptionStatus,
} from "@prisma/client"
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"

import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { getBillingProvider } from "@/lib/subscription-billing"
import { normalizeBillingCycle } from "@/lib/subscription-lifecycle"
import { getSubscriptionPlanById, isSubscriptionPlanId } from "@/lib/subscription-plans"

function normalizePlanId(value: unknown) {
  const raw = String(value ?? "free").trim().toLowerCase()
  return isSubscriptionPlanId(raw) ? raw : "free"
}

function resolvePeriodEnd(cycle: BillingCycle) {
  const now = new Date()
  const days = cycle === BillingCycle.YEARLY ? 365 : 30
  return new Date(now.getTime() + days * 24 * 60 * 60 * 1000)
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || !session.user.email) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 })
  }

  try {
    const body = await request.json().catch(() => ({}))
    const targetPlanId = normalizePlanId(body.planId)
    const cycle = normalizeBillingCycle(body.cycle)
    const targetPlan = getSubscriptionPlanById(targetPlanId)
    const now = new Date()

    const subscription = await prisma.subscription.findFirst({
      where: {
        userId: session.user.id,
      },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    })

    let updatedSubscription = subscription

    if (!subscription && targetPlanId === "free") {
      return NextResponse.json({
        subscription: null,
        plan: targetPlan,
        message: "当前已是免费套餐",
      })
    }

    if (!subscription) {
      const provider = getBillingProvider()
      const created = await provider.createSubscription({
        userId: session.user.id,
        email: session.user.email,
        planId: targetPlanId,
        cycle,
        trialDays: targetPlan.trialDays,
        metadata: {
          source: "change-plan",
        },
      })

      updatedSubscription = await prisma.subscription.create({
        data: {
          userId: session.user.id,
          provider: created.provider,
          externalCustomerId: created.externalCustomerId,
          externalSubscriptionId: created.externalSubscriptionId,
          planId: targetPlanId,
          cycle,
          status: created.status,
          cancelAtPeriodEnd: false,
          trialEndsAt: created.trialEndsAt,
          currentPeriodStart: created.currentPeriodStart,
          currentPeriodEnd: created.currentPeriodEnd,
          metadata: created.metadata,
        },
      })
    } else if (targetPlanId === "free") {
      updatedSubscription = await prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          planId: "free",
          status: SubscriptionStatus.CANCELED,
          cancelAtPeriodEnd: false,
          canceledAt: now,
        },
      })
    } else {
      updatedSubscription = await prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          planId: targetPlanId,
          cycle,
          status: SubscriptionStatus.ACTIVE,
          cancelAtPeriodEnd: false,
          canceledAt: null,
          currentPeriodStart: now,
          currentPeriodEnd: resolvePeriodEnd(cycle),
        },
      })
    }

    await prisma.billingEvent.create({
      data: {
        userId: session.user.id,
        subscriptionId: updatedSubscription?.id,
        provider: updatedSubscription?.provider,
        providerEventId: `local_plan_change_${Date.now()}`,
        type: "subscription.plan.changed",
        status: BillingEventProcessStatus.PROCESSED,
        payload: {
          targetPlanId,
          cycle,
          previousPlanId: subscription?.planId ?? null,
          changedAt: now.toISOString(),
        },
        processedAt: now,
      },
    })

    return NextResponse.json({
      subscription: updatedSubscription,
      plan: targetPlan,
      changed: true,
    })
  } catch (error) {
    console.error("Change subscription plan failed:", error)
    return NextResponse.json({ error: "套餐切换失败，请稍后重试" }, { status: 500 })
  }
}
