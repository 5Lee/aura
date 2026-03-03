import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"))
const lighthouseWorkflow = readFileSync(
  new URL("../.github/workflows/lighthouse-ci.yml", import.meta.url),
  "utf8"
)

test("test scripts use local runners instead of npx temporary installs", () => {
  assert.equal(packageJson.scripts?.["test:e2e"], "playwright test")
  assert.equal(packageJson.scripts?.["test:perf"], "lhci autorun --config=./lighthouserc.json")
  assert.equal(
    packageJson.devDependencies?.["@playwright/test"],
    "file:tools/testing/playwright-test-lite"
  )
  assert.equal(packageJson.devDependencies?.["@lhci/cli"], "file:tools/testing/lhci-cli-lite")
})

test("lighthouse workflow no longer uses npx temporary download", () => {
  assert.match(lighthouseWorkflow, /npm run test:perf/)
  assert.doesNotMatch(lighthouseWorkflow, /npx --yes @lhci\/cli/)
})
