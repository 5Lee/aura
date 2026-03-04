import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const schemaSource = readFileSync(new URL("../prisma/schema.prisma", import.meta.url), "utf8")
const slaLibSource = readFileSync(new URL("../lib/sla-monitoring.ts", import.meta.url), "utf8")
const slaReportRouteSource = readFileSync(
  new URL("../app/api/sla/report/route.ts", import.meta.url),
  "utf8"
)
const slaFaultRouteSource = readFileSync(
  new URL("../app/api/sla/fault-injection/route.ts", import.meta.url),
  "utf8"
)
const slaPageSource = readFileSync(new URL("../app/(dashboard)/sla/page.tsx", import.meta.url), "utf8")
const slaPanelSource = readFileSync(
  new URL("../components/sla/sla-monitoring-panel.tsx", import.meta.url),
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

test("schema includes sla snapshot and alert models with status enums", () => {
  assert.match(schemaSource, /enum SlaMetricType \{/)
  assert.match(schemaSource, /enum SlaAlertStatus \{/)
  assert.match(schemaSource, /model SlaSnapshot \{/)
  assert.match(schemaSource, /model SlaAlert \{/)
  assert.match(schemaSource, /slaSnapshots\s+SlaSnapshot\[\]/)
  assert.match(schemaSource, /slaAlerts\s+SlaAlert\[\]/)
})

test("sla monitoring lib defines plan policy, threshold evaluation and fault injection scenarios", () => {
  assert.match(slaLibSource, /PLAN_SLA_POLICY/)
  assert.match(slaLibSource, /evaluateSlaWindow/)
  assert.match(slaLibSource, /resolveSlaAlertDelta/)
  assert.match(slaLibSource, /normalizeSlaFaultScenario/)
  assert.match(slaLibSource, /buildFaultInjectionSample/)
  assert.match(slaLibSource, /latency_spike/)
  assert.match(slaLibSource, /error_burst/)
  assert.match(slaLibSource, /downtime_blip/)
  assert.match(slaLibSource, /recover/)
})

test("sla report api builds snapshots and reconciles alert trigger/recovery", () => {
  assert.match(slaReportRouteSource, /export async function GET\(request: Request\)/)
  assert.match(slaReportRouteSource, /evaluateSlaWindow/)
  assert.match(slaReportRouteSource, /prisma\.slaSnapshot\.create/)
  assert.match(slaReportRouteSource, /resolveSlaAlertDelta/)
  assert.match(slaReportRouteSource, /SlaAlertStatus\.OPEN/)
  assert.match(slaReportRouteSource, /recoveredAt/)
})

test("fault injection api supports incident simulation and recovery drill", () => {
  assert.match(slaFaultRouteSource, /export async function POST\(request: Request\)/)
  assert.match(slaFaultRouteSource, /normalizeSlaFaultScenario/)
  assert.match(slaFaultRouteSource, /buildFaultInjectionSample/)
  assert.match(slaFaultRouteSource, /source: "fault_injection"/)
  assert.match(slaFaultRouteSource, /scenario/)
})

test("sla page and panel provide report refresh, fault injection and recovery actions", () => {
  assert.match(slaPageSource, /SLA 监控与告警/)
  assert.match(slaPageSource, /SlaMonitoringPanel/)
  assert.match(slaPanelSource, /刷新 SLA 报表/)
  assert.match(slaPanelSource, /注入故障/)
  assert.match(slaPanelSource, /执行恢复检查/)
  assert.match(slaPanelSource, /\/api\/sla\/report/)
  assert.match(slaPanelSource, /\/api\/sla\/fault-injection/)
})

test("sla route is exposed in navigation and protected by middleware", () => {
  assert.match(navbarSource, /href: "\/sla"/)
  assert.match(mobileHeaderSource, /pathname === "\/sla"/)
  assert.match(middlewareSource, /"\/sla\/:path\*"/)
})

test("phase5 tracker marks week18-004 complete with synced metadata", () => {
  assert.equal(phase5FeatureList.meta.total_features, 16)
  assert.ok(phase5FeatureList.meta.completed_features >= 8)
  const feature = phase5FeatureList.features.find((item) => item.id === "phase5-week18-004")
  assert.ok(feature)
  assert.equal(feature.passes, true)
})
