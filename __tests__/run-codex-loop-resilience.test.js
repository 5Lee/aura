import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const scriptSource = readFileSync(
  new URL("../run_codex_loop.sh", import.meta.url),
  "utf8"
)

test("loop script exposes MCP fail-fast and retry controls", () => {
  assert.match(scriptSource, /CODEX_MCP_FAIL_FAST/)
  assert.match(scriptSource, /CODEX_MCP_FAIL_FAST_SEC/)
  assert.match(scriptSource, /CODEX_MCP_RETRY_PER_RUN/)
  assert.match(scriptSource, /CODEX_MCP_RETRY_DELAY_SEC/)
  assert.match(scriptSource, /CODEX_RUN_TIMEOUT_SEC/)
  assert.match(scriptSource, /CODEX_DIRTY_WORKTREE_POLICY/)
  assert.match(scriptSource, /CODEX_MAX_CONSECUTIVE_FAILURES/)
  assert.match(scriptSource, /CODEX_MAX_TASKS_PER_RUN/)
})

test("loop script classifies MCP startup failures and prints reason", () => {
  assert.match(scriptSource, /mcp-startup-stall/)
  assert.match(scriptSource, /mcp-startup-timeout/)
  assert.match(scriptSource, /Failure reason:/)
  assert.match(scriptSource, /is_mcp_failure_reason/)
})

test("loop script can retry within a run when MCP startup fails", () => {
  assert.match(scriptSource, /max_attempts=\$\(\(MCP_RETRY_PER_RUN \+ 1\)\)/)
  assert.match(scriptSource, /Retry attempt #/)
  assert.match(scriptSource, /Retrying MCP startup in/)
})

test("loop script records state snapshots and protects task isolation", () => {
  assert.match(scriptSource, /write_state_snapshot/)
  assert.match(scriptSource, /loop_state\.json/)
  assert.match(scriptSource, /task-isolation-violation/)
  assert.match(scriptSource, /dirty-worktree/)
  assert.match(scriptSource, /consecutive-failure-threshold/)
})
