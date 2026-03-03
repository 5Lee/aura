import assert from "node:assert/strict"
import test from "node:test"
import React from "react"

import * as inputExports from "../components/ui/input.tsx"
import { cleanup, render } from "../tests/test-utils.js"

const inputModule =
  inputExports.default ?? inputExports["module.exports"] ?? inputExports
const { Input } = inputModule

test("Input renders with provided attributes", () => {
  const { container } = render(
    React.createElement(Input, {
      type: "email",
      placeholder: "you@example.com",
    })
  )

  assert.match(container.innerHTML, /type="email"/)
  assert.match(container.innerHTML, /placeholder="you@example\.com"/)
  cleanup()
})

test("Input forwards change events", () => {
  let nextValue = ""
  const output = Input.render(
    {
      value: "",
      onChange: (event) => {
        nextValue = event.target.value
      },
    },
    null
  )

  assert.equal(typeof output.props.onChange, "function")
  output.props.onChange({ target: { value: "Aura Prompt" } })
  assert.equal(nextValue, "Aura Prompt")
})

test("Input forwards validation props", () => {
  const output = Input.render(
    {
      required: true,
      minLength: 8,
      "aria-invalid": true,
    },
    null
  )

  assert.equal(output.props.required, true)
  assert.equal(output.props.minLength, 8)
  assert.equal(output.props["aria-invalid"], true)
})
