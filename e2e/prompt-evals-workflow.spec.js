import { expect, test } from "@playwright/test"

import { createPromptEvalsFixture } from "./helpers/prompt-evals-fixture.js"
import {
  captureStepScreenshot,
  createPlaywrightArtifactDir,
  ensureValidPlaywrightMcp,
  openInlineHtml,
} from "./helpers/playwright-helpers.js"

test("validates prompt test-case import and repeated regression stability", async ({ page }) => {
  await ensureValidPlaywrightMcp()

  const fixture = createPromptEvalsFixture()
  const artifactsDir = await createPlaywrightArtifactDir("aura-prompt-evals-")

  const promptId = fixture.createPrompt("Weekly update: {{topic}}")
  const importedCount = fixture.importTestCases(
    promptId,
    [
      {
        name: "contains-topic",
        assertionType: "CONTAINS",
        expectedOutput: "平台稳定性",
        inputVariables: { topic: "平台稳定性" },
      },
      {
        name: "equals-check",
        assertionType: "EQUALS",
        expectedOutput: "Weekly update: 平台稳定性",
        inputVariables: { topic: "平台稳定性" },
      },
    ],
    true
  )

  expect(importedCount).toBe(2)

  const firstRun = fixture.run(promptId, "MANUAL")
  const secondRun = fixture.run(promptId, "SCHEDULED")

  expect(firstRun.failedCases).toBe(0)
  expect(secondRun.failedCases).toBe(0)
  expect(secondRun.passRate).toBe(firstRun.passRate)

  const runs = fixture.getRuns(promptId)
  expect(runs.length).toBe(2)

  await openInlineHtml(
    page,
    `<html><body><h1>Prompt Evals</h1><p>First run: ${firstRun.passRate}%</p><p>Second run: ${secondRun.passRate}%</p></body></html>`
  )
  const runCapture = await captureStepScreenshot(page, artifactsDir, "01-prompt-evals-stability")
  expect(runCapture.size).toBeGreaterThan(0)

  console.log(`[prompt-evals] screenshot artifacts: ${artifactsDir}`)
})
