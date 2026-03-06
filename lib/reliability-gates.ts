import {
  ReliabilityGateSeverity,
  ReliabilityGateStatus,
  ReliabilityGateType,
} from "@prisma/client"

import { sanitizeJsonValue, sanitizeMultilineTextInput, sanitizeTextInput } from "@/lib/security"

export const DEFAULT_RELIABILITY_GATE_POLICY = {
  functional: {
    maxCritical: 0,
    maxHigh: 1,
  },
  performance: {
    maxP95Ms: 900,
  },
  security: {
    maxCritical: 0,
    maxHigh: 0,
  },
}

function toRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {} as Record<string, unknown>
  }
  return value as Record<string, unknown>
}

export function normalizeReliabilityGateType(value: unknown) {
  const normalized = sanitizeTextInput(value, 20).toUpperCase()
  if (normalized === ReliabilityGateType.PERFORMANCE) {
    return ReliabilityGateType.PERFORMANCE
  }
  if (normalized === ReliabilityGateType.SECURITY) {
    return ReliabilityGateType.SECURITY
  }
  return ReliabilityGateType.FUNCTIONAL
}

export function normalizeReliabilityGateSeverity(value: unknown) {
  const normalized = sanitizeTextInput(value, 20).toUpperCase()
  if (normalized === ReliabilityGateSeverity.LOW) {
    return ReliabilityGateSeverity.LOW
  }
  if (normalized === ReliabilityGateSeverity.HIGH) {
    return ReliabilityGateSeverity.HIGH
  }
  if (normalized === ReliabilityGateSeverity.CRITICAL) {
    return ReliabilityGateSeverity.CRITICAL
  }
  return ReliabilityGateSeverity.MEDIUM
}

export function sanitizeReliabilityGateInput(input: unknown) {
  const source = toRecord(input)

  return {
    releaseKey: sanitizeTextInput(source.releaseKey, 80) || "release-preview",
    gateType: normalizeReliabilityGateType(source.gateType),
    severity: normalizeReliabilityGateSeverity(source.severity),
    branchName: sanitizeTextInput(source.branchName, 120) || "main",
    commitSha: sanitizeTextInput(source.commitSha, 120),
    environment: sanitizeTextInput(source.environment, 40) || "staging",
    findings:
      sanitizeJsonValue(source.findings, {
        maxDepth: 8,
        maxArrayLength: 120,
        maxKeysPerObject: 100,
        maxStringLength: 1000,
      }) || [],
    blockReason: sanitizeMultilineTextInput(source.blockReason, 1000).trim(),
  }
}

export function resolveReliabilityGateStatus({
  gateType,
  severity,
  findings,
  blockReason,
}: {
  gateType: ReliabilityGateType
  severity: ReliabilityGateSeverity
  findings: unknown
  blockReason: string
}) {
  const findingList = Array.isArray(findings) ? findings : []
  const gatePolicy =
    gateType === ReliabilityGateType.SECURITY
      ? DEFAULT_RELIABILITY_GATE_POLICY.security
      : gateType === ReliabilityGateType.FUNCTIONAL
        ? DEFAULT_RELIABILITY_GATE_POLICY.functional
        : null
  const criticalCount = findingList.filter((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return false
    }
    const level = sanitizeTextInput((item as Record<string, unknown>).severity, 20).toLowerCase()
    return level === "critical"
  }).length

  const highCount = findingList.filter((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return false
    }
    const level = sanitizeTextInput((item as Record<string, unknown>).severity, 20).toLowerCase()
    return level === "high"
  }).length

  if (blockReason || criticalCount > (gatePolicy?.maxCritical ?? 0)) {
    return ReliabilityGateStatus.BLOCKED
  }

  if (
    severity === ReliabilityGateSeverity.CRITICAL ||
    (gatePolicy !== null && highCount > gatePolicy.maxHigh)
  ) {
    return ReliabilityGateStatus.FAIL
  }

  if (gateType === ReliabilityGateType.PERFORMANCE && highCount > 0) {
    return ReliabilityGateStatus.WARN
  }

  return ReliabilityGateStatus.PASS
}

export function buildReliabilityGateSummary(
  rows: Array<{ status: ReliabilityGateStatus; gateType: ReliabilityGateType }>
) {
  return rows.reduce(
    (acc, item) => {
      acc.total += 1
      if (item.status === ReliabilityGateStatus.PASS) {
        acc.pass += 1
      }
      if (item.status === ReliabilityGateStatus.WARN) {
        acc.warn += 1
      }
      if (item.status === ReliabilityGateStatus.FAIL) {
        acc.fail += 1
      }
      if (item.status === ReliabilityGateStatus.BLOCKED) {
        acc.blocked += 1
      }
      acc.byType[item.gateType] = (acc.byType[item.gateType] || 0) + 1
      return acc
    },
    {
      total: 0,
      pass: 0,
      warn: 0,
      fail: 0,
      blocked: 0,
      byType: {} as Record<string, number>,
    }
  )
}
