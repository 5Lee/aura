import { PartnerLeadStatus, PartnerSettlementStatus, PartnerTierLevel } from "@prisma/client"

import { sanitizeTextInput } from "@/lib/security"

type PartnerTierPreset = {
  name: string
  level: PartnerTierLevel
  minQualifiedLeads: number
  revenueShareBasisPoints: number
  settlementCycleDays: number
  benefitPolicy: {
    benefits: string[]
    leadRoutingPriority: "standard" | "priority" | "exclusive"
  }
}

const DEFAULT_BENEFIT_SET = ["线索优先分发", "联合营销资源", "专属运营支持"]

export const DEFAULT_PARTNER_TIERS: PartnerTierPreset[] = [
  {
    name: "注册伙伴",
    level: PartnerTierLevel.REGISTERED,
    minQualifiedLeads: 3,
    revenueShareBasisPoints: 800,
    settlementCycleDays: 30,
    benefitPolicy: {
      benefits: [DEFAULT_BENEFIT_SET[0]],
      leadRoutingPriority: "standard",
    },
  },
  {
    name: "增长伙伴",
    level: PartnerTierLevel.GROWTH,
    minQualifiedLeads: 8,
    revenueShareBasisPoints: 1200,
    settlementCycleDays: 30,
    benefitPolicy: {
      benefits: [DEFAULT_BENEFIT_SET[0], DEFAULT_BENEFIT_SET[1]],
      leadRoutingPriority: "priority",
    },
  },
  {
    name: "战略伙伴",
    level: PartnerTierLevel.STRATEGIC,
    minQualifiedLeads: 20,
    revenueShareBasisPoints: 1800,
    settlementCycleDays: 14,
    benefitPolicy: {
      benefits: DEFAULT_BENEFIT_SET,
      leadRoutingPriority: "exclusive",
    },
  },
]

export function buildDefaultPartnerTierSeed(userId: string) {
  return DEFAULT_PARTNER_TIERS.map((item) => ({
    userId,
    name: item.name,
    level: item.level,
    minQualifiedLeads: item.minQualifiedLeads,
    revenueShareBasisPoints: item.revenueShareBasisPoints,
    settlementCycleDays: item.settlementCycleDays,
    benefitPolicy: item.benefitPolicy,
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

function normalizeRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {} as Record<string, unknown>
  }
  return value as Record<string, unknown>
}

function normalizeTierLevel(value: unknown, fallback: PartnerTierLevel) {
  const normalized = sanitizeTextInput(value, 40).toUpperCase()
  if (normalized === PartnerTierLevel.GROWTH) {
    return PartnerTierLevel.GROWTH
  }
  if (normalized === PartnerTierLevel.STRATEGIC) {
    return PartnerTierLevel.STRATEGIC
  }
  if (normalized === PartnerTierLevel.ELITE) {
    return PartnerTierLevel.ELITE
  }
  if (normalized === PartnerTierLevel.REGISTERED) {
    return PartnerTierLevel.REGISTERED
  }
  return fallback
}

export function sanitizePartnerTierInput(input: unknown, fallback = DEFAULT_PARTNER_TIERS[0]) {
  const source = normalizeRecord(input)

  return {
    name: sanitizeTextInput(source.name, 80) || fallback.name,
    level: normalizeTierLevel(source.level, fallback.level),
    minQualifiedLeads: resolvePositiveInt(source.minQualifiedLeads, fallback.minQualifiedLeads, 0, 100000),
    revenueShareBasisPoints: resolvePositiveInt(
      source.revenueShareBasisPoints,
      fallback.revenueShareBasisPoints,
      100,
      7000
    ),
    settlementCycleDays: resolvePositiveInt(source.settlementCycleDays, fallback.settlementCycleDays, 1, 90),
    benefitPolicy: {
      benefits: Array.isArray(source.benefits)
        ? source.benefits
            .map((item) => sanitizeTextInput(item, 60))
            .filter(Boolean)
            .slice(0, 8)
        : fallback.benefitPolicy.benefits,
      leadRoutingPriority:
        sanitizeTextInput(source.leadRoutingPriority, 20) === "exclusive"
          ? "exclusive"
          : sanitizeTextInput(source.leadRoutingPriority, 20) === "priority"
            ? "priority"
            : "standard",
    },
  }
}

export function sanitizePartnerLeadInput(input: unknown) {
  const source = normalizeRecord(input)

  return {
    tierId: sanitizeTextInput(source.tierId, 80),
    leadName: sanitizeTextInput(source.leadName, 100),
    company: sanitizeTextInput(source.company, 120),
    contactEmail: sanitizeTextInput(source.contactEmail, 160),
    sourceChannel: sanitizeTextInput(source.sourceChannel, 80) || "direct",
    attributionCode: sanitizeTextInput(source.attributionCode, 80) || "manual",
    estimatedDealCents: resolvePositiveInt(source.estimatedDealCents, 0, 0, 5_000_000_000),
    closedDealCents: resolvePositiveInt(source.closedDealCents, 0, 0, 5_000_000_000),
  }
}

export function resolvePartnerLeadAttribution({
  sourceChannel,
  attributionCode,
}: {
  sourceChannel: string
  attributionCode: string
}) {
  const source = sanitizeTextInput(sourceChannel, 80).toLowerCase() || "direct"
  const code = sanitizeTextInput(attributionCode, 80).toUpperCase() || "MANUAL"

  const sourceWeight =
    source === "referral"
      ? 1.2
      : source === "webinar"
        ? 1.1
        : source === "campaign"
          ? 1.05
          : 1

  return {
    attributionKey: `${source}:${code}`,
    sourceWeight,
    isTracked: code !== "MANUAL",
  }
}

export function calculatePartnerRevenueShare({
  grossRevenueCents,
  revenueShareBasisPoints,
}: {
  grossRevenueCents: number
  revenueShareBasisPoints: number
}) {
  const safeRevenue = Math.max(0, grossRevenueCents)
  const safeBps = Math.max(0, revenueShareBasisPoints)
  const payoutAmountCents = Math.round((safeRevenue * safeBps) / 10000)

  return {
    grossRevenueCents: safeRevenue,
    payoutAmountCents,
    revenueShareBasisPoints: safeBps,
  }
}

export function summarizePartnerSettlement(
  leads: Array<{
    status: PartnerLeadStatus
    estimatedDealCents: number
    closedDealCents: number
    commissionBasisPoints: number
  }>
) {
  return leads.reduce(
    (acc, lead) => {
      acc.totalLeads += 1
      if (lead.status === PartnerLeadStatus.QUALIFIED || lead.status === PartnerLeadStatus.WON) {
        acc.qualifiedLeads += 1
      }
      if (lead.status === PartnerLeadStatus.WON) {
        acc.wonLeads += 1
      }
      acc.totalEstimatedRevenueCents += Math.max(0, lead.estimatedDealCents)
      acc.totalClosedRevenueCents += Math.max(0, lead.closedDealCents)
      acc.estimatedPayoutCents += Math.round(
        (Math.max(0, lead.closedDealCents) * Math.max(0, lead.commissionBasisPoints)) / 10000
      )
      return acc
    },
    {
      totalLeads: 0,
      qualifiedLeads: 0,
      wonLeads: 0,
      totalEstimatedRevenueCents: 0,
      totalClosedRevenueCents: 0,
      estimatedPayoutCents: 0,
    }
  )
}

export function reconcilePartnerSettlement({
  expectedPayoutCents,
  actualPayoutCents,
}: {
  expectedPayoutCents: number
  actualPayoutCents: number
}) {
  const expected = Math.max(0, expectedPayoutCents)
  const actual = Math.max(0, actualPayoutCents)
  const deltaCents = actual - expected

  return {
    matched: deltaCents === 0,
    deltaCents,
    expectedPayoutCents: expected,
    actualPayoutCents: actual,
  }
}

export function normalizePartnerLeadStatus(value: unknown) {
  const normalized = sanitizeTextInput(value, 20).toUpperCase()
  if (normalized === PartnerLeadStatus.QUALIFIED) {
    return PartnerLeadStatus.QUALIFIED
  }
  if (normalized === PartnerLeadStatus.WON) {
    return PartnerLeadStatus.WON
  }
  if (normalized === PartnerLeadStatus.LOST) {
    return PartnerLeadStatus.LOST
  }
  if (normalized === PartnerLeadStatus.INVALID) {
    return PartnerLeadStatus.INVALID
  }
  if (normalized === PartnerLeadStatus.NEW) {
    return PartnerLeadStatus.NEW
  }
  return PartnerLeadStatus.NEW
}

export function normalizePartnerSettlementStatus(value: unknown) {
  const normalized = sanitizeTextInput(value, 30).toUpperCase()
  if (normalized === PartnerSettlementStatus.PENDING) {
    return PartnerSettlementStatus.PENDING
  }
  if (normalized === PartnerSettlementStatus.PROCESSING) {
    return PartnerSettlementStatus.PROCESSING
  }
  if (normalized === PartnerSettlementStatus.PAID) {
    return PartnerSettlementStatus.PAID
  }
  if (normalized === PartnerSettlementStatus.DISPUTED) {
    return PartnerSettlementStatus.DISPUTED
  }
  if (normalized === PartnerSettlementStatus.DRAFT) {
    return PartnerSettlementStatus.DRAFT
  }
  return PartnerSettlementStatus.DRAFT
}
