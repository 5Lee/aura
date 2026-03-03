import assert from "node:assert/strict"
import test from "node:test"
import React from "react"

import * as buttonExports from "../components/ui/button.tsx"
import { cleanup, render, screen } from "../tests/test-utils.js"

const buttonModule =
  buttonExports.default ?? buttonExports["module.exports"] ?? buttonExports
const { Button } = buttonModule

test("Button renders label content", () => {
  render(React.createElement(Button, { type: "button" }, "Save Prompt"))
  const label = screen.getByText("Save Prompt")
  assert.equal(label.textContent, "Save Prompt")
  cleanup()
})

test("Button forwards click handlers", () => {
  let clicked = 0
  const output = Button.render(
    {
      onClick: () => {
        clicked += 1
      },
      children: "Submit",
    },
    null
  )

  assert.equal(typeof output.props.onClick, "function")
  output.props.onClick({ type: "click" })
  assert.equal(clicked, 1)
})

test("Button keeps disabled state", () => {
  render(React.createElement(Button, { disabled: true }, "Disabled"))
  const disabledButton = screen.getByText("Disabled")
  assert.equal(disabledButton.disabled, true)
  cleanup()
})
