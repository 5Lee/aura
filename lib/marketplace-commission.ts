import {
  MarketplaceLedgerStatus,
  MarketplaceSettlementStatus,
  type Prisma,
} from "@prisma/client"

import { sanitizeMultilineTextInput, sanitizeTextInput } from "@/lib/security"

export type MarketplaceCommissionRulePreset = {
  name: string
  category: string
  creatorRateBasisPoints: number
  platformRateBasisPoints: number
  settlementCycleDays: number
  minimumPayoutCents: number
  currency: string
}

export const DEFAULT_MARKETPLACE_COMMISSION_RULES: MarketplaceCommissionRulePreset[] = [
  {
    name: "标准提示词模板分成",
    category: "prompt-template",
    creatorRateBasisPoints: 7000,
    platformRateBasisPoints: 3000,
    settlementCycleDays: 30,
    minimumPayoutCents: 10000,
    currency: "CNY",
  },
  {
    name: "企业定制交付分成",
    category: "enterprise-delivery",
    creatorRateBasisPoints: 6500,
    platformRateBasisPoints: 3500,
    settlementCycleDays: 30,
    minimumPayoutCents: 30000,
    currency: "CNY",
  },
]

export type MarketplaceCommissionBreakdown = {
  grossAmountCents: number
  creatorCommissionCents: number
  platformCommissionCents: number
  creatorRateBasisPoints: number
  platformRateBasisPoints: number
}

export function sanitizeMarketplaceCommissionRuleInput(
  input: unknown,
  fallback: MarketplaceCommissionRulePreset = DEFAULT_MARKETPLACE_COMMISSION_RULES[0]
): MarketplaceCommissionRulePreset {
  const source = toRecord(input)
  const creatorRateBasisPoints = resolveBasisPoints(source.creatorRateBasisPoints, fallback.creatorRateBasisPoints)
  const platformRateBasisPoints = resolveBasisPoints(
    source.platformRateBasisPoints,
    fallback.platformRateBasisPoints
  )

  const totalBasisPoints = creatorRateBasisPoints + platformRateBasisPoints
  const normalizedCreatorRate = totalBasisPoints <= 10000
    ? creatorRateBasisPoints
    : fallback.creatorRateBasisPoints
  const normalizedPlatformRate = totalBasisPoints <= 10000
    ? platformRateBasisPoints
    : fallback.platformRateBasisPoints

  return {
    name: sanitizeTextInput(source.name, 120) || fallback.name,
    category: sanitizeTextInput(source.category, 80) || fallback.category,
    creatorRateBasisPoints: normalizedCreatorRate,
    platformRateBasisPoints: normalizedPlatformRate,
    settlementCycleDays: resolveInt(source.settlementCycleDays, fallback.settlementCycleDays, 1, 90),
    minimumPayoutCents: resolveInt(source.minimumPayoutCents, fallback.minimumPayoutCents, 0, 100000000),
    currency: sanitizeTextInput(source.currency, 8).toUpperCase() || fallback.currency,
  }
}

export function calculateMarketplaceCommission(
  grossAmountCents: number,
  rule: Pick<MarketplaceCommissionRulePreset, "creatorRateBasisPoints" | "platformRateBasisPoints">
): MarketplaceCommissionBreakdown {
  const normalizedGross = Math.max(0, Math.floor(grossAmountCents))
  const creatorCommissionCents = Math.floor((normalizedGross * rule.creatorRateBasisPoints) / 10000)
  const platformCommissionCents = Math.max(0, normalizedGross - creatorCommissionCents)

  return {
    grossAmountCents: normalizedGross,
    creatorCommissionCents,
    platformCommissionCents,
    creatorRateBasisPoints: rule.creatorRateBasisPoints,
    platformRateBasisPoints: rule.platformRateBasisPoints,
  }
}

export function resolveSettlementWindow(periodEnd: Date, settlementCycleDays: number) {
  const normalizedCycle = Math.max(1, Math.min(90, Math.floor(settlementCycleDays)))
  const end = new Date(periodEnd)
  const start = new Date(end.getTime() - normalizedCycle * 24 * 60 * 60 * 1000)
  return { periodStart: start, periodEnd: end }
}

export function buildDefaultMarketplaceRuleSeed(userId: string) {
  return DEFAULT_MARKETPLACE_COMMISSION_RULES.map((rule) => ({
    userId,
    name: rule.name,
    category: rule.category,
    creatorRateBasisPoints: rule.creatorRateBasisPoints,
    platformRateBasisPoints: rule.platformRateBasisPoints,
    settlementCycleDays: rule.settlementCycleDays,
    minimumPayoutCents: rule.minimumPayoutCents,
    currency: rule.currency,
    active: true,
  }))
}

export function summarizeMarketplaceSettlement(
  ledgers: Array<{
    grossAmountCents: number
    creatorCommissionCents: number
    platformCommissionCents: number
  }>
) {
  const totals = ledgers.reduce(
    (acc, row) => {
      acc.grossAmountCents += Math.max(0, row.grossAmountCents)
      acc.creatorCommissionCents += Math.max(0, row.creatorCommissionCents)
      acc.platformCommissionCents += Math.max(0, row.platformCommissionCents)
      return acc
    },
    {
      grossAmountCents: 0,
      creatorCommissionCents: 0,
      platformCommissionCents: 0,
    }
  )

  return {
    ...totals,
    payoutAmountCents: totals.creatorCommissionCents,
  }
}

export function normalizeMarketplaceSettlementStatus(value: unknown) {
  const normalized = sanitizeTextInput(value, 20).toUpperCase()
  if (normalized === MarketplaceSettlementStatus.PROCESSING) {
    return MarketplaceSettlementStatus.PROCESSING
  }
  if (normalized === MarketplaceSettlementStatus.PAID) {
    return MarketplaceSettlementStatus.PAID
  }
  if (normalized === MarketplaceSettlementStatus.FAILED) {
    return MarketplaceSettlementStatus.FAILED
  }
  return MarketplaceSettlementStatus.PENDING
}

export function normalizeMarketplaceLedgerStatus(value: unknown) {
  const normalized = sanitizeTextInput(value, 20).toUpperCase()
  if (normalized === MarketplaceLedgerStatus.SETTLED) {
    return MarketplaceLedgerStatus.SETTLED
  }
  if (normalized === MarketplaceLedgerStatus.REVERSED) {
    return MarketplaceLedgerStatus.REVERSED
  }
  return MarketplaceLedgerStatus.ACCRUED
}

export function sanitizeMarketplaceSummary(value: unknown) {
  return sanitizeMultilineTextInput(value, 1200).trim()
}

export function sanitizeMarketplaceMetadata(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined
  }
  return value as Prisma.InputJsonObject
}

function toRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {} as Record<string, unknown>
  }
  return value as Record<string, unknown>
}

function resolveInt(value: unknown, fallback: number, min: number, max: number) {
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

function resolveBasisPoints(value: unknown, fallback: number) {
  return resolveInt(value, fallback, 0, 10000)
}
