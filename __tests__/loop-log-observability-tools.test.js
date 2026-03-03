import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const loopScript = readFileSync(new URL("../run_codex_loop.sh", import.meta.url), "utf8")
const summaryTool = readFileSync(new URL("../tools/loop-log-summary.sh", import.meta.url), "utf8")
const archiveTool = readFileSync(new URL("../tools/loop-log-archive.sh", import.meta.url), "utf8")

test("loop script emits per-run summary jsonl for diagnostics", () => {
  assert.match(loopScript, /RUN_SUMMARY_FILE=.*runs\.jsonl/)
  assert.match(loopScript, /append_run_summary/)
  assert.match(loopScript, /Run summary file:/)
})

test("summary tool supports latest and explicit log dir views", () => {
  assert.match(summaryTool, /--latest/)
  assert.match(summaryTool, /--dir/)
  assert.match(summaryTool, /--json/)
  assert.match(summaryTool, /runs\.jsonl/)
  assert.match(summaryTool, /Failure reasons:/)
})

test("archive tool supports keep-days and dry-run controls", () => {
  assert.match(archiveTool, /--keep-days/)
  assert.match(archiveTool, /--dry-run/)
  assert.match(archiveTool, /archive/)
})
