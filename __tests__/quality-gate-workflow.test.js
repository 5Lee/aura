import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const workflow = readFileSync(
  new URL("../.github/workflows/quality-gate.yml", import.meta.url),
  "utf8"
)
const qualityDoc = readFileSync(
  new URL("../docs/quality-gate.md", import.meta.url),
  "utf8"
)

test("quality gate workflow covers build/typecheck/lint/test on main", () => {
  assert.match(workflow, /name: Quality Gate/)
  assert.match(workflow, /pull_request:\n\s+branches:\n\s+- main/)
  assert.match(workflow, /push:\n\s+branches:\n\s+- main/)
  assert.match(workflow, /Stage 1 - Typecheck/)
  assert.match(workflow, /npm run typecheck/)
  assert.match(workflow, /Stage 2 - Lint/)
  assert.match(workflow, /npm run lint/)
  assert.match(workflow, /Stage 3 - Test/)
  assert.match(workflow, /npm test/)
  assert.match(workflow, /Stage 4 - Build/)
  assert.match(workflow, /npm run build/)
})

test("quality gate doc includes matrix and branch protection guidance", () => {
  assert.match(qualityDoc, /Gate Matrix/)
  assert.match(qualityDoc, /Typecheck/)
  assert.match(qualityDoc, /Lint/)
  assert.match(qualityDoc, /Test/)
  assert.match(qualityDoc, /Build/)
  assert.match(qualityDoc, /Require status checks to pass before merging/)
  assert.match(qualityDoc, /Quality Gate/)
})
