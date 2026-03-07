import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"
import { expect, test } from "@playwright/test"

import {
  captureStepScreenshot,
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
  normalizeHtmlText,
  requestJson,
  requestText,
} from "./helpers/live-app-regression-helpers.js"

const prisma = new PrismaClient()

async function createLivePromptUser({ email, name, password }) {
  const hashedPassword = await bcrypt.hash(password, 10)

  return prisma.user.create({
    data: {
      name,
      email,
      password: hashedPassword,
    },
    select: {
      id: true,
    },
  })
}

test("runs a live prompt publishing regression against the app", async ({ page }) => {
  await ensureValidPlaywrightMcp()

  const shouldRun = await ensureLiveAppReady("live-prompt-publishing-regression")
  if (!shouldRun) {
    return
  }

  const artifactsDir = await createPlaywrightArtifactDir("aura-live-prompt-publishing-")
  const cookieJar = {}
  const timestamp = Date.now()
  const userEmail = `live-prompt-${timestamp}@aura.test`
  const password = "demo123456"
  const promptTitle = `MCP 自动化回归提示词 ${timestamp}`
  const promptTitleV2 = `${promptTitle} v2`
  const promptDescription = "自动化覆盖模板预览、收藏、发布和社区筛选的真实路径"
  const promptContent = [
    "你是一名资深代码审查助手，请用{{language}}语境分析下面的代码片段，并给出问题、风险和改进建议：",
    "",
    "{{snippet}}",
  ].join("\n")
  const templateVariables = [
    {
      name: "language",
      type: "string",
      required: true,
    },
    {
      name: "snippet",
      type: "string",
      required: true,
    },
  ]

  try {
    const category = await prisma.category.findUnique({
      where: { name: "编程开发" },
    })

    expect(Boolean(category?.id)).toBe(true)

    await createLivePromptUser({
      email: userEmail,
      name: "MCP 自动化发布",
      password,
    })

    const login = await loginWithCredentials(cookieJar, userEmail, password)
    expect(login.response.status).toBe(200)

    const preview = await requestJson("/api/prompts/render", cookieJar, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        template: promptContent,
        input: {
          language: "TypeScript",
          snippet: "function sum(a, b) { return a + b }",
        },
        variables: templateVariables,
      }),
    })

    expect(preview.response.status).toBe(200)
    expect(preview.payload?.rendered).toContain("TypeScript")
    expect(preview.payload?.rendered).toContain("function sum(a, b)")

    const createPrompt = await requestJson("/api/prompts", cookieJar, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        title: promptTitle,
        content: promptContent,
        description: promptDescription,
        categoryId: category.id,
        isPublic: false,
        tags: ["mcp", "自动化", "回归"],
        templateVariables,
      }),
    })

    expect(createPrompt.response.status).toBe(201)
    expect(createPrompt.payload?.title).toBe(promptTitle)
    expect(createPrompt.payload?.publishStatus).toBe("DRAFT")
    expect(createPrompt.payload?.isPublic).toBe(false)
    expect(createPrompt.payload?.templateVariables?.length).toBe(2)

    const promptId = createPrompt.payload?.id
    expect(Boolean(promptId)).toBe(true)

    const favorite = await requestJson("/api/favorites", cookieJar, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        promptId,
      }),
    })

    expect(favorite.response.status).toBe(201)

    const favorites = await requestJson("/api/favorites", cookieJar)
    expect(favorites.response.status).toBe(200)
    expect(Array.isArray(favorites.payload)).toBe(true)
    expect(favorites.payload.length).toBe(1)
    expect(favorites.payload[0]?.prompt?.title).toBe(promptTitle)

    const collections = await requestText("/collections", cookieJar)
    expect(collections.response.status).toBe(200)
    expect(collections.text).toContain(promptTitle)

    await openInlineHtml(
      page,
      createSummaryHtml("Live Prompt Draft", [
        `Prompt: ${promptTitle}`,
        "Template preview resolves declared variables.",
        "Collections include the favorited draft prompt.",
      ])
    )
    const draftCapture = await captureStepScreenshot(page, artifactsDir, "01-live-prompt-draft")
    expect(draftCapture.size).toBeGreaterThan(0)

    const updatePrompt = await requestJson(`/api/prompts/${promptId}`, cookieJar, {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        title: promptTitleV2,
        description: `${promptDescription}，并验证公开发布后的社区可见性。`,
        isPublic: true,
        tags: ["mcp", "自动化", "回归", "发布"],
        templateVariables,
      }),
    })

    expect(updatePrompt.response.status).toBe(200)
    expect(updatePrompt.payload?.title).toBe(promptTitleV2)
    expect(updatePrompt.payload?.isPublic).toBe(true)

    const workflowBeforeReview = await requestJson(`/api/prompts/${promptId}/workflow`, cookieJar)
    expect(workflowBeforeReview.response.status).toBe(200)
    expect(workflowBeforeReview.payload?.publishStatus).toBe("DRAFT")
    expect(workflowBeforeReview.payload?.transitions).toContain("IN_REVIEW")

    const reviewTransition = await requestJson(`/api/prompts/${promptId}/workflow`, cookieJar, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        status: "IN_REVIEW",
        note: "Live prompt publishing regression review gate",
      }),
    })

    expect(reviewTransition.response.status).toBe(200)
    expect(reviewTransition.payload?.publishStatus).toBe("IN_REVIEW")

    const publishTransition = await requestJson(`/api/prompts/${promptId}/workflow`, cookieJar, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        status: "PUBLISHED",
        note: "Live prompt publishing regression publish gate",
      }),
    })

    expect(publishTransition.response.status).toBe(200)
    expect(publishTransition.payload?.publishStatus).toBe("PUBLISHED")

    const detail = await requestJson(`/api/prompts/${promptId}`, cookieJar)
    expect(detail.response.status).toBe(200)
    expect(detail.payload?.title).toBe(promptTitleV2)
    expect(detail.payload?.publishStatus).toBe("PUBLISHED")
    expect(detail.payload?.isPublic).toBe(true)
    expect(detail.payload?.favoriteCount).toBe(1)

    await openInlineHtml(
      page,
      createSummaryHtml("Live Prompt Publishing", [
        `Prompt: ${promptTitleV2}`,
        "Workflow transitions DRAFT -> IN_REVIEW -> PUBLISHED.",
        "Prompt detail reflects public visibility and favorite count.",
      ])
    )
    const publishCapture = await captureStepScreenshot(page, artifactsDir, "02-live-prompt-published")
    expect(publishCapture.size).toBeGreaterThan(0)

    await page.goto(resolveE2EUrl(`/browse?q=${encodeURIComponent(promptTitleV2)}`, liveBaseURL))
    const browseSearchHtml = normalizeHtmlText(await page.content())
    expect(browseSearchHtml).toContain(promptTitleV2)

    await page.goto(
      resolveE2EUrl(
        `/browse?category=${encodeURIComponent(category.id)}&q=${encodeURIComponent(promptTitleV2)}`,
        liveBaseURL
      )
    )
    const browseFilteredHtml = normalizeHtmlText(await page.content())
    expect(browseFilteredHtml).toContain(promptTitleV2)
    expect(browseFilteredHtml).toContain("分类：编程开发")

    const missingQuery = `missing-${timestamp}`
    await page.goto(
      resolveE2EUrl(
        `/browse?category=${encodeURIComponent(category.id)}&q=${encodeURIComponent(missingQuery)}`,
        liveBaseURL
      )
    )
    const browseEmptyHtml = normalizeHtmlText(await page.content())
    expect(browseEmptyHtml).toContain("当前还没有可浏览的公开提示词")
    expect(browseEmptyHtml).toContain(missingQuery)

    await openInlineHtml(
      page,
      createSummaryHtml("Live Browse Filters", [
        `Search hit: ${promptTitleV2}`,
        "Category filter keeps the published prompt visible.",
        "Missing keyword renders the public empty state.",
      ])
    )
    const browseCapture = await captureStepScreenshot(page, artifactsDir, "03-live-browse-filters")
    expect(browseCapture.size).toBeGreaterThan(0)

    const deletePrompt = await requestJson(`/api/prompts/${promptId}`, cookieJar, {
      method: "DELETE",
    })

    expect(deletePrompt.response.status).toBe(200)
    expect(deletePrompt.payload?.message).toBe("提示词删除成功")

    const promptsAfterDelete = await requestText("/prompts", cookieJar)
    expect(promptsAfterDelete.response.status).toBe(200)
    expect(promptsAfterDelete.text).toContain("还没有提示词")

    console.log(`[live-prompt-publishing-regression] screenshot artifacts: ${artifactsDir}`)
  } finally {
    try {
      await cleanupLiveTestUser(prisma, userEmail)
    } finally {
      await prisma.$disconnect()
    }
  }
})
