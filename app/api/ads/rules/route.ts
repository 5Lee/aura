import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"

import { DEFAULT_AD_PLACEMENT_RULES, buildDefaultAdPlacementSeed, sanitizeAdPlacementRuleInput } from "@/lib/ad-strategy"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { recordPromptAuditLog } from "@/lib/prompt-audit-log"
import { sanitizeTextInput } from "@/lib/security"
import { getUserEntitlementSnapshot, hasAdStrategyAccess } from "@/lib/subscription-entitlements"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 })
  }

  const snapshot = await getUserEntitlementSnapshot(session.user.id)
  if (!hasAdStrategyAccess(snapshot.plan.id)) {
    return NextResponse.json(
      {
        error: "广告与推荐位商业策略仅对 Pro / Team / Enterprise 套餐开放",
        upgradeRequired: true,
      },
      { status: 403 }
    )
  }

  const count = await prisma.adPlacementRule.count({
    where: {
      userId: session.user.id,
    },
  })

  if (count === 0) {
    await prisma.adPlacementRule.createMany({
      data: buildDefaultAdPlacementSeed(session.user.id),
    })
  }

  const rules = await prisma.adPlacementRule.findMany({
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

  const snapshot = await getUserEntitlementSnapshot(session.user.id)
  if (!hasAdStrategyAccess(snapshot.plan.id)) {
    return NextResponse.json(
      {
        error: "广告与推荐位商业策略仅对 Pro / Team / Enterprise 套餐开放",
        upgradeRequired: true,
      },
      { status: 403 }
    )
  }

  try {
    const body = await request.json().catch(() => ({}))
    const ruleId = sanitizeTextInput(body.id, 80)

    const current = ruleId
      ? await prisma.adPlacementRule.findFirst({
          where: {
            id: ruleId,
            userId: session.user.id,
          },
        })
      : null

    const sanitized = sanitizeAdPlacementRuleInput(body, {
      ...(current
        ? {
            name: current.name,
            placementType: current.placementType,
            audienceSegment: current.audienceSegment,
            biddingModel: current.biddingModel === "CPM" ? "CPM" : "CPC",
            bidPriceCents: current.bidPriceCents,
            dailyBudgetCapCents: current.dailyBudgetCapCents,
            conversionTarget: current.conversionTarget,
            safetyPolicy: {
              blockedKeywords: DEFAULT_AD_PLACEMENT_RULES[0].safetyPolicy.blockedKeywords,
              requireManualReview: true,
            },
          }
        : DEFAULT_AD_PLACEMENT_RULES[0]),
    })

    const rule = await prisma.adPlacementRule.upsert({
      where: {
        id: current?.id || "__create_ad_rule__",
      },
      create: {
        userId: session.user.id,
        name: sanitized.name,
        placementType: sanitized.placementType,
        audienceSegment: sanitized.audienceSegment,
        biddingModel: sanitized.biddingModel,
        bidPriceCents: sanitized.bidPriceCents,
        dailyBudgetCapCents: sanitized.dailyBudgetCapCents,
        conversionTarget: sanitized.conversionTarget,
        safetyPolicy: sanitized.safetyPolicy,
        active: body.active !== false,
      },
      update: {
        name: sanitized.name,
        placementType: sanitized.placementType,
        audienceSegment: sanitized.audienceSegment,
        biddingModel: sanitized.biddingModel,
        bidPriceCents: sanitized.bidPriceCents,
        dailyBudgetCapCents: sanitized.dailyBudgetCapCents,
        conversionTarget: sanitized.conversionTarget,
        safetyPolicy: sanitized.safetyPolicy,
        active: body.active !== false,
      },
    })

    await recordPromptAuditLog({
      actorId: session.user.id,
      action: "ads.rule.upsert",
      resource: "ads",
      request,
      metadata: {
        ruleId: rule.id,
        placementType: rule.placementType,
      },
    })

    return NextResponse.json({ rule })
  } catch (error) {
    console.error("Save ad placement rule failed:", error)
    return NextResponse.json({ error: "保存投放规则失败" }, { status: 500 })
  }
}
