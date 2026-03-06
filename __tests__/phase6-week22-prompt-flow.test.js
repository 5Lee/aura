import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const schemaSource = readFileSync(new URL("../prisma/schema.prisma", import.meta.url), "utf8")
const entitlementsSource = readFileSync(
  new URL("../lib/subscription-entitlements.ts", import.meta.url),
  "utf8"
)
const promptFlowLibSource = readFileSync(new URL("../lib/prompt-flow.ts", import.meta.url), "utf8")
const promptFlowRouteSource = readFileSync(new URL("../app/api/prompt-flow/route.ts", import.meta.url), "utf8")
const promptFlowPageSource = readFileSync(
  new URL("../app/(dashboard)/prompt-flow/page.tsx", import.meta.url),
  "utf8"
)
const promptFlowPanelSource = readFileSync(
  new URL("../components/workflow/prompt-flow-panel.tsx", import.meta.url),
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

test("schema includes prompt flow definition and run models", () => {
  assert.match(schemaSource, /enum PromptFlowStatus \{/)
  assert.match(schemaSource, /enum PromptFlowExecutionMode \{/)
  assert.match(schemaSource, /enum PromptFlowRunStatus \{/)
  assert.match(schemaSource, /model PromptFlowDefinition \{/) 
  assert.match(schemaSource, /model PromptFlowRun \{/) 
  assert.match(schemaSource, /promptFlows\s+PromptFlowDefinition\[\]/)
  assert.match(schemaSource, /promptFlowRuns\s+PromptFlowRun\[\]/)
})

test("prompt flow lib provides node-edge sanitization, execution and replay helpers", () => {
  assert.match(promptFlowLibSource, /DEFAULT_PROMPT_FLOW_TEMPLATES/)
  assert.match(promptFlowLibSource, /sanitizePromptFlowInput/)
  assert.match(promptFlowLibSource, /simulatePromptFlowExecution/)
  assert.match(promptFlowLibSource, /buildExecutionOrder/)
  assert.match(promptFlowLibSource, /resolvePromptFlowReplayToken/)
})

test("prompt flow APIs support orchestration config, execution, replay and idempotence", () => {
  assert.match(promptFlowRouteSource, /export async function GET\(\)/)
  assert.match(promptFlowRouteSource, /export async function PUT\(request: Request\)/)
  assert.match(promptFlowRouteSource, /export async function POST\(request: Request\)/)
  assert.match(promptFlowRouteSource, /buildPromptFlowSeed/)
  assert.match(promptFlowRouteSource, /simulatePromptFlowExecution/)
  assert.match(promptFlowRouteSource, /flowId_replayToken/)
  assert.match(promptFlowRouteSource, /idempotent: true/)
  assert.match(promptFlowRouteSource, /resolveFlowGovernanceAuditAction/)
  assert.match(promptFlowRouteSource, /promptflow\.run\.execute/)
})

test("prompt flow dashboard exposes visual editing and run log workflow", () => {
  assert.match(entitlementsSource, /PROMPT_FLOW_PLANS/)
  assert.match(entitlementsSource, /hasPromptFlowAccess/)
  assert.match(promptFlowPageSource, /Week22-002/)
  assert.match(promptFlowPanelSource, /工作流节点化编排（Prompt Flow）/)
  assert.match(promptFlowPanelSource, /可视化流程编辑与运行日志/)
  assert.match(promptFlowPanelSource, /执行并记录运行日志/)
  assert.match(promptFlowPanelSource, /\/api\/prompt-flow/)
  assert.match(navbarSource, /href="\/admin"/)
  assert.match(navbarSource, /"\/prompt-flow"/)
  assert.match(mobileHeaderSource, /pathname === "\/prompt-flow"/)
  assert.match(middlewareSource, /"\/prompt-flow\/:path\*"/)
})

test("phase6 tracker marks week22-002 complete with synced metadata", () => {
  assert.equal(phase6FeatureList.meta.total_features, 16)
  assert.ok(phase6FeatureList.meta.completed_features >= 6)
  const feature = phase6FeatureList.features.find((item) => item.id === "phase6-week22-002")
  assert.ok(feature)
  assert.equal(feature.passes, true)
})
