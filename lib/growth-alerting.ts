import { GrowthAlertStatus, GrowthAlertType, GrowthExperimentStatus } from "@prisma/client"

import { sanitizeTextInput } from "@/lib/security"

export const DEFAULT_GROWTH_ALERT_RULES = {
  conversionDropPercent: 35,
  maxCostPerConversionCents: 15000,
  minSampleExposures: 120,
}

export function normalizeGrowthAlertStatus(value: unknown) {
  const normalized = sanitizeTextInput(value, 30).toUpperCase()

  if (normalized === GrowthAlertStatus.RESOLVED) {
    return GrowthAlertStatus.RESOLVED
  }
  if (normalized === GrowthAlertStatus.ACKNOWLEDGED) {
    return GrowthAlertStatus.ACKNOWLEDGED
  }
  if (normalized === GrowthAlertStatus.OPEN) {
    return GrowthAlertStatus.OPEN
  }

  return GrowthAlertStatus.OPEN
}

export function normalizeGrowthAlertType(value: unknown) {
  const normalized = sanitizeTextInput(value, 30).toUpperCase()

  if (normalized === GrowthAlertType.COST_SPIKE) {
    return GrowthAlertType.COST_SPIKE
  }
  if (normalized === GrowthAlertType.LOW_SAMPLE) {
    return GrowthAlertType.LOW_SAMPLE
  }
  if (normalized === GrowthAlertType.CONVERSION_DROP) {
    return GrowthAlertType.CONVERSION_DROP
  }

  return GrowthAlertType.CONVERSION_DROP
}

function resolveSeverity(score: number) {
  if (score >= 0.9) {
    return "P0"
  }
  if (score >= 0.75) {
    return "P1"
  }
  if (score >= 0.55) {
    return "P2"
  }

  return "P3"
}

export function buildGrowthAlertEvaluations({
  experiment,
  latestSnapshot,
  latestAttribution,
}: {
  experiment: {
    id: string
    status: GrowthExperimentStatus
    baselineMetric: number
  }
  latestSnapshot: {
    exposures: number
    conversionRate: number
  } | null
  latestAttribution: {
    costCents: number
    conversions: number
  } | null
}) {
  const alerts: Array<{
    type: GrowthAlertType
    severity: string
    message: string
    triggerValue: number
    thresholdValue: number
    score: number
  }> = []

  if (latestSnapshot) {
    const dropThreshold = Number(
      (Math.max(0, experiment.baselineMetric) * (1 - DEFAULT_GROWTH_ALERT_RULES.conversionDropPercent / 100)).toFixed(2)
    )

    if (latestSnapshot.conversionRate < dropThreshold && latestSnapshot.exposures >= DEFAULT_GROWTH_ALERT_RULES.minSampleExposures) {
      const gap = Math.max(0, dropThreshold - latestSnapshot.conversionRate)
      const score = Math.min(0.99, Number((0.58 + gap / Math.max(dropThreshold, 1)).toFixed(2)))
      alerts.push({
        type: GrowthAlertType.CONVERSION_DROP,
        severity: resolveSeverity(score),
        message: `转化率跌破阈值：${latestSnapshot.conversionRate}% < ${dropThreshold}%`,
        triggerValue: latestSnapshot.conversionRate,
        thresholdValue: dropThreshold,
        score,
      })
    }

    if (latestSnapshot.exposures < DEFAULT_GROWTH_ALERT_RULES.minSampleExposures) {
      const ratio = 1 - latestSnapshot.exposures / Math.max(DEFAULT_GROWTH_ALERT_RULES.minSampleExposures, 1)
      const score = Math.max(0.5, Math.min(0.9, Number((0.52 + ratio * 0.4).toFixed(2))))
      alerts.push({
        type: GrowthAlertType.LOW_SAMPLE,
        severity: resolveSeverity(score),
        message: `样本量不足：${latestSnapshot.exposures} < ${DEFAULT_GROWTH_ALERT_RULES.minSampleExposures}`,
        triggerValue: latestSnapshot.exposures,
        thresholdValue: DEFAULT_GROWTH_ALERT_RULES.minSampleExposures,
        score,
      })
    }
  }

  if (latestAttribution) {
    const safeConversions = Math.max(0, latestAttribution.conversions)
    const cpa =
      safeConversions === 0
        ? latestAttribution.costCents
        : Number((latestAttribution.costCents / safeConversions).toFixed(2))

    if (cpa > DEFAULT_GROWTH_ALERT_RULES.maxCostPerConversionCents) {
      const ratio = cpa / Math.max(DEFAULT_GROWTH_ALERT_RULES.maxCostPerConversionCents, 1)
      const score = Math.min(0.98, Number((0.6 + Math.min(ratio, 2) * 0.15).toFixed(2)))
      alerts.push({
        type: GrowthAlertType.COST_SPIKE,
        severity: resolveSeverity(score),
        message: `获客成本超阈值：${cpa} > ${DEFAULT_GROWTH_ALERT_RULES.maxCostPerConversionCents}`,
        triggerValue: cpa,
        thresholdValue: DEFAULT_GROWTH_ALERT_RULES.maxCostPerConversionCents,
        score,
      })
    }
  }

  return alerts
}

export function resolveGrowthAlertAutoPause(type: GrowthAlertType) {
  if (type === GrowthAlertType.CONVERSION_DROP || type === GrowthAlertType.COST_SPIKE) {
    return true
  }

  return false
}
