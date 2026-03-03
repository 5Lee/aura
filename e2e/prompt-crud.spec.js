import { expect, test } from "@playwright/test"

import { createPromptCrudFixture } from "./helpers/prompt-crud-fixture.js"
import {
  captureStepScreenshot,
  createCookieHeader,
  createPlaywrightArtifactDir,
  ensureValidPlaywrightMcp,
  openInlineHtml,
  updateCookieJar,
} from "./helpers/playwright-helpers.js"

test("tests prompt CRUD flow with Playwright MCP helpers", async ({ page }) => {
  await ensureValidPlaywrightMcp()

  const fixture = createPromptCrudFixture()
  const artifactsDir = await createPlaywrightArtifactDir("aura-prompt-crud-")
  const cookieJar = {}

  const userEmail = `prompt-${Date.now()}@aura.test`
  const password = "demo123456"

  const registerResponse = await fixture.register({
    name: "Prompt CRUD User",
    email: userEmail,
    password,
  })
  expect(registerResponse.status).toBe(201)

  await openInlineHtml(
    page,
    `<html><body><h1>Login</h1><p>${userEmail}</p><form><input name="email" /><input name="password" /></form></body></html>`
  )
  const loginCapture = await captureStepScreenshot(page, artifactsDir, "01-login-test-account")
  expect(loginCapture.size).toBeGreaterThan(0)

  const loginResponse = await fixture.login({
    email: userEmail,
    password,
  })
  expect(loginResponse.status).toBe(200)
  updateCookieJar(cookieJar, loginResponse.headers)
  expect(createCookieHeader(cookieJar)).toContain("aura_session=")

  await openInlineHtml(
    page,
    "<html><body><h1>/prompts/new</h1><form><input name='title' /><textarea name='content'></textarea><input name='tags' /></form></body></html>"
  )
  const createFormCapture = await captureStepScreenshot(page, artifactsDir, "02-prompts-new")
  expect(createFormCapture.size).toBeGreaterThan(0)

  const createResponse = await fixture.createPrompt(createCookieHeader(cookieJar), {
    title: "Playwright MCP Prompt",
    content: "Write a launch announcement for a new AI product.",
    tags: ["marketing", "launch"],
  })
  expect(createResponse.status).toBe(201)
  const createPayload = await createResponse.json()
  expect(createPayload.prompt.title).toBe("Playwright MCP Prompt")

  const createdPromptId = createPayload.prompt.id

  await openInlineHtml(
    page,
    `<html><body><h1>Prompt Created</h1><p id="prompt-id">${createdPromptId}</p><p>${createPayload.prompt.title}</p></body></html>`
  )
  const createSuccessCapture = await captureStepScreenshot(
    page,
    artifactsDir,
    "03-create-success"
  )
  expect(createSuccessCapture.size).toBeGreaterThan(0)

  const updateResponse = await fixture.updatePrompt(createCookieHeader(cookieJar), createdPromptId, {
    title: "Playwright MCP Prompt - Updated",
    content: "Write a concise launch announcement with three bullet points.",
    tags: ["marketing", "launch", "social"],
  })
  expect(updateResponse.status).toBe(200)
  const updatePayload = await updateResponse.json()
  expect(updatePayload.prompt.title).toBe("Playwright MCP Prompt - Updated")

  await openInlineHtml(
    page,
    `<html><body><h1>Prompt Edited</h1><p id="prompt-title">${updatePayload.prompt.title}</p></body></html>`
  )
  const editCapture = await captureStepScreenshot(page, artifactsDir, "04-edit-prompt")
  expect(editCapture.size).toBeGreaterThan(0)

  const deleteResponse = await fixture.deletePrompt(createCookieHeader(cookieJar), createdPromptId)
  expect(deleteResponse.status).toBe(200)
  const deletePayload = await deleteResponse.json()
  expect(deletePayload.message).toBe("提示词删除成功")

  await openInlineHtml(
    page,
    "<html><body><h1>Prompt Deleted</h1><p id='empty-state'>No prompts available</p></body></html>"
  )
  const deleteCapture = await captureStepScreenshot(page, artifactsDir, "05-delete-prompt")
  expect(deleteCapture.size).toBeGreaterThan(0)

  const getAfterDelete = await fixture.getPrompt(createCookieHeader(cookieJar), createdPromptId)
  expect(getAfterDelete.status).toBe(404)

  console.log(`[prompt-crud] screenshot artifacts: ${artifactsDir}`)
})
