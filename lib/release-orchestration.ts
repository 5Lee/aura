import { ReleaseStageStatus } from "@prisma/client"

import { sanitizeJsonValue, sanitizeMultilineTextInput, sanitizeTextInput } from "@/lib/security"

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

export const DEFAULT_RELEASE_REHEARSAL_TEMPLATE = {
  name: "Phase6 灰度演练",
  canaryTrafficPercent: 10,
  rollbackThresholdPercent: 5,
  checklist: ["回归测试通过", "质量闸门通过", "灰度监控可用", "回滚脚本已验证"],
}

export function normalizeReleaseStageStatus(value: unknown) {
  const normalized = sanitizeTextInput(value, 20).toUpperCase()
  if (normalized === ReleaseStageStatus.READY) {
    return ReleaseStageStatus.READY
  }
  if (normalized === ReleaseStageStatus.ROLLING) {
    return ReleaseStageStatus.ROLLING
  }
  if (normalized === ReleaseStageStatus.ROLLED_BACK) {
    return ReleaseStageStatus.ROLLED_BACK
  }
  if (normalized === ReleaseStageStatus.COMPLETED) {
    return ReleaseStageStatus.COMPLETED
  }
  if (normalized === ReleaseStageStatus.FAILED) {
    return ReleaseStageStatus.FAILED
  }
  return ReleaseStageStatus.DRAFT
}

export function sanitizeReleasePlanInput(input: unknown) {
  const source = toRecord(input)
  const now = new Date()
  const defaultEnd = new Date(now.getTime() + 3 * 60 * 60 * 1000)

  return {
    id: sanitizeTextInput(source.id, 80),
    name: sanitizeTextInput(source.name, 80) || DEFAULT_RELEASE_REHEARSAL_TEMPLATE.name,
    status: normalizeReleaseStageStatus(source.status),
    releaseWindowStart: new Date(
      sanitizeTextInput(source.releaseWindowStart, 40) || now.toISOString()
    ),
    releaseWindowEnd: new Date(sanitizeTextInput(source.releaseWindowEnd, 40) || defaultEnd.toISOString()),
    canaryTrafficPercent: toInt(
      source.canaryTrafficPercent,
      DEFAULT_RELEASE_REHEARSAL_TEMPLATE.canaryTrafficPercent,
      1,
      100
    ),
    rollbackThresholdPercent: toInt(
      source.rollbackThresholdPercent,
      DEFAULT_RELEASE_REHEARSAL_TEMPLATE.rollbackThresholdPercent,
      1,
      100
    ),
    checklist:
      sanitizeJsonValue(source.checklist, {
        maxDepth: 4,
        maxArrayLength: 40,
        maxKeysPerObject: 20,
        maxStringLength: 400,
      }) || DEFAULT_RELEASE_REHEARSAL_TEMPLATE.checklist,
    rehearsalScript: sanitizeMultilineTextInput(source.rehearsalScript, 2000).trim(),
    impactSummary: sanitizeMultilineTextInput(source.impactSummary, 2000).trim(),
  }
}

export function buildReleasePlanSeed(userId: string) {
  const now = new Date()
  const endAt = new Date(now.getTime() + 2 * 60 * 60 * 1000)
  return {
    userId,
    name: DEFAULT_RELEASE_REHEARSAL_TEMPLATE.name,
    status: ReleaseStageStatus.READY,
    releaseWindowStart: now,
    releaseWindowEnd: endAt,
    canaryTrafficPercent: DEFAULT_RELEASE_REHEARSAL_TEMPLATE.canaryTrafficPercent,
    rollbackThresholdPercent: DEFAULT_RELEASE_REHEARSAL_TEMPLATE.rollbackThresholdPercent,
    checklist: DEFAULT_RELEASE_REHEARSAL_TEMPLATE.checklist,
    rehearsalScript: "npm run test && npm run build",
    impactSummary: "覆盖增长运营与生态协同链路。",
  }
}

export function resolveRollbackImpact({
  canaryTrafficPercent,
  estimatedUsers,
}: {
  canaryTrafficPercent: number
  estimatedUsers: number
}) {
  const impactScore = Number(((canaryTrafficPercent / 100) * Math.max(1, estimatedUsers)).toFixed(2))
  return {
    impactScore,
    recommendation:
      impactScore > 200
        ? "建议立即回滚并暂停灰度放量"
        : "可继续观察，准备一键回滚",
  }
}
