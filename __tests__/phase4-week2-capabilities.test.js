import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"

const promptsPageSource = readFileSync(
  new URL("../app/(dashboard)/prompts/page.tsx", import.meta.url),
  "utf8"
)
const promptDetailPageSource = readFileSync(
  new URL("../app/(dashboard)/prompts/[id]/page.tsx", import.meta.url),
  "utf8"
)
const promptFormSource = readFileSync(new URL("../components/prompts/prompt-form.tsx", import.meta.url), "utf8")
const promptVersionPanelSource = readFileSync(
  new URL("../components/prompts/prompt-version-panel.tsx", import.meta.url),
  "utf8"
)
const promptAdvancedFiltersSource = readFileSync(
  new URL("../components/prompts/prompt-advanced-filters.tsx", import.meta.url),
  "utf8"
)
const createPromptRouteSource = readFileSync(new URL("../app/api/prompts/route.ts", import.meta.url), "utf8")
const updatePromptRouteSource = readFileSync(
  new URL("../app/api/prompts/[id]/route.ts", import.meta.url),
  "utf8"
)
const rollbackRouteSource = readFileSync(
  new URL("../app/api/prompts/[id]/rollback/route.ts", import.meta.url),
  "utf8"
)
const templateVariableUtilsSource = readFileSync(
  new URL("../lib/prompt-template-variable-utils.ts", import.meta.url),
  "utf8"
)
const playwrightSpecSource = readFileSync(
  new URL("../e2e/prompt-versioning-workflow.spec.js", import.meta.url),
  "utf8"
)

test("version panel is integrated on prompt detail page with rollback protection", () => {
  assert.match(promptDetailPageSource, /PromptVersionPanel/)
  assert.match(promptVersionPanelSource, /版本差异对比/)
  assert.match(promptVersionPanelSource, /confirmHighRisk/)
  assert.match(promptVersionPanelSource, /高风险回滚/)
})

test("prompt editor supports variables, sample preview and rendering endpoint", () => {
  assert.match(promptFormSource, /模板变量/)
  assert.match(promptFormSource, /变量样例输入/)
  assert.match(promptFormSource, /\/api\/prompts\/render/)
  assert.match(promptFormSource, /localStorage/)
})

test("prompt create and update APIs persist template variables", () => {
  assert.match(templateVariableUtilsSource, /sanitizeTemplateVariables/)
  assert.match(templateVariableUtilsSource, /replacePromptTemplateVariablesWithClient/)
  assert.match(createPromptRouteSource, /templateVariables/)
  assert.match(createPromptRouteSource, /sanitizeTemplateVariables/)
  assert.match(updatePromptRouteSource, /templateVariables/)
  assert.match(updatePromptRouteSource, /replacePromptTemplateVariablesWithClient/)
})

test("rollback API enforces secondary confirmation for high risk rollback", () => {
  assert.match(rollbackRouteSource, /confirmHighRisk/)
  assert.match(rollbackRouteSource, /高风险回滚需要二次确认/)
})

test("prompts page supports multi-dimensional filters and saved views", () => {
  assert.match(promptsPageSource, /PromptAdvancedFilters/)
  assert.match(promptsPageSource, /authorId/)
  assert.match(promptsPageSource, /updatedWithin/)
  assert.match(promptAdvancedFiltersSource, /SAVED_VIEWS_STORAGE_KEY/)
  assert.match(promptAdvancedFiltersSource, /应用视图/)
})

test("playwright workflow covers version history and protected rollback", () => {
  assert.match(playwrightSpecSource, /ensureValidPlaywrightMcp/)
  assert.match(playwrightSpecSource, /高风险回滚/)
  assert.match(playwrightSpecSource, /captureStepScreenshot/)
})
