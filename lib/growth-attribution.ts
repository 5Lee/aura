import { GrowthAttributionStatus } from "@prisma/client"

import { sanitizeMultilineTextInput, sanitizeTextInput } from "@/lib/security"

export type GrowthAttributionPreset = {
  channel: string
  exposures: number
  clicks: number
  conversions: number
  costCents: number
  revenueCents: number
}

export const DEFAULT_GROWTH_ATTRIBUTION_PRESETS: GrowthAttributionPreset[] = [
  {
    channel: "ORGANIC",
    exposures: 2600,
    clicks: 780,
    conversions: 156,
    costCents: 68000,
    revenueCents: 468000,
  },
  {
    channel: "PAID_SEARCH",
    exposures: 1800,
    clicks: 540,
    conversions: 92,
    costCents: 126000,
    revenueCents: 358000,
  },
]

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

function normalizeRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {} as Record<string, unknown>
  }

  return value as Record<string, unknown>
}

export function normalizeGrowthAttributionStatus(value: unknown) {
  const normalized = sanitizeTextInput(value, 20).toUpperCase()

  if (normalized === GrowthAttributionStatus.ANOMALY) {
    return GrowthAttributionStatus.ANOMALY
  }
  if (normalized === GrowthAttributionStatus.CORRECTED) {
    return GrowthAttributionStatus.CORRECTED
  }
  if (normalized === GrowthAttributionStatus.NORMAL) {
    return GrowthAttributionStatus.NORMAL
  }

  return GrowthAttributionStatus.NORMAL
}

export function normalizeGrowthAttributionChannel(value: unknown) {
  const normalized = sanitizeTextInput(value, 60).toUpperCase().replace(/\s+/g, "_")
  if (!normalized) {
    return "DIRECT"
  }

  return normalized
}

export function resolveGrowthAttributionMetrics({
  exposures,
  clicks,
  conversions,
  costCents,
}: {
  exposures: number
  clicks: number
  conversions: number
  costCents: number
}) {
  const safeExposures = Math.max(0, exposures)
  const safeClicks = Math.max(0, clicks)
  const safeConversions = Math.max(0, conversions)
  const safeCost = Math.max(0, costCents)

  const ctr = safeExposures === 0 ? 0 : Number(((safeClicks / safeExposures) * 100).toFixed(2))
  const conversionRate = safeClicks === 0 ? 0 : Number(((safeConversions / safeClicks) * 100).toFixed(2))
  const costPerAcquisition =
    safeConversions === 0 ? safeCost : Number((safeCost / safeConversions / 100).toFixed(2))

  return {
    ctr,
    conversionRate,
    costPerAcquisition,
  }
}

export function detectGrowthAttributionAnomaly({
  exposures,
  clicks,
  conversions,
  costCents,
  conversionRate,
}: {
  exposures: number
  clicks: number
  conversions: number
  costCents: number
  conversionRate: number
}) {
  if (clicks > exposures && exposures > 0) {
    return {
      hasAnomaly: true,
      reason: "clicks-exceed-exposures",
      score: 0.95,
    }
  }

  if (conversions > clicks && clicks > 0) {
    return {
      hasAnomaly: true,
      reason: "conversions-exceed-clicks",
      score: 0.98,
    }
  }

  if (costCents > 0 && conversions === 0 && clicks >= 20) {
    return {
      hasAnomaly: true,
      reason: "spend-without-conversion",
      score: 0.82,
    }
  }

  if (conversionRate > 75) {
    return {
      hasAnomaly: true,
      reason: "conversion-rate-too-high",
      score: 0.76,
    }
  }

  return {
    hasAnomaly: false,
    reason: null,
    score: 0,
  }
}

export function sanitizeGrowthAttributionInput(input: unknown) {
  const source = normalizeRecord(input)
  const now = new Date()
  const endFallback = new Date(now)
  const startFallback = new Date(now.getTime() - 24 * 60 * 60 * 1000)

  const windowStart = parseDate(source.windowStart, startFallback)
  const windowEnd = parseDate(source.windowEnd, endFallback)

  return {
    id: sanitizeTextInput(source.id, 80),
    experimentId: sanitizeTextInput(source.experimentId, 80),
    channel: normalizeGrowthAttributionChannel(source.channel),
    windowStart,
    windowEnd: windowEnd.getTime() <= windowStart.getTime() ? new Date(windowStart.getTime() + 3600000) : windowEnd,
    exposures: resolvePositiveInt(source.exposures, 0, 0, 100000000),
    clicks: resolvePositiveInt(source.clicks, 0, 0, 100000000),
    conversions: resolvePositiveInt(source.conversions, 0, 0, 100000000),
    costCents: resolvePositiveInt(source.costCents, 0, 0, 2000000000),
    revenueCents: resolvePositiveInt(source.revenueCents, 0, 0, 2000000000),
    correctionTag: sanitizeTextInput(source.correctionTag, 120),
    correctionNote: sanitizeMultilineTextInput(source.correctionNote, 500).trim(),
  }
}

export function buildGrowthAttributionSeed(
  userId: string,
  experiments: Array<{ id: string; startAt: Date; endAt: Date }>
) {
  return experiments.slice(0, 2).flatMap((experiment, index) => {
    const preset = DEFAULT_GROWTH_ATTRIBUTION_PRESETS[index % DEFAULT_GROWTH_ATTRIBUTION_PRESETS.length]
    const metrics = resolveGrowthAttributionMetrics({
      exposures: preset.exposures,
      clicks: preset.clicks,
      conversions: preset.conversions,
      costCents: preset.costCents,
    })

    return {
      userId,
      experimentId: experiment.id,
      channel: preset.channel,
      windowStart: experiment.startAt,
      windowEnd: experiment.endAt,
      exposures: preset.exposures,
      clicks: preset.clicks,
      conversions: preset.conversions,
      costCents: preset.costCents,
      revenueCents: preset.revenueCents,
      ctr: metrics.ctr,
      conversionRate: metrics.conversionRate,
      status: GrowthAttributionStatus.NORMAL,
      anomalyScore: 0,
      metadata: {
        source: "preset",
      },
    }
  })
}

export function buildGrowthAttributionAggregate<T extends { experimentId: string; channel: string; exposures: number; clicks: number; conversions: number; costCents: number; revenueCents: number }>(
  rows: T[]
) {
  const grouped = new Map<string, {
    experimentId: string
    channel: string
    exposures: number
    clicks: number
    conversions: number
    costCents: number
    revenueCents: number
  }>()

  for (const row of rows) {
    const key = `${row.experimentId}::${row.channel}`
    const current =
      grouped.get(key) ||
      {
        experimentId: row.experimentId,
        channel: row.channel,
        exposures: 0,
        clicks: 0,
        conversions: 0,
        costCents: 0,
        revenueCents: 0,
      }

    current.exposures += row.exposures
    current.clicks += row.clicks
    current.conversions += row.conversions
    current.costCents += row.costCents
    current.revenueCents += row.revenueCents

    grouped.set(key, current)
  }

  return Array.from(grouped.values())
    .map((item) => {
      const metrics = resolveGrowthAttributionMetrics({
        exposures: item.exposures,
        clicks: item.clicks,
        conversions: item.conversions,
        costCents: item.costCents,
      })

      return {
        ...item,
        ctr: metrics.ctr,
        conversionRate: metrics.conversionRate,
        costPerAcquisition: metrics.costPerAcquisition,
        roiPercent:
          item.costCents <= 0
            ? 0
            : Number((((item.revenueCents - item.costCents) / item.costCents) * 100).toFixed(2)),
      }
    })
    .sort((a, b) => b.conversions - a.conversions)
}

export function resolveGrowthAttributionConsistency({
  attributionRows,
  metricRows,
}: {
  attributionRows: Array<{ exposures: number; conversions: number }>
  metricRows: Array<{ exposures: number; conversions: number }>
}) {
  const attributionExposure = attributionRows.reduce((acc, item) => acc + item.exposures, 0)
  const attributionConversion = attributionRows.reduce((acc, item) => acc + item.conversions, 0)
  const metricExposure = metricRows.reduce((acc, item) => acc + item.exposures, 0)
  const metricConversion = metricRows.reduce((acc, item) => acc + item.conversions, 0)

  const exposureGap = attributionExposure - metricExposure
  const conversionGap = attributionConversion - metricConversion
  const denominator = Math.max(metricExposure, 1)
  const gapPercent = Number((Math.abs(exposureGap) / denominator * 100).toFixed(2))

  return {
    attributionExposure,
    attributionConversion,
    metricExposure,
    metricConversion,
    exposureGap,
    conversionGap,
    gapPercent,
    consistent: gapPercent <= 5 && Math.abs(conversionGap) <= Math.max(5, Math.floor(metricConversion * 0.1)),
  }
}
