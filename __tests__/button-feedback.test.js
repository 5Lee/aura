import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"

const source = readFileSync(new URL("../components/ui/button.tsx", import.meta.url), "utf8")

test("button includes shared press feedback classes", () => {
  assert.match(source, /transition-\[color,box-shadow,transform\] duration-200 ease-out/)
  assert.match(source, /active:scale-\[0\.98\]/)
  assert.match(source, /disabled:cursor-not-allowed/)
})

test("button supports loading spinner and busy semantics", () => {
  assert.match(source, /const isLoading = loading \?\? \(type === "submit" && Boolean\(disabled\)\)/)
  assert.match(source, /aria-busy=\{isLoading \|\| undefined\}/)
  assert.match(source, /data-loading=\{isLoading \? "true" : undefined\}/)
  assert.match(source, /animate-spin rounded-full border-2 border-current border-r-transparent/)
})
