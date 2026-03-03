import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"

const layoutSource = readFileSync(
  new URL("../app/layout.tsx", import.meta.url),
  "utf8"
)
const designTokenSource = readFileSync(
  new URL("../styles/design-tokens.css", import.meta.url),
  "utf8"
)

test("root layout avoids network-bound google font imports", () => {
  assert.doesNotMatch(layoutSource, /next\/font\/google/)
})

test("body keeps tailwind typography baseline class", () => {
  assert.match(layoutSource, /<body className="font-sans antialiased">/)
})

test("design tokens define local-first font variables and fallback stacks", () => {
  assert.match(designTokenSource, /--font-inter: 'Inter';/)
  assert.match(designTokenSource, /--font-jetbrains-mono: 'JetBrains Mono';/)
  assert.match(designTokenSource, /--font-family-sans: var\(--font-inter\), 'PingFang SC'/)
  assert.match(designTokenSource, /--font-family-mono: var\(--font-jetbrains-mono\), 'SFMono-Regular'/)
})
