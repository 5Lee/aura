import { GrowthExperimentStatus, GrowthMetricType } from "@prisma/client"

import { sanitizeMultilineTextInput, sanitizeTextInput } from "@/lib/security"

export type GrowthExperimentPreset = {
  name: string
  hypothesis: string
  segmentKey: string
  baselineMetric: number
  targetMetric: number
  liftTargetPercent: number
  durationDays: number
}

export const DEFAULT_GROWTH_EXPERIMENT_PRESETS: GrowthExperimentPreset[] = [
  {
    name: "新用户激活引导优化",
    hypothesis: "优化首日引导可提升新用户创建首条提示词转化率",
    segmentKey: "new-user-d1",
    baselineMetric: 8.5,
    targetMetric: 11.5,
    liftTargetPercent: 35,
    durationDays: 14,
  },
  {
    name: "回访召回提醒频率实验",
    hypothesis: "更精准的召回触达频率可提升 7 日回访率",
    segmentKey: "churn-risk-d7",
    baselineMetric: 12,
    targetMetric: 15,
    liftTargetPercent: 25,
    durationDays: 21,
  },
]

export function buildGrowthExperimentSeed(userId: string) {
  const now = new Date()

  return DEFAULT_GROWTH_EXPERIMENT_PRESETS.map((item) => {
    const endAt = new Date(now)
    endAt.setDate(endAt.getDate() + item.durationDays)

    return {
      userId,
      name: item.name,
      hypothesis: item.hypothesis,
      segmentKey: item.segmentKey,
      status: GrowthExperimentStatus.DRAFT,
      baselineMetric: item.baselineMetric,
      targetMetric: item.targetMetric,
      liftTargetPercent: item.liftTargetPercent,
      startAt: now,
      endAt,
      payload: {
        source: "preset",
        durationDays: item.durationDays,
      },
    }
  })
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

function normalizeRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {} as Record<string, unknown>
  }

  return value as Record<string, unknown>
}

export function sanitizeGrowthExperimentInput(input: unknown) {
  const source = normalizeRecord(input)
  const now = new Date()
  const defaultEndAt = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)

  return {
    name: sanitizeTextInput(source.name, 120),
    hypothesis: sanitizeMultilineTextInput(source.hypothesis, 2000).trim(),
    segmentKey: sanitizeTextInput(source.segmentKey, 80),
    baselineMetric: resolveFloat(source.baselineMetric, 0, 0, 100000),
    targetMetric: resolveFloat(source.targetMetric, 0, 0, 100000),
    liftTargetPercent: resolveFloat(source.liftTargetPercent, 0, 0, 1000),
    startAt: parseDate(source.startAt, now),
    endAt: parseDate(source.endAt, defaultEndAt),
  }
}

export function normalizeGrowthExperimentStatus(value: unknown) {
  const normalized = sanitizeTextInput(value, 30).toUpperCase()

  if (normalized === GrowthExperimentStatus.RUNNING) {
    return GrowthExperimentStatus.RUNNING
  }
  if (normalized === GrowthExperimentStatus.PAUSED) {
    return GrowthExperimentStatus.PAUSED
  }
  if (normalized === GrowthExperimentStatus.COMPLETED) {
    return GrowthExperimentStatus.COMPLETED
  }
  if (normalized === GrowthExperimentStatus.ARCHIVED) {
    return GrowthExperimentStatus.ARCHIVED
  }
  if (normalized === GrowthExperimentStatus.DRAFT) {
    return GrowthExperimentStatus.DRAFT
  }

  return GrowthExperimentStatus.DRAFT
}

export function normalizeGrowthMetricType(value: unknown) {
  const normalized = sanitizeTextInput(value, 30).toUpperCase()

  if (normalized === GrowthMetricType.EXPOSURE) {
    return GrowthMetricType.EXPOSURE
  }
  if (normalized === GrowthMetricType.CTR) {
    return GrowthMetricType.CTR
  }
  if (normalized === GrowthMetricType.RETENTION) {
    return GrowthMetricType.RETENTION
  }
  if (normalized === GrowthMetricType.REVENUE) {
    return GrowthMetricType.REVENUE
  }
  if (normalized === GrowthMetricType.CONVERSION) {
    return GrowthMetricType.CONVERSION
  }

  return GrowthMetricType.CONVERSION
}

export function resolveGrowthScheduleWindow(startAt: Date, endAt: Date, now = new Date()) {
  if (startAt.getTime() >= endAt.getTime()) {
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

export function resolveGrowthSnapshotInput(input: unknown) {
  const source = normalizeRecord(input)
  const now = new Date()

  return {
    metricType: normalizeGrowthMetricType(source.metricType),
    windowStart: parseDate(source.windowStart, now),
    windowEnd: parseDate(source.windowEnd, now),
    exposures: resolvePositiveInt(source.exposures, 0, 0, 100000000),
    conversions: resolvePositiveInt(source.conversions, 0, 0, 100000000),
    retainedUsers: resolvePositiveInt(source.retainedUsers, 0, 0, 100000000),
    revenueCents: resolvePositiveInt(source.revenueCents, 0, 0, 1000000000),
  }
}

export function resolveGrowthSnapshotMetrics({
  baselineMetric,
  targetMetric,
  exposures,
  conversions,
}: {
  baselineMetric: number
  targetMetric: number
  exposures: number
  conversions: number
}) {
  const safeExposures = Math.max(0, exposures)
  const safeConversions = Math.max(0, conversions)
  const conversionRate =
    safeExposures === 0 ? 0 : Number(((safeConversions / safeExposures) * 100).toFixed(2))

  const baseline = Math.max(0, baselineMetric)
  const liftPercent =
    baseline <= 0 ? 0 : Number((((conversionRate - baseline) / baseline) * 100).toFixed(2))

  const targetGap = Number((Math.max(0, targetMetric) - conversionRate).toFixed(2))

  return {
    conversionRate,
    liftPercent,
    targetGap,
  }
}
