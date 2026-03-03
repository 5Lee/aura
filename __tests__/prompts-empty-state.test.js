import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"

const emptyStateSource = readFileSync(
  new URL("../components/ui/empty-state.tsx", import.meta.url),
  "utf8"
)
const promptsPageSource = readFileSync(
  new URL("../app/(dashboard)/prompts/page.tsx", import.meta.url),
  "utf8"
)

test("empty state component provides reusable icon and action slots", () => {
  assert.match(emptyStateSource, /interface EmptyStateProps/)
  assert.match(emptyStateSource, /icon: React\.ReactNode/)
  assert.match(emptyStateSource, /actions\?: React\.ReactNode/)
  assert.match(emptyStateSource, /bg-gradient-to-br from-card via-card to-muted\/30/)
})

test("prompts page supports no-data and no-search-result empty states", () => {
  assert.match(promptsPageSource, /const query = searchParams\.q\?\.trim\(\) \?\? ""/)
  assert.match(promptsPageSource, /where\.OR = \[/)
  assert.match(promptsPageSource, /title="没有找到匹配的提示词"/)
  assert.match(promptsPageSource, /title="还没有提示词"/)
  assert.match(promptsPageSource, /href="\/prompts\/new"/)
  assert.match(promptsPageSource, /href="\/prompts"/)
})
