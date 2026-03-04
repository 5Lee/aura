import type { SlaMetricType } from "@prisma/client"

import { type SubscriptionPlanId, isSubscriptionPlanId } from "@/lib/subscription-plans"

export type SlaPolicy = {
  planId: SubscriptionPlanId
  targetAvailability: number
  maxErrorRate: number
  maxLatencyP95Ms: number
  reportWindowHours: number
}

export type SlaBreach = {
  metric: SlaMetricType
  threshold: number
  observed: number
  summary: string
}

export const PLAN_SLA_POLICY: Record<SubscriptionPlanId, SlaPolicy> = {
  free: {
    planId: "free",
    targetAvailability: 95,
    maxErrorRate: 5,
    maxLatencyP95Ms: 2600,
    reportWindowHours: 24,
  },
  pro: {
    planId: "pro",
    targetAvailability: 99,
    maxErrorRate: 2,
    maxLatencyP95Ms: 1600,
    reportWindowHours: 24,
  },
  team: {
    planId: "team",
    targetAvailability: 99.5,
    maxErrorRate: 1,
    maxLatencyP95Ms: 1200,
    reportWindowHours: 24,
  },
  enterprise: {
    planId: "enterprise",
    targetAvailability: 99.9,
    maxErrorRate: 0.5,
    maxLatencyP95Ms: 800,
    reportWindowHours: 24,
  },
}

function roundTo(value: number, precision = 2) {
  const factor = 10 ** precision
  return Math.round(value * factor) / factor
}

function computePercentile(values: number[], percentile: number) {
  if (values.length === 0) {
    return 0
  }
  const sorted = [...values].sort((a, b) => a - b)
  const rank = Math.min(sorted.length - 1, Math.max(0, Math.ceil((percentile / 100) * sorted.length) - 1))
  return Math.max(0, Math.round(sorted[rank]))
}

export function resolveSlaPolicy(planId: string) {
  if (isSubscriptionPlanId(planId)) {
    return PLAN_SLA_POLICY[planId]
  }
  return PLAN_SLA_POLICY.free
}

export function evaluateSlaWindow({
  policy,
  totalChecks,
  failedChecks,
  latenciesMs,
}: {
  policy: SlaPolicy
  totalChecks: number
  failedChecks: number
  latenciesMs: number[]
}) {
  const normalizedTotalChecks = Math.max(0, Math.floor(totalChecks))
  const normalizedFailedChecks = Math.max(0, Math.min(normalizedTotalChecks, Math.floor(failedChecks)))
  const availabilityRate =
    normalizedTotalChecks === 0
      ? 100
      : roundTo(((normalizedTotalChecks - normalizedFailedChecks) / normalizedTotalChecks) * 100)
  const errorRate = normalizedTotalChecks === 0 ? 0 : roundTo((normalizedFailedChecks / normalizedTotalChecks) * 100)
  const latencyP95Ms = computePercentile(
    latenciesMs.filter((value) => Number.isFinite(value) && value >= 0),
    95
  )

  const breaches: SlaBreach[] = []

  if (latencyP95Ms > policy.maxLatencyP95Ms) {
    breaches.push({
      metric: "LATENCY",
      threshold: policy.maxLatencyP95Ms,
      observed: latencyP95Ms,
      summary: `P95 延迟 ${latencyP95Ms}ms 超出阈值 ${policy.maxLatencyP95Ms}ms`,
    })
  }

  if (errorRate > policy.maxErrorRate) {
    breaches.push({
      metric: "ERROR_RATE",
      threshold: policy.maxErrorRate,
      observed: errorRate,
      summary: `错误率 ${errorRate}% 超出阈值 ${policy.maxErrorRate}%`,
    })
  }

  if (availabilityRate < policy.targetAvailability) {
    breaches.push({
      metric: "AVAILABILITY",
      threshold: policy.targetAvailability,
      observed: availabilityRate,
      summary: `可用性 ${availabilityRate}% 低于目标 ${policy.targetAvailability}%`,
    })
  }

  return {
    availabilityRate,
    errorRate,
    latencyP95Ms,
    totalChecks: normalizedTotalChecks,
    failedChecks: normalizedFailedChecks,
    breaches,
  }
}

export function resolveSlaAlertDelta({
  openAlerts,
  breaches,
}: {
  openAlerts: Array<{ id: string; metric: SlaMetricType }>
  breaches: SlaBreach[]
}) {
  const breachByMetric = new Map<SlaMetricType, SlaBreach>()
  for (const breach of breaches) {
    if (!breachByMetric.has(breach.metric)) {
      breachByMetric.set(breach.metric, breach)
    }
  }

  const openByMetric = new Map<SlaMetricType, { id: string; metric: SlaMetricType }>()
  for (const alert of openAlerts) {
    if (!openByMetric.has(alert.metric)) {
      openByMetric.set(alert.metric, alert)
    }
  }

  const createAlerts: SlaBreach[] = []
  const recoverAlertIds: string[] = []

  for (const [metric, breach] of breachByMetric.entries()) {
    if (!openByMetric.has(metric)) {
      createAlerts.push(breach)
    }
  }

  for (const [metric, alert] of openByMetric.entries()) {
    if (!breachByMetric.has(metric)) {
      recoverAlertIds.push(alert.id)
    }
  }

  return {
    createAlerts,
    recoverAlertIds,
  }
}

export type SlaFaultScenario = "latency_spike" | "error_burst" | "downtime_blip" | "recover"

export function normalizeSlaFaultScenario(value: unknown): SlaFaultScenario {
  if (value === "latency_spike") {
    return "latency_spike"
  }
  if (value === "error_burst") {
    return "error_burst"
  }
  if (value === "downtime_blip") {
    return "downtime_blip"
  }
  if (value === "recover") {
    return "recover"
  }
  return "latency_spike"
}

export function buildFaultInjectionSample(scenario: SlaFaultScenario) {
  if (scenario === "error_burst") {
    return {
      scenario,
      totalChecks: 120,
      failedChecks: 18,
      latenciesMs: [780, 830, 860, 920, 990, 1040, 1120, 1280, 1360, 1480],
      note: "模拟上游异常导致错误率激增。",
    }
  }

  if (scenario === "downtime_blip") {
    return {
      scenario,
      totalChecks: 120,
      failedChecks: 26,
      latenciesMs: [540, 620, 680, 740, 790, 860, 920, 980, 1040, 1100],
      note: "模拟瞬时可用性下降。",
    }
  }

  if (scenario === "recover") {
    return {
      scenario,
      totalChecks: 120,
      failedChecks: 0,
      latenciesMs: [220, 260, 280, 310, 340, 360, 390, 420, 450, 500],
      note: "模拟恢复后稳定窗口。",
    }
  }

  return {
    scenario,
    totalChecks: 120,
    failedChecks: 3,
    latenciesMs: [980, 1120, 1260, 1380, 1450, 1620, 1780, 1940, 2280, 2560],
    note: "模拟延迟突增窗口。",
  }
}
