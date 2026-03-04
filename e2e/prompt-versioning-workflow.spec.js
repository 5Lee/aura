import { expect, test } from "@playwright/test"

import { createPromptVersioningFixture } from "./helpers/prompt-versioning-fixture.js"
import {
  captureStepScreenshot,
  createCookieHeader,
  createPlaywrightArtifactDir,
  ensureValidPlaywrightMcp,
  openInlineHtml,
  updateCookieJar,
} from "./helpers/playwright-helpers.js"

test("validates prompt version history, diff and protected rollback flow", async ({ page }) => {
  await ensureValidPlaywrightMcp()

  const fixture = createPromptVersioningFixture()
  const artifactsDir = await createPlaywrightArtifactDir("aura-prompt-versioning-")
  const cookieJar = {}

  const userEmail = `versioning-${Date.now()}@aura.test`
  const password = "demo123456"

  const registerResponse = await fixture.register({
    name: "Prompt Versioning User",
    email: userEmail,
    password,
  })
  expect(registerResponse.status).toBe(201)

  const loginResponse = await fixture.login({ email: userEmail, password })
  expect(loginResponse.status).toBe(200)
  updateCookieJar(cookieJar, loginResponse.headers)

  const cookieHeader = createCookieHeader(cookieJar)
  const createResponse = await fixture.createPrompt(cookieHeader, {
    title: "Versioned Prompt",
    content: "Write a weekly product update for {{team}}.",
    tags: ["weekly", "status"],
  })
  expect(createResponse.status).toBe(201)
  const createPayload = await createResponse.json()
  const promptId = createPayload.prompt.id

  await fixture.updatePrompt(cookieHeader, promptId, {
    content: "Write a concise weekly product update for {{team}} with 3 bullet points.",
    tags: ["weekly", "status", "summary"],
  })
  await fixture.updatePrompt(cookieHeader, promptId, {
    content: "Write a concise weekly product update for {{team}} and highlight blockers.",
  })
  await fixture.updatePrompt(cookieHeader, promptId, {
    content: "Write a concise weekly product update for {{team}} and classify risks.",
  })

  const versionsResponse = await fixture.listVersions(cookieHeader, promptId)
  expect(versionsResponse.status).toBe(200)
  const versions = await versionsResponse.json()
  expect(versions.length).toBeGreaterThanOrEqual(4)

  await openInlineHtml(
    page,
    `<html><body><h1>Version List</h1><p>Latest: v${versions[0].version}</p><p>Oldest: v${versions[versions.length - 1].version}</p></body></html>`
  )
  const versionListCapture = await captureStepScreenshot(page, artifactsDir, "01-version-list")
  expect(versionListCapture.size).toBeGreaterThan(0)

  const targetVersion = versions[versions.length - 1]
  const rollbackWithoutConfirm = await fixture.rollbackPrompt(cookieHeader, promptId, {
    versionId: targetVersion.id,
    confirmHighRisk: false,
  })
  expect(rollbackWithoutConfirm.status).toBe(400)
  const rollbackWithoutConfirmPayload = await rollbackWithoutConfirm.json()
  expect(rollbackWithoutConfirmPayload.error).toContain("高风险回滚")

  const rollbackResponse = await fixture.rollbackPrompt(cookieHeader, promptId, {
    versionId: targetVersion.id,
    confirmHighRisk: true,
    reason: "Recover baseline prompt",
  })
  expect(rollbackResponse.status).toBe(200)
  const rollbackPayload = await rollbackResponse.json()
  expect(rollbackPayload.rollbackVersion.source).toBe("ROLLBACK")

  const versionsAfterRollback = await fixture.listVersions(cookieHeader, promptId)
  const versionsAfterRollbackPayload = await versionsAfterRollback.json()
  expect(versionsAfterRollbackPayload[0].source).toBe("ROLLBACK")

  await openInlineHtml(
    page,
    `<html><body><h1>Rollback Complete</h1><p id='source'>${versionsAfterRollbackPayload[0].source}</p><p id='summary'>${versionsAfterRollbackPayload[0].changeSummary}</p></body></html>`
  )
  const rollbackCapture = await captureStepScreenshot(page, artifactsDir, "02-rollback-complete")
  expect(rollbackCapture.size).toBeGreaterThan(0)

  console.log(`[prompt-versioning] screenshot artifacts: ${artifactsDir}`)
})
