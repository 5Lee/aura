import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const schemaSource = readFileSync(new URL("../prisma/schema.prisma", import.meta.url), "utf8")
const adLibSource = readFileSync(new URL("../lib/ad-strategy.ts", import.meta.url), "utf8")
const entitlementsSource = readFileSync(
  new URL("../lib/subscription-entitlements.ts", import.meta.url),
  "utf8"
)
const rulesRouteSource = readFileSync(new URL("../app/api/ads/rules/route.ts", import.meta.url), "utf8")
const campaignsRouteSource = readFileSync(
  new URL("../app/api/ads/campaigns/route.ts", import.meta.url),
  "utf8"
)
const campaignRouteSource = readFileSync(
  new URL("../app/api/ads/campaigns/[id]/route.ts", import.meta.url),
  "utf8"
)
const adsPageSource = readFileSync(new URL("../app/(dashboard)/ads/page.tsx", import.meta.url), "utf8")
const adsPanelSource = readFileSync(
  new URL("../components/ads/ad-strategy-panel.tsx", import.meta.url),
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

test("schema includes ad placement rules, campaign workflow and performance snapshots", () => {
  assert.match(schemaSource, /enum AdCampaignStatus \{/) 
  assert.match(schemaSource, /model AdPlacementRule \{/) 
  assert.match(schemaSource, /model AdCampaign \{/) 
  assert.match(schemaSource, /model AdPerformanceSnapshot \{/) 
  assert.match(schemaSource, /adPlacementRules\s+AdPlacementRule\[\]/)
  assert.match(schemaSource, /adCampaigns\s+AdCampaign\[\]/)
  assert.match(schemaSource, /adPerformanceSnapshots\s+AdPerformanceSnapshot\[\]/)
})

test("ad strategy lib provides placement presets, review safety policy and conversion metrics", () => {
  assert.match(adLibSource, /DEFAULT_AD_PLACEMENT_RULES/)
  assert.match(adLibSource, /sanitizeAdPlacementRuleInput/)
  assert.match(adLibSource, /sanitizeAdCampaignInput/)
  assert.match(adLibSource, /evaluateAdSafetyPolicy/)
  assert.match(adLibSource, /resolveAdBudgetGuard/)
  assert.match(adLibSource, /resolveAdScheduleWindow/)
  assert.match(adLibSource, /resolveAdConversionMetrics/)
})

test("subscription entitlement adds ad strategy access gate", () => {
  assert.match(entitlementsSource, /AD_STRATEGY_PLANS/)
  assert.match(entitlementsSource, /hasAdStrategyAccess/)
  assert.match(entitlementsSource, /"pro"/)
  assert.match(entitlementsSource, /"team"/)
  assert.match(entitlementsSource, /"enterprise"/)
})

test("ads routes cover placement rules, campaign creation, review workflow, budget and safety updates", () => {
  assert.match(rulesRouteSource, /export async function GET\(\)/)
  assert.match(rulesRouteSource, /export async function PUT\(request: Request\)/)
  assert.match(rulesRouteSource, /ads\.rule\.upsert/)

  assert.match(campaignsRouteSource, /export async function GET\(\)/)
  assert.match(campaignsRouteSource, /export async function POST\(request: Request\)/)
  assert.match(campaignsRouteSource, /resolveAdCampaignInitialStatus/)
  assert.match(campaignsRouteSource, /evaluateAdSafetyPolicy/)
  assert.match(campaignsRouteSource, /ads\.campaign\.create/)

  assert.match(campaignRouteSource, /export async function PATCH\(request: Request/)
  assert.match(campaignRouteSource, /resolveAdBudgetGuard/)
  assert.match(campaignRouteSource, /resolveAdScheduleWindow/)
  assert.match(campaignRouteSource, /AdCampaignStatus\.COMPLETED/)
  assert.match(campaignRouteSource, /ads\.campaign\.update/)
})

test("ads page and panel expose recommendation placement strategy and conversion tracking", () => {
  assert.match(adsPageSource, /广告与推荐位商业策略/)
  assert.match(adsPageSource, /AdStrategyPanel/)
  assert.match(adsPageSource, /Week20-003/)

  assert.match(adsPanelSource, /\/api\/ads\/rules/)
  assert.match(adsPanelSource, /\/api\/ads\/campaigns/)
  assert.match(adsPanelSource, /提交审核状态/)
  assert.match(adsPanelSource, /上报投放数据/)
  assert.match(adsPanelSource, /投放预算与时段控制/)
})

test("ads route is managed via admin portal and protected by middleware", () => {
  assert.match(navbarSource, /href="\/admin"/)
  assert.match(navbarSource, /"\/ads"/)
  assert.match(mobileHeaderSource, /pathname === "\/ads"/)
  assert.match(middlewareSource, /"\/ads\/:path\*"/)
})

test("phase5 tracker marks week20-003 complete with synced metadata", () => {
  assert.equal(phase5FeatureList.meta.total_features, 16)
  assert.ok(phase5FeatureList.meta.completed_features >= 15)
  const feature = phase5FeatureList.features.find((item) => item.id === "phase5-week20-003")
  assert.ok(feature)
  assert.equal(feature.passes, true)
})
