import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const schemaSource = readFileSync(new URL("../prisma/schema.prisma", import.meta.url), "utf8")
const workflowRouteSource = readFileSync(
  new URL("../app/api/prompts/[id]/workflow/route.ts", import.meta.url),
  "utf8"
)
const membersRouteSource = readFileSync(
  new URL("../app/api/prompts/[id]/members/route.ts", import.meta.url),
  "utf8"
)
const batchRouteSource = readFileSync(
  new URL("../app/api/prompts/batch/route.ts", import.meta.url),
  "utf8"
)
const codeRouteSource = readFileSync(new URL("../app/api/prompts/code/route.ts", import.meta.url), "utf8")
const promptsPageSource = readFileSync(
  new URL("../app/(dashboard)/prompts/page.tsx", import.meta.url),
  "utf8"
)
const filtersSource = readFileSync(
  new URL("../components/prompts/prompt-advanced-filters.tsx", import.meta.url),
  "utf8"
)
const promptDetailSource = readFileSync(
  new URL("../app/(dashboard)/prompts/[id]/page.tsx", import.meta.url),
  "utf8"
)

test("schema includes publish workflow and role membership models", () => {
  assert.match(schemaSource, /enum PromptPublishStatus/)
  assert.match(schemaSource, /enum PromptRole/)
  assert.match(schemaSource, /model PromptMember/)
  assert.match(schemaSource, /publishStatus\s+PromptPublishStatus/)
  assert.match(schemaSource, /sourceExternalId\s+String\?\s+@unique/)
})

test("workflow route supports state transition checks and history query", () => {
  assert.match(workflowRouteSource, /canTransitionPublishStatus/)
  assert.match(workflowRouteSource, /listTransitions/)
  assert.match(workflowRouteSource, /prompt\.workflow\.transition/)
  assert.match(workflowRouteSource, /history:/)
})

test("members route enforces owner-only management with role normalization", () => {
  assert.match(membersRouteSource, /canManageMembers/)
  assert.match(membersRouteSource, /仅 Owner 可管理协作者/)
  assert.match(membersRouteSource, /MANAGED_ROLES/)
  assert.match(membersRouteSource, /prompt\.members\.update/)
})

test("batch route supports visibility and archive lifecycle operations", () => {
  assert.match(batchRouteSource, /"update-tags"/)
  assert.match(batchRouteSource, /"set-visibility"/)
  assert.match(batchRouteSource, /"archive"/)
  assert.match(batchRouteSource, /"restore"/)
  assert.match(batchRouteSource, /unauthorized/)
})

test("prompt-as-code route supports json\/yaml import-export and conflict policies", () => {
  assert.match(codeRouteSource, /resolveFormat/)
  assert.match(codeRouteSource, /serializePromptCodeFile/)
  assert.match(codeRouteSource, /parsePromptCodeFile/)
  assert.match(codeRouteSource, /"skip", "overwrite", "create-new"/)
  assert.match(codeRouteSource, /resolveImportPublishState/)
})

test("prompts list integrates publish status filters and batch toolbar", () => {
  assert.match(promptsPageSource, /PromptBatchToolbar/)
  assert.match(promptsPageSource, /publishStatus/)
  assert.match(filtersSource, /按发布状态筛选/)
  assert.match(filtersSource, /publishStatus: String\(view\.filters\.publishStatus \|\| "all"\)/)
})

test("prompt detail page mounts workflow, members, and prompt-as-code panels", () => {
  assert.match(promptDetailSource, /PromptWorkflowPanel/)
  assert.match(promptDetailSource, /PromptMembersPanel/)
  assert.match(promptDetailSource, /PromptCodePanel/)
  assert.match(promptDetailSource, /PUBLISH_STATUS_LABELS/)
})
