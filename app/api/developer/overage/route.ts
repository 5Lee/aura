import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"

import { authOptions } from "@/lib/auth"
import { resolveApiQuotaPolicy, resolveOveragePackPrice } from "@/lib/api-pricing"
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
    const apiKeyId = sanitizeTextInput(body.apiKeyId, 80)
    if (!apiKeyId) {
      return NextResponse.json({ error: "请指定 API Key" }, { status: 400 })
    }

    const apiKey = await prisma.apiKey.findFirst({
      where: {
        id: apiKeyId,
        userId: session.user.id,
      },
    })

    if (!apiKey) {
      return NextResponse.json({ error: "API Key 不存在" }, { status: 404 })
    }

    const policy = resolveApiQuotaPolicy(apiKey.planId)
    const units = resolvePositiveInt(body.units, policy.defaultOveragePackUnits, 1000, 10000000)
    const pack = resolveOveragePackPrice({
      packUnits: units,
      policy,
    })

    const now = new Date()

    const [purchase] = await prisma.$transaction([
      prisma.apiOveragePurchase.create({
        data: {
          userId: session.user.id,
          apiKeyId: apiKey.id,
          units: pack.units,
          amountCents: pack.amountCents,
          providerEventId: `api_manual_overage_${Date.now()}_${apiKey.id}`,
          status: "PROCESSED",
          processedAt: now,
          metadata: {
            source: "manual",
          },
        },
      }),
      prisma.apiKey.update({
        where: {
          id: apiKey.id,
        },
        data: {
          monthlyQuota: {
            increment: pack.units,
          },
        },
      }),
      prisma.billingEvent.create({
        data: {
          userId: session.user.id,
          provider: "MOCKPAY",
          providerEventId: `api_manual_overage_event_${Date.now()}`,
          type: "developer.api.overage.pack.purchased",
          status: "PROCESSED",
          payload: {
            apiKeyId: apiKey.id,
            units: pack.units,
            amountCents: pack.amountCents,
          },
          processedAt: now,
        },
      }),
    ])

    await recordPromptAuditLog({
      actorId: session.user.id,
      action: "developer.api.overage.purchase",
      resource: "api",
      request,
      metadata: {
        apiKeyId: apiKey.id,
        purchaseId: purchase.id,
        units: purchase.units,
        amountCents: purchase.amountCents,
      },
    })

    return NextResponse.json({ purchase }, { status: 201 })
  } catch (error) {
    console.error("Purchase overage pack failed:", error)
    return NextResponse.json({ error: "购买扩容包失败" }, { status: 500 })
  }
}
