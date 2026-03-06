import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const schemaSource = readFileSync(new URL("../prisma/schema.prisma", import.meta.url), "utf8")
const governanceLibSource = readFileSync(
  new URL("../lib/integration-governance.ts", import.meta.url),
  "utf8"
)
const connectorsRouteSource = readFileSync(
  new URL("../app/api/connectors/route.ts", import.meta.url),
  "utf8"
)
const flowRouteSource = readFileSync(new URL("../app/api/prompt-flow/route.ts", import.meta.url), "utf8")
const auditRouteSource = readFileSync(new URL("../app/api/audit-logs/route.ts", import.meta.url), "utf8")
const governanceApiSource = readFileSync(
  new URL("../app/api/governance/audit/route.ts", import.meta.url),
  "utf8"
)
const governancePageSource = readFileSync(
  new URL("../app/(dashboard)/governance/page.tsx", import.meta.url),
  "utf8"
)
const governancePanelSource = readFileSync(
  new URL("../components/integrations/governance-audit-panel.tsx", import.meta.url),
  "utf8"
)
const entitlementsSource = readFileSync(
  new URL("../lib/subscription-entitlements.ts", import.meta.url),
  "utf8"
)
const adminSubnavSource = readFileSync(new URL("../components/layout/admin-subnav.tsx", import.meta.url), "utf8")
const mobileHeaderSource = readFileSync(
  new URL("../components/layout/mobile-page-header.tsx", import.meta.url),
  "utf8"
)
const middlewareSource = readFileSync(new URL("../middleware.ts", import.meta.url), "utf8")
const featureList = JSON.parse(
  readFileSync(new URL("../feature_list_phase6_growth_ecosystem.json", import.meta.url), "utf8")
)

test("governance relies on tamper-evident audit chain fields", () => {
  assert.match(schemaSource, /model PromptAuditLog \{/)
  assert.match(schemaSource, /previousHash\s+String\?/) 
  assert.match(schemaSource, /entryHash\s+String\?\s+@unique/)
  assert.match(schemaSource, /immutable\s+Boolean\s+@default\(true\)/)
})

test("governance helpers support resource filtering and integrity summary", () => {
  assert.match(governanceLibSource, /GOVERNANCE_RESOURCE_KEYS/)
  assert.match(governanceLibSource, /sanitizeGovernanceResourceFilter/)
  assert.match(governanceLibSource, /normalizeFlowGovernanceAction/)
  assert.match(governanceLibSource, /resolveConnectorGovernanceAuditActions/)
  assert.match(governanceLibSource, /resolveGovernanceIntegritySummary/)
  assert.match(governanceLibSource, /nonRepudiationRatio/)
})

test("connector and workflow routes emit governance-specific audit events", () => {
  assert.match(governanceLibSource, /integration\.connector\.credential\.rotate/)
  assert.match(governanceLibSource, /integration\.connector\.authorization\.change/)
  assert.match(governanceLibSource, /promptflow\.flow\.publish/)
  assert.match(governanceLibSource, /promptflow\.flow\.rollback/)
  assert.match(governanceLibSource, /promptflow\.flow\.disable/)
  assert.match(connectorsRouteSource, /resolveConnectorGovernanceAuditActions/)
  assert.match(flowRouteSource, /resolveFlowGovernanceAuditAction/)
  assert.match(auditRouteSource, /resourceId/)
  assert.match(auditRouteSource, /resolveAuditLogResourceMatch/)
})

test("governance dashboard and API provide resource-level audit retrieval", () => {
  assert.match(entitlementsSource, /INTEGRATION_GOVERNANCE_PLANS/)
  assert.match(entitlementsSource, /hasIntegrationGovernanceAccess/)
  assert.match(governanceApiSource, /export async function GET\(request: Request\)/)
  assert.match(governanceApiSource, /value === null \|\| value\.trim\(\) === ""/)
  assert.match(governanceApiSource, /resource: \{ in: \["connectors", "prompt-flow"\] \}/)
  assert.match(governanceApiSource, /resourceScope/)
  assert.match(governancePageSource, /Week22-004/)
  assert.match(governancePanelSource, /连接器与工作流审计治理/)
  assert.match(governancePanelSource, /按资源维度检索/)
  assert.match(governancePanelSource, /\/api\/governance\/audit/)
  assert.match(governancePanelSource, /timeZone: "Asia\/Shanghai"/)
  assert.match(governancePanelSource, /formatDateTime\(log\.createdAt\)/)
})

test("governance surfaces in backoffice routing and protections", () => {
  assert.match(adminSubnavSource, /href: "\/admin\/governance"/)
  assert.match(mobileHeaderSource, /governance: "治理审计"/)
  assert.match(middlewareSource, /"\/governance\/:path\*"/)
  assert.match(middlewareSource, /"\/admin\/:path\*"/)
})

test("phase6 tracker marks week22-004 complete", () => {
  const item = featureList.features.find((feature) => feature.id === "phase6-week22-004")
  assert.ok(item)
  assert.equal(item.passes, true)
})
