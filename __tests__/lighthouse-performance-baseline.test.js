import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"

const lighthouseConfig = JSON.parse(
  readFileSync(new URL("../lighthouserc.json", import.meta.url), "utf8")
)
const workflowSource = readFileSync(
  new URL("../.github/workflows/lighthouse-ci.yml", import.meta.url),
  "utf8"
)

test("lighthouse config defines core web vitals budgets", () => {
  const assertions = lighthouseConfig.ci.assert.assertions

  assert.deepEqual(assertions["largest-contentful-paint"], [
    "error",
    { maxNumericValue: 2500 },
  ])
  assert.deepEqual(assertions["max-potential-fid"], [
    "error",
    { maxNumericValue: 100 },
  ])
  assert.deepEqual(assertions["cumulative-layout-shift"], [
    "error",
    { maxNumericValue: 0.1 },
  ])
})

test("lighthouse workflow monitors performance in CI", () => {
  assert.match(workflowSource, /name: Lighthouse CI/)
  assert.match(workflowSource, /schedule:/)
  assert.match(workflowSource, /npm run build/)
  assert.match(
    workflowSource,
    /npx --yes @lhci\/cli@0\.15\.1 autorun --config=\.\/lighthouserc\.json/
  )
})
