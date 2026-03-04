import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const schemaSource = readFileSync(new URL("../prisma/schema.prisma", import.meta.url), "utf8")
const promptDetailSource = readFileSync(
  new URL("../app/(dashboard)/prompts/[id]/page.tsx", import.meta.url),
  "utf8"
)
const dashboardSource = readFileSync(
  new URL("../app/(dashboard)/dashboard/page.tsx", import.meta.url),
  "utf8"
)
const promptEvalLibSource = readFileSync(new URL("../lib/prompt-evals.ts", import.meta.url), "utf8")
const testCaseRouteSource = readFileSync(
  new URL("../app/api/prompts/[id]/test-cases/route.ts", import.meta.url),
  "utf8"
)
const evaluateRouteSource = readFileSync(
  new URL("../app/api/prompts/[id]/evaluate/route.ts", import.meta.url),
  "utf8"
)
const evalRunsRouteSource = readFileSync(
  new URL("../app/api/prompts/[id]/eval-runs/route.ts", import.meta.url),
  "utf8"
)
const promptRegressionToolSource = readFileSync(
  new URL("../tools/prompt-regression.ts", import.meta.url),
  "utf8"
)
const packageJsonSource = readFileSync(new URL("../package.json", import.meta.url), "utf8")
const qualityWorkflowSource = readFileSync(
  new URL("../.github/workflows/quality-gate.yml", import.meta.url),
  "utf8"
)

test("schema includes prompt test case and eval run models", () => {
  assert.match(schemaSource, /enum PromptAssertionType/)
  assert.match(schemaSource, /model PromptTestCase/)
  assert.match(schemaSource, /model PromptEvalRun/)
  assert.match(schemaSource, /model PromptEvalResult/)
})

test("prompt detail page mounts test case panel and dashboard page shows quality board", () => {
  assert.match(promptDetailSource, /PromptTestCasePanel/)
  assert.match(dashboardSource, /提示词质量看板/)
  assert.match(dashboardSource, /分类质量对比/)
  assert.match(dashboardSource, /高风险提示词/)
})

test("eval library implements assertion evaluation and quality dashboard aggregation", () => {
  assert.match(promptEvalLibSource, /evaluatePromptAssertion/)
  assert.match(promptEvalLibSource, /executePromptEvalRun/)
  assert.match(promptEvalLibSource, /JSON_SCHEMA/)
  assert.match(promptEvalLibSource, /getPromptQualityDashboard/)
})

test("prompt test case and eval routes are available", () => {
  assert.match(testCaseRouteSource, /prompt\.test-case\.create/)
  assert.match(testCaseRouteSource, /prompt\.test-case\.import/)
  assert.match(evaluateRouteSource, /prompt\.eval\.run/)
  assert.match(evalRunsRouteSource, /promptEvalRun\.findMany/)
})

test("prompt-regression tool and CI gate are configured", () => {
  assert.match(promptRegressionToolSource, /\[prompt-regression\]/)
  assert.match(promptRegressionToolSource, /\[prompt-regression\]\[FAIL\]/)
  assert.match(packageJsonSource, /"prompt-regression"\s*:\s*"tsx tools\/prompt-regression\.ts"/)
  assert.match(qualityWorkflowSource, /Stage 4 - Prompt Regression/)
  assert.match(qualityWorkflowSource, /npm run prompt-regression -- --mode ci --allow-empty/)
})
