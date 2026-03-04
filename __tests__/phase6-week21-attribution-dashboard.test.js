import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const schemaSource = readFileSync(new URL("../prisma/schema.prisma", import.meta.url), "utf8")
const attributionLibSource = readFileSync(new URL("../lib/growth-attribution.ts", import.meta.url), "utf8")
const experimentsRouteSource = readFileSync(
  new URL("../app/api/growth-lab/experiments/route.ts", import.meta.url),
  "utf8"
)
const attributionRouteSource = readFileSync(
  new URL("../app/api/growth-lab/attribution/route.ts", import.meta.url),
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
const phase6FeatureList = JSON.parse(
  readFileSync(new URL("../feature_list_phase6_growth_ecosystem.json", import.meta.url), "utf8")
)

test("schema includes attribution model and relation links", () => {
  assert.match(schemaSource, /enum GrowthAttributionStatus \{/)
  assert.match(schemaSource, /model GrowthAttributionSnapshot \{/) 
  assert.match(schemaSource, /growthAttributionSnapshots\s+GrowthAttributionSnapshot\[\]/)
  assert.match(schemaSource, /attributionSnapshots\s+GrowthAttributionSnapshot\[\]/)
})

test("attribution lib provides sanitize, anomaly detection and consistency helpers", () => {
  assert.match(attributionLibSource, /DEFAULT_GROWTH_ATTRIBUTION_PRESETS/)
  assert.match(attributionLibSource, /sanitizeGrowthAttributionInput/)
  assert.match(attributionLibSource, /resolveGrowthAttributionMetrics/)
  assert.match(attributionLibSource, /detectGrowthAttributionAnomaly/)
  assert.match(attributionLibSource, /buildGrowthAttributionAggregate/)
  assert.match(attributionLibSource, /resolveGrowthAttributionConsistency/)
})

test("attribution route supports aggregation, anomaly correction and audit logs", () => {
  assert.match(attributionRouteSource, /export async function GET\(request: Request\)/)
  assert.match(attributionRouteSource, /export async function PUT\(request: Request\)/)
  assert.match(attributionRouteSource, /export async function PATCH\(request: Request\)/)
  assert.match(attributionRouteSource, /buildGrowthAttributionSeed/)
  assert.match(attributionRouteSource, /buildGrowthAttributionAggregate/)
  assert.match(attributionRouteSource, /detectGrowthAttributionAnomaly/)
  assert.match(attributionRouteSource, /growth\.attribution\.upsert/)
  assert.match(attributionRouteSource, /growth\.attribution\.correct/)
})

test("growth lab page and APIs expose attribution payload and operations", () => {
  assert.match(experimentsRouteSource, /attributionSnapshots/)
  assert.match(experimentsRouteSource, /attributionAggregate/)
  assert.match(experimentsRouteSource, /attributionConsistency/)
  assert.match(growthPageSource, /attributionSnapshots=/)
  assert.match(growthPageSource, /attributionAggregate=/)
  assert.match(growthPageSource, /attributionConsistency=/)
  assert.match(growthPanelSource, /增长归因看板与渠道效果分析/)
  assert.match(growthPanelSource, /异常归因规则与纠偏标记/)
  assert.match(growthPanelSource, /\/api\/growth-lab\/attribution/)
  assert.match(growthPanelSource, /渠道归因对比（实验 \/ 渠道 \/ 时间窗口）/)
})

test("phase6 tracker marks week21-003 complete with synced metadata", () => {
  assert.equal(phase6FeatureList.meta.total_features, 16)
  assert.ok(phase6FeatureList.meta.completed_features >= 3)
  const feature = phase6FeatureList.features.find((item) => item.id === "phase6-week21-003")
  assert.ok(feature)
  assert.equal(feature.passes, true)
})
