import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"

const source = readFileSync(
  new URL("../components/prompts/prompt-preview-card.tsx", import.meta.url),
  "utf8"
)
const virtualizedGridSource = readFileSync(
  new URL("../components/prompts/virtualized-prompt-grid.tsx", import.meta.url),
  "utf8"
)
const browsePageSource = readFileSync(
  new URL("../app/browse/page.tsx", import.meta.url),
  "utf8"
)
const promptsPageSource = readFileSync(
  new URL("../app/(dashboard)/prompts/page.tsx", import.meta.url),
  "utf8"
)
const collectionsPageSource = readFileSync(
  new URL("../app/(dashboard)/collections/page.tsx", import.meta.url),
  "utf8"
)

test("prompt preview card keeps full-width mobile layout and compact spacing", () => {
  assert.match(source, /group block h-full w-full/)
  assert.match(source, /space-y-2\.5 pb-3 sm:space-y-3 sm:pb-4/)
  assert.match(source, /space-y-3\.5 sm:space-y-4/)
  assert.match(source, /gap-1\.5 sm:gap-2/)
})

test("prompt preview card uses mobile-friendly typography and clamps long titles", () => {
  assert.match(source, /line-clamp-2 break-words text-lg .* sm:text-xl/)
  assert.match(source, /line-clamp-2 text-\[13px\] .* sm:text-sm/)
})

test("prompt lists use tighter mobile gaps while preserving desktop columns", () => {
  const mobileGridPattern = /grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2 lg:grid-cols-3/

  assert.match(virtualizedGridSource, mobileGridPattern)
})

test("prompt list pages share the virtualized grid renderer", () => {
  assert.match(promptsPageSource, /VirtualizedPromptGrid/)
  assert.match(browsePageSource, /VirtualizedPromptGrid/)
  assert.match(collectionsPageSource, /VirtualizedPromptGrid/)
})
