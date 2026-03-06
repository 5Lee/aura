import { AdCampaignStatus } from "@prisma/client"
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"

import {
  normalizeAdCampaignStatus,
  resolveAdBudgetGuard,
  resolveAdConversionMetrics,
  resolveAdScheduleWindow,
} from "@/lib/ad-strategy"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { recordPromptAuditLog } from "@/lib/prompt-audit-log"
import { sanitizeMultilineTextInput, sanitizeTextInput } from "@/lib/security"
import { getUserEntitlementSnapshot, hasAdStrategyAccess } from "@/lib/subscription-entitlements"

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

function isStatusTransitionAllowed(from: AdCampaignStatus, to: AdCampaignStatus) {
  if (from === to) {
    return true
  }

  const matrix: Record<AdCampaignStatus, AdCampaignStatus[]> = {
    [AdCampaignStatus.DRAFT]: [AdCampaignStatus.IN_REVIEW, AdCampaignStatus.REJECTED],
    [AdCampaignStatus.IN_REVIEW]: [AdCampaignStatus.APPROVED, AdCampaignStatus.REJECTED],
    [AdCampaignStatus.APPROVED]: [AdCampaignStatus.ACTIVE, AdCampaignStatus.PAUSED, AdCampaignStatus.COMPLETED],
    [AdCampaignStatus.REJECTED]: [AdCampaignStatus.IN_REVIEW],
    [AdCampaignStatus.ACTIVE]: [AdCampaignStatus.PAUSED, AdCampaignStatus.COMPLETED],
    [AdCampaignStatus.PAUSED]: [AdCampaignStatus.ACTIVE, AdCampaignStatus.COMPLETED],
    [AdCampaignStatus.COMPLETED]: [],
  }

  return matrix[from].includes(to)
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
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
    const campaign = await prisma.adCampaign.findFirst({
      where: {
        id: params.id,
        userId: session.user.id,
      },
      include: {
        rule: {
          select: {
            id: true,
            dailyBudgetCapCents: true,
          },
        },
      },
    })

    if (!campaign) {
      return NextResponse.json({ error: "投放不存在" }, { status: 404 })
    }

    const nextStatus = body.status ? normalizeAdCampaignStatus(body.status) : campaign.status
    if (!isStatusTransitionAllowed(campaign.status, nextStatus)) {
      return NextResponse.json({ error: "不允许的投放状态流转" }, { status: 400 })
    }

    const isActivationTransition = nextStatus === AdCampaignStatus.ACTIVE && campaign.status !== AdCampaignStatus.ACTIVE
    if (isActivationTransition) {
      const window = resolveAdScheduleWindow(campaign.startAt, campaign.endAt)
      if (!window.active) {
        return NextResponse.json({ error: "当前不在投放时段内" }, { status: 400 })
      }
      if (campaign.status !== AdCampaignStatus.APPROVED && campaign.status !== AdCampaignStatus.PAUSED) {
        return NextResponse.json({ error: "仅审核通过或暂停中的投放可激活" }, { status: 400 })
      }
    }

    const now = new Date()
    const metricsInputProvided =
      body.impressions !== undefined ||
      body.clicks !== undefined ||
      body.conversions !== undefined ||
      body.spendCents !== undefined ||
      body.unsafeBlocks !== undefined

    let metricPatch: {
      impressions: number
      clicks: number
      conversions: number
      spendCents: number
      unsafeBlocks: number
    } | null = null

    if (metricsInputProvided) {
      metricPatch = {
        impressions: resolvePositiveInt(body.impressions, 0, 0, 100000000),
        clicks: resolvePositiveInt(body.clicks, 0, 0, 100000000),
        conversions: resolvePositiveInt(body.conversions, 0, 0, 100000000),
        spendCents: resolvePositiveInt(body.spendCents, 0, 0, 1000000000),
        unsafeBlocks: resolvePositiveInt(body.unsafeBlocks, 0, 0, 1000000),
      }

      const dayStart = new Date(now)
      dayStart.setHours(0, 0, 0, 0)

      const daySpent = await prisma.adPerformanceSnapshot.aggregate({
        where: {
          campaignId: campaign.id,
          windowEnd: {
            gte: dayStart,
          },
        },
        _sum: {
          spendCents: true,
        },
      })

      const budgetGuard = resolveAdBudgetGuard({
        budgetCents: campaign.budgetCents,
        spentCents: campaign.spentCents,
        newSpendCents: metricPatch.spendCents,
        dailyBudgetCapCents: campaign.rule.dailyBudgetCapCents,
        daySpentCents: daySpent._sum.spendCents || 0,
      })

      if (!budgetGuard.allowDailyBudget) {
        return NextResponse.json({ error: "超出当日预算上限" }, { status: 400 })
      }

      if (!budgetGuard.allowTotalBudget) {
        return NextResponse.json({ error: "超出总预算上限" }, { status: 400 })
      }
    }

    const reviewNote = sanitizeMultilineTextInput(body.reviewNote, 1200).trim()
    const reviewBy = sanitizeTextInput(body.reviewBy, 80) || session.user.id

    const updated = await prisma.$transaction(async (tx) => {
      if (metricPatch) {
        const performance = resolveAdConversionMetrics({
          impressions: metricPatch.impressions,
          clicks: metricPatch.clicks,
          conversions: metricPatch.conversions,
          spendCents: metricPatch.spendCents,
        })

        await tx.adPerformanceSnapshot.create({
          data: {
            userId: session.user.id,
            campaignId: campaign.id,
            windowStart: body.windowStart ? new Date(body.windowStart) : now,
            windowEnd: body.windowEnd ? new Date(body.windowEnd) : now,
            impressions: metricPatch.impressions,
            clicks: metricPatch.clicks,
            conversions: metricPatch.conversions,
            spendCents: metricPatch.spendCents,
            conversionRate: performance.conversionRate,
            unsafeBlocks: metricPatch.unsafeBlocks,
          },
        })
      }

      const finalStatus =
        metricPatch && campaign.spentCents + metricPatch.spendCents >= campaign.budgetCents
          ? AdCampaignStatus.COMPLETED
          : nextStatus

      return tx.adCampaign.update({
        where: {
          id: campaign.id,
        },
        data: {
          status: finalStatus,
          impressions: {
            increment: metricPatch?.impressions || 0,
          },
          clicks: {
            increment: metricPatch?.clicks || 0,
          },
          conversions: {
            increment: metricPatch?.conversions || 0,
          },
          spentCents: {
            increment: metricPatch?.spendCents || 0,
          },
          blockedBySafetyCount: {
            increment: metricPatch?.unsafeBlocks || 0,
          },
          reviewNote: reviewNote || campaign.reviewNote,
          reviewBy: nextStatus === AdCampaignStatus.APPROVED || nextStatus === AdCampaignStatus.REJECTED
            ? reviewBy
            : campaign.reviewBy,
          reviewedAt:
            nextStatus === AdCampaignStatus.APPROVED || nextStatus === AdCampaignStatus.REJECTED
              ? now
              : campaign.reviewedAt,
        },
      })
    })

    await recordPromptAuditLog({
      actorId: session.user.id,
      action: "ads.campaign.update",
      resource: "ads",
      request,
      metadata: {
        campaignId: updated.id,
        status: updated.status,
      },
    })

    return NextResponse.json({ campaign: updated })
  } catch (error) {
    console.error("Update ad campaign failed:", error)
    return NextResponse.json({ error: "更新投放失败" }, { status: 500 })
  }
}
