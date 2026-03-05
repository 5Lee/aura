import { SelfHealSuggestionStatus } from "@prisma/client"

import { sanitizeMultilineTextInput, sanitizeTextInput } from "@/lib/security"

export const DEFAULT_SELF_HEAL_PATTERNS = [
  {
    name: "配置缺失修复",
    defectSignature: "missing-config",
    fixTemplate: "补齐缺失配置并重新触发任务。",
    regressionScript: "npm run test -- __tests__/phase6-week24-reliability-delivery-closure.test.js",
  },
  {
    name: "通知重试失败修复",
    defectSignature: "notification-retry-failed",
    fixTemplate: "检查频控参数并降低并发后重试。",
    regressionScript: "npm run test -- __tests__/phase6-week23-ops-automation-notify-analytics-playbook.test.js",
  },
]

function toRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {} as Record<string, unknown>
  }
  return value as Record<string, unknown>
}

function toFloat(value: unknown, fallback: number, min: number, max: number) {
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

export function normalizeSelfHealSuggestionStatus(value: unknown) {
  const normalized = sanitizeTextInput(value, 20).toUpperCase()
  if (normalized === SelfHealSuggestionStatus.APPLIED) {
    return SelfHealSuggestionStatus.APPLIED
  }
  if (normalized === SelfHealSuggestionStatus.DISMISSED) {
    return SelfHealSuggestionStatus.DISMISSED
  }
  return SelfHealSuggestionStatus.OPEN
}

export function sanitizeSelfHealPatternInput(input: unknown, fallback = DEFAULT_SELF_HEAL_PATTERNS[0]) {
  const source = toRecord(input)

  return {
    id: sanitizeTextInput(source.id, 80),
    name: sanitizeTextInput(source.name, 80) || fallback.name,
    defectSignature: sanitizeTextInput(source.defectSignature, 120) || fallback.defectSignature,
    fixTemplate: sanitizeMultilineTextInput(source.fixTemplate, 1200).trim() || fallback.fixTemplate,
    regressionScript:
      sanitizeMultilineTextInput(source.regressionScript, 1200).trim() || fallback.regressionScript,
    confidenceScore: toFloat(source.confidenceScore, 0.75, 0.1, 1),
    enabled: source.enabled !== false,
  }
}

export function buildSelfHealPatternSeed(userId: string) {
  return DEFAULT_SELF_HEAL_PATTERNS.map((item) => ({
    userId,
    name: item.name,
    defectSignature: item.defectSignature,
    fixTemplate: item.fixTemplate,
    regressionScript: item.regressionScript,
    confidenceScore: 0.78,
    successRate: 0.65,
    enabled: true,
    metadata: {
      source: "preset",
    },
  }))
}

export function resolveSelfHealSuggestion({
  pattern,
  defectReference,
}: {
  pattern: {
    id: string
    name: string
    defectSignature: string
    fixTemplate: string
    confidenceScore: number
  }
  defectReference: string
}) {
  const suggestion = `${pattern.fixTemplate}\n\n建议先在预发环境执行并人工确认。`

  return {
    patternId: pattern.id,
    defectReference,
    suggestion,
    patchPreview: `# ${pattern.name}\n- signature: ${pattern.defectSignature}\n- reference: ${defectReference}`,
    status: SelfHealSuggestionStatus.OPEN,
    confidence: pattern.confidenceScore,
  }
}

export function resolveSelfHealEfficiency(
  runs: Array<{ status: SelfHealSuggestionStatus; createdAt: Date; appliedAt: Date | null }>
) {
  const applied = runs.filter((item) => item.status === SelfHealSuggestionStatus.APPLIED)
  const averageMins =
    applied.length === 0
      ? 0
      : Number(
          (
            applied.reduce((acc, item) => {
              if (!item.appliedAt) {
                return acc
              }
              return acc + (item.appliedAt.getTime() - item.createdAt.getTime()) / 60000
            }, 0) / applied.length
          ).toFixed(1)
        )

  return {
    totalRuns: runs.length,
    appliedRuns: applied.length,
    improvePercent: runs.length === 0 ? 0 : Number(((applied.length / runs.length) * 100).toFixed(2)),
    averageFixMinutes: averageMins,
  }
}
