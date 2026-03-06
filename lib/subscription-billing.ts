import { createHmac, randomUUID, timingSafeEqual } from "node:crypto"
import {
  BillingCycle,
  BillingProvider,
  SubscriptionStatus,
  type Prisma,
} from "@prisma/client"

type SubscriptionMetadata = Prisma.JsonObject | undefined

export type CreateSubscriptionInput = {
  userId: string
  email: string
  planId: string
  cycle: BillingCycle
  trialDays: number
  metadata?: SubscriptionMetadata
}

export type CreateSubscriptionResult = {
  provider: BillingProvider
  externalCustomerId: string
  externalSubscriptionId: string
  status: SubscriptionStatus
  trialEndsAt: Date | null
  currentPeriodStart: Date
  currentPeriodEnd: Date
  metadata?: SubscriptionMetadata
}

export type CancelSubscriptionInput = {
  externalSubscriptionId: string
  atPeriodEnd: boolean
  currentStatus?: SubscriptionStatus
}

export type CancelSubscriptionResult = {
  status: SubscriptionStatus
  cancelAtPeriodEnd: boolean
  canceledAt: Date | null
}

export type RenewSubscriptionInput = {
  externalSubscriptionId: string
}

export type RenewSubscriptionResult = {
  status: SubscriptionStatus
  currentPeriodStart: Date
  currentPeriodEnd: Date
}

export type BillingWebhookEventData = {
  userId?: string
  planId?: string
  cycle?: BillingCycle
  providerStatus?: string
  externalCustomerId?: string
  externalSubscriptionId?: string
  cancelAtPeriodEnd?: boolean
  currentPeriodStart?: Date | null
  currentPeriodEnd?: Date | null
  trialEndsAt?: Date | null
  metadata?: SubscriptionMetadata
}

export type BillingWebhookEvent = {
  provider: BillingProvider
  providerEventId: string
  type: string
  occurredAt: Date
  data: BillingWebhookEventData
  payload: Prisma.JsonObject
}

export interface BillingProviderAdapter {
  name: BillingProvider
  createSubscription(input: CreateSubscriptionInput): Promise<CreateSubscriptionResult>
  cancelSubscription(input: CancelSubscriptionInput): Promise<CancelSubscriptionResult>
  renewSubscription(input: RenewSubscriptionInput): Promise<RenewSubscriptionResult>
  verifyWebhookSignature(rawBody: string, signature: string, secret: string): boolean
  parseWebhookEvent(rawBody: string): BillingWebhookEvent
}

function getCycleDays(cycle: BillingCycle) {
  return cycle === BillingCycle.YEARLY ? 365 : 30
}

function parseDateOrNull(value: unknown) {
  if (!value || typeof value !== "string") {
    return null
  }
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function parseCycle(value: unknown) {
  if (value === BillingCycle.YEARLY || value === "YEARLY") {
    return BillingCycle.YEARLY
  }
  return BillingCycle.MONTHLY
}

function buildMockSignature(rawBody: string, secret: string) {
  return createHmac("sha256", secret).update(rawBody).digest("hex")
}

function stripSignaturePrefix(signature: string) {
  return signature.startsWith("sha256=") ? signature.slice(7) : signature
}

function safeCompareSignature(actual: string, expected: string) {
  const actualBuffer = Buffer.from(actual)
  const expectedBuffer = Buffer.from(expected)

  if (actualBuffer.length !== expectedBuffer.length) {
    return false
  }

  return timingSafeEqual(actualBuffer, expectedBuffer)
}

class MockBillingProvider implements BillingProviderAdapter {
  readonly name = BillingProvider.MOCKPAY

  async createSubscription(input: CreateSubscriptionInput): Promise<CreateSubscriptionResult> {
    const now = new Date()
    const currentPeriodStart = now
    const currentPeriodEnd = new Date(now.getTime() + getCycleDays(input.cycle) * 24 * 60 * 60 * 1000)
    const trialEndsAt =
      input.trialDays > 0 ? new Date(now.getTime() + input.trialDays * 24 * 60 * 60 * 1000) : null

    return {
      provider: this.name,
      externalCustomerId: `mock_cus_${randomUUID().replace(/-/g, "").slice(0, 16)}`,
      externalSubscriptionId: `mock_sub_${randomUUID().replace(/-/g, "").slice(0, 16)}`,
      status: trialEndsAt ? SubscriptionStatus.TRIALING : SubscriptionStatus.ACTIVE,
      trialEndsAt,
      currentPeriodStart,
      currentPeriodEnd,
      metadata: input.metadata,
    }
  }

  async cancelSubscription(input: CancelSubscriptionInput): Promise<CancelSubscriptionResult> {
    return {
      status: input.atPeriodEnd ? input.currentStatus ?? SubscriptionStatus.ACTIVE : SubscriptionStatus.CANCELED,
      cancelAtPeriodEnd: input.atPeriodEnd,
      canceledAt: input.atPeriodEnd ? null : new Date(),
    }
  }

  async renewSubscription(_: RenewSubscriptionInput): Promise<RenewSubscriptionResult> {
    const now = new Date()
    return {
      status: SubscriptionStatus.ACTIVE,
      currentPeriodStart: now,
      currentPeriodEnd: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
    }
  }

  verifyWebhookSignature(rawBody: string, signature: string, secret: string) {
    const normalizedSignature = stripSignaturePrefix(signature)
    if (!normalizedSignature || !secret) {
      return false
    }

    const expected = buildMockSignature(rawBody, secret)
    return safeCompareSignature(normalizedSignature, expected)
  }

  parseWebhookEvent(rawBody: string): BillingWebhookEvent {
    const payload = JSON.parse(rawBody) as Record<string, unknown>
    const data = (payload.data ?? {}) as Record<string, unknown>
    const providerEventId = String(payload.id ?? "").trim()
    const type = String(payload.type ?? "").trim()
    if (!providerEventId || !type) {
      throw new Error("Invalid billing webhook event")
    }

    const occurredAt = parseDateOrNull(payload.createdAt) ?? new Date()
    const metadata = data.metadata && typeof data.metadata === "object" ? (data.metadata as Prisma.JsonObject) : undefined

    return {
      provider: this.name,
      providerEventId,
      type,
      occurredAt,
      data: {
        userId: typeof data.userId === "string" ? data.userId : undefined,
        planId: typeof data.planId === "string" ? data.planId : undefined,
        cycle: parseCycle(data.cycle),
        providerStatus: typeof data.status === "string" ? data.status : undefined,
        externalCustomerId: typeof data.customerId === "string" ? data.customerId : undefined,
        externalSubscriptionId:
          typeof data.subscriptionId === "string" ? data.subscriptionId : undefined,
        cancelAtPeriodEnd: Boolean(data.cancelAtPeriodEnd),
        currentPeriodStart: parseDateOrNull(data.currentPeriodStart),
        currentPeriodEnd: parseDateOrNull(data.currentPeriodEnd),
        trialEndsAt: parseDateOrNull(data.trialEndsAt),
        metadata,
      },
      payload: payload as Prisma.JsonObject,
    }
  }
}

const mockBillingProvider = new MockBillingProvider()

export function resolveBillingProviderName(provider?: string | null) {
  const value = String(provider ?? process.env.AURA_BILLING_PROVIDER ?? BillingProvider.MOCKPAY)
    .trim()
    .toUpperCase()
  return value === BillingProvider.MOCKPAY ? BillingProvider.MOCKPAY : BillingProvider.MOCKPAY
}

export function getBillingProvider(provider?: BillingProvider | string | null) {
  const providerName =
    typeof provider === "string" ? resolveBillingProviderName(provider) : provider ?? resolveBillingProviderName()

  switch (providerName) {
    case BillingProvider.MOCKPAY:
    default:
      return mockBillingProvider
  }
}
