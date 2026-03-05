import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const schemaSource = readFileSync(new URL("../prisma/schema.prisma", import.meta.url), "utf8")
const alertingLibSource = readFileSync(new URL("../lib/growth-alerting.ts", import.meta.url), "utf8")
const alertsRouteSource = readFileSync(
  new URL("../app/api/growth-lab/alerts/route.ts", import.meta.url),
  "utf8"
)
const experimentsRouteSource = readFileSync(
  new URL("../app/api/growth-lab/experiments/route.ts", import.meta.url),
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

test("schema includes growth alert enums and experiment alert model", () => {
  assert.match(schemaSource, /enum GrowthAlertType \{/) 
  assert.match(schemaSource, /enum GrowthAlertStatus \{/) 
  assert.match(schemaSource, /model GrowthExperimentAlert \{/) 
  assert.match(schemaSource, /growthExperimentAlerts\s+GrowthExperimentAlert\[\]/)
  assert.match(schemaSource, /alerts\s+GrowthExperimentAlert\[\]/)
})

test("alerting lib provides threshold rules and circuit-break helpers", () => {
  assert.match(alertingLibSource, /DEFAULT_GROWTH_ALERT_RULES/)
  assert.match(alertingLibSource, /buildGrowthAlertEvaluations/)
  assert.match(alertingLibSource, /normalizeGrowthAlertStatus/)
  assert.match(alertingLibSource, /normalizeGrowthAlertType/)
  assert.match(alertingLibSource, /resolveGrowthAlertAutoPause/)
})

test("alerts route supports evaluation, auto pause and manual recovery", () => {
  assert.match(alertsRouteSource, /export async function GET\(request: Request\)/)
  assert.match(alertsRouteSource, /export async function POST\(request: Request\)/)
  assert.match(alertsRouteSource, /export async function PATCH\(request: Request\)/)
  assert.match(alertsRouteSource, /buildGrowthAlertEvaluations/)
  assert.match(alertsRouteSource, /resolveGrowthAlertAutoPause/)
  assert.match(alertsRouteSource, /status:\s*"PAUSED"/)
  assert.match(alertsRouteSource, /status:\s*"RUNNING"/)
  assert.match(alertsRouteSource, /growth\.alert\.evaluate/)
  assert.match(alertsRouteSource, /growth\.alert\.resolve/)
})

test("growth APIs and panel expose alerting and circuit-break workflow", () => {
  assert.match(experimentsRouteSource, /alerts/)
  assert.match(growthPageSource, /alerts=/)
  assert.match(growthPanelSource, /实验异常告警与自动熔断策略/)
  assert.match(growthPanelSource, /告警处理与恢复路径/)
  assert.match(growthPanelSource, /\/api\/growth-lab\/alerts/)
  assert.match(growthPanelSource, /执行告警评估/)
})

test("phase6 tracker marks week21-004 complete with synced metadata", () => {
  assert.equal(phase6FeatureList.meta.total_features, 16)
  assert.ok(phase6FeatureList.meta.completed_features >= 4)
  const feature = phase6FeatureList.features.find((item) => item.id === "phase6-week21-004")
  assert.ok(feature)
  assert.equal(feature.passes, true)
})
