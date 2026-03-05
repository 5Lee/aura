import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const schemaSource = readFileSync(new URL("../prisma/schema.prisma", import.meta.url), "utf8")
const entitlementsSource = readFileSync(
  new URL("../lib/subscription-entitlements.ts", import.meta.url),
  "utf8"
)
const connectorsLibSource = readFileSync(
  new URL("../lib/integration-connectors.ts", import.meta.url),
  "utf8"
)
const connectorsRouteSource = readFileSync(new URL("../app/api/connectors/route.ts", import.meta.url), "utf8")
const connectorsPageSource = readFileSync(
  new URL("../app/(dashboard)/connectors/page.tsx", import.meta.url),
  "utf8"
)
const connectorPanelSource = readFileSync(
  new URL("../components/integrations/connector-catalog-panel.tsx", import.meta.url),
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

test("schema includes connector catalog, credential and health check models", () => {
  assert.match(schemaSource, /enum ConnectorProvider \{/)
  assert.match(schemaSource, /enum ConnectorStatus \{/)
  assert.match(schemaSource, /enum ConnectorCheckStatus \{/)
  assert.match(schemaSource, /model IntegrationConnector \{/)
  assert.match(schemaSource, /model IntegrationConnectorHealthCheck \{/)
  assert.match(schemaSource, /integrationConnectors\s+IntegrationConnector\[\]/)
  assert.match(schemaSource, /integrationHealthChecks\s+IntegrationConnectorHealthCheck\[\]/)
})

test("connector lib provides sanitization, encryption, masking and diagnostics helpers", () => {
  assert.match(connectorsLibSource, /DEFAULT_CONNECTOR_PRESETS/)
  assert.match(connectorsLibSource, /sanitizeConnectorInput/)
  assert.match(connectorsLibSource, /encryptConnectorCredential/)
  assert.match(connectorsLibSource, /decryptConnectorCredential/)
  assert.match(connectorsLibSource, /maskCredential/)
  assert.match(connectorsLibSource, /resolveConnectorHealthCheck/)
})

test("connector APIs support catalog management, secret rotation and health checks", () => {
  assert.match(connectorsRouteSource, /export async function GET\(\)/)
  assert.match(connectorsRouteSource, /export async function PUT\(request: Request\)/)
  assert.match(connectorsRouteSource, /export async function POST\(request: Request\)/)
  assert.match(connectorsRouteSource, /buildConnectorSeed/)
  assert.match(connectorsRouteSource, /encryptConnectorCredential/)
  assert.match(connectorsRouteSource, /resolveConnectorHealthCheck/)
  assert.match(connectorsRouteSource, /integration\.connector\.upsert/)
  assert.match(connectorsRouteSource, /integration\.connector\.healthcheck/)
  assert.match(connectorsRouteSource, /credentialExposed: false/)
})

test("connector dashboard is gated by entitlement and integrated in navigation", () => {
  assert.match(entitlementsSource, /CONNECTOR_CATALOG_PLANS/)
  assert.match(entitlementsSource, /hasConnectorCatalogAccess/)
  assert.match(connectorsPageSource, /Week22-001/)
  assert.match(connectorsPageSource, /ConnectorCatalogPanel/)
  assert.match(connectorPanelSource, /第三方模型与工具连接器目录/)
  assert.match(connectorPanelSource, /API Key\/Secret 安全存储与轮换/)
  assert.match(connectorPanelSource, /连接健康检查与故障诊断/)
  assert.match(connectorPanelSource, /\/api\/connectors/)
  assert.match(navbarSource, /href: "\/connectors"/)
  assert.match(mobileHeaderSource, /pathname === "\/connectors"/)
  assert.match(middlewareSource, /"\/connectors\/:path\*"/)
})

test("phase6 tracker marks week22-001 complete with synced metadata", () => {
  assert.equal(phase6FeatureList.meta.total_features, 16)
  assert.ok(phase6FeatureList.meta.completed_features >= 5)
  const feature = phase6FeatureList.features.find((item) => item.id === "phase6-week22-001")
  assert.ok(feature)
  assert.equal(feature.passes, true)
})
