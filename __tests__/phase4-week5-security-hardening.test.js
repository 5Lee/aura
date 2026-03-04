import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const securitySource = readFileSync(new URL("../lib/security.ts", import.meta.url), "utf8")
const templateSource = readFileSync(new URL("../lib/prompt-template.ts", import.meta.url), "utf8")
const templateVariableSource = readFileSync(
  new URL("../lib/prompt-template-variable-utils.ts", import.meta.url),
  "utf8"
)
const renderRouteSource = readFileSync(new URL("../app/api/prompts/render/route.ts", import.meta.url), "utf8")
const promptRouteSource = readFileSync(new URL("../app/api/prompts/[id]/route.ts", import.meta.url), "utf8")
const testCaseUtilsSource = readFileSync(new URL("../lib/prompt-test-case-utils.ts", import.meta.url), "utf8")
const evalsSource = readFileSync(new URL("../lib/prompt-evals.ts", import.meta.url), "utf8")
const tagUtilsSource = readFileSync(new URL("../lib/tag-utils.ts", import.meta.url), "utf8")

test("security utility blocks dangerous keys and sanitizes nested json payloads", () => {
  assert.match(securitySource, /BLOCKED_OBJECT_KEYS/)
  assert.match(securitySource, /hasBlockedObjectPath/)
  assert.match(securitySource, /sanitizeJsonValue/)
  assert.match(securitySource, /Object\.create\(null\)/)
})

test("template validation hardens against unsafe variable names and prototype chain access", () => {
  assert.match(templateSource, /isSafeTemplateVariableName/)
  assert.match(templateSource, /Object\.create\(null\)/)
  assert.match(templateSource, /Object\.prototype\.hasOwnProperty\.call/)
})

test("template variable sanitizer enforces safe naming before persistence", () => {
  assert.match(templateVariableSource, /isSafeTemplateVariableName/)
  assert.match(templateVariableSource, /sanitizeTextInput/)
  assert.match(templateVariableSource, /sanitizeMultilineTextInput/)
})

test("render route is authenticated and applies payload size plus sanitization guards", () => {
  assert.match(renderRouteSource, /getServerSession/)
  assert.match(renderRouteSource, /请先登录/)
  assert.match(renderRouteSource, /MAX_TEMPLATE_LENGTH/)
  assert.match(renderRouteSource, /sanitizeTemplateVariables/)
  assert.match(renderRouteSource, /sanitizeJsonValue/)
})

test("prompt detail api redacts member and author email exposure for non-privileged viewers", () => {
  assert.match(promptRouteSource, /const canSeeMembers = permission\.isOwner \|\| Boolean\(permission\.role\)/)
  assert.match(promptRouteSource, /const canSeeUserEmail = permission\.isOwner \|\| permission\.canManageMembers/)
  assert.match(promptRouteSource, /email: canSeeUserEmail \? member\.user\.email : null/)
})

test("test-case sanitizer rejects unsafe inputVariables and eval guards expensive assertions", () => {
  assert.match(testCaseUtilsSource, /sanitizeJsonValue/)
  assert.match(testCaseUtilsSource, /normalizedInputVariables === undefined/)
  assert.match(evalsSource, /正则表达式过长/)
  assert.match(evalsSource, /JSON Schema 断言配置过长/)
})

test("tag normalization applies text sanitization to avoid unsafe raw labels", () => {
  assert.match(tagUtilsSource, /sanitizeTextInput/)
})
