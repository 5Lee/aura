import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"

import { authOptions } from "@/lib/auth"
import {
  generateRawApiKey,
  hashApiKey,
  maskApiKeyPrefix,
  resolveApiKeyPrefix,
  resolveApiKeyStatus,
  resolveApiQuotaPolicy,
  resolveMonthWindow,
} from "@/lib/api-pricing"
import { prisma } from "@/lib/db"
import { recordPromptAuditLog } from "@/lib/prompt-audit-log"
import { sanitizeTextInput } from "@/lib/security"
import {
  getUserEntitlementSnapshot,
  hasApiPricingAccess,
  isLimitExceeded,
} from "@/lib/subscription-entitlements"

function resolvePositiveInt(value: unknown, fallback: number, min: number, max: number) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    return fallback
  }

  const rounded = Math.floor(parsed)
  if (rounded < min) {
    return min
  }
  if (rounded > max) {
    return max
  }

  return rounded
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 })
  }

  const snapshot = await getUserEntitlementSnapshot(session.user.id)
  if (!hasApiPricingAccess(snapshot.plan.id)) {
    return NextResponse.json(
      {
        error: "API 定价与配额策略仅对 Pro / Team / Enterprise 套餐开放",
        upgradeRequired: true,
      },
      { status: 403 }
    )
  }

  const [keys, usageSummary] = await Promise.all([
    prisma.apiKey.findMany({
      where: {
        userId: session.user.id,
      },
      orderBy: [{ createdAt: "desc" }],
      include: {
        _count: {
          select: {
            usageRecords: true,
            alerts: true,
          },
        },
      },
    }),
    prisma.apiUsageRecord.aggregate({
      where: {
        userId: session.user.id,
        blocked: false,
      },
      _sum: {
        requestCount: true,
        amountCents: true,
      },
    }),
  ])

  return NextResponse.json({
    keys: keys.map((item) => ({
      id: item.id,
      name: item.name,
      keyPrefix: maskApiKeyPrefix(item.keyPrefix),
      status: item.status,
      planId: item.planId,
      monthlyQuota: item.monthlyQuota,
      consumedCallsMonth: item.consumedCallsMonth,
      rateLimitPerMinute: item.rateLimitPerMinute,
      overageAutoPackEnabled: item.overageAutoPackEnabled,
      overagePackSize: item.overagePackSize,
      monthWindowStart: item.monthWindowStart.toISOString(),
      monthWindowEnd: item.monthWindowEnd.toISOString(),
      lastUsedAt: item.lastUsedAt?.toISOString() ?? null,
      createdAt: item.createdAt.toISOString(),
      usageRecordCount: item._count.usageRecords,
      openAlertCount: item._count.alerts,
    })),
    usageSummary: {
      requestCount: usageSummary._sum.requestCount || 0,
      amountCents: usageSummary._sum.amountCents || 0,
    },
  })
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 })
  }

  const snapshot = await getUserEntitlementSnapshot(session.user.id)
  if (!hasApiPricingAccess(snapshot.plan.id)) {
    return NextResponse.json(
      {
        error: "API 定价与配额策略仅对 Pro / Team / Enterprise 套餐开放",
        upgradeRequired: true,
      },
      { status: 403 }
    )
  }

  try {
    const body = await request.json().catch(() => ({}))
    const policy = resolveApiQuotaPolicy(snapshot.plan.id)

    const currentKeyCount = await prisma.apiKey.count({
      where: {
        userId: session.user.id,
        status: {
          not: "REVOKED",
        },
      },
    })

    if (isLimitExceeded(policy.maxApiKeys, currentKeyCount, 1)) {
      return NextResponse.json(
        {
          error: `API Key 数量已达上限（${String(policy.maxApiKeys)}）`,
        },
        { status: 403 }
      )
    }

    const keyName = sanitizeTextInput(body.name, 80) || `Primary Key ${currentKeyCount + 1}`
    const monthlyQuota = resolvePositiveInt(
      body.monthlyQuota,
      typeof policy.maxApiCallsPerMonth === "number" ? policy.maxApiCallsPerMonth : 100000000,
      1000,
      200000000
    )
    const rateLimitPerMinute = resolvePositiveInt(body.rateLimitPerMinute, 120, 1, 5000)
    const overagePackSize = resolvePositiveInt(
      body.overagePackSize,
      policy.defaultOveragePackUnits,
      1000,
      10000000
    )

    const rawKey = generateRawApiKey()
    const keyHash = hashApiKey(rawKey)
    const keyPrefix = resolveApiKeyPrefix(rawKey)
    const monthWindow = resolveMonthWindow()

    const created = await prisma.apiKey.create({
      data: {
        userId: session.user.id,
        name: keyName,
        keyHash,
        keyPrefix,
        status: resolveApiKeyStatus(body.status),
        planId: snapshot.plan.id,
        monthlyQuota,
        rateLimitPerMinute,
        overageAutoPackEnabled: body.overageAutoPackEnabled === true,
        overagePackSize,
        consumedCallsMonth: 0,
        monthWindowStart: monthWindow.start,
        monthWindowEnd: monthWindow.end,
      },
    })

    await recordPromptAuditLog({
      actorId: session.user.id,
      action: "developer.api_key.create",
      resource: "api",
      request,
      metadata: {
        apiKeyId: created.id,
        planId: created.planId,
      },
    })

    return NextResponse.json(
      {
        apiKey: {
          id: created.id,
          name: created.name,
          keyPrefix: maskApiKeyPrefix(created.keyPrefix),
          status: created.status,
          monthlyQuota: created.monthlyQuota,
          rateLimitPerMinute: created.rateLimitPerMinute,
          overageAutoPackEnabled: created.overageAutoPackEnabled,
          overagePackSize: created.overagePackSize,
          monthWindowStart: created.monthWindowStart.toISOString(),
          monthWindowEnd: created.monthWindowEnd.toISOString(),
          createdAt: created.createdAt.toISOString(),
        },
        rawKey,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error("Create api key failed:", error)
    return NextResponse.json({ error: "创建 API Key 失败" }, { status: 500 })
  }
}
