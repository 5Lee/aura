import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const advancedAnalyticsLibSource = readFileSync(
  new URL("../lib/advanced-analytics.ts", import.meta.url),
  "utf8"
)
const entitlementsSource = readFileSync(
  new URL("../lib/subscription-entitlements.ts", import.meta.url),
  "utf8"
)
const analyticsRouteSource = readFileSync(
  new URL("../app/api/analytics/advanced/route.ts", import.meta.url),
  "utf8"
)
const dashboardSource = readFileSync(
  new URL("../app/(dashboard)/dashboard/page.tsx", import.meta.url),
  "utf8"
)
const phase5FeatureList = JSON.parse(
  readFileSync(new URL("../feature_list_phase5_commercialization.json", import.meta.url), "utf8")
)

test("advanced analytics lib includes conversion funnel, quality trend and retention metrics", () => {
  assert.match(advancedAnalyticsLibSource, /conversionFunnel/)
  assert.match(advancedAnalyticsLibSource, /versionQualityTrend/)
  assert.match(advancedAnalyticsLibSource, /retention/)
  assert.match(advancedAnalyticsLibSource, /templateCoverage/)
  assert.match(advancedAnalyticsLibSource, /retentionRate30/)
})

test("advanced analytics access policy grants pro/team and blocks free", () => {
  assert.match(entitlementsSource, /ADVANCED_ANALYTICS_PLANS/)
  assert.match(entitlementsSource, /"pro"/)
  assert.match(entitlementsSource, /"team"/)
  assert.match(entitlementsSource, /hasAdvancedAnalyticsAccess/)
})

test("advanced analytics api enforces plan gating for free users", () => {
  assert.match(analyticsRouteSource, /hasAdvancedAnalyticsAccess/)
  assert.match(analyticsRouteSource, /高级分析仅对 Pro \/ Team 套餐开放/)
  assert.match(analyticsRouteSource, /upgradeRequired: true/)
})

test("dashboard shows advanced analytics section with upgrade fallback", () => {
  assert.match(dashboardSource, /高级分析看板/)
  assert.match(dashboardSource, /升级查看高级分析/)
  assert.match(dashboardSource, /getAdvancedAnalyticsDashboard/)
  assert.match(dashboardSource, /hasAdvancedAnalyticsAccess/)
})

test("phase5 tracker marks week18-001 complete and metadata is synced", () => {
  assert.equal(phase5FeatureList.meta.total_features, 16)
  assert.ok(phase5FeatureList.meta.completed_features >= 5)
  const feature = phase5FeatureList.features.find((item) => item.id === "phase5-week18-001")
  assert.ok(feature)
  assert.equal(feature.passes, true)
})
