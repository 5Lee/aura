import assert from "node:assert/strict"
import test from "node:test"

import * as templateModule from "../lib/prompt-template.ts"

const templateLib = templateModule.default ?? templateModule["module.exports"] ?? templateModule
const { extractTemplateVariables, validateTemplateInput, renderPromptTemplate } = templateLib

test("extractTemplateVariables returns deduplicated placeholders", () => {
  const variables = extractTemplateVariables("你好 {{name}}，今天主题是 {{topic}}，再次确认 {{name}}")
  assert.deepEqual(variables, ["name", "topic"])
})

test("validateTemplateInput catches required and type errors", () => {
  const result = validateTemplateInput(
    [
      { name: "name", required: true, minLength: 2 },
      { name: "temperature", type: "number", required: true },
      { name: "strict", type: "boolean" },
    ],
    {
      name: "A",
      temperature: "abc",
      strict: "maybe",
    }
  )

  assert.equal(result.ok, false)
  assert.ok(result.errors.some((error) => error.includes("变量 name 长度不能小于 2")))
  assert.ok(result.errors.some((error) => error.includes("变量 temperature 必须为数字")))
  assert.ok(result.errors.some((error) => error.includes("变量 strict 必须为布尔值")))
})

test("renderPromptTemplate returns rendered output and missing variable feedback", () => {
  const ok = renderPromptTemplate("你好 {{name}}，主题 {{topic}}", {
    name: "Aura",
    topic: "版本治理",
  })
  assert.equal(ok.ok, true)
  assert.equal(ok.rendered, "你好 Aura，主题 版本治理")

  const missing = renderPromptTemplate("你好 {{name}}，主题 {{topic}}", {
    name: "Aura",
  })
  assert.equal(missing.ok, false)
  assert.match(missing.error, /缺少变量: topic/)
})
