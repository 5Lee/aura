import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const tsconfig = JSON.parse(readFileSync(new URL("../tsconfig.json", import.meta.url), "utf8"))
const typecheckTsconfig = JSON.parse(
  readFileSync(new URL("../tsconfig.typecheck.json", import.meta.url), "utf8")
)
const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"))

test("typecheck config avoids hard dependency on .next/types", () => {
  const includes = typecheckTsconfig.include || []
  const excludes = typecheckTsconfig.exclude || []

  assert.ok(Array.isArray(includes))
  assert.equal(includes.some((entry) => String(entry).includes(".next/types")), false)
  assert.ok(Array.isArray(excludes))
  assert.equal(excludes.includes(".next"), true)
  assert.equal(typecheckTsconfig.compilerOptions?.incremental, false)
  assert.equal(tsconfig.compilerOptions?.incremental, false)
})

test("typecheck command is available for clean environment verification", () => {
  assert.equal(packageJson.scripts?.typecheck, "tsc --noEmit -p tsconfig.typecheck.json")
})
