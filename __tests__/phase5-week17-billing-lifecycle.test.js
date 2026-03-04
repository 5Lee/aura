import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const schemaSource = readFileSync(new URL("../prisma/schema.prisma", import.meta.url), "utf8")
const billingLibSource = readFileSync(
  new URL("../lib/subscription-billing.ts", import.meta.url),
  "utf8"
)
const lifecycleSource = readFileSync(
  new URL("../lib/subscription-lifecycle.ts", import.meta.url),
  "utf8"
)
const checkoutRouteSource = readFileSync(
  new URL("../app/api/subscription/checkout/route.ts", import.meta.url),
  "utf8"
)
const webhookRouteSource = readFileSync(
  new URL("../app/api/subscription/webhook/route.ts", import.meta.url),
  "utf8"
)
const phase5FeatureList = JSON.parse(
  readFileSync(new URL("../feature_list_phase5_commercialization.json", import.meta.url), "utf8")
)

test("prisma schema includes subscription lifecycle and billing event models", () => {
  assert.match(schemaSource, /model Subscription \{/)
  assert.match(schemaSource, /model BillingEvent \{/)
  assert.match(schemaSource, /enum SubscriptionStatus \{/)
  assert.match(schemaSource, /enum BillingEventProcessStatus \{/)
  assert.match(schemaSource, /@@unique\(\[provider, providerEventId\]\)/)
})

test("billing provider abstraction exposes create, cancel, renew and webhook verification", () => {
  assert.match(billingLibSource, /interface BillingProviderAdapter/)
  assert.match(billingLibSource, /createSubscription\(/)
  assert.match(billingLibSource, /cancelSubscription\(/)
  assert.match(billingLibSource, /renewSubscription\(/)
  assert.match(billingLibSource, /verifyWebhookSignature\(/)
  assert.match(billingLibSource, /timingSafeEqual/)
})

test("subscription lifecycle maps provider events to local state transitions", () => {
  assert.match(lifecycleSource, /resolveSubscriptionStatusFromEvent/)
  assert.match(lifecycleSource, /SubscriptionStatus\.PAST_DUE/)
  assert.match(lifecycleSource, /SubscriptionStatus\.CANCELED/)
  assert.match(lifecycleSource, /buildSubscriptionPatchFromWebhook/)
})

test("checkout route creates subscription via billing provider and persists billing event", () => {
  assert.match(checkoutRouteSource, /provider\.createSubscription/)
  assert.match(checkoutRouteSource, /prisma\.subscription\.upsert/)
  assert.match(checkoutRouteSource, /prisma\.billingEvent\.create/)
})

test("webhook route enforces signature validation and idempotent event processing", () => {
  assert.match(webhookRouteSource, /verifyWebhookSignature/)
  assert.match(webhookRouteSource, /provider_providerEventId/)
  assert.match(webhookRouteSource, /BillingEventProcessStatus\.PROCESSED/)
  assert.match(webhookRouteSource, /BillingEventProcessStatus\.FAILED/)
  assert.match(webhookRouteSource, /buildSubscriptionPatchFromWebhook/)
})

test("phase5 tracker marks week17-002 as completed with metadata sync", () => {
  assert.equal(phase5FeatureList.meta.total_features, 16)
  assert.ok(phase5FeatureList.meta.completed_features >= 2)
  const feature = phase5FeatureList.features.find((item) => item.id === "phase5-week17-002")
  assert.ok(feature)
  assert.equal(feature.passes, true)
})
