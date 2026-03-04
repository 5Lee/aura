import { AdCampaignStatus } from "@prisma/client"

import { sanitizeMultilineTextInput, sanitizeTextInput } from "@/lib/security"

const BLOCKED_CONTENT_KEYWORDS = ["赌博", "色情", "暴力", "仇恨", "诈骗", "虚假收益"]

export type AdPlacementPreset = {
  name: string
  placementType: string
  audienceSegment: string
  biddingModel: "CPC" | "CPM"
  bidPriceCents: number
  dailyBudgetCapCents: number
  conversionTarget: number
  safetyPolicy: {
    blockedKeywords: string[]
    requireManualReview: boolean
  }
}

export const DEFAULT_AD_PLACEMENT_RULES: AdPlacementPreset[] = [
  {
    name: "推荐位标准投放",
    placementType: "home-recommendation",
    audienceSegment: "general",
    biddingModel: "CPC",
    bidPriceCents: 120,
    dailyBudgetCapCents: 200000,
    conversionTarget: 1.2,
    safetyPolicy: {
      blockedKeywords: BLOCKED_CONTENT_KEYWORDS,
      requireManualReview: true,
    },
  },
  {
    name: "搜索结果推广位",
    placementType: "search-sponsored",
    audienceSegment: "intent-high",
    biddingModel: "CPM",
    bidPriceCents: 90,
    dailyBudgetCapCents: 300000,
    conversionTarget: 1.5,
    safetyPolicy: {
      blockedKeywords: BLOCKED_CONTENT_KEYWORDS,
      requireManualReview: true,
    },
  },
]

export function buildDefaultAdPlacementSeed(userId: string) {
  return DEFAULT_AD_PLACEMENT_RULES.map((item) => ({
    userId,
    name: item.name,
    placementType: item.placementType,
    audienceSegment: item.audienceSegment,
    biddingModel: item.biddingModel,
    bidPriceCents: item.bidPriceCents,
    dailyBudgetCapCents: item.dailyBudgetCapCents,
    conversionTarget: item.conversionTarget,
    safetyPolicy: item.safetyPolicy,
    active: true,
  }))
}

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

function resolveFloat(value: unknown, fallback: number, min: number, max: number) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    return fallback
  }

  if (parsed < min) {
    return min
  }
  if (parsed > max) {
    return max
  }
  return Number(parsed.toFixed(2))
}

function parseDate(value: unknown, fallback: Date) {
  if (typeof value !== "string") {
    return fallback
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return fallback
  }
  return parsed
}

function sanitizeStringArray(value: unknown, maxItems: number, maxLength: number) {
  if (!Array.isArray(value)) {
    return [] as string[]
  }
  return value
    .map((item) => sanitizeTextInput(item, maxLength))
    .filter(Boolean)
    .slice(0, maxItems)
}

function normalizeRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {} as Record<string, unknown>
  }
  return value as Record<string, unknown>
}

export function sanitizeAdPlacementRuleInput(input: unknown, fallback = DEFAULT_AD_PLACEMENT_RULES[0]) {
  const source = normalizeRecord(input)
  const rawSafety = normalizeRecord(source.safetyPolicy)

  return {
    name: sanitizeTextInput(source.name, 120) || fallback.name,
    placementType: sanitizeTextInput(source.placementType, 80) || fallback.placementType,
    audienceSegment: sanitizeTextInput(source.audienceSegment, 80) || fallback.audienceSegment,
    biddingModel: sanitizeTextInput(source.biddingModel, 20).toUpperCase() === "CPM" ? "CPM" : "CPC",
    bidPriceCents: resolvePositiveInt(source.bidPriceCents, fallback.bidPriceCents, 1, 100000),
    dailyBudgetCapCents: resolvePositiveInt(
      source.dailyBudgetCapCents,
      fallback.dailyBudgetCapCents,
      100,
      100000000
    ),
    conversionTarget: resolveFloat(source.conversionTarget, fallback.conversionTarget, 0, 100),
    safetyPolicy: {
      blockedKeywords:
        sanitizeStringArray(rawSafety.blockedKeywords, 50, 40).length > 0
          ? sanitizeStringArray(rawSafety.blockedKeywords, 50, 40)
          : fallback.safetyPolicy.blockedKeywords,
      requireManualReview: rawSafety.requireManualReview !== false,
    },
  }
}

export function sanitizeAdCampaignInput(input: unknown) {
  const source = normalizeRecord(input)
  const now = new Date()
  const startAt = parseDate(source.startAt, now)
  const endAtFallback = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
  const endAt = parseDate(source.endAt, endAtFallback)

  return {
    title: sanitizeTextInput(source.title, 160),
    advertiser: sanitizeTextInput(source.advertiser, 120),
    content: sanitizeMultilineTextInput(source.content, 6000).trim(),
    landingUrl: sanitizeTextInput(source.landingUrl, 400),
    startAt,
    endAt,
    budgetCents: resolvePositiveInt(source.budgetCents, 100000, 1000, 500000000),
  }
}

export function evaluateAdSafetyPolicy({
  content,
  blockedKeywords,
}: {
  content: string
  blockedKeywords: string[]
}) {
  const normalizedContent = content.trim().toLowerCase()
  const matchedKeywords = blockedKeywords
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((keyword) => normalizedContent.includes(keyword.toLowerCase()))

  return {
    safe: matchedKeywords.length === 0,
    matchedKeywords,
  }
}

export function resolveAdCampaignInitialStatus({
  requireManualReview,
  safe,
}: {
  requireManualReview: boolean
  safe: boolean
}) {
  if (!safe) {
    return AdCampaignStatus.REJECTED
  }
  if (requireManualReview) {
    return AdCampaignStatus.IN_REVIEW
  }
  return AdCampaignStatus.APPROVED
}

export function resolveAdBudgetGuard({
  budgetCents,
  spentCents,
  newSpendCents,
  dailyBudgetCapCents,
  daySpentCents,
}: {
  budgetCents: number
  spentCents: number
  newSpendCents: number
  dailyBudgetCapCents: number
  daySpentCents: number
}) {
  const projectedTotal = Math.max(0, spentCents) + Math.max(0, newSpendCents)
  const projectedDaily = Math.max(0, daySpentCents) + Math.max(0, newSpendCents)

  return {
    allowTotalBudget: projectedTotal <= Math.max(0, budgetCents),
    allowDailyBudget: projectedDaily <= Math.max(0, dailyBudgetCapCents),
    projectedTotal,
    projectedDaily,
  }
}

export function resolveAdScheduleWindow(startAt: Date, endAt: Date, now = new Date()) {
  const startsBeforeEnds = startAt.getTime() < endAt.getTime()
  if (!startsBeforeEnds) {
    return {
      active: false,
      reason: "invalid-window",
    }
  }

  if (now.getTime() < startAt.getTime()) {
    return {
      active: false,
      reason: "not-started",
    }
  }

  if (now.getTime() > endAt.getTime()) {
    return {
      active: false,
      reason: "expired",
    }
  }

  return {
    active: true,
    reason: "active",
  }
}

export function resolveAdConversionMetrics({
  impressions,
  clicks,
  conversions,
  spendCents,
}: {
  impressions: number
  clicks: number
  conversions: number
  spendCents: number
}) {
  const safeImpressions = Math.max(0, impressions)
  const safeClicks = Math.max(0, clicks)
  const safeConversions = Math.max(0, conversions)
  const safeSpend = Math.max(0, spendCents)

  const ctr = safeImpressions === 0 ? 0 : Number(((safeClicks / safeImpressions) * 100).toFixed(2))
  const conversionRate = safeClicks === 0 ? 0 : Number(((safeConversions / safeClicks) * 100).toFixed(2))
  const cpcCents = safeClicks === 0 ? 0 : Math.round(safeSpend / safeClicks)

  return {
    ctr,
    conversionRate,
    cpcCents,
  }
}

export function normalizeAdCampaignStatus(value: unknown) {
  const normalized = sanitizeTextInput(value, 30).toUpperCase()
  if (normalized === AdCampaignStatus.IN_REVIEW) {
    return AdCampaignStatus.IN_REVIEW
  }
  if (normalized === AdCampaignStatus.APPROVED) {
    return AdCampaignStatus.APPROVED
  }
  if (normalized === AdCampaignStatus.REJECTED) {
    return AdCampaignStatus.REJECTED
  }
  if (normalized === AdCampaignStatus.ACTIVE) {
    return AdCampaignStatus.ACTIVE
  }
  if (normalized === AdCampaignStatus.PAUSED) {
    return AdCampaignStatus.PAUSED
  }
  if (normalized === AdCampaignStatus.COMPLETED) {
    return AdCampaignStatus.COMPLETED
  }
  return AdCampaignStatus.DRAFT
}
