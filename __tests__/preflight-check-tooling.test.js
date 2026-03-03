import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"))
const scriptSource = readFileSync(new URL("../tools/preflight-check.sh", import.meta.url), "utf8")
const guideSource = readFileSync(new URL("../AGENT_SESSION_GUIDE.md", import.meta.url), "utf8")
const preflightDoc = readFileSync(new URL("../docs/preflight-check.md", import.meta.url), "utf8")

test("package scripts expose fast and full preflight modes", () => {
  assert.equal(packageJson.scripts?.preflight, "bash ./tools/preflight-check.sh --mode fast")
  assert.equal(packageJson.scripts?.["preflight:fast"], "bash ./tools/preflight-check.sh --mode fast")
  assert.equal(packageJson.scripts?.["preflight:full"], "bash ./tools/preflight-check.sh --mode full")
})

test("preflight script checks dependency, db, type, and test stages", () => {
  assert.match(scriptSource, /dep\.node/)
  assert.match(scriptSource, /dep\.npm/)
  assert.match(scriptSource, /dep\.node_modules/)
  assert.match(scriptSource, /db\.ping/)
  assert.match(scriptSource, /quality\.typecheck/)
  assert.match(scriptSource, /quality\.test/)
  assert.match(scriptSource, /quality\.build/)
  assert.match(scriptSource, /MODE="fast"/)
  assert.match(scriptSource, /\$MODE" != "fast" && "\$MODE" != "full"/)
})

test("guide and docs reference unified preflight usage", () => {
  assert.match(guideSource, /npm run preflight/)
  assert.match(guideSource, /npm run preflight:full/)
  assert.match(guideSource, /docs\/preflight-check\.md/)
  assert.match(preflightDoc, /--mode fast --skip-db/)
  assert.match(preflightDoc, /--skip-db/)
})
