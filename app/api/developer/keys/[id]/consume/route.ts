import { createHash } from "node:crypto"
import { ApiModelTier } from "@prisma/client"
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"

import { authOptions } from "@/lib/auth"
import {
  calculateApiUsageCharge,
  resolveApiAbuseSignal,
  resolveMonthlyQuotaDecision,
  resolveOveragePackPrice,
  resolveRateLimitDecision,
  resolveApiQuotaPolicy,
  resolveMonthWindow,
  shouldRotateMonthWindow,
} from "@/lib/api-pricing"
import { prisma } from "@/lib/db"
import { recordPromptAuditLog } from "@/lib/prompt-audit-log"
import { sanitizeTextInput } from "@/lib/security"
import { getUserEntitlementSnapshot, hasApiPricingAccess } from "@/lib/subscription-entitlements"

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

function resolveModelTier(value: unknown) {
  const normalized = String(value || "").trim().toUpperCase()
  if (normalized === ApiModelTier.ADVANCED) {
    return ApiModelTier.ADVANCED
  }
  if (normalized === ApiModelTier.PREMIUM) {
    return ApiModelTier.PREMIUM
  }
  return ApiModelTier.BASIC
}

function hashIp(value: string) {
  return createHash("sha256").update(value).digest("hex")
}

async function createAlert(input: {
  userId: string
  apiKeyId: string
  type: string
  thresholdPercent: number
  observedPercent: number
  message: string
}) {
  const existing = await prisma.apiQuotaAlert.findFirst({
    where: {
      userId: input.userId,
      apiKeyId: input.apiKeyId,
      type: input.type,
      status: "OPEN",
    },
  })

  if (existing) {
    return existing
  }

  return prisma.apiQuotaAlert.create({
    data: {
      userId: input.userId,
      apiKeyId: input.apiKeyId,
      type: input.type,
      thresholdPercent: input.thresholdPercent,
      observedPercent: input.observedPercent,
      message: input.message,
      status: "OPEN",
    },
  })
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
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
    const apiKey = await prisma.apiKey.findFirst({
      where: {
        id: params.id,
        userId: session.user.id,
      },
    })

    if (!apiKey) {
      return NextResponse.json({ error: "API Key 不存在" }, { status: 404 })
    }

    const now = new Date()
    const requestCount = resolvePositiveInt(body.requestCount, 1, 1, 5000)
    const billableUnits = resolvePositiveInt(body.billableUnits, requestCount, 1, 500000)
    const modelTier = resolveModelTier(body.modelTier)

    let key = apiKey
    if (shouldRotateMonthWindow(apiKey.monthWindowEnd, now)) {
      const monthWindow = resolveMonthWindow(now)
      key = await prisma.apiKey.update({
        where: {
          id: apiKey.id,
        },
        data: {
          consumedCallsMonth: 0,
          monthWindowStart: monthWindow.start,
          monthWindowEnd: monthWindow.end,
        },
      })
    }

    const recentUsage = await prisma.apiUsageRecord.aggregate({
      where: {
        apiKeyId: key.id,
        createdAt: {
          gte: new Date(now.getTime() - 60 * 1000),
        },
      },
      _sum: {
        requestCount: true,
      },
    })

    const requestsLastMinute = recentUsage._sum.requestCount || 0
    const rateLimitDecision = resolveRateLimitDecision({
      requestsLastMinute,
      rateLimitPerMinute: key.rateLimitPerMinute,
      incomingRequests: requestCount,
    })

    const quotaDecision = resolveMonthlyQuotaDecision({
      consumedCallsMonth: key.consumedCallsMonth,
      monthlyQuota: key.monthlyQuota,
      incomingRequests: requestCount,
    })

    const forwardedFor = request.headers.get("x-forwarded-for") || ""
    const clientIp = sanitizeTextInput(forwardedFor.split(",")[0], 120) || "unknown"
    const ipHash = hashIp(clientIp)

    let overagePurchase: { units: number; amountCents: number; id: string } | null = null
    let resolvedQuotaDecision = quotaDecision

    if (!quotaDecision.allowed && key.overageAutoPackEnabled && key.overagePackSize > 0) {
      const policy = resolveApiQuotaPolicy(key.planId)
      const requiredUnits = quotaDecision.projected - key.monthlyQuota
      const packUnits = Math.max(requiredUnits, key.overagePackSize)
      const pack = resolveOveragePackPrice({
        packUnits,
        policy,
      })

      const purchase = await prisma.$transaction(async (tx) => {
        const createdPurchase = await tx.apiOveragePurchase.create({
          data: {
            userId: session.user.id,
            apiKeyId: key.id,
            units: pack.units,
            amountCents: pack.amountCents,
            providerEventId: `api_overage_${Date.now()}_${key.id}`,
            status: "PROCESSED",
            processedAt: now,
            metadata: {
              auto: true,
              requiredUnits,
            },
          },
        })

        await tx.apiKey.update({
          where: {
            id: key.id,
          },
          data: {
            monthlyQuota: {
              increment: pack.units,
            },
          },
        })

        await tx.billingEvent.create({
          data: {
            userId: session.user.id,
            provider: "MOCKPAY",
            providerEventId: `api_overage_event_${createdPurchase.id}`,
            type: "developer.api.overage.pack.purchased",
            status: "PROCESSED",
            payload: {
              apiKeyId: key.id,
              purchaseId: createdPurchase.id,
              units: pack.units,
              amountCents: pack.amountCents,
            },
            processedAt: now,
          },
        })

        return createdPurchase
      })

      key = {
        ...key,
        monthlyQuota: key.monthlyQuota + pack.units,
      }
      resolvedQuotaDecision = resolveMonthlyQuotaDecision({
        consumedCallsMonth: key.consumedCallsMonth,
        monthlyQuota: key.monthlyQuota,
        incomingRequests: requestCount,
      })
      overagePurchase = {
        id: purchase.id,
        units: purchase.units,
        amountCents: purchase.amountCents,
      }
    }

    const keyAvailable = key.status === "ACTIVE"
    const allowed = keyAvailable && rateLimitDecision.allowed && resolvedQuotaDecision.allowed

    if (!allowed) {
      const blockedReason = !keyAvailable
        ? "api-key-disabled"
        : !rateLimitDecision.allowed
          ? "rate-limit-exceeded"
          : "monthly-quota-exceeded"

      await prisma.apiUsageRecord.create({
        data: {
          userId: session.user.id,
          apiKeyId: key.id,
          modelTier,
          requestCount,
          billableUnits,
          unitPriceCents: 0,
          amountCents: 0,
          blocked: true,
          blockedReason,
          ipHash,
          metadata: {
            requestsLastMinute,
            rateLimitPerMinute: key.rateLimitPerMinute,
            consumedCallsMonth: key.consumedCallsMonth,
            monthlyQuota: key.monthlyQuota,
          },
        },
      })

      if (!rateLimitDecision.allowed) {
        await createAlert({
          userId: session.user.id,
          apiKeyId: key.id,
          type: "RATE_LIMIT",
          thresholdPercent: 100,
          observedPercent: Math.max(
            100,
            Math.round((rateLimitDecision.projected / rateLimitDecision.rateLimitPerMinute) * 100)
          ),
          message: "API 调用触发速率限制",
        })
      }

      if (!resolvedQuotaDecision.allowed) {
        await createAlert({
          userId: session.user.id,
          apiKeyId: key.id,
          type: "MONTHLY_QUOTA",
          thresholdPercent: 100,
          observedPercent: resolvedQuotaDecision.usagePercent,
          message: "API 月度配额不足",
        })
      }

      const abuseSignal = resolveApiAbuseSignal({
        blockedByRateLimit: !rateLimitDecision.allowed,
        blockedByQuota: !resolvedQuotaDecision.allowed,
        callsInWindow: requestsLastMinute,
      })

      if (abuseSignal.highRisk) {
        await createAlert({
          userId: session.user.id,
          apiKeyId: key.id,
          type: "ABUSE_RISK",
          thresholdPercent: 100,
          observedPercent: 100,
          message: "疑似滥用流量，请检查调用来源",
        })
      }

      return NextResponse.json(
        {
          allowed: false,
          blockedReason,
          overagePurchase,
          rateLimit: rateLimitDecision,
          quota: resolvedQuotaDecision,
        },
        { status: 429 }
      )
    }

    const charge = calculateApiUsageCharge(modelTier, billableUnits)

    const updatedKey = await prisma.$transaction(async (tx) => {
      const usage = await tx.apiUsageRecord.create({
        data: {
          userId: session.user.id,
          apiKeyId: key.id,
          modelTier,
          requestCount,
          billableUnits,
          unitPriceCents: charge.unitPriceCents,
          amountCents: charge.amountCents,
          blocked: false,
          ipHash,
          metadata: {
            requestsLastMinute,
            projectedCallsMonth: key.consumedCallsMonth + requestCount,
          },
        },
      })

      const next = await tx.apiKey.update({
        where: {
          id: key.id,
        },
        data: {
          consumedCallsMonth: {
            increment: requestCount,
          },
          lastUsedAt: now,
        },
      })

      return {
        usage,
        key: next,
      }
    })

    const usagePercent = updatedKey.key.monthlyQuota <= 0
      ? 100
      : Math.round((updatedKey.key.consumedCallsMonth / updatedKey.key.monthlyQuota) * 100)

    if (usagePercent >= 95) {
      await createAlert({
        userId: session.user.id,
        apiKeyId: key.id,
        type: "QUOTA_95",
        thresholdPercent: 95,
        observedPercent: usagePercent,
        message: "API 月度配额使用已超过 95%",
      })
    } else if (usagePercent >= 80) {
      await createAlert({
        userId: session.user.id,
        apiKeyId: key.id,
        type: "QUOTA_80",
        thresholdPercent: 80,
        observedPercent: usagePercent,
        message: "API 月度配额使用已超过 80%",
      })
    }

    await recordPromptAuditLog({
      actorId: session.user.id,
      action: "developer.api.consume",
      resource: "api",
      request,
      metadata: {
        apiKeyId: key.id,
        requestCount,
        billableUnits,
        amountCents: charge.amountCents,
        modelTier,
      },
    })

    return NextResponse.json({
      allowed: true,
      overagePurchase,
      charge,
      usage: {
        id: updatedKey.usage.id,
        requestCount: updatedKey.usage.requestCount,
        billableUnits: updatedKey.usage.billableUnits,
        amountCents: updatedKey.usage.amountCents,
      },
      quota: {
        consumedCallsMonth: updatedKey.key.consumedCallsMonth,
        monthlyQuota: updatedKey.key.monthlyQuota,
        usagePercent,
      },
      rateLimit: {
        requestsLastMinute,
        rateLimitPerMinute: key.rateLimitPerMinute,
      },
    })
  } catch (error) {
    console.error("Consume api usage failed:", error)
    return NextResponse.json({ error: "API 调用计费失败" }, { status: 500 })
  }
}
