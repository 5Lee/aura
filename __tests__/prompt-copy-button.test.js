import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"

import * as promptCopyExports from "../components/prompts/prompt-copy-button.tsx"

const source = readFileSync(new URL("../components/prompts/prompt-copy-button.tsx", import.meta.url), "utf8")

test("prompt copy button writes to clipboard and shows toast", () => {
  assert.match(source, /navigator\.clipboard\?\.writeText/)
  assert.match(source, /setIsToastVisible\(true\)/)
  assert.match(source, /提示词内容已复制到剪贴板/)
  assert.equal(promptCopyExports.COPY_TOAST_DURATION_MS, 3000)
})

test("prompt copy toast auto dismisses after the configured delay", () => {
  assert.match(source, /setTimeout\(\(\) => \{\s*setIsCopied\(false\)\s*setIsToastVisible\(false\)/)
  assert.match(source, /clearTimeout\(hideToastTimeoutRef\.current\)/)
})
