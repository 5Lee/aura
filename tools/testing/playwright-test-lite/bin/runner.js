#!/usr/bin/env node
import { spawnSync } from "node:child_process"
import { existsSync, readdirSync, statSync, writeFileSync } from "node:fs"
import path from "node:path"
import { pathToFileURL } from "node:url"

import { __getRegisteredTests, __resetRegisteredTests } from "../index.js"

const rootDir = process.cwd()
const cliArgs = process.argv.slice(2)
const command = cliArgs[0] ?? "test"
const testArgs = command === "test" ? cliArgs.slice(1) : cliArgs

const defaultConfig = {
  testDir: "e2e",
  timeout: 30_000,
  use: {
    baseURL: "",
  },
}

const isFlag = (arg) => arg.startsWith("-")

const walk = (dir, files = []) => {
  if (!existsSync(dir)) {
    return files
  }

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

    if (/\.(spec|test)\.(js|jsx|ts|tsx)$/.test(fullPath)) {
      files.push(fullPath)
    }
  }

  return files
}

const loadConfig = async () => {
  const configPaths = [
    "playwright.config.ts",
    "playwright.config.js",
    "playwright.config.mjs",
    "playwright.config.cjs",
  ]

  const configPath = configPaths.find((candidate) => existsSync(path.join(rootDir, candidate)))
  if (!configPath) {
    return defaultConfig
  }

  const imported = await import(pathToFileURL(path.join(rootDir, configPath)).href)
  return {
    ...defaultConfig,
    ...(imported.default ?? imported),
  }
}

const ensureCommand = () => {
  if (command === "--version" || command === "-V" || command === "version") {
    console.log("Version 0.0.0-local")
    return false
  }

  if (command === "install") {
    console.log("playwright-lite: browser install skipped (offline local runner).")
    return false
  }

  if (command !== "test") {
    console.error(`playwright-lite: unsupported command \"${command}\"`)
    process.exit(1)
  }

  return true
}

class LitePage {
  constructor(baseURL = "") {
    this.baseURL = baseURL
    this.currentUrl = ""
    this.currentHtml = ""
    this.lastStatus = 0
  }

  resolveUrl(target) {
    if (/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(target)) {
      return target
    }

    if (!this.baseURL) {
      return target
    }

    return new URL(target, this.baseURL).toString()
  }

  async goto(target) {
    const url = this.resolveUrl(target)

    if (url.startsWith("data:text/html")) {
      const payload = url.split(",")[1] ?? ""
      this.currentHtml = decodeURIComponent(payload)
      this.currentUrl = url
      this.lastStatus = 200
      return this.response()
    }

    const response = await fetch(url)
    this.currentHtml = await response.text()
    this.currentUrl = url
    this.lastStatus = response.status
    return this.response()
  }

  async content() {
    return this.currentHtml
  }

  url() {
    return this.currentUrl
  }

  async screenshot(options = {}) {
    const outputPath = typeof options === "string" ? options : options.path
    const buffer = Buffer.from(this.currentHtml, "utf8")

    if (outputPath) {
      writeFileSync(path.resolve(rootDir, outputPath), buffer)
    }

    return buffer
  }

  response() {
    return {
      status: () => this.lastStatus,
      ok: () => this.lastStatus >= 200 && this.lastStatus < 400,
      url: () => this.currentUrl,
      text: async () => this.currentHtml,
    }
  }
}

const runWithTimeout = async (fn, timeoutMs) => {
  if (!timeoutMs || timeoutMs <= 0) {
    return fn()
  }

  const timeout = new Promise((_, reject) => {
    setTimeout(() => {
      reject(new Error(`Timed out after ${timeoutMs}ms`))
    }, timeoutMs)
  })

  return Promise.race([fn(), timeout])
}

const runTests = async () => {
  const config = await loadConfig()
  __resetRegisteredTests()

  const requestedFiles = testArgs.filter((arg) => !isFlag(arg))
  const discoveredFiles = walk(path.join(rootDir, config.testDir ?? "e2e"))

  const testFiles =
    requestedFiles.length > 0
      ? discoveredFiles.filter((file) => requestedFiles.some((target) => file.includes(target)))
      : discoveredFiles

  if (testFiles.length === 0) {
    console.log("No tests found.")
    return 0
  }

  for (const file of testFiles) {
    await import(pathToFileURL(file).href)
  }

  const tests = __getRegisteredTests()
  let passed = 0
  let failed = 0
  let skipped = 0

  for (const testCase of tests) {
    if (testCase.skip) {
      skipped += 1
      console.log(`- ${testCase.title} (skipped)`)
      continue
    }

    const page = new LitePage(config.use?.baseURL ?? "")
    const fixtures = {
      page,
      baseURL: config.use?.baseURL,
    }

    try {
      for (const hook of testCase.beforeEach) {
        await runWithTimeout(() => hook(fixtures), config.timeout)
      }

      await runWithTimeout(() => testCase.fn(fixtures), config.timeout)

      for (const hook of testCase.afterEach) {
        await runWithTimeout(() => hook(fixtures), config.timeout)
      }

      passed += 1
      console.log(`✔ ${testCase.title}`)
    } catch (error) {
      failed += 1
      console.log(`✖ ${testCase.title}`)
      console.error(error)
    }
  }

  console.log(`\nResults: ${passed} passed, ${failed} failed, ${skipped} skipped`)

  if (failed > 0) {
    return 1
  }

  if (testArgs.includes("--coverage")) {
    const coverageResult = spawnSync("node", ["--experimental-test-coverage", "--test"], {
      cwd: rootDir,
      stdio: "inherit",
    })

    if ((coverageResult.status ?? 1) !== 0) {
      return coverageResult.status ?? 1
    }
  }

  return 0
}

if (ensureCommand()) {
  runTests().then((status) => {
    process.exit(status)
  })
}
