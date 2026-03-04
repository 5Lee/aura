import { AdCampaignStatus } from "@prisma/client"
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"

import {
  evaluateAdSafetyPolicy,
  resolveAdCampaignInitialStatus,
  resolveAdConversionMetrics,
  resolveAdScheduleWindow,
  sanitizeAdCampaignInput,
} from "@/lib/ad-strategy"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { recordPromptAuditLog } from "@/lib/prompt-audit-log"
import { sanitizeTextInput } from "@/lib/security"
import { getUserEntitlementSnapshot, hasAdStrategyAccess } from "@/lib/subscription-entitlements"

function parseStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as string[]
  }
  return value.filter((item): item is string => typeof item === "string")
}

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

  const [campaigns, snapshots] = await Promise.all([
    prisma.adCampaign.findMany({
      where: {
        userId: session.user.id,
      },
      include: {
        rule: {
          select: {
            id: true,
            name: true,
            placementType: true,
            dailyBudgetCapCents: true,
          },
        },
      },
      orderBy: [{ createdAt: "desc" }],
      take: 80,
    }),
    prisma.adPerformanceSnapshot.findMany({
      where: {
        userId: session.user.id,
      },
      orderBy: [{ windowEnd: "desc" }],
      take: 400,
    }),
  ])

  const summary = campaigns.reduce(
    (acc, campaign) => {
      acc.totalBudgetCents += campaign.budgetCents
      acc.totalSpentCents += campaign.spentCents
      acc.totalImpressions += campaign.impressions
      acc.totalClicks += campaign.clicks
      acc.totalConversions += campaign.conversions
      acc.totalUnsafeBlocks += campaign.blockedBySafetyCount
      return acc
    },
    {
      totalBudgetCents: 0,
      totalSpentCents: 0,
      totalImpressions: 0,
      totalClicks: 0,
      totalConversions: 0,
      totalUnsafeBlocks: 0,
    }
  )

  const conversion = resolveAdConversionMetrics({
    impressions: summary.totalImpressions,
    clicks: summary.totalClicks,
    conversions: summary.totalConversions,
    spendCents: summary.totalSpentCents,
  })

  return NextResponse.json({
    campaigns,
    snapshots,
    summary: {
      ...summary,
      ...conversion,
    },
  })
}

export async function POST(request: Request) {
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
    const ruleId = sanitizeTextInput(body.ruleId, 80)
    if (!ruleId) {
      return NextResponse.json({ error: "请先选择投放规则" }, { status: 400 })
    }

    const rule = await prisma.adPlacementRule.findFirst({
      where: {
        id: ruleId,
        userId: session.user.id,
        active: true,
      },
    })

    if (!rule) {
      return NextResponse.json({ error: "投放规则不存在" }, { status: 404 })
    }

    const sanitized = sanitizeAdCampaignInput(body)
    if (!sanitized.title || !sanitized.advertiser || !sanitized.content) {
      return NextResponse.json({ error: "请填写广告标题、投放方和内容" }, { status: 400 })
    }

    const schedule = resolveAdScheduleWindow(sanitized.startAt, sanitized.endAt, sanitized.startAt)
    if (schedule.reason === "invalid-window") {
      return NextResponse.json({ error: "投放时段不合法" }, { status: 400 })
    }

    const safetyPolicyRecord =
      rule.safetyPolicy && typeof rule.safetyPolicy === "object" && !Array.isArray(rule.safetyPolicy)
        ? (rule.safetyPolicy as Record<string, unknown>)
        : {}
    const blockedKeywords = parseStringArray(safetyPolicyRecord.blockedKeywords)
    const requireManualReview = safetyPolicyRecord.requireManualReview !== false

    const safety = evaluateAdSafetyPolicy({
      content: sanitized.content,
      blockedKeywords,
    })

    const status = resolveAdCampaignInitialStatus({
      requireManualReview,
      safe: safety.safe,
    })

    const campaign = await prisma.adCampaign.create({
      data: {
        userId: session.user.id,
        ruleId: rule.id,
        title: sanitized.title,
        advertiser: sanitized.advertiser,
        status,
        content: sanitized.content,
        landingUrl: sanitized.landingUrl || null,
        startAt: sanitized.startAt,
        endAt: sanitized.endAt,
        budgetCents: sanitized.budgetCents,
        spentCents: 0,
        blockedBySafetyCount: safety.safe ? 0 : 1,
        reviewNote: safety.safe
          ? requireManualReview
            ? "待审核"
            : "自动通过"
          : `命中内容安全策略：${safety.matchedKeywords.join("、")}`,
        metadata: {
          safety,
          placementType: rule.placementType,
          biddingModel: rule.biddingModel,
        },
      },
      include: {
        rule: {
          select: {
            id: true,
            name: true,
            placementType: true,
            dailyBudgetCapCents: true,
          },
        },
      },
    })

    await recordPromptAuditLog({
      actorId: session.user.id,
      action: "ads.campaign.create",
      resource: "ads",
      request,
      metadata: {
        campaignId: campaign.id,
        status: campaign.status,
      },
    })

    return NextResponse.json({ campaign }, { status: 201 })
  } catch (error) {
    console.error("Create ad campaign failed:", error)
    return NextResponse.json({ error: "创建广告投放失败" }, { status: 500 })
  }
}
