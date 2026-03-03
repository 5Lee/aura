import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"

const mobileNavSource = readFileSync(
  new URL("../components/layout/mobile-nav-sheet.tsx", import.meta.url),
  "utf8"
)
const buttonSource = readFileSync(
  new URL("../components/ui/button.tsx", import.meta.url),
  "utf8"
)
const globalStylesSource = readFileSync(
  new URL("../styles/globals.css", import.meta.url),
  "utf8"
)

test("interactive controls provide a shared visible focus style for keyboard users", () => {
  assert.match(globalStylesSource, /:where\(a\[href\], button, summary, \[role="button"\]\):focus-visible/)
})

test("mobile nav sheet traps tab focus, restores trigger focus, and closes with Escape", () => {
  assert.match(mobileNavSource, /if \(event\.key === "Escape"\)/)
  assert.match(mobileNavSource, /trapFocusWithinPanel\(event, panelRef\.current\)/)
  assert.match(mobileNavSource, /if \(wasOpenRef\.current && !open\)/)
  assert.match(mobileNavSource, /triggerButtonRef\.current\?\.focus\(\)/)
})

test("action controls keep native button semantics for Enter and Space activation", () => {
  assert.match(buttonSource, /extends React\.ButtonHTMLAttributes<HTMLButtonElement>/)
  assert.match(buttonSource, /const Comp = asChild \? Slot : "button"/)

  const buttonTypeCount = [...mobileNavSource.matchAll(/type="button"/g)].length
  assert.ok(buttonTypeCount >= 2)
})
