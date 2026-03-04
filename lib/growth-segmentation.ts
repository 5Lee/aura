import { GrowthSegmentMatchMode, GrowthSegmentStatus } from "@prisma/client"

import { sanitizeMultilineTextInput, sanitizeTextInput } from "@/lib/security"

type GrowthAudienceSegmentPreset = {
  name: string
  key: string
  description: string
  matchMode: GrowthSegmentMatchMode
  ruleConfig: {
    rules: Array<{
      field: string
      operator: string
      value: string | number
    }>
    logic: GrowthSegmentMatchMode
  }
  estimatedUsers: number
}

export const DEFAULT_GROWTH_AUDIENCE_SEGMENTS: GrowthAudienceSegmentPreset[] = [
  {
    name: "高意向新用户",
    key: "high-intent-new",
    description: "近 7 天注册且有编辑行为的新用户",
    matchMode: GrowthSegmentMatchMode.ALL,
    ruleConfig: {
      logic: GrowthSegmentMatchMode.ALL,
      rules: [
        {
          field: "signupDays",
          operator: "lte",
          value: 7,
        },
        {
          field: "editCount",
          operator: "gte",
          value: 1,
        },
      ],
    },
    estimatedUsers: 180,
  },
  {
    name: "高流失风险用户",
    key: "churn-risk",
    description: "14 天未活跃且未创建新提示词的用户",
    matchMode: GrowthSegmentMatchMode.ALL,
    ruleConfig: {
      logic: GrowthSegmentMatchMode.ALL,
      rules: [
        {
          field: "inactiveDays",
          operator: "gte",
          value: 14,
        },
        {
          field: "newPromptCount",
          operator: "eq",
          value: 0,
        },
      ],
    },
    estimatedUsers: 120,
  },
]

export function buildGrowthAudienceSegmentSeed(userId: string) {
  return DEFAULT_GROWTH_AUDIENCE_SEGMENTS.map((item) => ({
    userId,
    name: item.name,
    key: item.key,
    description: item.description,
    version: 1,
    status: GrowthSegmentStatus.ACTIVE,
    matchMode: item.matchMode,
    ruleConfig: item.ruleConfig,
    estimatedUsers: item.estimatedUsers,
    lastMatchedAt: new Date(),
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

function sanitizeRules(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as Array<{
      field: string
      operator: string
      value: string | number
    }>
  }

  return value
    .map((item) => normalizeRecord(item))
    .map((item) => {
      const field = sanitizeTextInput(item.field, 60)
      const operator = sanitizeTextInput(item.operator, 30)
      const rawValue = item.value
      const value =
        typeof rawValue === "number"
          ? Number.isFinite(rawValue)
            ? rawValue
            : 0
          : sanitizeTextInput(rawValue, 120)

      return {
        field,
        operator,
        value,
      }
    })
    .filter((item) => item.field && item.operator)
    .slice(0, 20)
}

export function normalizeGrowthSegmentStatus(value: unknown) {
  const normalized = sanitizeTextInput(value, 20).toUpperCase()

  if (normalized === GrowthSegmentStatus.ACTIVE) {
    return GrowthSegmentStatus.ACTIVE
  }
  if (normalized === GrowthSegmentStatus.ARCHIVED) {
    return GrowthSegmentStatus.ARCHIVED
  }
  if (normalized === GrowthSegmentStatus.DRAFT) {
    return GrowthSegmentStatus.DRAFT
  }

  return GrowthSegmentStatus.DRAFT
}

export function normalizeGrowthSegmentMatchMode(value: unknown) {
  const normalized = sanitizeTextInput(value, 10).toUpperCase()

  if (normalized === GrowthSegmentMatchMode.ANY) {
    return GrowthSegmentMatchMode.ANY
  }
  if (normalized === GrowthSegmentMatchMode.ALL) {
    return GrowthSegmentMatchMode.ALL
  }

  return GrowthSegmentMatchMode.ALL
}

export function sanitizeGrowthAudienceSegmentInput(input: unknown, fallback = DEFAULT_GROWTH_AUDIENCE_SEGMENTS[0]) {
  const source = normalizeRecord(input)
  const rawRuleConfig = normalizeRecord(source.ruleConfig)

  const rules = sanitizeRules(rawRuleConfig.rules)
  const matchMode = normalizeGrowthSegmentMatchMode(source.matchMode || rawRuleConfig.logic)

  return {
    name: sanitizeTextInput(source.name, 80) || fallback.name,
    key: sanitizeTextInput(source.key, 80) || fallback.key,
    description: sanitizeMultilineTextInput(source.description, 500).trim() || fallback.description,
    status: normalizeGrowthSegmentStatus(source.status),
    matchMode,
    estimatedUsers: resolvePositiveInt(source.estimatedUsers, fallback.estimatedUsers, 0, 100000000),
    ruleConfig: {
      logic: matchMode,
      rules: rules.length > 0 ? rules : fallback.ruleConfig.rules,
    },
  }
}

export function resolveGrowthAudienceEstimate({
  estimatedUsers,
  rolloutPercent,
  excludedSegments,
}: {
  estimatedUsers: number
  rolloutPercent: number
  excludedSegments: number
}) {
  const safeUsers = Math.max(0, estimatedUsers)
  const safeRollout = Math.min(100, Math.max(0, rolloutPercent))
  const safeExcluded = Math.max(0, excludedSegments)

  const targetUsers = Math.floor((safeUsers * safeRollout) / 100)
  const finalUsers = Math.max(0, targetUsers - safeExcluded)

  return {
    targetUsers,
    finalUsers,
    rolloutPercent: safeRollout,
  }
}

export function sanitizeExcludedSegmentKeys(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as string[]
  }

  return value
    .map((item) => sanitizeTextInput(item, 80))
    .filter(Boolean)
    .slice(0, 30)
}
