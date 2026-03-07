import { PrismaClient } from "@prisma/client"
import { expect, test } from "@playwright/test"

import {
  captureStepScreenshot,
  createCookieHeader,
  createPlaywrightArtifactDir,
  ensureValidPlaywrightMcp,
  openInlineHtml,
  resolveE2EUrl,
} from "./helpers/playwright-helpers.js"
import {
  cleanupLiveTestUser,
  createSummaryHtml,
  ensureLiveAppReady,
  liveBaseURL,
  loginWithCredentials,
  logoutWithSession,
  requestCaptchaChallenge,
  requestJson,
  requestText,
} from "./helpers/live-app-regression-helpers.js"

const prisma = new PrismaClient()

test("runs a live auth regression against the app", async ({ page }) => {
  await ensureValidPlaywrightMcp()

  const shouldRun = await ensureLiveAppReady("live-auth-regression")
  if (!shouldRun) {
    return
  }

  const artifactsDir = await createPlaywrightArtifactDir("aura-live-auth-regression-")
  const cookieJar = {}
  const timestamp = Date.now()
  const userEmail = `live-auth-${timestamp}@aura.test`
  const password = "demo123456"
  const registerIp = `198.51.${Math.floor(timestamp / 200) % 200}.${(timestamp % 200) + 1}`

  try {
    await page.goto(resolveE2EUrl("/", liveBaseURL))
    expect(await page.content()).toContain("免费开始使用")

    await page.goto(resolveE2EUrl("/register", liveBaseURL))
    expect(await page.content()).toContain("创建账号")

    await page.goto(resolveE2EUrl("/login", liveBaseURL))
    expect(await page.content()).toContain("欢迎回来")

    const registerCaptcha = await requestCaptchaChallenge("/api/auth/register-captcha", cookieJar)
    expect(registerCaptcha.response.status).toBe(200)
    expect(registerCaptcha.code.length).toBe(5)

    const register = await requestJson("/api/auth/register", cookieJar, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": registerIp,
      },
      body: JSON.stringify({
        name: "MCP 自动化认证",
        email: userEmail,
        password,
        captcha: registerCaptcha.code,
      }),
    })

    expect(register.response.status).toBe(201)
    expect(Boolean(register.payload?.userId)).toBe(true)

    const invalidLogin = await requestJson("/api/auth/validate-credentials", cookieJar, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        email: userEmail,
        password: "wrong123",
      }),
    })

    expect(invalidLogin.payload?.ok).toBe(false)
    expect(invalidLogin.payload?.error).toBe("邮箱或密码错误")

    const login = await loginWithCredentials(cookieJar, userEmail, password)
    expect(login.response.status).toBe(200)
    expect(createCookieHeader(cookieJar)).toContain("next-auth.session-token=")

    const session = await requestJson("/api/auth/session", cookieJar)
    expect(session.response.status).toBe(200)
    expect(session.payload?.user?.email).toBe(userEmail)
    expect(session.payload?.user?.name).toBe("MCP 自动化认证")

    const promptsHome = await requestText("/prompts", cookieJar)
    expect(promptsHome.response.status).toBe(200)
    expect(promptsHome.text).toContain("我的提示词")

    await openInlineHtml(
      page,
      createSummaryHtml("Live Auth Regression", [
        `User: ${userEmail}`,
        "Register API returns 201 for a new account.",
        "Credential precheck rejects wrong passwords.",
        "NextAuth session is established and protected routes open.",
      ])
    )
    const authCapture = await captureStepScreenshot(page, artifactsDir, "01-live-auth-regression")
    expect(authCapture.size).toBeGreaterThan(0)

    const logout = await logoutWithSession(cookieJar)
    expect(logout.response.status).toBe(200)
    expect(Boolean(logout.payload?.url)).toBe(true)
    expect(createCookieHeader(cookieJar)).not.toContain("next-auth.session-token=")

    const sessionAfterLogout = await requestJson("/api/auth/session", cookieJar)
    expect(Boolean(sessionAfterLogout.payload?.user)).toBe(false)

    const protectedAfterLogout = await requestText("/prompts", cookieJar)
    expect(protectedAfterLogout.response.status).toBe(307)
    expect(protectedAfterLogout.response.headers.get("location")).toContain(
      "/login?callbackUrl=%2Fprompts"
    )

    console.log(`[live-auth-regression] screenshot artifacts: ${artifactsDir}`)
  } finally {
    try {
      await cleanupLiveTestUser(prisma, userEmail)
    } finally {
      await prisma.$disconnect()
    }
  }
})
