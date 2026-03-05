import { PlaybookTemplateStatus } from "@prisma/client"

import { sanitizeJsonValue, sanitizeMultilineTextInput, sanitizeTextInput } from "@/lib/security"

export const DEFAULT_PLAYBOOK_TEMPLATES = [
  {
    name: "新用户激活追踪",
    summary: "覆盖欢迎触达、首周激活提醒与漏斗复盘。",
    tags: ["activation", "onboarding"],
  },
  {
    name: "故障降级通知",
    summary: "当核心指标异常时执行通知、回滚与复盘动作。",
    tags: ["incident", "reliability"],
  },
]

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

export function normalizePlaybookStatus(value: unknown) {
  const normalized = sanitizeTextInput(value, 20).toUpperCase()
  if (normalized === PlaybookTemplateStatus.PUBLISHED) {
    return PlaybookTemplateStatus.PUBLISHED
  }
  if (normalized === PlaybookTemplateStatus.ARCHIVED) {
    return PlaybookTemplateStatus.ARCHIVED
  }
  return PlaybookTemplateStatus.DRAFT
}

export function sanitizePlaybookInput(input: unknown, fallback = DEFAULT_PLAYBOOK_TEMPLATES[0]) {
  const source = toRecord(input)
  const tags = Array.isArray(source.tags)
    ? source.tags
        .map((item) => sanitizeTextInput(item, 24).toLowerCase())
        .filter(Boolean)
        .slice(0, 8)
    : fallback.tags

  return {
    id: sanitizeTextInput(source.id, 80),
    name: sanitizeTextInput(source.name, 80) || fallback.name,
    summary: sanitizeMultilineTextInput(source.summary, 1000).trim() || fallback.summary,
    status: normalizePlaybookStatus(source.status),
    tags,
    version: toInt(source.version, 1, 1, 999),
    rating: Math.max(0, Math.min(5, Number(source.rating || 0))),
    content:
      sanitizeJsonValue(source.content, {
        maxDepth: 8,
        maxArrayLength: 80,
        maxKeysPerObject: 60,
        maxStringLength: 800,
      }) || {
        steps: ["定义触发条件", "执行任务", "复盘"],
      },
    compatibilityNotes: sanitizeMultilineTextInput(source.compatibilityNotes, 500).trim(),
    rollbackTargetVersion: toInt(source.rollbackTargetVersion, 0, 0, 999),
  }
}

export function buildPlaybookSeed(userId: string) {
  return DEFAULT_PLAYBOOK_TEMPLATES.map((item) => ({
    userId,
    name: item.name,
    summary: item.summary,
    status: PlaybookTemplateStatus.PUBLISHED,
    tags: item.tags,
    version: 1,
    ratingScore: 4.6,
    ratingCount: 12,
    content: {
      steps: [
        { title: "准备数据", owner: "ops" },
        { title: "执行任务中心脚本", owner: "ops-bot" },
        { title: "汇总结果", owner: "analyst" },
      ],
    },
    compatibilityNotes: "兼容 v1 任务模板",
  }))
}

export function resolvePlaybookRating({
  currentScore,
  currentCount,
  nextRating,
}: {
  currentScore: number
  currentCount: number
  nextRating: number
}) {
  const safeRating = Math.max(0, Math.min(5, Number.isFinite(nextRating) ? nextRating : 0))
  const safeCount = Math.max(0, currentCount)
  const total = currentScore * safeCount + safeRating
  const count = safeCount + 1

  return {
    ratingScore: Number((total / count).toFixed(2)),
    ratingCount: count,
  }
}

export function resolvePlaybookCompatibility({
  templateVersion,
  targetVersion,
}: {
  templateVersion: number
  targetVersion: number
}) {
  if (targetVersion <= 0) {
    return {
      compatible: true,
      reason: "未指定回滚版本",
    }
  }

  const diff = Math.abs(templateVersion - targetVersion)
  if (diff > 2) {
    return {
      compatible: false,
      reason: "模板升级跨度过大，建议先执行回滚兼容检查",
    }
  }

  return {
    compatible: true,
    reason: "模板升级兼容",
  }
}
