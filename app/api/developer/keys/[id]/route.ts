import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"

import { authOptions } from "@/lib/auth"
import { resolveApiKeyStatus } from "@/lib/api-pricing"
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

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
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

    const updated = await prisma.apiKey.update({
      where: {
        id: apiKey.id,
      },
      data: {
        name: sanitizeTextInput(body.name, 80) || apiKey.name,
        status: resolveApiKeyStatus(body.status),
        monthlyQuota: resolvePositiveInt(body.monthlyQuota, apiKey.monthlyQuota, 1000, 200000000),
        rateLimitPerMinute: resolvePositiveInt(
          body.rateLimitPerMinute,
          apiKey.rateLimitPerMinute,
          1,
          5000
        ),
        overageAutoPackEnabled:
          typeof body.overageAutoPackEnabled === "boolean"
            ? body.overageAutoPackEnabled
            : apiKey.overageAutoPackEnabled,
        overagePackSize: resolvePositiveInt(body.overagePackSize, apiKey.overagePackSize, 1000, 10000000),
      },
    })

    await recordPromptAuditLog({
      actorId: session.user.id,
      action: "developer.api_key.update",
      resource: "api",
      request,
      metadata: {
        apiKeyId: updated.id,
        status: updated.status,
      },
    })

    return NextResponse.json({ apiKey: updated })
  } catch (error) {
    console.error("Update api key failed:", error)
    return NextResponse.json({ error: "更新 API Key 失败" }, { status: 500 })
  }
}
