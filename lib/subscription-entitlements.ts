import { SubscriptionStatus } from "@prisma/client"

import { prisma } from "@/lib/db"
import {
  getSubscriptionPlanById,
  isSubscriptionPlanId,
  type PlanLimitValue,
  type SubscriptionPlan,
  type SubscriptionPlanId,
} from "@/lib/subscription-plans"

const PAID_ACCESS_STATUSES = new Set<SubscriptionStatus>([
  SubscriptionStatus.TRIALING,
  SubscriptionStatus.ACTIVE,
  SubscriptionStatus.PAST_DUE,
])

const ADVANCED_ANALYTICS_PLANS = new Set<SubscriptionPlanId>(["pro", "team", "enterprise"])

function resolveEffectivePlanId(rawPlanId: string | null, status: SubscriptionStatus | null) {
  if (!rawPlanId || !isSubscriptionPlanId(rawPlanId)) {
    return "free" as SubscriptionPlanId
  }

  if (!status || !PAID_ACCESS_STATUSES.has(status)) {
    return "free" as SubscriptionPlanId
  }

  return rawPlanId
}

function toPercent(current: number, limit: PlanLimitValue) {
  if (limit === "unlimited" || limit <= 0) {
    return 0
  }
  return Math.min(100, Math.round((current / limit) * 100))
}

export function isLimitExceeded(limit: PlanLimitValue, current: number, increase = 0) {
  if (limit === "unlimited") {
    return false
  }
  return current + increase > limit
}

export async function getUserEntitlementSnapshot(userId: string) {
  const monthStart = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)

  const [subscription, promptCount, privatePromptCount, monthlyEvalRuns] = await prisma.$transaction([
    prisma.subscription.findFirst({
      where: { userId },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    }),
    prisma.prompt.count({
      where: { authorId: userId },
    }),
    prisma.prompt.count({
      where: { authorId: userId, isPublic: false },
    }),
    prisma.promptEvalRun.count({
      where: {
        triggeredById: userId,
        createdAt: {
          gte: monthStart,
        },
      },
    }),
  ])

  const effectivePlanId = resolveEffectivePlanId(subscription?.planId ?? null, subscription?.status ?? null)
  const plan = getSubscriptionPlanById(effectivePlanId)

  return {
    subscription,
    plan,
    usage: {
      promptCount,
      privatePromptCount,
      monthlyEvalRuns,
      promptUsagePercent: toPercent(promptCount, plan.limits.maxPrompts),
      privatePromptUsagePercent: toPercent(privatePromptCount, plan.limits.maxPrivatePrompts),
      evalUsagePercent: toPercent(monthlyEvalRuns, plan.limits.maxEvalRunsPerMonth),
    },
  }
}

export function hasAdvancedAnalyticsAccess(planId: string) {
  if (!isSubscriptionPlanId(planId)) {
    return false
  }
  return ADVANCED_ANALYTICS_PLANS.has(planId)
}

export function getPlanLimitHint(plan: SubscriptionPlan, key: keyof SubscriptionPlan["limits"]) {
  const value = plan.limits[key]
  if (value === "unlimited") {
    return `${plan.name} 套餐该项不限`
  }
  return `${plan.name} 套餐上限 ${value}`
}

export async function validatePromptCreationQuota(userId: string, isPublic: boolean) {
  const snapshot = await getUserEntitlementSnapshot(userId)

  if (isLimitExceeded(snapshot.plan.limits.maxPrompts, snapshot.usage.promptCount, 1)) {
    return {
      ok: false as const,
      error: `已达到提示词数量上限（${getPlanLimitHint(snapshot.plan, "maxPrompts")}）`,
      snapshot,
    }
  }

  if (!isPublic && isLimitExceeded(snapshot.plan.limits.maxPrivatePrompts, snapshot.usage.privatePromptCount, 1)) {
    return {
      ok: false as const,
      error: `已达到私有提示词上限（${getPlanLimitHint(snapshot.plan, "maxPrivatePrompts")}）`,
      snapshot,
    }
  }

  return {
    ok: true as const,
    snapshot,
  }
}

export async function validatePrivateVisibilityTransition(
  userId: string,
  currentIsPublic: boolean,
  nextIsPublic: boolean
) {
  if (!currentIsPublic || nextIsPublic) {
    return {
      ok: true as const,
    }
  }

  const snapshot = await getUserEntitlementSnapshot(userId)
  if (isLimitExceeded(snapshot.plan.limits.maxPrivatePrompts, snapshot.usage.privatePromptCount, 1)) {
    return {
      ok: false as const,
      error: `私有提示词配额不足，请升级套餐后再改为私有（${getPlanLimitHint(snapshot.plan, "maxPrivatePrompts")}）`,
      snapshot,
    }
  }

  return {
    ok: true as const,
    snapshot,
  }
}
