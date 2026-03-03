#!/usr/bin/env node
import { spawnSync } from "node:child_process"
import { existsSync, readdirSync, statSync } from "node:fs"
import path from "node:path"
import { pathToFileURL } from "node:url"

const rootDir = process.cwd()

const defaultTestPattern = (file) =>
  /\.(test|spec)\.(js|jsx|ts|tsx)$/.test(file)

const walk = (dir, files = []) => {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".next" || entry === ".git") {
      continue
    }

    const fullPath = path.join(dir, entry)
    const stat = statSync(fullPath)
    if (stat.isDirectory()) {
      walk(fullPath, files)
      continue
    }

    if (defaultTestPattern(fullPath)) {
      files.push(fullPath)
    }
  }

  return files
}

const normalizeConfigPath = (value) =>
  value.replace("<rootDir>", rootDir).replace(/^\.\//, "")

const loadConfig = async () => {
  const jsConfig = path.join(rootDir, "jest.config.js")
  if (!existsSync(jsConfig)) {
    return { setupFilesAfterEnv: [] }
  }

  const imported = await import(pathToFileURL(jsConfig).href)
  const config = imported.default ?? imported
  return {
    setupFilesAfterEnv: (config.setupFilesAfterEnv ?? []).map(normalizeConfigPath),
  }
}

const run = async () => {
  const config = await loadConfig()
  const cliArgs = process.argv.slice(2)
  const cliTargets = cliArgs.filter((arg) => !arg.startsWith("-"))
  const shouldCollectCoverage = cliArgs.includes("--coverage")
  const discoveredFiles = walk(rootDir)

  const testFiles =
    cliTargets.length > 0
      ? discoveredFiles.filter((file) =>
          cliTargets.some((target) => file.includes(target))
        )
      : discoveredFiles

  if (testFiles.length === 0) {
    console.log("No tests found.")
    process.exit(0)
  }

  const importArgs = ["tsx", ...config.setupFilesAfterEnv].flatMap((file) => [
    "--import",
    file,
  ])
  const coverageArgs = shouldCollectCoverage
    ? ["--experimental-test-coverage"]
    : []
  const result = spawnSync(
    "node",
    [...importArgs, ...coverageArgs, "--test", ...testFiles],
    {
      cwd: rootDir,
      env: { ...process.env, NODE_NO_WARNINGS: "1" },
      stdio: "inherit",
    }
  )

  process.exit(result.status ?? 1)
}

run()
