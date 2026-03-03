import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"

const source = readFileSync(
  new URL("../components/prompts/prompt-preview-card.tsx", import.meta.url),
  "utf8"
)

test("prompt preview card includes required hover interaction classes", () => {
  assert.match(source, /group-hover:-translate-y-0\.5/)
  assert.match(source, /group-hover:shadow-card-hover/)
  assert.match(source, /group-hover:border-primary\/35/)
  assert.match(source, /transition-\[transform,box-shadow,border-color\] duration-200/)
})
