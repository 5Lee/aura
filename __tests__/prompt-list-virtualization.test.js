import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"

const virtualizedGridSource = readFileSync(
  new URL("../components/prompts/virtualized-prompt-grid.tsx", import.meta.url),
  "utf8"
)

test("virtualized prompt grid only enables windowing for 100+ items", () => {
  assert.match(virtualizedGridSource, /virtualizeThreshold = 100/)
  assert.match(virtualizedGridSource, /prompts\.length >= virtualizeThreshold/)
  assert.match(virtualizedGridSource, /if \(!shouldVirtualize\)/)
})

test("virtualized prompt grid computes row window from scroll position", () => {
  assert.match(
    virtualizedGridSource,
    /startRowIndex = Math\.max\(0, Math\.floor\(scrollTop \/ estimatedRowHeight\) - overscanRows\)/
  )
  assert.match(
    virtualizedGridSource,
    /endRowIndex = Math\.min\(\s*rows\.length,\s*Math\.ceil\(\(scrollTop \+ safeViewportHeight\) \/ estimatedRowHeight\) \+ overscanRows\s*\)/
  )
  assert.match(virtualizedGridSource, /rows\.slice\(startRowIndex, endRowIndex\)/)
})

test("virtualized prompt grid keeps a bounded scroll container", () => {
  assert.match(virtualizedGridSource, /max-h-\[70vh\] overflow-y-auto/)
  assert.match(virtualizedGridSource, /paddingTop: topSpacerHeight/)
  assert.match(virtualizedGridSource, /paddingBottom: bottomSpacerHeight/)
})
