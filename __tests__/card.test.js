import assert from "node:assert/strict"
import test from "node:test"
import React from "react"

import * as cardExports from "../components/ui/card.tsx"
import { cleanup, render } from "../tests/test-utils.js"

const cardModule =
  cardExports.default ?? cardExports["module.exports"] ?? cardExports
const { Card, CardContent, CardDescription, CardHeader, CardTitle } =
  cardModule

test("Card renders wrapper classes", () => {
  const { container } = render(
    React.createElement(Card, null, React.createElement(CardContent, null, "Body"))
  )

  assert.match(container.innerHTML, /rounded-lg/)
  assert.match(container.innerHTML, /shadow-sm/)
  cleanup()
})

test("Card renders title and content", () => {
  const { container } = render(
    React.createElement(
      Card,
      null,
      React.createElement(
        CardHeader,
        null,
        React.createElement(CardTitle, null, "Prompt Planner"),
        React.createElement(CardDescription, null, "Organize reusable prompts")
      ),
      React.createElement(CardContent, null, "Card Content")
    )
  )

  assert.match(container.textContent, /Prompt Planner/)
  assert.match(container.textContent, /Organize reusable prompts/)
  assert.match(container.textContent, /Card Content/)
  cleanup()
})
