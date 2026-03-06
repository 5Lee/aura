import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const schemaSource = readFileSync(new URL("../prisma/schema.prisma", import.meta.url), "utf8")
const growthLibSource = readFileSync(new URL("../lib/growth-lab.ts", import.meta.url), "utf8")
const entitlementsSource = readFileSync(
  new URL("../lib/subscription-entitlements.ts", import.meta.url),
  "utf8"
)
const experimentsRouteSource = readFileSync(
  new URL("../app/api/growth-lab/experiments/route.ts", import.meta.url),
  "utf8"
)
const experimentRouteSource = readFileSync(
  new URL("../app/api/growth-lab/experiments/[id]/route.ts", import.meta.url),
  "utf8"
)
const growthPageSource = readFileSync(
  new URL("../app/(dashboard)/growth-lab/page.tsx", import.meta.url),
  "utf8"
)
const growthPanelSource = readFileSync(
  new URL("../components/growth/growth-experiment-panel.tsx", import.meta.url),
  "utf8"
)
const navbarSource = readFileSync(new URL("../components/layout/navbar.tsx", import.meta.url), "utf8")
const mobileHeaderSource = readFileSync(
  new URL("../components/layout/mobile-page-header.tsx", import.meta.url),
  "utf8"
)
const middlewareSource = readFileSync(new URL("../middleware.ts", import.meta.url), "utf8")
const phase6FeatureList = JSON.parse(
  readFileSync(new URL("../feature_list_phase6_growth_ecosystem.json", import.meta.url), "utf8")
)

test("schema includes growth experiment and metric snapshot models", () => {
  assert.match(schemaSource, /enum GrowthExperimentStatus \{/)
  assert.match(schemaSource, /enum GrowthMetricType \{/)
  assert.match(schemaSource, /model GrowthExperiment \{/)
  assert.match(schemaSource, /model GrowthMetricSnapshot \{/)
  assert.match(schemaSource, /growthExperiments\s+GrowthExperiment\[\]/)
  assert.match(schemaSource, /growthMetricSnapshots\s+GrowthMetricSnapshot\[\]/)
})

test("growth lab lib provides experiment presets, sanitizers and metric calculators", () => {
  assert.match(growthLibSource, /DEFAULT_GROWTH_EXPERIMENT_PRESETS/)
  assert.match(growthLibSource, /buildGrowthExperimentSeed/)
  assert.match(growthLibSource, /sanitizeGrowthExperimentInput/)
  assert.match(growthLibSource, /normalizeGrowthExperimentStatus/)
  assert.match(growthLibSource, /resolveGrowthScheduleWindow/)
  assert.match(growthLibSource, /resolveGrowthSnapshotInput/)
  assert.match(growthLibSource, /resolveGrowthSnapshotMetrics/)
})

test("subscription entitlement adds growth lab access gate", () => {
  assert.match(entitlementsSource, /GROWTH_LAB_PLANS/)
  assert.match(entitlementsSource, /hasGrowthLabAccess/)
  assert.match(entitlementsSource, /"pro"/)
  assert.match(entitlementsSource, /"team"/)
  assert.match(entitlementsSource, /"enterprise"/)
})

test("growth lab routes cover experiment lifecycle and metric reporting", () => {
  assert.match(experimentsRouteSource, /export async function GET\(\)/)
  assert.match(experimentsRouteSource, /export async function POST\(request: Request\)/)
  assert.match(experimentsRouteSource, /buildGrowthExperimentSeed/)
  assert.match(experimentsRouteSource, /growth\.experiment\.create/)

  assert.match(experimentRouteSource, /export async function PATCH\(request: Request/)
  assert.match(experimentRouteSource, /isStatusTransitionAllowed/)
  assert.match(experimentRouteSource, /resolveGrowthSnapshotInput/)
  assert.match(experimentRouteSource, /growth\.experiment\.update/)
})

test("growth page and panel expose experiment setup and metric update workflow", () => {
  assert.match(growthPageSource, /增长实验中心/)
  assert.match(growthPageSource, /GrowthExperimentPanel/)
  assert.match(growthPageSource, /Week21-001/)

  assert.match(growthPanelSource, /\/api\/growth-lab\/experiments/)
  assert.match(growthPanelSource, /实验定义与目标配置/)
  assert.match(growthPanelSource, /指标采集与状态流转/)
  assert.match(growthPanelSource, /实验进展总览/)
})

test("growth lab route is managed via admin portal and protected by middleware", () => {
  assert.match(navbarSource, /href="\/admin"/)
  assert.match(navbarSource, /"\/growth-lab"/)
  assert.match(mobileHeaderSource, /pathname === "\/growth-lab"/)
  assert.match(middlewareSource, /"\/growth-lab\/:path\*"/)
})

test("phase6 tracker marks week21-001 complete with synced metadata", () => {
  assert.equal(phase6FeatureList.meta.total_features, 16)
  assert.ok(phase6FeatureList.meta.completed_features >= 1)
  const feature = phase6FeatureList.features.find((item) => item.id === "phase6-week21-001")
  assert.ok(feature)
  assert.equal(feature.passes, true)
})
