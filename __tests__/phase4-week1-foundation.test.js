import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"

const schemaSource = readFileSync(new URL("../prisma/schema.prisma", import.meta.url), "utf8")
const createPromptRouteSource = readFileSync(new URL("../app/api/prompts/route.ts", import.meta.url), "utf8")
const promptRouteSource = readFileSync(new URL("../app/api/prompts/[id]/route.ts", import.meta.url), "utf8")
const rollbackRouteSource = readFileSync(
  new URL("../app/api/prompts/[id]/rollback/route.ts", import.meta.url),
  "utf8"
)
const versionsRouteSource = readFileSync(
  new URL("../app/api/prompts/[id]/versions/route.ts", import.meta.url),
  "utf8"
)
const auditRouteSource = readFileSync(new URL("../app/api/audit-logs/route.ts", import.meta.url), "utf8")
const templateVariableRouteSource = readFileSync(
  new URL("../app/api/prompts/[id]/template-variables/route.ts", import.meta.url),
  "utf8"
)
const benchmarkNotesSource = readFileSync(
  new URL("../docs/phase4-github-benchmark-notes.md", import.meta.url),
  "utf8"
)

test("phase4 benchmark notes include matrix, gap and dependency mapping", () => {
  assert.match(benchmarkNotesSource, /能力矩阵（五维）/)
  assert.match(benchmarkNotesSource, /Aura 差距结论/)
  assert.match(benchmarkNotesSource, /执行优先级与依赖/)
  assert.match(benchmarkNotesSource, /PromptStack\/promptstack/)
})

test("schema includes versioning, template variable and prompt audit models", () => {
  assert.match(schemaSource, /enum PromptVersionSource/)
  assert.match(schemaSource, /model PromptVersion/)
  assert.match(schemaSource, /model PromptTemplateVariable/)
  assert.match(schemaSource, /model PromptAuditLog/)
})

test("prompt create and update routes record version snapshots and audit logs", () => {
  assert.match(createPromptRouteSource, /createPromptVersionSnapshot/)
  assert.match(createPromptRouteSource, /PromptVersionSource\.CREATE/)
  assert.match(createPromptRouteSource, /recordPromptAuditLog/)

  assert.match(promptRouteSource, /PromptVersionSource\.UPDATE/)
  assert.match(promptRouteSource, /recordPromptAuditLog\(\{\s*promptId: params\.id,/)
})

test("rollback and versions routes are available for version workflow", () => {
  assert.match(rollbackRouteSource, /PromptVersionSource\.ROLLBACK/)
  assert.match(rollbackRouteSource, /action: "prompt\.rollback"/)
  assert.match(versionsRouteSource, /listPromptVersions/)
})

test("template variable and audit query routes are implemented", () => {
  assert.match(templateVariableRouteSource, /promptTemplateVariable/)
  assert.match(templateVariableRouteSource, /action: "prompt\.template-variables\.update"/)
  assert.match(auditRouteSource, /promptAuditLog\.findMany/)
})
