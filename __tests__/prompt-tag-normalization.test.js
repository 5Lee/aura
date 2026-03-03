import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"

import * as tagUtilsModule from "../lib/tag-utils.ts"

const tagUtils = tagUtilsModule.default ?? tagUtilsModule["module.exports"] ?? tagUtilsModule
const { normalizeTagNames } = tagUtils

const createPromptRouteSource = readFileSync(new URL("../app/api/prompts/route.ts", import.meta.url), "utf8")
const updatePromptRouteSource = readFileSync(new URL("../app/api/prompts/[id]/route.ts", import.meta.url), "utf8")

test("normalizeTagNames trims, deduplicates and removes empty values", () => {
  const normalized = normalizeTagNames([" GPT-4 ", "gpt-4", "  ", "Claude", "claude"])
  assert.deepEqual(normalized, ["GPT-4", "Claude"])
})

test("prompt routes resolve tags by name to avoid duplicate-name write failures", () => {
  assert.match(createPromptRouteSource, /normalizeTagNames\(tags\)/)
  assert.match(createPromptRouteSource, /findOrCreateTagByName\(tagName\)/)
  assert.match(updatePromptRouteSource, /normalizeTagNames\(tags\)/)
  assert.match(updatePromptRouteSource, /findOrCreateTagByName\(tagName\)/)
})
