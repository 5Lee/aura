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

test("root layout uses swap display and preload for key fonts", () => {
  assert.match(layoutSource, /Inter\(\{[\s\S]*display: "swap"[\s\S]*preload: true[\s\S]*variable: "--font-inter"/)
  assert.match(layoutSource, /JetBrains_Mono\(\{[\s\S]*display: "swap"[\s\S]*preload: true[\s\S]*variable: "--font-jetbrains-mono"/)
})

test("body enables font variables and tailwind sans stack", () => {
  assert.match(layoutSource, /className=\{`\$\{inter\.variable\} \$\{jetBrainsMono\.variable\} font-sans antialiased`\}/)
})

test("design tokens consume optimized font variables with fallback stacks", () => {
  assert.match(designTokenSource, /--font-family-sans: var\(--font-inter\), 'PingFang SC'/)
  assert.match(designTokenSource, /--font-family-mono: var\(--font-jetbrains-mono\), 'SFMono-Regular'/)
})
