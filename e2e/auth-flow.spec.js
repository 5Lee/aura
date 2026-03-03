import { expect, test } from "@playwright/test"

import { createAuthFlowFixture } from "./helpers/auth-flow-fixture.js"
import {
  captureStepScreenshot,
  createCookieHeader,
  createPlaywrightArtifactDir,
  ensureValidPlaywrightMcp,
  openInlineHtml,
  updateCookieJar,
} from "./helpers/playwright-helpers.js"

test("debugs register/login/logout flow with Playwright MCP helpers", async ({ page }) => {
  await ensureValidPlaywrightMcp()

  const authFixture = createAuthFlowFixture()
  const artifactsDir = await createPlaywrightArtifactDir("aura-auth-flow-")

  const cookieJar = {}
  const userEmail = `playwright-${Date.now()}@aura.test`
  const password = "demo123456"

  await openInlineHtml(
    page,
    "<html><body><h1>Aura Register</h1><form><input name='name' /><input name='email' /><input name='password' /></form></body></html>"
  )
  const registerCapture = await captureStepScreenshot(page, artifactsDir, "01-register")
  expect(registerCapture.size).toBeGreaterThan(0)

  const registerResponse = await authFixture.register({
    name: "Playwright MCP",
    email: userEmail,
    password,
  })

  expect(registerResponse.status).toBe(201)
  const registerPayload = await registerResponse.json()
  expect(registerPayload.redirectTo).toBe("/login?registered=true")

  await openInlineHtml(
    page,
    "<html><body><h1>Aura Login</h1><p id='register-success'>注册成功，请登录</p><form><input name='email' /><input name='password' /></form></body></html>"
  )
  const loginCapture = await captureStepScreenshot(page, artifactsDir, "02-login")
  expect(loginCapture.size).toBeGreaterThan(0)

  const loginResponse = await authFixture.login({
    email: userEmail,
    password,
  })

  expect(loginResponse.status).toBe(200)
  updateCookieJar(cookieJar, loginResponse.headers)
  expect(createCookieHeader(cookieJar)).toContain("aura_session=")

  const dashboardResponse = await authFixture.accessDashboard(createCookieHeader(cookieJar))
  expect(dashboardResponse.status).toBe(200)
  const dashboardPayload = await dashboardResponse.json()
  expect(dashboardPayload.message).toBe("Dashboard")

  await openInlineHtml(
    page,
    `<html><body><h1>Dashboard</h1><p id="session-user">${dashboardPayload.userName}</p></body></html>`
  )
  const dashboardCapture = await captureStepScreenshot(page, artifactsDir, "03-dashboard")
  expect(dashboardCapture.size).toBeGreaterThan(0)

  const logoutResponse = await authFixture.logout(createCookieHeader(cookieJar))
  expect(logoutResponse.status).toBe(200)
  updateCookieJar(cookieJar, logoutResponse.headers)
  expect(cookieJar.aura_session).toBe(undefined)

  const logoutPayload = await logoutResponse.json()
  expect(logoutPayload.redirectTo).toBe("/")

  await openInlineHtml(page, "<html><body><h1>Aura Home</h1></body></html>")
  const logoutCapture = await captureStepScreenshot(page, artifactsDir, "04-logout")
  expect(logoutCapture.size).toBeGreaterThan(0)

  const dashboardAfterLogout = await authFixture.accessDashboard(createCookieHeader(cookieJar))
  expect(dashboardAfterLogout.status).toBe(302)

  console.log(`[auth-flow] screenshot artifacts: ${artifactsDir}`)
})
