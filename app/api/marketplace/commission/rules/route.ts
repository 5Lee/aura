import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"

import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import {
  buildDefaultMarketplaceRuleSeed,
  sanitizeMarketplaceCommissionRuleInput,
} from "@/lib/marketplace-commission"
import { recordPromptAuditLog } from "@/lib/prompt-audit-log"
import { sanitizeTextInput } from "@/lib/security"
import {
  getUserEntitlementSnapshot,
  hasMarketplaceCommissionAccess,
} from "@/lib/subscription-entitlements"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 })
  }

  const entitlement = await getUserEntitlementSnapshot(session.user.id)
  if (!hasMarketplaceCommissionAccess(entitlement.plan.id)) {
    return NextResponse.json(
      {
        error: "应用市场佣金体系仅对 Pro / Team / Enterprise 套餐开放",
        upgradeRequired: true,
      },
      { status: 403 }
    )
  }

  const count = await prisma.marketplaceCommissionRule.count({
    where: {
      userId: session.user.id,
    },
  })

  if (count === 0) {
    await prisma.marketplaceCommissionRule.createMany({
      data: buildDefaultMarketplaceRuleSeed(session.user.id),
    })
  }

  const rules = await prisma.marketplaceCommissionRule.findMany({
    where: {
      userId: session.user.id,
    },
    orderBy: [{ active: "desc" }, { updatedAt: "desc" }],
  })

  return NextResponse.json({ rules })
}

export async function PUT(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 })
  }

  const entitlement = await getUserEntitlementSnapshot(session.user.id)
  if (!hasMarketplaceCommissionAccess(entitlement.plan.id)) {
    return NextResponse.json(
      {
        error: "应用市场佣金体系仅对 Pro / Team / Enterprise 套餐开放",
        upgradeRequired: true,
      },
      { status: 403 }
    )
  }

  try {
    const body = await request.json().catch(() => ({}))
    const ruleId = sanitizeTextInput(body.id, 80)

    const current = ruleId
      ? await prisma.marketplaceCommissionRule.findFirst({
          where: {
            id: ruleId,
            userId: session.user.id,
          },
        })
      : null

    const sanitized = sanitizeMarketplaceCommissionRuleInput(body, {
      name: current?.name || "标准提示词模板分成",
      category: current?.category || "prompt-template",
      creatorRateBasisPoints: current?.creatorRateBasisPoints || 7000,
      platformRateBasisPoints: current?.platformRateBasisPoints || 3000,
      settlementCycleDays: current?.settlementCycleDays || 30,
      minimumPayoutCents: current?.minimumPayoutCents || 10000,
      currency: current?.currency || "CNY",
    })

    if (sanitized.creatorRateBasisPoints + sanitized.platformRateBasisPoints > 10000) {
      return NextResponse.json({ error: "分成比例总和不能超过 100%" }, { status: 400 })
    }

    const rule = await prisma.marketplaceCommissionRule.upsert({
      where: {
        id: current?.id || "__create_marketplace_rule__",
      },
      create: {
        userId: session.user.id,
        name: sanitized.name,
        category: sanitized.category,
        creatorRateBasisPoints: sanitized.creatorRateBasisPoints,
        platformRateBasisPoints: sanitized.platformRateBasisPoints,
        settlementCycleDays: sanitized.settlementCycleDays,
        minimumPayoutCents: sanitized.minimumPayoutCents,
        currency: sanitized.currency,
        active: body.active !== false,
      },
      update: {
        name: sanitized.name,
        category: sanitized.category,
        creatorRateBasisPoints: sanitized.creatorRateBasisPoints,
        platformRateBasisPoints: sanitized.platformRateBasisPoints,
        settlementCycleDays: sanitized.settlementCycleDays,
        minimumPayoutCents: sanitized.minimumPayoutCents,
        currency: sanitized.currency,
        active: body.active === false ? false : true,
      },
    })

    await recordPromptAuditLog({
      actorId: session.user.id,
      action: "marketplace.rule.upsert",
      resource: "marketplace",
      request,
      metadata: {
        ruleId: rule.id,
        creatorRateBasisPoints: rule.creatorRateBasisPoints,
        platformRateBasisPoints: rule.platformRateBasisPoints,
      },
    })

    return NextResponse.json({ rule })
  } catch (error) {
    console.error("Save marketplace commission rule failed:", error)
    return NextResponse.json({ error: "保存佣金规则失败" }, { status: 500 })
  }
}
