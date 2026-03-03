import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const promptDetailPageSource = readFileSync(
  new URL("../app/(dashboard)/prompts/[id]/page.tsx", import.meta.url),
  "utf8"
)

test("prompt detail page loads tag relation fields from PromptTag", () => {
  assert.match(
    promptDetailPageSource,
    /tags:\s*\{\s*include:\s*\{\s*tag:\s*true,\s*\},\s*\}/s
  )
  assert.match(promptDetailPageSource, /key=\{promptTag\.tagId\}/)
  assert.match(promptDetailPageSource, /\{promptTag\.tag\.name\}/)
})

test("prompt detail page handles nullable author safely", () => {
  assert.match(
    promptDetailPageSource,
    /作者:\s*\{prompt\.author\?\.name \|\| prompt\.author\?\.email \|\| "匿名用户"\}/
  )
})
