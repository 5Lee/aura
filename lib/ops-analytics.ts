import { OpsAnalyticsMetricType } from "@prisma/client"

import { sanitizeTextInput } from "@/lib/security"

export const OPS_FUNNEL_STAGES = ["activated", "retained", "revisit", "converted"] as const

function toRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {} as Record<string, unknown>
  }
  return value as Record<string, unknown>
}

function toInt(value: unknown, fallback: number, min: number, max: number) {
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

export function normalizeOpsAnalyticsMetricType(value: unknown) {
  const normalized = sanitizeTextInput(value, 20).toUpperCase()
  if (normalized === OpsAnalyticsMetricType.RETENTION) {
    return OpsAnalyticsMetricType.RETENTION
  }
  if (normalized === OpsAnalyticsMetricType.REVISIT) {
    return OpsAnalyticsMetricType.REVISIT
  }
  return OpsAnalyticsMetricType.ACTIVATION
}

export function sanitizeOpsAnalyticsInput(input: unknown) {
  const source = toRecord(input)
  const now = new Date()
  const defaultStart = new Date(now.getTime() - 24 * 60 * 60 * 1000)

  return {
    cohortKey: sanitizeTextInput(source.cohortKey, 80) || "all-users",
    metricType: normalizeOpsAnalyticsMetricType(source.metricType),
    stage: sanitizeTextInput(source.stage, 20).toLowerCase() || "activated",
    windowStart: new Date(sanitizeTextInput(source.windowStart, 40) || defaultStart.toISOString()),
    windowEnd: new Date(sanitizeTextInput(source.windowEnd, 40) || now.toISOString()),
    activatedUsers: toInt(source.activatedUsers, 0, 0, 100000000),
    retainedUsers: toInt(source.retainedUsers, 0, 0, 100000000),
    revisitUsers: toInt(source.revisitUsers, 0, 0, 100000000),
    conversionUsers: toInt(source.conversionUsers, 0, 0, 100000000),
    experimentId: sanitizeTextInput(source.experimentId, 80),
    traceToken: sanitizeTextInput(source.traceToken, 120),
  }
}

export function buildOpsAnalyticsSeed(userId: string) {
  const now = new Date()
  const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  return [
    {
      userId,
      cohortKey: "new-users-w10",
      metricType: OpsAnalyticsMetricType.ACTIVATION,
      stage: "activated",
      windowStart: start,
      windowEnd: now,
      activatedUsers: 1200,
      retainedUsers: 420,
      revisitUsers: 320,
      conversionUsers: 190,
      traceToken: `seed-${Date.now()}-a`,
      metadata: {
        source: "preset",
        linkedExperiment: "growth-lab",
      },
    },
    {
      userId,
      cohortKey: "paid-users-w10",
      metricType: OpsAnalyticsMetricType.RETENTION,
      stage: "retained",
      windowStart: start,
      windowEnd: now,
      activatedUsers: 500,
      retainedUsers: 290,
      revisitUsers: 210,
      conversionUsers: 150,
      traceToken: `seed-${Date.now()}-b`,
      metadata: {
        source: "preset",
      },
    },
  ]
}

export function buildOpsFunnelSummary(
  snapshots: Array<{
    activatedUsers: number
    retainedUsers: number
    revisitUsers: number
    conversionUsers: number
  }>
) {
  const totals = snapshots.reduce(
    (acc, item) => {
      acc.activated += item.activatedUsers
      acc.retained += item.retainedUsers
      acc.revisit += item.revisitUsers
      acc.converted += item.conversionUsers
      return acc
    },
    { activated: 0, retained: 0, revisit: 0, converted: 0 }
  )

  const retentionRate =
    totals.activated === 0 ? 0 : Number(((totals.retained / totals.activated) * 100).toFixed(2))
  const revisitRate =
    totals.retained === 0 ? 0 : Number(((totals.revisit / totals.retained) * 100).toFixed(2))
  const conversionRate =
    totals.activated === 0 ? 0 : Number(((totals.converted / totals.activated) * 100).toFixed(2))

  return {
    ...totals,
    retentionRate,
    revisitRate,
    conversionRate,
  }
}

export function buildOpsCohortComparison(
  snapshots: Array<{
    cohortKey: string
    activatedUsers: number
    retainedUsers: number
    conversionUsers: number
  }>
) {
  const map = new Map<string, { activatedUsers: number; retainedUsers: number; conversionUsers: number }>()

  for (const item of snapshots) {
    const prev = map.get(item.cohortKey) || {
      activatedUsers: 0,
      retainedUsers: 0,
      conversionUsers: 0,
    }
    map.set(item.cohortKey, {
      activatedUsers: prev.activatedUsers + item.activatedUsers,
      retainedUsers: prev.retainedUsers + item.retainedUsers,
      conversionUsers: prev.conversionUsers + item.conversionUsers,
    })
  }

  return Array.from(map.entries()).map(([cohortKey, value]) => ({
    cohortKey,
    activatedUsers: value.activatedUsers,
    retainedUsers: value.retainedUsers,
    conversionUsers: value.conversionUsers,
    retentionRate:
      value.activatedUsers === 0
        ? 0
        : Number(((value.retainedUsers / value.activatedUsers) * 100).toFixed(2)),
    conversionRate:
      value.activatedUsers === 0
        ? 0
        : Number(((value.conversionUsers / value.activatedUsers) * 100).toFixed(2)),
  }))
}

export function resolveOpsFunnelConsistency(
  snapshots: Array<{ activatedUsers: number; retainedUsers: number; revisitUsers: number; conversionUsers: number }>
) {
  let inconsistentRows = 0
  for (const item of snapshots) {
    if (
      item.retainedUsers > item.activatedUsers ||
      item.revisitUsers > item.retainedUsers ||
      item.conversionUsers > item.activatedUsers
    ) {
      inconsistentRows += 1
    }
  }

  return {
    inconsistentRows,
    traceable: inconsistentRows === 0,
  }
}
