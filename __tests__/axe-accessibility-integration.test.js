import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"

const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"))
const appProvidersSource = readFileSync(
  new URL("../components/providers/app-providers.tsx", import.meta.url),
  "utf8"
)
const axeLiteSource = readFileSync(
  new URL("../tools/testing/axe-core-react-lite/index.js", import.meta.url),
  "utf8"
)

test("project installs @axe-core/react via local testing package", () => {
  assert.equal(
    packageJson.devDependencies["@axe-core/react"],
    "file:tools/testing/axe-core-react-lite"
  )
})

test("app providers load axe-core only in development and guard duplicate setup", () => {
  assert.match(appProvidersSource, /process\.env\.NODE_ENV === "production"/)
  assert.match(appProvidersSource, /window\.__AURA_AXE_READY__/)
  assert.match(appProvidersSource, /import\("@axe-core\/react"\)/)
  assert.match(appProvidersSource, /import\("react-dom\/client"\)/)
  assert.match(appProvidersSource, /AXE_INTEGRATION_DELAY = 1000/)
})

test("axe-lite surfaces serious form-name and image-alt accessibility issues", () => {
  assert.match(axeLiteSource, /control-has-accessible-name/)
  assert.match(axeLiteSource, /image-alt/)
  assert.match(axeLiteSource, /serious accessibility issue/)
})
