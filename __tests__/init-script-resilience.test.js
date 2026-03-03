import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const initScript = readFileSync(new URL("../init.sh", import.meta.url), "utf8")

test("init script supports port preflight with auto/fail strategy", () => {
  assert.match(initScript, /is_port_in_use\(\)/)
  assert.match(initScript, /AURA_DEV_PORT/)
  assert.match(initScript, /AURA_PORT_STRATEGY/)
  assert.match(initScript, /trying next port/i)
})

test("init script allows no-dev mode for preflight-only checks", () => {
  assert.match(initScript, /AURA_INIT_NO_DEV/)
  assert.match(initScript, /skipping dev server startup/i)
})

test("init script degrades gracefully when database is unavailable", () => {
  assert.match(initScript, /Database is currently unreachable/)
  assert.match(initScript, /Continue without DB migration\/seed/)
  assert.match(initScript, /DATABASE_URL/)
  assert.match(initScript, /brew services start mysql/)
})
