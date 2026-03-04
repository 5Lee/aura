import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const schemaSource = readFileSync(new URL("../prisma/schema.prisma", import.meta.url), "utf8")
const subscriptionPlansSource = readFileSync(
  new URL("../lib/subscription-plans.ts", import.meta.url),
  "utf8"
)
const apiPricingLibSource = readFileSync(new URL("../lib/api-pricing.ts", import.meta.url), "utf8")
const entitlementsSource = readFileSync(
  new URL("../lib/subscription-entitlements.ts", import.meta.url),
  "utf8"
)
const keysRouteSource = readFileSync(
  new URL("../app/api/developer/keys/route.ts", import.meta.url),
  "utf8"
)
const keyRouteSource = readFileSync(
  new URL("../app/api/developer/keys/[id]/route.ts", import.meta.url),
  "utf8"
)
const consumeRouteSource = readFileSync(
  new URL("../app/api/developer/keys/[id]/consume/route.ts", import.meta.url),
  "utf8"
)
const usageRouteSource = readFileSync(
  new URL("../app/api/developer/usage/route.ts", import.meta.url),
  "utf8"
)
const overageRouteSource = readFileSync(
  new URL("../app/api/developer/overage/route.ts", import.meta.url),
  "utf8"
)
const developerApiPageSource = readFileSync(
  new URL("../app/(dashboard)/developer-api/page.tsx", import.meta.url),
  "utf8"
)
const apiPanelSource = readFileSync(
  new URL("../components/developer/api-pricing-quota-panel.tsx", import.meta.url),
  "utf8"
)
const navbarSource = readFileSync(new URL("../components/layout/navbar.tsx", import.meta.url), "utf8")
const mobileHeaderSource = readFileSync(
  new URL("../components/layout/mobile-page-header.tsx", import.meta.url),
  "utf8"
)
const middlewareSource = readFileSync(new URL("../middleware.ts", import.meta.url), "utf8")
const phase5FeatureList = JSON.parse(
  readFileSync(new URL("../feature_list_phase5_commercialization.json", import.meta.url), "utf8")
)

test("schema includes api key, usage, alert and overage purchase models", () => {
  assert.match(schemaSource, /enum ApiModelTier \{/) 
  assert.match(schemaSource, /enum ApiKeyStatus \{/) 
  assert.match(schemaSource, /enum ApiQuotaAlertStatus \{/) 
  assert.match(schemaSource, /model ApiKey \{/) 
  assert.match(schemaSource, /model ApiUsageRecord \{/) 
  assert.match(schemaSource, /model ApiQuotaAlert \{/) 
  assert.match(schemaSource, /model ApiOveragePurchase \{/) 
  assert.match(schemaSource, /apiKeys\s+ApiKey\[\]/)
  assert.match(schemaSource, /apiUsageRecords\s+ApiUsageRecord\[\]/)
  assert.match(schemaSource, /apiQuotaAlerts\s+ApiQuotaAlert\[\]/)
})

test("subscription plans and api pricing libs define model pricing and plan quotas", () => {
  assert.match(subscriptionPlansSource, /maxApiKeys/)
  assert.match(subscriptionPlansSource, /maxApiCallsPerMonth/)
  assert.match(apiPricingLibSource, /API_MODEL_PRICING_MATRIX/)
  assert.match(apiPricingLibSource, /resolveApiQuotaPolicy/)
  assert.match(apiPricingLibSource, /resolveRateLimitDecision/)
  assert.match(apiPricingLibSource, /resolveMonthlyQuotaDecision/)
  assert.match(apiPricingLibSource, /resolveOveragePackPrice/)
  assert.match(apiPricingLibSource, /resolveApiAbuseSignal/)
})

test("subscription entitlement adds api pricing access gate", () => {
  assert.match(entitlementsSource, /API_PRICING_PLANS/)
  assert.match(entitlementsSource, /hasApiPricingAccess/)
  assert.match(entitlementsSource, /"pro"/)
  assert.match(entitlementsSource, /"team"/)
  assert.match(entitlementsSource, /"enterprise"/)
})

test("developer api routes support api key lifecycle, metering, overage and abuse protection", () => {
  assert.match(keysRouteSource, /export async function GET\(\)/)
  assert.match(keysRouteSource, /export async function POST\(request: Request\)/)
  assert.match(keysRouteSource, /developer\.api_key\.create/)
  assert.match(keysRouteSource, /isLimitExceeded/)

  assert.match(keyRouteSource, /export async function PATCH\(request: Request/)
  assert.match(keyRouteSource, /developer\.api_key\.update/)

  assert.match(consumeRouteSource, /export async function POST\(request: Request/)
  assert.match(consumeRouteSource, /resolveRateLimitDecision/)
  assert.match(consumeRouteSource, /resolveMonthlyQuotaDecision/)
  assert.match(consumeRouteSource, /developer\.api\.consume/)
  assert.match(consumeRouteSource, /ABUSE_RISK/)
  assert.match(consumeRouteSource, /developer\.api\.overage\.pack\.purchased/)

  assert.match(usageRouteSource, /export async function GET\(\)/)
  assert.match(usageRouteSource, /blockedCount/)

  assert.match(overageRouteSource, /export async function POST\(request: Request\)/)
  assert.match(overageRouteSource, /developer\.api\.overage\.purchase/)
})

test("developer api page and panel expose pricing, quota linkage and auto overage flow", () => {
  assert.match(developerApiPageSource, /API 定价与配额策略/)
  assert.match(developerApiPageSource, /ApiPricingQuotaPanel/)
  assert.match(developerApiPageSource, /Week20-002/)

  assert.match(apiPanelSource, /\/api\/developer\/keys/)
  assert.match(apiPanelSource, /\/api\/developer\/overage/)
  assert.match(apiPanelSource, /\/api\/developer\/keys\/\$\{selectedKey\?\.id\}\/consume/)
  assert.match(apiPanelSource, /启用超量自动扩容包购买/)
  assert.match(apiPanelSource, /手动购买扩容包/)
})

test("developer api route is exposed in navigation and protected by middleware", () => {
  assert.match(navbarSource, /href: "\/developer-api"/)
  assert.match(mobileHeaderSource, /pathname === "\/developer-api"/)
  assert.match(middlewareSource, /"\/developer-api\/:path\*"/)
})

test("phase5 tracker marks week20-002 complete with synced metadata", () => {
  assert.equal(phase5FeatureList.meta.total_features, 16)
  assert.ok(phase5FeatureList.meta.completed_features >= 14)
  const feature = phase5FeatureList.features.find((item) => item.id === "phase5-week20-002")
  assert.ok(feature)
  assert.equal(feature.passes, true)
})
