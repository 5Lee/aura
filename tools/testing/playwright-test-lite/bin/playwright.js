#!/usr/bin/env node
import { spawnSync } from "node:child_process"
import path from "node:path"
import { fileURLToPath } from "node:url"

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const runnerPath = path.join(currentDir, "runner.js")

const result = spawnSync("node", ["--import", "tsx", runnerPath, ...process.argv.slice(2)], {
  cwd: process.cwd(),
  env: { ...process.env, NODE_NO_WARNINGS: "1" },
  stdio: "inherit",
})

process.exit(result.status ?? 1)
