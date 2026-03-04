import { BillingCycle, SubscriptionStatus, type Prisma } from "@prisma/client"

import { type BillingWebhookEvent } from "@/lib/subscription-billing"

export function normalizeBillingCycle(value: unknown) {
  if (value === BillingCycle.YEARLY || value === "YEARLY") {
    return BillingCycle.YEARLY
  }
  return BillingCycle.MONTHLY
}

function normalizeProviderStatus(value: string | undefined) {
  return String(value ?? "").trim().toLowerCase()
}

export function resolveSubscriptionStatusFromEvent(
  eventType: string,
  providerStatus: string | undefined,
  fallbackStatus: SubscriptionStatus = SubscriptionStatus.ACTIVE
) {
  const normalizedType = eventType.trim().toLowerCase()
  const normalizedProviderStatus = normalizeProviderStatus(providerStatus)

  if (
    normalizedType.includes("payment_failed") ||
    normalizedProviderStatus === "past_due" ||
    normalizedProviderStatus === "payment_failed"
  ) {
    return SubscriptionStatus.PAST_DUE
  }

  if (
    normalizedType.includes("canceled") ||
    normalizedType.includes("deleted") ||
    normalizedProviderStatus === "canceled"
  ) {
    return SubscriptionStatus.CANCELED
  }

  if (normalizedType.includes("expired") || normalizedProviderStatus === "expired") {
    return SubscriptionStatus.EXPIRED
  }

  if (normalizedType.includes("trial") || normalizedProviderStatus === "trialing") {
    return SubscriptionStatus.TRIALING
  }

  if (normalizedType.includes("renewed") || normalizedType.includes("paid") || normalizedProviderStatus === "active") {
    return SubscriptionStatus.ACTIVE
  }

  return fallbackStatus
}

export function buildSubscriptionPatchFromWebhook(
  event: BillingWebhookEvent,
  fallbackStatus: SubscriptionStatus = SubscriptionStatus.ACTIVE
) {
  const status = resolveSubscriptionStatusFromEvent(
    event.type,
    event.data.providerStatus,
    fallbackStatus
  )

  const patch: Prisma.SubscriptionUncheckedUpdateInput = {
    status,
    cancelAtPeriodEnd: event.data.cancelAtPeriodEnd ?? false,
  }

  if (event.data.planId) {
    patch.planId = event.data.planId
  }

  if (event.data.cycle) {
    patch.cycle = normalizeBillingCycle(event.data.cycle)
  }

  if (event.data.externalCustomerId) {
    patch.externalCustomerId = event.data.externalCustomerId
  }

  if (event.data.externalSubscriptionId) {
    patch.externalSubscriptionId = event.data.externalSubscriptionId
  }

  if (event.data.trialEndsAt !== undefined) {
    patch.trialEndsAt = event.data.trialEndsAt
  }

  if (event.data.currentPeriodStart !== undefined) {
    patch.currentPeriodStart = event.data.currentPeriodStart
  }

  if (event.data.currentPeriodEnd !== undefined) {
    patch.currentPeriodEnd = event.data.currentPeriodEnd
  }

  if (status === SubscriptionStatus.CANCELED || status === SubscriptionStatus.EXPIRED) {
    patch.canceledAt = new Date()
  } else {
    patch.canceledAt = null
  }

  if (event.data.metadata) {
    patch.metadata = event.data.metadata
  }

  return patch
}
