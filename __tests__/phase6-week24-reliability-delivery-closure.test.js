import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const schemaSource = readFileSync(new URL("../prisma/schema.prisma", import.meta.url), "utf8")
const entitlementsSource = readFileSync(
  new URL("../lib/subscription-entitlements.ts", import.meta.url),
  "utf8"
)
const gateLibSource = readFileSync(new URL("../lib/reliability-gates.ts", import.meta.url), "utf8")
const selfHealLibSource = readFileSync(new URL("../lib/self-heal.ts", import.meta.url), "utf8")
const releaseLibSource = readFileSync(new URL("../lib/release-orchestration.ts", import.meta.url), "utf8")
const closureLibSource = readFileSync(new URL("../lib/phase6-closure.ts", import.meta.url), "utf8")

const gateApiSource = readFileSync(new URL("../app/api/reliability/gates/route.ts", import.meta.url), "utf8")
const selfHealApiSource = readFileSync(
  new URL("../app/api/reliability/self-heal/route.ts", import.meta.url),
  "utf8"
)
const releaseApiSource = readFileSync(
  new URL("../app/api/reliability/releases/route.ts", import.meta.url),
  "utf8"
)
const closureApiSource = readFileSync(
  new URL("../app/api/reliability/phase6-closure/route.ts", import.meta.url),
  "utf8"
)

const gatePageSource = readFileSync(
  new URL("../app/(dashboard)/reliability-gates/page.tsx", import.meta.url),
  "utf8"
)
const selfHealPageSource = readFileSync(new URL("../app/(dashboard)/self-heal/page.tsx", import.meta.url), "utf8")
const releasePageSource = readFileSync(
  new URL("../app/(dashboard)/release-orchestration/page.tsx", import.meta.url),
  "utf8"
)
const closurePageSource = readFileSync(
  new URL("../app/(dashboard)/phase6-closure/page.tsx", import.meta.url),
  "utf8"
)

const gatePanelSource = readFileSync(
  new URL("../components/reliability/quality-gate-panel.tsx", import.meta.url),
  "utf8"
)
const selfHealPanelSource = readFileSync(
  new URL("../components/reliability/self-heal-panel.tsx", import.meta.url),
  "utf8"
)
const releasePanelSource = readFileSync(
  new URL("../components/reliability/release-orchestration-panel.tsx", import.meta.url),
  "utf8"
)
const closurePanelSource = readFileSync(
  new URL("../components/reliability/phase6-closure-panel.tsx", import.meta.url),
  "utf8"
)

const adminPageSource = readFileSync(new URL("../app/(dashboard)/admin/page.tsx", import.meta.url), "utf8")
const adminSubnavSource = readFileSync(new URL("../components/layout/admin-subnav.tsx", import.meta.url), "utf8")
const mobileHeaderSource = readFileSync(
  new URL("../components/layout/mobile-page-header.tsx", import.meta.url),
  "utf8"
)
const middlewareSource = readFileSync(new URL("../middleware.ts", import.meta.url), "utf8")
const workflowSource = readFileSync(
  new URL("../.github/workflows/phase6-release-gates.yml", import.meta.url),
  "utf8"
)
const handbookSource = readFileSync(new URL("../docs/phase6-operations-handbook.md", import.meta.url), "utf8")
const phase6FeatureList = JSON.parse(
  readFileSync(new URL("../feature_list_phase6_growth_ecosystem.json", import.meta.url), "utf8")
)

test("schema includes reliability, self-heal, release orchestration and closure models", () => {
  assert.match(schemaSource, /enum ReliabilityGateType \{/)
  assert.match(schemaSource, /enum ReliabilityGateSeverity \{/)
  assert.match(schemaSource, /enum ReliabilityGateStatus \{/)
  assert.match(schemaSource, /enum SelfHealSuggestionStatus \{/)
  assert.match(schemaSource, /enum ReleaseStageStatus \{/)
  assert.match(schemaSource, /enum PhaseClosureStatus \{/)
  assert.match(schemaSource, /model ReliabilityGateRun \{/) 
  assert.match(schemaSource, /model SelfHealPattern \{/) 
  assert.match(schemaSource, /model SelfHealExecution \{/) 
  assert.match(schemaSource, /model ReleaseOrchestrationPlan \{/) 
  assert.match(schemaSource, /model ReleaseRollbackEvent \{/) 
  assert.match(schemaSource, /model Phase6ClosureReport \{/) 
  assert.match(schemaSource, /reliabilityGateRuns\s+ReliabilityGateRun\[\]/)
  assert.match(schemaSource, /selfHealPatterns\s+SelfHealPattern\[\]/)
  assert.match(schemaSource, /releasePlans\s+ReleaseOrchestrationPlan\[\]/)
  assert.match(schemaSource, /phase6ClosureReports\s+Phase6ClosureReport\[\]/)
})

test("week24 libs expose gate policy, self-heal, rollback impact and closure scoring", () => {
  assert.match(gateLibSource, /DEFAULT_RELIABILITY_GATE_POLICY/)
  assert.match(gateLibSource, /sanitizeReliabilityGateInput/)
  assert.match(gateLibSource, /resolveReliabilityGateStatus/)
  assert.match(gateLibSource, /buildReliabilityGateSummary/)

  assert.match(selfHealLibSource, /DEFAULT_SELF_HEAL_PATTERNS/)
  assert.match(selfHealLibSource, /sanitizeSelfHealPatternInput/)
  assert.match(selfHealLibSource, /resolveSelfHealSuggestion/)
  assert.match(selfHealLibSource, /resolveSelfHealEfficiency/)

  assert.match(releaseLibSource, /DEFAULT_RELEASE_REHEARSAL_TEMPLATE/)
  assert.match(releaseLibSource, /sanitizeReleasePlanInput/)
  assert.match(releaseLibSource, /resolveRollbackImpact/)

  assert.match(closureLibSource, /sanitizePhaseClosureInput/)
  assert.match(closureLibSource, /resolvePhase6ClosureScore/)
  assert.match(closureLibSource, /listPhaseClosureTransitions/)
  assert.match(closureLibSource, /canTransitionPhaseClosureStatus/)
  assert.match(closureLibSource, /resolvePhase6FreezeTimestamp/)
})

test("week24 APIs cover gates, self-heal, rollback and phase closure lifecycle", () => {
  assert.match(gateApiSource, /export async function GET\(\)/)
  assert.match(gateApiSource, /export async function POST\(request: Request\)/)
  assert.match(gateApiSource, /reliability\.gate\.run/)

  assert.match(selfHealApiSource, /export async function GET\(\)/)
  assert.match(selfHealApiSource, /export async function PUT\(request: Request\)/)
  assert.match(selfHealApiSource, /export async function POST\(request: Request\)/)
  assert.match(selfHealApiSource, /export async function PATCH\(request: Request\)/)
  assert.match(selfHealApiSource, /reliability\.selfheal\.suggestion\.update/)

  assert.match(releaseApiSource, /export async function GET\(\)/)
  assert.match(releaseApiSource, /export async function PUT\(request: Request\)/)
  assert.match(releaseApiSource, /export async function POST\(request: Request\)/)
  assert.match(releaseApiSource, /release\.plan\.rollback/)

  assert.match(closureApiSource, /export async function GET\(\)/)
  assert.match(closureApiSource, /export async function PUT\(request: Request\)/)
  assert.match(closureApiSource, /canTransitionPhaseClosureStatus/)
  assert.match(closureApiSource, /phase6\.closure\.update/)
})

test("week24 dashboard pages and panels expose reliability and closure workflows", () => {
  assert.match(entitlementsSource, /RELIABILITY_GATE_PLANS/)
  assert.match(entitlementsSource, /SELF_HEAL_PLANS/)
  assert.match(entitlementsSource, /RELEASE_ORCHESTRATION_PLANS/)
  assert.match(entitlementsSource, /PHASE6_CLOSURE_PLANS/)
  assert.match(entitlementsSource, /hasReliabilityGateAccess/)
  assert.match(entitlementsSource, /hasSelfHealAccess/)
  assert.match(entitlementsSource, /hasReleaseOrchestrationAccess/)
  assert.match(entitlementsSource, /hasPhase6ClosureAccess/)

  assert.match(gatePageSource, /Week24-001/)
  assert.match(selfHealPageSource, /Week24-002/)
  assert.match(releasePageSource, /Week24-003/)
  assert.match(closurePageSource, /Week24-004/)

  assert.match(gatePanelSource, /\/api\/reliability\/gates/)
  assert.match(gatePanelSource, /统一功能\/性能\/安全门禁与阻断策略/)

  assert.match(selfHealPanelSource, /\/api\/reliability\/self-heal/)
  assert.match(selfHealPanelSource, /自动修复建议 \+ 人工确认应用/)

  assert.match(releasePanelSource, /\/api\/reliability\/releases/)
  assert.match(releasePanelSource, /一键回滚与影响面评估/)

  assert.match(closurePanelSource, /\/api\/reliability\/phase6-closure/)
  assert.match(closurePanelSource, /Phase6 功能终验 \/ 运维手册 \/ 演练复盘 \/ 基线冻结/)
  assert.match(closurePanelSource, /终验状态/)
  assert.match(closurePanelSource, /签收终验/)
  assert.match(closurePanelSource, /冻结基线/)
})

test("week24 includes release gate workflow and operations handbook deliverables", () => {
  assert.match(workflowSource, /name: Phase6 Release Gates/)
  assert.match(workflowSource, /Functional Gate/)
  assert.match(workflowSource, /Performance Gate/)
  assert.match(workflowSource, /Security Gate/)
  assert.match(workflowSource, /Require status checks to pass before merging/)

  assert.match(handbookSource, /# Phase6 Operations Handbook/)
  assert.match(handbookSource, /Final Acceptance Checklist/)
  assert.match(handbookSource, /Emergency Plan/)
  assert.match(handbookSource, /Training Material/)
  assert.match(handbookSource, /Baseline Freeze/)
  assert.match(handbookSource, /Next Phase Roadmap/)
})

test("week24 modules are accessible from admin and protected by middleware", () => {
  assert.match(adminPageSource, /href: "\/admin\/reliability-gates"/)
  assert.match(adminPageSource, /href: "\/admin\/self-heal"/)
  assert.match(adminPageSource, /href: "\/admin\/release-orchestration"/)
  assert.match(adminPageSource, /href: "\/admin\/phase6-closure"/)

  assert.match(adminSubnavSource, /href: "\/admin\/reliability-gates"/)
  assert.match(adminSubnavSource, /href: "\/admin\/self-heal"/)
  assert.match(adminSubnavSource, /href: "\/admin\/release-orchestration"/)
  assert.match(adminSubnavSource, /href: "\/admin\/phase6-closure"/)

  assert.match(mobileHeaderSource, /"reliability-gates": "质量闸门"/)
  assert.match(mobileHeaderSource, /"self-heal": "自愈修复"/)
  assert.match(mobileHeaderSource, /"release-orchestration": "发布编排"/)
  assert.match(mobileHeaderSource, /"phase6-closure": "Phase6 终验"/)

  assert.match(middlewareSource, /"\/reliability-gates\/:path\*"/)
  assert.match(middlewareSource, /"\/self-heal\/:path\*"/)
  assert.match(middlewareSource, /"\/release-orchestration\/:path\*"/)
  assert.match(middlewareSource, /"\/phase6-closure\/:path\*"/)
})

test("phase6 tracker marks week24 complete and metadata in sync", () => {
  for (const id of [
    "phase6-week24-001",
    "phase6-week24-002",
    "phase6-week24-003",
    "phase6-week24-004",
  ]) {
    const item = phase6FeatureList.features.find((feature) => feature.id === id)
    assert.ok(item)
    assert.equal(item.passes, true)
  }

  assert.equal(phase6FeatureList.meta.completed_features, 16)
})
