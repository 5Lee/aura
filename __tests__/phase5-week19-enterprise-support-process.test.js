import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const schemaSource = readFileSync(new URL("../prisma/schema.prisma", import.meta.url), "utf8")
const supportProcessLibSource = readFileSync(
  new URL("../lib/enterprise-support.ts", import.meta.url),
  "utf8"
)
const entitlementsSource = readFileSync(
  new URL("../lib/subscription-entitlements.ts", import.meta.url),
  "utf8"
)
const runbookRouteSource = readFileSync(
  new URL("../app/api/support/process/runbook/route.ts", import.meta.url),
  "utf8"
)
const escalationsRouteSource = readFileSync(
  new URL("../app/api/support/process/escalations/route.ts", import.meta.url),
  "utf8"
)
const postmortemsRouteSource = readFileSync(
  new URL("../app/api/support/process/postmortems/route.ts", import.meta.url),
  "utf8"
)
const postmortemRouteSource = readFileSync(
  new URL("../app/api/support/process/postmortems/[id]/route.ts", import.meta.url),
  "utf8"
)
const supportPageSource = readFileSync(
  new URL("../app/(dashboard)/support/page.tsx", import.meta.url),
  "utf8"
)
const supportPanelSource = readFileSync(
  new URL("../components/support/enterprise-support-process-panel.tsx", import.meta.url),
  "utf8"
)
const phase5FeatureList = JSON.parse(
  readFileSync(new URL("../feature_list_phase5_commercialization.json", import.meta.url), "utf8")
)

test("schema includes escalation and postmortem data models for enterprise support process", () => {
  assert.match(schemaSource, /enum SupportEscalationLevel \{/) 
  assert.match(schemaSource, /enum SupportEscalationStatus \{/) 
  assert.match(schemaSource, /enum SupportPostmortemStatus \{/) 
  assert.match(schemaSource, /model SupportEscalationPolicy \{/) 
  assert.match(schemaSource, /model SupportEscalationEvent \{/) 
  assert.match(schemaSource, /model SupportRunbook \{/) 
  assert.match(schemaSource, /model SupportPostmortem \{/) 
  assert.match(schemaSource, /supportEscalationPolicies\s+SupportEscalationPolicy\[\]/)
  assert.match(schemaSource, /supportEscalationEvents\s+SupportEscalationEvent\[\]/)
  assert.match(schemaSource, /supportPostmortems\s+SupportPostmortem\[\]/)
})

test("enterprise support lib provides escalation matrix, runbook defaults and collaboration metrics", () => {
  assert.match(supportProcessLibSource, /PLAN_ENTERPRISE_ESCALATION_PATHS/)
  assert.match(supportProcessLibSource, /DEFAULT_SUPPORT_RUNBOOK_CONFIG/)
  assert.match(supportProcessLibSource, /buildSupportEscalationPolicySeed/)
  assert.match(supportProcessLibSource, /extractSupportRunbookConfig/)
  assert.match(supportProcessLibSource, /resolveEscalationPath/)
  assert.match(supportProcessLibSource, /sanitizePostmortemInput/)
  assert.match(supportProcessLibSource, /resolveCrossTeamCollaborationEfficiency/)
})

test("subscription entitlement opens enterprise support process for team and enterprise", () => {
  assert.match(entitlementsSource, /ENTERPRISE_SUPPORT_PROCESS_PLANS/)
  assert.match(entitlementsSource, /"team"/)
  assert.match(entitlementsSource, /"enterprise"/)
  assert.match(entitlementsSource, /hasEnterpriseSupportProcessAccess/)
})

test("support process api routes cover runbook, escalations and postmortem lifecycle", () => {
  assert.match(runbookRouteSource, /export async function GET\(\)/)
  assert.match(runbookRouteSource, /export async function PUT\(request: Request\)/)
  assert.match(runbookRouteSource, /support\.runbook\.update/)
  assert.match(runbookRouteSource, /hasEnterpriseSupportProcessAccess/)

  assert.match(escalationsRouteSource, /export async function GET\(\)/)
  assert.match(escalationsRouteSource, /export async function POST\(request: Request\)/)
  assert.match(escalationsRouteSource, /buildSupportEscalationPolicySeed/)
  assert.match(escalationsRouteSource, /ticket\.escalated/)
  assert.match(escalationsRouteSource, /support\.escalation\.create/)

  assert.match(postmortemsRouteSource, /export async function GET\(\)/)
  assert.match(postmortemsRouteSource, /export async function POST\(request: Request\)/)
  assert.match(postmortemsRouteSource, /support\.postmortem\.create/)

  assert.match(postmortemRouteSource, /export async function PATCH\(request: Request/)
  assert.match(postmortemRouteSource, /normalizePostmortemStatus/)
  assert.match(postmortemRouteSource, /support\.postmortem\.update/)
})

test("support page and panel expose enterprise support process standardization workflow", () => {
  assert.match(supportPageSource, /企业支持流程标准化/)
  assert.match(supportPageSource, /EnterpriseSupportProcessPanel/)
  assert.match(supportPageSource, /Week19-004/)

  assert.match(supportPanelSource, /\/api\/support\/process\/runbook/)
  assert.match(supportPanelSource, /\/api\/support\/process\/escalations/)
  assert.match(supportPanelSource, /\/api\/support\/process\/postmortems/)
  assert.match(supportPanelSource, /跨团队协作效率/)
  assert.match(supportPanelSource, /发布复盘/)
})

test("phase5 tracker marks week19-004 complete with synced metadata", () => {
  assert.equal(phase5FeatureList.meta.total_features, 16)
  assert.ok(phase5FeatureList.meta.completed_features >= 12)
  const feature = phase5FeatureList.features.find((item) => item.id === "phase5-week19-004")
  assert.ok(feature)
  assert.equal(feature.passes, true)
})
