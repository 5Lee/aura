import { BillingCycle, BillingProvider, PrismaClient, SubscriptionStatus } from "@prisma/client"
import bcrypt from "bcryptjs"
import { expect, test } from "@playwright/test"

import {
  captureStepScreenshot,
  createCookieHeader,
  createPlaywrightArtifactDir,
  ensureValidPlaywrightMcp,
  openInlineHtml,
} from "./helpers/playwright-helpers.js"
import {
  createSummaryHtml,
  ensureLiveAppReady,
  liveBaseURL,
  loginWithCredentials,
  normalizeHtmlText,
  requestJson,
  requestText,
} from "./helpers/live-app-regression-helpers.js"

const prisma = new PrismaClient()

test.setTimeout(180_000)

async function createLiveEnterpriseUser({ email, name, password }) {
  const hashedPassword = await bcrypt.hash(password, 10)
  const now = new Date()
  const currentPeriodEnd = new Date(now)
  currentPeriodEnd.setMonth(currentPeriodEnd.getMonth() + 1)

  return prisma.user.create({
    data: {
      name,
      email,
      password: hashedPassword,
      subscriptions: {
        create: {
          provider: BillingProvider.MOCKPAY,
          externalCustomerId: `live-admin-customer-${Date.now()}`,
          externalSubscriptionId: `live-admin-subscription-${Date.now()}`,
          planId: "enterprise",
          cycle: BillingCycle.MONTHLY,
          status: SubscriptionStatus.ACTIVE,
          currentPeriodStart: now,
          currentPeriodEnd,
          metadata: {
            source: "live-admin-backoffice-regression",
          },
        },
      },
    },
    select: {
      id: true,
      email: true,
      name: true,
    },
  })
}

async function cleanupLiveAdminUser(userEmail) {
  const user = await prisma.user.findUnique({
    where: { email: userEmail },
    select: { id: true },
  })

  if (!user?.id) {
    return
  }

  const userId = user.id

  await prisma.$transaction(async (tx) => {
    await tx.supportEscalationEvent.deleteMany({
      where: {
        ticket: {
          userId,
        },
      },
    })
    await tx.supportPostmortem.deleteMany({
      where: {
        tenantUserId: userId,
      },
    })
    await tx.supportTicketEvent.deleteMany({
      where: {
        ticket: {
          userId,
        },
      },
    })
    await tx.supportEscalationPolicy.deleteMany({
      where: {
        userId,
      },
    })
    await tx.supportRunbook.deleteMany({
      where: {
        userId,
      },
    })
    await tx.supportTicket.deleteMany({
      where: {
        userId,
      },
    })

    await tx.partnerSettlement.deleteMany({
      where: {
        userId,
      },
    })
    await tx.partnerLead.deleteMany({
      where: {
        userId,
      },
    })
    await tx.partnerTier.deleteMany({
      where: {
        userId,
      },
    })

    await tx.apiQuotaAlert.deleteMany({
      where: {
        userId,
      },
    })
    await tx.apiUsageRecord.deleteMany({
      where: {
        userId,
      },
    })
    await tx.apiOveragePurchase.deleteMany({
      where: {
        userId,
      },
    })
    await tx.apiKey.deleteMany({
      where: {
        userId,
      },
    })

    await tx.billingInvoice.deleteMany({
      where: {
        userId,
      },
    })
    await tx.billingEvent.deleteMany({
      where: {
        userId,
      },
    })
    await tx.invoiceProfile.deleteMany({
      where: {
        userId,
      },
    })
    await tx.subscription.deleteMany({
      where: {
        userId,
      },
    })

    await tx.promptAuditLog.deleteMany({
      where: {
        actorId: userId,
      },
    })

    await tx.user.deleteMany({
      where: {
        id: userId,
      },
    })
  })
}

async function assertProtectedPageContains(cookieJar, pathname, expectedText) {
  const response = await requestText(pathname, cookieJar)
  expect(response.response.status).toBe(200)

  const html = normalizeHtmlText(response.text)
  expect(html).toContain(expectedText)

  return html
}

async function captureSummary(page, artifactsDir, stepName, title, details) {
  await openInlineHtml(page, createSummaryHtml(title, details))
  const capture = await captureStepScreenshot(page, artifactsDir, stepName)
  expect(capture.size).toBeGreaterThan(0)
  return capture
}

test("runs a live admin backoffice regression against the app", async ({ page }) => {
  await ensureValidPlaywrightMcp()

  const shouldRun = await ensureLiveAppReady("live-admin-backoffice-regression")
  if (!shouldRun) {
    return
  }

  const artifactsDir = await createPlaywrightArtifactDir("aura-live-admin-backoffice-")
  const cookieJar = {}
  const timestamp = Date.now()
  const userEmail = `live-admin-${timestamp}@aura.test`
  const password = "demo123456"
  const userName = "MCP Admin Regression"
  const ticketTitle = `Playwright 支持回归 ${timestamp}`
  const ticketDescription = "Playwright 管理台回归：验证支持、计费、开发者 API 与合作伙伴后台流程。"
  const runbookMarker = `Playwright enterprise drill ${timestamp}`
  const escalationReason = "Playwright 演练：验证升级路径提交流程与页内反馈。"
  const postmortemSummary = `Playwright 复盘草稿 ${timestamp}`
  const billingTitle = `Playwright Billing ${timestamp}`
  const billingTaxNumber = `TAX-${timestamp}`
  const apiKeyName = `Playwright API Key ${timestamp}`
  const partnerTierName = `Playwright Tier ${timestamp}`
  const partnerLeadName = `Playwright Lead ${timestamp}`

  try {
    const user = await createLiveEnterpriseUser({
      email: userEmail,
      name: userName,
      password,
    })

    const login = await loginWithCredentials(cookieJar, userEmail, password)
    expect(login.response.status).toBe(200)
    expect(createCookieHeader(cookieJar)).toMatch(/session-token=/)

    const session = await requestJson("/api/auth/session", cookieJar)
    expect(session.response.status).toBe(200)
    expect(session.payload?.user?.email).toBe(userEmail)

    const supportPage = await assertProtectedPageContains(cookieJar, "/admin/support", "专属支持通道与工单体系")
    expect(supportPage).toContain("工单标题")

    const invalidTicket = await requestJson("/api/support/tickets", cookieJar, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        title: "",
        description: "",
      }),
    })
    expect(invalidTicket.response.status).toBe(400)
    expect(invalidTicket.payload?.error).toBe("工单标题和描述不能为空")

    const createdTicketResponse = await requestJson("/api/support/tickets", cookieJar, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        title: ticketTitle,
        description: ticketDescription,
        category: "quality",
        priority: "HIGH",
      }),
    })
    expect(createdTicketResponse.response.status).toBe(201)
    expect(createdTicketResponse.payload?.ticket?.title).toBe(ticketTitle)
    expect(createdTicketResponse.payload?.ticket?.priority).toBe("HIGH")
    expect(createdTicketResponse.payload?.priorityDowngraded).toBe(false)

    const createdTicketId = createdTicketResponse.payload?.ticket?.id
    expect(Boolean(createdTicketId)).toBe(true)

    const ticketList = await requestJson("/api/support/tickets?page=1&pageSize=10", cookieJar)
    expect(ticketList.response.status).toBe(200)
    expect(JSON.stringify(ticketList.payload?.data || [])).toContain(ticketTitle)

    const savedRunbookResponse = await requestJson("/api/support/process/runbook", cookieJar, {
      method: "PUT",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        triageChecklist: [runbookMarker, "确认影响面", "同步客户状态"],
        escalationWorkflow: ["L1: 值班支持工程师接单", "L3: 建立跨团队战情室"],
        responseWorkflow: ["10 分钟内首次响应", "30 分钟内同步定位进展"],
        contactMatrix: [
          {
            role: "Incident Commander",
            team: "enterprise-support",
            channel: "#incident-war-room",
            owner: "playwright-ic",
          },
        ],
        postmortemTemplate: {
          timeline: ["事件开始", "恢复时间"],
          impactAssessment: ["受影响客户", "业务影响"],
          rootCause: ["直接原因"],
          actionItems: ["短期修复", "长期治理"],
        },
      }),
    })
    expect(savedRunbookResponse.response.status).toBe(200)
    expect(JSON.stringify(savedRunbookResponse.payload?.runbook?.config?.triageChecklist || [])).toContain(
      runbookMarker
    )

    const createdEscalationResponse = await requestJson("/api/support/process/escalations", cookieJar, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        ticketId: createdTicketId,
        level: "L3",
        reason: escalationReason,
      }),
    })
    expect(createdEscalationResponse.response.status).toBe(200)
    expect(createdEscalationResponse.payload?.escalation?.ticketId).toBe(createdTicketId)
    expect(createdEscalationResponse.payload?.escalation?.level).toBe("L3")
    expect(createdEscalationResponse.payload?.ticket?.status).toBe("IN_PROGRESS")

    const createdPostmortemResponse = await requestJson("/api/support/process/postmortems", cookieJar, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        ticketId: createdTicketId,
        summary: postmortemSummary,
      }),
    })
    expect(createdPostmortemResponse.response.status).toBe(201)
    expect(createdPostmortemResponse.payload?.postmortem?.summary).toContain(postmortemSummary)
    expect(createdPostmortemResponse.payload?.postmortem?.status).toBe("DRAFT")

    const supportTicket = await prisma.supportTicket.findUnique({
      where: {
        id: createdTicketId,
      },
      select: {
        status: true,
        priority: true,
      },
    })
    expect(supportTicket?.status).toBe("IN_PROGRESS")
    expect(supportTicket?.priority).toBe("URGENT")

    const savedRunbook = await prisma.supportRunbook.findUnique({
      where: {
        userId: user.id,
      },
      select: {
        triageChecklist: true,
      },
    })
    expect(JSON.stringify(savedRunbook?.triageChecklist || [])).toContain(runbookMarker)

    const escalationEvent = await prisma.supportEscalationEvent.findFirst({
      where: {
        ticketId: createdTicketId,
      },
      orderBy: {
        createdAt: "desc",
      },
      select: {
        level: true,
        targetTeam: true,
      },
    })
    expect(escalationEvent?.level).toBe("L3")
    expect(Boolean(escalationEvent?.targetTeam)).toBe(true)

    const supportPostmortem = await prisma.supportPostmortem.findFirst({
      where: {
        ticketId: createdTicketId,
      },
      orderBy: {
        createdAt: "desc",
      },
      select: {
        summary: true,
        status: true,
      },
    })
    expect(supportPostmortem?.summary).toContain(postmortemSummary)
    expect(supportPostmortem?.status).toBe("DRAFT")

    await captureSummary(page, artifactsDir, "01-live-admin-support", "Live Admin Support", [
      `Base URL: ${liveBaseURL}`,
      `Ticket created: ${ticketTitle}`,
      `Escalation level: ${createdEscalationResponse.payload?.escalation?.level || "n/a"}`,
      `Postmortem: ${postmortemSummary}`,
    ])

    const billingPage = await assertProtectedPageContains(cookieJar, "/admin/billing", "发票与税务管理")
    expect(billingPage).toContain("保存发票信息")

    const invalidInvoiceProfile = await requestJson("/api/billing/invoice-profile", cookieJar, {
      method: "PUT",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        title: "",
        taxNumber: "",
      }),
    })
    expect(invalidInvoiceProfile.response.status).toBe(400)
    expect(invalidInvoiceProfile.payload?.error).toBe("发票抬头和税号不能为空")

    const savedInvoiceProfileResponse = await requestJson("/api/billing/invoice-profile", cookieJar, {
      method: "PUT",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        title: billingTitle,
        taxNumber: billingTaxNumber,
        billingEmail: `billing-${timestamp}@aura.test`,
        phone: "021-55667788",
        address: "上海市徐汇区漕溪北路 398 号",
        bankName: "Playwright Test Bank",
        bankAccount: "622202202603070001",
      }),
    })
    expect(savedInvoiceProfileResponse.response.status).toBe(200)
    expect(savedInvoiceProfileResponse.payload?.profile?.title).toBe(billingTitle)
    expect(savedInvoiceProfileResponse.payload?.profile?.taxNumber).toBe(billingTaxNumber)

    const issuedInvoiceResponse = await requestJson("/api/billing/invoices", cookieJar, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        note: "Playwright live admin billing regression",
      }),
    })
    expect(issuedInvoiceResponse.response.status).toBe(201)
    expect(issuedInvoiceResponse.payload?.invoice?.status).toBe("ISSUED")

    const latestInvoice = await prisma.billingInvoice.findFirst({
      where: {
        userId: user.id,
      },
      orderBy: {
        createdAt: "desc",
      },
      select: {
        invoiceNo: true,
        status: true,
        totalCents: true,
      },
    })
    expect(latestInvoice?.status).toBe("ISSUED")
    expect(latestInvoice?.totalCents).toBe(0)

    const invoiceCsv = await requestText("/api/billing/invoices?format=csv", cookieJar)
    expect(invoiceCsv.response.status).toBe(200)
    expect(invoiceCsv.text).toContain("invoiceNo")
    expect(invoiceCsv.text).toContain(latestInvoice?.invoiceNo || "")

    await captureSummary(page, artifactsDir, "02-live-admin-billing", "Live Admin Billing", [
      `Invoice profile saved: ${billingTitle}`,
      `Invoice issued: ${latestInvoice?.invoiceNo || "n/a"}`,
      `Invoice total cents: ${String(latestInvoice?.totalCents ?? "n/a")}`,
      "CSV export path exercised through billing invoices endpoint.",
    ])

    const developerApiPage = await assertProtectedPageContains(cookieJar, "/admin/developer-api", "API 定价与配额策略")
    expect(developerApiPage).toContain("新 API Key 名称")

    const createdApiKeyResponse = await requestJson("/api/developer/keys", cookieJar, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        name: apiKeyName,
      }),
    })
    expect(createdApiKeyResponse.response.status).toBe(201)
    expect(createdApiKeyResponse.payload?.apiKey?.name).toBe(apiKeyName)
    expect(Boolean(createdApiKeyResponse.payload?.rawKey)).toBe(true)

    const createdApiKeyId = createdApiKeyResponse.payload?.apiKey?.id
    expect(Boolean(createdApiKeyId)).toBe(true)

    const updatedApiKeyResponse = await requestJson(`/api/developer/keys/${createdApiKeyId}`, cookieJar, {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        monthlyQuota: 250000,
        rateLimitPerMinute: 180,
        overagePackSize: 600000,
        overageAutoPackEnabled: true,
      }),
    })
    expect(updatedApiKeyResponse.response.status).toBe(200)
    expect(updatedApiKeyResponse.payload?.apiKey?.monthlyQuota).toBe(250000)
    expect(updatedApiKeyResponse.payload?.apiKey?.rateLimitPerMinute).toBe(180)
    expect(updatedApiKeyResponse.payload?.apiKey?.overageAutoPackEnabled).toBe(true)

    const consumedApiUsageResponse = await requestJson(
      `/api/developer/keys/${createdApiKeyId}/consume`,
      cookieJar,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-forwarded-for": "203.0.113.10",
        },
        body: JSON.stringify({
          requestCount: 120,
          billableUnits: 240,
          modelTier: "ADVANCED",
        }),
      }
    )
    expect(consumedApiUsageResponse.response.status).toBe(200)
    expect(consumedApiUsageResponse.payload?.allowed).toBe(true)
    expect(consumedApiUsageResponse.payload?.usage?.requestCount).toBe(120)
    expect(consumedApiUsageResponse.payload?.usage?.billableUnits).toBe(240)

    const usageSummaryResponse = await requestJson("/api/developer/usage", cookieJar)
    expect(usageSummaryResponse.response.status).toBe(200)
    expect(usageSummaryResponse.payload?.usage?.totalRequestCount).toBeGreaterThan(0)
    expect(usageSummaryResponse.payload?.usage?.totalAmountCents).toBeGreaterThan(0)

    const purchasedOverageResponse = await requestJson("/api/developer/overage", cookieJar, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        apiKeyId: createdApiKeyId,
        units: 600000,
      }),
    })
    expect(purchasedOverageResponse.response.status).toBe(201)
    expect(purchasedOverageResponse.payload?.purchase?.units).toBe(600000)

    const updatedApiKey = await prisma.apiKey.findUnique({
      where: {
        id: createdApiKeyId,
      },
      select: {
        monthlyQuota: true,
        rateLimitPerMinute: true,
        overagePackSize: true,
        overageAutoPackEnabled: true,
      },
    })
    expect(updatedApiKey?.monthlyQuota).toBe(850000)
    expect(updatedApiKey?.rateLimitPerMinute).toBe(180)
    expect(updatedApiKey?.overagePackSize).toBe(600000)
    expect(updatedApiKey?.overageAutoPackEnabled).toBe(true)

    const purchaseCount = await prisma.apiOveragePurchase.count({
      where: {
        userId: user.id,
        apiKeyId: createdApiKeyId,
      },
    })
    expect(purchaseCount).toBeGreaterThan(0)

    await captureSummary(page, artifactsDir, "03-live-admin-api", "Live Admin Developer API", [
      `API key created: ${apiKeyName}`,
      `Usage requests recorded: ${String(consumedApiUsageResponse.payload?.usage?.requestCount ?? 0)}`,
      `Overage purchases: ${String(purchaseCount)}`,
      `Monthly quota after manual pack: ${String(updatedApiKey?.monthlyQuota ?? "n/a")}`,
    ])

    const partnersPage = await assertProtectedPageContains(cookieJar, "/admin/partners", "合作伙伴分层与结算")
    expect(partnersPage).toContain("等级名称")

    const seededTiers = await requestJson("/api/partners/tiers", cookieJar)
    expect(seededTiers.response.status).toBe(200)
    expect((seededTiers.payload?.tiers || []).length).toBeGreaterThan(0)

    const savedTierResponse = await requestJson("/api/partners/tiers", cookieJar, {
      method: "PUT",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        name: partnerTierName,
        level: "GROWTH",
        minQualifiedLeads: 1,
        revenueShareBasisPoints: 1200,
        settlementCycleDays: 30,
        benefits: ["联合销售加速"],
        leadRoutingPriority: "priority",
      }),
    })
    expect(savedTierResponse.response.status).toBe(200)
    expect(savedTierResponse.payload?.tier?.name).toBe(partnerTierName)

    const partnerTierId = savedTierResponse.payload?.tier?.id
    expect(Boolean(partnerTierId)).toBe(true)

    const invalidLeadResponse = await requestJson("/api/partners/leads", cookieJar, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        tierId: "",
        leadName: "",
        attributionCode: "",
      }),
    })
    expect(invalidLeadResponse.response.status).toBe(400)
    expect(invalidLeadResponse.payload?.error).toBe("请填写合作伙伴等级、线索名称与归因编码")

    const createdLeadResponse = await requestJson("/api/partners/leads", cookieJar, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        tierId: partnerTierId,
        leadName: partnerLeadName,
        company: "Playwright Partner Co.",
        sourceChannel: "referral",
        attributionCode: `ATTR-${timestamp}`,
        status: "WON",
        estimatedDealCents: 150000,
        closedDealCents: 200000,
      }),
    })
    expect(createdLeadResponse.response.status).toBe(201)
    expect(createdLeadResponse.payload?.lead?.status).toBe("WON")

    const createdLeadId = createdLeadResponse.payload?.lead?.id
    expect(Boolean(createdLeadId)).toBe(true)

    const settlementWindowStart = new Date(timestamp - 60 * 60 * 1000).toISOString()
    const settlementWindowEnd = new Date(timestamp + 60 * 60 * 1000).toISOString()

    const createdSettlementResponse = await requestJson("/api/partners/settlements", cookieJar, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        tierId: partnerTierId,
        periodStart: settlementWindowStart,
        periodEnd: settlementWindowEnd,
        payoutReference: `SETTLE-${timestamp}`,
      }),
    })
    expect(createdSettlementResponse.response.status).toBe(201)
    expect(createdSettlementResponse.payload?.settlement?.status).toBe("PENDING")
    expect(createdSettlementResponse.payload?.settlement?.payoutAmountCents).toBe(24000)

    const createdSettlementId = createdSettlementResponse.payload?.settlement?.id
    expect(Boolean(createdSettlementId)).toBe(true)

    const updatedSettlementResponse = await requestJson(
      `/api/partners/settlements/${createdSettlementId}`,
      cookieJar,
      {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          status: "PAID",
          actualPayoutCents: 24000,
          payoutReference: `PAID-${timestamp}`,
          note: "Playwright 对账通过。",
        }),
      }
    )
    expect(updatedSettlementResponse.response.status).toBe(200)
    expect(updatedSettlementResponse.payload?.settlement?.status).toBe("PAID")
    expect(updatedSettlementResponse.payload?.settlement?.payoutReference).toBe(`PAID-${timestamp}`)

    const savedTier = await prisma.partnerTier.findUnique({
      where: {
        id: partnerTierId,
      },
      select: {
        level: true,
        revenueShareBasisPoints: true,
      },
    })
    expect(savedTier?.level).toBe("GROWTH")
    expect(savedTier?.revenueShareBasisPoints).toBe(1200)

    const createdLead = await prisma.partnerLead.findUnique({
      where: {
        id: createdLeadId,
      },
      select: {
        status: true,
        settlementId: true,
      },
    })
    expect(createdLead?.status).toBe("WON")
    expect(createdLead?.settlementId).toBe(createdSettlementId)

    const updatedSettlement = await prisma.partnerSettlement.findUnique({
      where: {
        id: createdSettlementId,
      },
      select: {
        status: true,
        payoutReference: true,
      },
    })
    expect(updatedSettlement?.status).toBe("PAID")
    expect(updatedSettlement?.payoutReference).toBe(`PAID-${timestamp}`)

    await captureSummary(page, artifactsDir, "04-live-admin-partners", "Live Admin Partners", [
      `Partner tier saved: ${partnerTierName}`,
      `Lead created: ${partnerLeadName}`,
      `Settlement status: ${updatedSettlement?.status || "n/a"}`,
      `Settlement payout reference: ${updatedSettlement?.payoutReference || "n/a"}`,
    ])

    await captureSummary(page, artifactsDir, "05-live-admin-summary", "Live Admin Backoffice Regression", [
      `User: ${userEmail}`,
      `Support ticket created: ${ticketTitle}`,
      `Invoice profile saved: ${billingTitle}`,
      `API key created: ${apiKeyName}`,
      `Partner settlement updated for: ${partnerLeadName}`,
    ])

    console.log(`[live-admin-backoffice-regression] screenshot artifacts: ${artifactsDir}`)
  } finally {
    try {
      await cleanupLiveAdminUser(userEmail)
    } finally {
      await prisma.$disconnect()
    }
  }
})
