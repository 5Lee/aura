import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const troubleshootingDoc = readFileSync(
  new URL("../docs/troubleshooting.md", import.meta.url),
  "utf8"
)
const readmeSource = readFileSync(new URL("../README.md", import.meta.url), "utf8")
const guideSource = readFileSync(new URL("../AGENT_SESSION_GUIDE.md", import.meta.url), "utf8")

test("troubleshooting handbook covers key historical failure patterns", () => {
  assert.match(troubleshootingDoc, /P1001/)
  assert.match(troubleshootingDoc, /ENOTFOUND/)
  assert.match(troubleshootingDoc, /MCP 启动超时/)
  assert.match(troubleshootingDoc, /lint.*交互/)
  assert.match(troubleshootingDoc, /\.next\/types/)
})

test("troubleshooting handbook provides actionable recovery commands", () => {
  assert.match(troubleshootingDoc, /npm run db:generate/)
  assert.match(troubleshootingDoc, /npm run preflight/)
  assert.match(troubleshootingDoc, /npm run preflight:full/)
  assert.match(troubleshootingDoc, /tools\/loop-log-summary\.sh/)
})

test("entry docs link to troubleshooting handbook", () => {
  assert.match(readmeSource, /docs\/troubleshooting\.md/)
  assert.match(guideSource, /docs\/troubleshooting\.md/)
})
