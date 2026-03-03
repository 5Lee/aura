import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"

const styles = readFileSync(new URL("../styles/globals.css", import.meta.url), "utf8")

test("global form controls define a shared focus-visible style", () => {
  assert.match(styles, /input:not\(\[type="checkbox"\]\):not\(\[type="radio"\]\):not\(\[type="file"\]\)/)
  assert.match(styles, /textarea,/)
  assert.match(styles, /select\s*\):focus-visible/)
  assert.match(
    styles,
    /@apply border-ring outline-none ring-2 ring-ring ring-offset-2 ring-offset-background;/
  )
})

test("checkbox and radio controls also get keyboard-visible focus rings", () => {
  assert.match(styles, /input\[type="checkbox"\], input\[type="radio"\]\):focus-visible/)
  assert.match(styles, /@apply outline-none ring-2 ring-ring ring-offset-2 ring-offset-background;/)
})
