import { createHash, randomBytes } from "node:crypto"

import { ApiModelTier, type ApiKeyStatus } from "@prisma/client"

import { getSubscriptionPlanById, isSubscriptionPlanId, type SubscriptionPlanId } from "@/lib/subscription-plans"

export type ApiModelPricing = {
  modelTier: ApiModelTier
  unitPriceCents: number
  defaultRateLimitPerMinute: number
}

export const API_MODEL_PRICING_MATRIX: Record<ApiModelTier, ApiModelPricing> = {
  [ApiModelTier.BASIC]: {
    modelTier: ApiModelTier.BASIC,
    unitPriceCents: 2,
    defaultRateLimitPerMinute: 120,
  },
  [ApiModelTier.ADVANCED]: {
    modelTier: ApiModelTier.ADVANCED,
    unitPriceCents: 8,
    defaultRateLimitPerMinute: 60,
  },
  [ApiModelTier.PREMIUM]: {
    modelTier: ApiModelTier.PREMIUM,
    unitPriceCents: 20,
    defaultRateLimitPerMinute: 20,
  },
}

export type ApiQuotaPolicy = {
  planId: SubscriptionPlanId
  maxApiKeys: number | "unlimited"
  maxApiCallsPerMonth: number | "unlimited"
  defaultOveragePackUnits: number
  overagePackPriceCents: number
}

export function resolveApiQuotaPolicy(planId: string): ApiQuotaPolicy {
  const normalizedPlan = isSubscriptionPlanId(planId) ? planId : "free"
  const plan = getSubscriptionPlanById(normalizedPlan)

  if (normalizedPlan === "enterprise") {
    return {
      planId: normalizedPlan,
      maxApiKeys: "unlimited",
      maxApiCallsPerMonth: "unlimited",
      defaultOveragePackUnits: 500000,
      overagePackPriceCents: 29900,
    }
  }

  if (normalizedPlan === "team") {
    return {
      planId: normalizedPlan,
      maxApiKeys: plan.limits.maxApiKeys,
      maxApiCallsPerMonth: plan.limits.maxApiCallsPerMonth,
      defaultOveragePackUnits: 100000,
      overagePackPriceCents: 9900,
    }
  }

  if (normalizedPlan === "pro") {
    return {
      planId: normalizedPlan,
      maxApiKeys: plan.limits.maxApiKeys,
      maxApiCallsPerMonth: plan.limits.maxApiCallsPerMonth,
      defaultOveragePackUnits: 50000,
      overagePackPriceCents: 5900,
    }
  }

  return {
    planId: normalizedPlan,
    maxApiKeys: plan.limits.maxApiKeys,
    maxApiCallsPerMonth: plan.limits.maxApiCallsPerMonth,
    defaultOveragePackUnits: 10000,
    overagePackPriceCents: 1990,
  }
}

export function generateRawApiKey() {
  return `aura_live_${randomBytes(24).toString("hex")}`
}

export function hashApiKey(rawKey: string) {
  return createHash("sha256").update(rawKey).digest("hex")
}

export function resolveApiKeyPrefix(rawKey: string) {
  if (!rawKey.startsWith("aura_live_")) {
    return rawKey.slice(0, 12)
  }
  return rawKey.slice(0, 18)
}

export function maskApiKeyPrefix(keyPrefix: string) {
  return `${keyPrefix}********`
}

export function resolveMonthWindow(now = new Date()) {
  const start = new Date(now)
  start.setDate(1)
  start.setHours(0, 0, 0, 0)

  const end = new Date(start)
  end.setMonth(end.getMonth() + 1)
  return {
    start,
    end,
  }
}

export function shouldRotateMonthWindow(windowEnd: Date, now = new Date()) {
  return now.getTime() >= windowEnd.getTime()
}

export function resolveApiKeyStatus(value: unknown): ApiKeyStatus {
  const normalized = String(value ?? "").trim().toUpperCase()
  if (normalized === "DISABLED") {
    return "DISABLED"
  }
  if (normalized === "REVOKED") {
    return "REVOKED"
  }
  return "ACTIVE"
}

export function calculateApiUsageCharge(modelTier: ApiModelTier, billableUnits: number) {
  const pricing = API_MODEL_PRICING_MATRIX[modelTier]
  const normalizedUnits = Math.max(1, Math.floor(billableUnits))
  return {
    modelTier,
    billableUnits: normalizedUnits,
    unitPriceCents: pricing.unitPriceCents,
    amountCents: pricing.unitPriceCents * normalizedUnits,
  }
}

export function resolveRateLimitDecision({
  requestsLastMinute,
  rateLimitPerMinute,
  incomingRequests,
}: {
  requestsLastMinute: number
  rateLimitPerMinute: number
  incomingRequests: number
}) {
  const normalizedRateLimit = Math.max(1, Math.floor(rateLimitPerMinute))
  const normalizedIncoming = Math.max(1, Math.floor(incomingRequests))
  const projected = requestsLastMinute + normalizedIncoming
  return {
    allowed: projected <= normalizedRateLimit,
    requestsLastMinute,
    projected,
    rateLimitPerMinute: normalizedRateLimit,
  }
}

export function resolveMonthlyQuotaDecision({
  consumedCallsMonth,
  monthlyQuota,
  incomingRequests,
}: {
  consumedCallsMonth: number
  monthlyQuota: number
  incomingRequests: number
}) {
  const normalizedQuota = Math.max(0, Math.floor(monthlyQuota))
  const normalizedIncoming = Math.max(1, Math.floor(incomingRequests))
  const projected = consumedCallsMonth + normalizedIncoming
  const usagePercent = normalizedQuota <= 0 ? 100 : Math.round((projected / normalizedQuota) * 100)

  return {
    allowed: projected <= normalizedQuota,
    projected,
    usagePercent,
    monthlyQuota: normalizedQuota,
  }
}

export function resolveApiAbuseSignal({
  blockedByRateLimit,
  blockedByQuota,
  callsInWindow,
}: {
  blockedByRateLimit: boolean
  blockedByQuota: boolean
  callsInWindow: number
}) {
  if (blockedByRateLimit && callsInWindow >= 3) {
    return {
      highRisk: true,
      reason: "rate-limit-burst",
    }
  }
  if (blockedByQuota) {
    return {
      highRisk: false,
      reason: "quota-exhausted",
    }
  }
  return {
    highRisk: false,
    reason: "none",
  }
}

export function resolveOveragePackPrice({
  packUnits,
  policy,
}: {
  packUnits: number
  policy: ApiQuotaPolicy
}) {
  const normalizedUnits = Math.max(1, Math.floor(packUnits))
  const unitPrice = policy.overagePackPriceCents / Math.max(1, policy.defaultOveragePackUnits)
  const amountCents = Math.max(1, Math.round(unitPrice * normalizedUnits))
  return {
    units: normalizedUnits,
    amountCents,
  }
}
