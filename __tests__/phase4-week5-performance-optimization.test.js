import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const promptsPageSource = readFileSync(
  new URL("../app/(dashboard)/prompts/page.tsx", import.meta.url),
  "utf8"
)
const promptsApiSource = readFileSync(new URL("../app/api/prompts/route.ts", import.meta.url), "utf8")
const versioningSource = readFileSync(new URL("../lib/prompt-versioning.ts", import.meta.url), "utf8")
const evalsSource = readFileSync(new URL("../lib/prompt-evals.ts", import.meta.url), "utf8")
const perfCacheSource = readFileSync(new URL("../lib/perf-cache.ts", import.meta.url), "utf8")
const benchmarkSource = readFileSync(
  new URL("../tools/prompt-performance-benchmark.ts", import.meta.url),
  "utf8"
)
const packageJsonSource = readFileSync(new URL("../package.json", import.meta.url), "utf8")

test("prompts page applies server-side pagination and reduced query payload selection", () => {
  assert.match(promptsPageSource, /resolvePositiveInt/)
  assert.match(promptsPageSource, /const page = resolvePositiveInt/)
  assert.match(promptsPageSource, /const pageSize = resolvePositiveInt/)
  assert.match(promptsPageSource, /take: pageSize/)
  assert.match(promptsPageSource, /skip,/)
  assert.match(promptsPageSource, /每页 \{pageSize\} 条/)
})

test("prompts api supports paginated responses with optional meta payload", () => {
  assert.match(promptsApiSource, /const includeMeta = searchParams.get\("meta"\) === "1"/)
  assert.match(promptsApiSource, /const page = resolvePositiveInt/)
  assert.match(promptsApiSource, /const pageSize = resolvePositiveInt/)
  assert.match(promptsApiSource, /meta: \{/)
  assert.match(promptsApiSource, /totalPages/)
})

test("performance cache utility supports ttl and tag-based invalidation", () => {
  assert.match(perfCacheSource, /getOrSetPerfCache/)
  assert.match(perfCacheSource, /invalidatePerfCacheByTag/)
  assert.match(perfCacheSource, /invalidatePerfCacheByTags/)
  assert.match(perfCacheSource, /expiresAt/)
})

test("version queries and eval dashboard use cached hot queries with invalidation", () => {
  assert.match(versioningSource, /getOrSetPerfCache/)
  assert.match(versioningSource, /prompt-versions:/)
  assert.match(versioningSource, /invalidatePerfCacheByTag/)
  assert.match(evalsSource, /quality-dashboard:/)
  assert.match(evalsSource, /invalidatePerfCacheByTag\(`quality-dashboard:/)
})

test("1k+ dataset benchmark tooling is available and exposes p95 target gate", () => {
  assert.match(benchmarkSource, /size: resolveInt\("size", 1200/)
  assert.match(benchmarkSource, /targetP95Ms/)
  assert.match(benchmarkSource, /latencyMs:/)
  assert.match(benchmarkSource, /process\.exitCode = 1/)
  assert.match(packageJsonSource, /"prompt-benchmark"\s*:\s*"tsx tools\/prompt-performance-benchmark\.ts"/)
})
