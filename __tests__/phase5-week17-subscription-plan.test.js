import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const subscriptionPlansSource = readFileSync(
  new URL("../lib/subscription-plans.ts", import.meta.url),
  "utf8"
)
const pricingPageSource = readFileSync(new URL("../app/pricing/page.tsx", import.meta.url), "utf8")
const plansApiSource = readFileSync(
  new URL("../app/api/subscription/plans/route.ts", import.meta.url),
  "utf8"
)
const homeHeaderSource = readFileSync(
  new URL("../components/layout/home-header.tsx", import.meta.url),
  "utf8"
)
const dashboardNavbarSource = readFileSync(
  new URL("../components/layout/navbar.tsx", import.meta.url),
  "utf8"
)
const phase5FeatureList = JSON.parse(
  readFileSync(new URL("../feature_list_phase5_commercialization.json", import.meta.url), "utf8")
)

test("subscription plan catalog defines four commercial tiers", () => {
  assert.match(subscriptionPlansSource, /id: "free"/)
  assert.match(subscriptionPlansSource, /id: "pro"/)
  assert.match(subscriptionPlansSource, /id: "team"/)
  assert.match(subscriptionPlansSource, /id: "enterprise"/)
  assert.match(subscriptionPlansSource, /recommended: true/)
})

test("subscription plans api exposes the shared catalog", () => {
  assert.match(plansApiSource, /plans: subscriptionPlans/)
  assert.match(plansApiSource, /currency: "CNY"/)
})

test("pricing page renders plan cards and a comparison table", () => {
  assert.match(pricingPageSource, /subscriptionPlans\.map/)
  assert.match(pricingPageSource, /Aura 商业化套餐设计/)
  assert.match(pricingPageSource, /<table/)
})

test("public and dashboard navigation both include pricing entry", () => {
  assert.match(homeHeaderSource, /href="\/pricing"/)
  assert.match(dashboardNavbarSource, /href: "\/pricing"/)
})

test("phase5 tracker starts with week17-001 completed", () => {
  assert.equal(phase5FeatureList.meta.total_features, 16)
  assert.equal(phase5FeatureList.meta.completed_features, 1)

  const firstFeature = phase5FeatureList.features.find((feature) => feature.id === "phase5-week17-001")
  assert.ok(firstFeature)
  assert.equal(firstFeature.passes, true)
})
