import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const schemaSource = readFileSync(new URL("../prisma/schema.prisma", import.meta.url), "utf8")
const complianceLibSource = readFileSync(
  new URL("../lib/compliance-audit.ts", import.meta.url),
  "utf8"
)
const promptAuditLibSource = readFileSync(
  new URL("../lib/prompt-audit-log.ts", import.meta.url),
  "utf8"
)
const auditLogsRouteSource = readFileSync(
  new URL("../app/api/audit-logs/route.ts", import.meta.url),
  "utf8"
)
const auditRetentionRouteSource = readFileSync(
  new URL("../app/api/audit-logs/retention/route.ts", import.meta.url),
  "utf8"
)
const auditAnomaliesRouteSource = readFileSync(
  new URL("../app/api/audit-logs/anomalies/route.ts", import.meta.url),
  "utf8"
)
const auditVerifyRouteSource = readFileSync(
  new URL("../app/api/audit-logs/verify/route.ts", import.meta.url),
  "utf8"
)
const compliancePageSource = readFileSync(
  new URL("../app/(dashboard)/compliance/page.tsx", import.meta.url),
  "utf8"
)
const compliancePanelSource = readFileSync(
  new URL("../components/compliance/audit-compliance-panel.tsx", import.meta.url),
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

test("schema includes enhanced audit fields, retention policy and anomaly models", () => {
  assert.match(schemaSource, /enum AuditRiskLevel \{/) 
  assert.match(schemaSource, /model AuditRetentionPolicy \{/) 
  assert.match(schemaSource, /model AuditAnomaly \{/) 
  assert.match(schemaSource, /entryHash\s+String\?\s+@unique/)
  assert.match(schemaSource, /previousHash\s+String\?/) 
  assert.match(schemaSource, /requestId\s+String\?/) 
  assert.match(schemaSource, /retentionUntil\s+DateTime\?/) 
  assert.match(schemaSource, /auditRetentionPolicy\s+AuditRetentionPolicy\?/) 
  assert.match(schemaSource, /auditAnomalies\s+AuditAnomaly\[\]/) 
})

test("compliance audit libs provide hash chain, retention and anomaly detection helpers", () => {
  assert.match(complianceLibSource, /buildAuditEntryHash/)
  assert.match(complianceLibSource, /verifyAuditHashChain/)
  assert.match(complianceLibSource, /exportAuditLogsAsCsv/)
  assert.match(complianceLibSource, /runAuditAnomalyRules/)
  assert.match(complianceLibSource, /getOrCreateAuditRetentionPolicy/)
  assert.match(promptAuditLibSource, /extractRequestAuditContext/)
  assert.match(promptAuditLibSource, /previousHash/)
  assert.match(promptAuditLibSource, /entryHash/)
  assert.match(promptAuditLibSource, /runAuditAnomalyRules/)
})

test("audit routes support export, retention strategy, anomaly management and integrity verification", () => {
  assert.match(auditLogsRouteSource, /format/)
  assert.match(auditLogsRouteSource, /exportAuditLogsAsCsv/)
  assert.match(auditLogsRouteSource, /retentionDays/)
  assert.match(auditRetentionRouteSource, /export async function GET\(\)/)
  assert.match(auditRetentionRouteSource, /export async function PUT\(request: Request\)/)
  assert.match(auditRetentionRouteSource, /audit\.retention\.update/)
  assert.match(auditAnomaliesRouteSource, /export async function PATCH\(request: Request\)/)
  assert.match(auditAnomaliesRouteSource, /audit\.anomaly\.resolve/)
  assert.match(auditVerifyRouteSource, /verifyAuditHashChain/)
  assert.match(auditVerifyRouteSource, /audit\.chain\.verify/)
})

test("compliance page and panel expose retention config, export and tamper-proof verification", () => {
  assert.match(compliancePageSource, /合规审计增强/)
  assert.match(compliancePageSource, /AuditCompliancePanel/)
  assert.match(compliancePanelSource, /\/api\/audit-logs\/retention/)
  assert.match(compliancePanelSource, /\/api\/audit-logs\/verify/)
  assert.match(compliancePanelSource, /\/api\/audit-logs\?format=csv/)
  assert.match(compliancePanelSource, /校验不可篡改链/)
  assert.match(compliancePanelSource, /异常访问检测/)
})

test("compliance route is exposed in navigation and protected by middleware", () => {
  assert.match(navbarSource, /href: "\/compliance"/)
  assert.match(mobileHeaderSource, /pathname === "\/compliance"/)
  assert.match(middlewareSource, /"\/compliance\/:path\*"/)
})

test("phase5 tracker marks week19-003 complete with synced metadata", () => {
  assert.equal(phase5FeatureList.meta.total_features, 16)
  assert.ok(phase5FeatureList.meta.completed_features >= 11)
  const feature = phase5FeatureList.features.find((item) => item.id === "phase5-week19-003")
  assert.ok(feature)
  assert.equal(feature.passes, true)
})
