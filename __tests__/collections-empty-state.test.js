import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"

const collectionsPageSource = readFileSync(
  new URL("../app/(dashboard)/collections/page.tsx", import.meta.url),
  "utf8"
)

test("collections page uses guided empty state with browse action", () => {
  assert.match(collectionsPageSource, /import \{ EmptyState \} from "@\/components\/ui\/empty-state"/)
  assert.match(collectionsPageSource, /title="还没有收藏的提示词"/)
  assert.match(collectionsPageSource, /href="\/browse"/)
  assert.match(collectionsPageSource, /浏览公开提示词/)
  assert.match(collectionsPageSource, /href="\/prompts"/)
})
