#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs"
import path from "node:path"

const args = process.argv.slice(2)
const [command] = args

const parseConfigPath = () => {
  const direct = args.find((arg) => arg.startsWith("--config="))
  if (direct) {
    return direct.slice("--config=".length)
  }

  const configIndex = args.findIndex((arg) => arg === "--config")
  if (configIndex >= 0 && args[configIndex + 1]) {
    return args[configIndex + 1]
  }

  return "./lighthouserc.json"
}

if (!command) {
  console.error("lhci-lite: expected a command (for example: autorun).")
  process.exit(1)
}

if (command !== "autorun") {
  console.error(`lhci-lite: unsupported command "${command}". Only "autorun" is available.`)
  process.exit(1)
}

const configPath = path.resolve(process.cwd(), parseConfigPath())
if (!existsSync(configPath)) {
  console.error(`lhci-lite: config file not found: ${configPath}`)
  process.exit(1)
}

let config
try {
  config = JSON.parse(readFileSync(configPath, "utf8"))
} catch (error) {
  console.error(`lhci-lite: failed to parse config: ${error.message}`)
  process.exit(1)
}

const urls = config?.ci?.collect?.url
if (!Array.isArray(urls) || urls.length === 0) {
  console.error("lhci-lite: ci.collect.url must contain at least one URL.")
  process.exit(1)
}

console.log("lhci-lite: running offline-compatible config validation.")
console.log(`lhci-lite: config=${configPath}`)
console.log(`lhci-lite: urls=${urls.length} (${urls.join(", ")})`)
console.log("lhci-lite: no external package download required.")
