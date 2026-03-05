import { OpsTaskChannel, OpsTaskStatus } from "@prisma/client"

import { sanitizeJsonValue, sanitizeMultilineTextInput, sanitizeTextInput } from "@/lib/security"

export type OpsTaskTemplatePreset = {
  name: string
  description: string
  scheduleCron: string
  retryLimit: number
  defaultChannel: OpsTaskChannel
}

export const DEFAULT_OPS_TASK_TEMPLATES: OpsTaskTemplatePreset[] = [
  {
    name: "增长日报分发",
    description: "每天汇总核心增长指标并同步到运营群。",
    scheduleCron: "0 9 * * *",
    retryLimit: 2,
    defaultChannel: OpsTaskChannel.IN_APP,
  },
  {
    name: "高风险告警升级",
    description: "当告警等级为高风险时自动升级并通知值班人员。",
    scheduleCron: "*/30 * * * *",
    retryLimit: 3,
    defaultChannel: OpsTaskChannel.EMAIL,
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

export function normalizeOpsTaskStatus(value: unknown) {
  const normalized = sanitizeTextInput(value, 24).toUpperCase()
  if (normalized === OpsTaskStatus.DRAFT) {
    return OpsTaskStatus.DRAFT
  }
  if (normalized === OpsTaskStatus.SCHEDULED) {
    return OpsTaskStatus.SCHEDULED
  }
  if (normalized === OpsTaskStatus.RUNNING) {
    return OpsTaskStatus.RUNNING
  }
  if (normalized === OpsTaskStatus.SUCCEEDED) {
    return OpsTaskStatus.SUCCEEDED
  }
  if (normalized === OpsTaskStatus.FAILED) {
    return OpsTaskStatus.FAILED
  }
  if (normalized === OpsTaskStatus.PAUSED) {
    return OpsTaskStatus.PAUSED
  }
  return OpsTaskStatus.DRAFT
}

export function normalizeOpsTaskChannel(value: unknown) {
  const normalized = sanitizeTextInput(value, 20).toUpperCase()
  if (normalized === OpsTaskChannel.EMAIL) {
    return OpsTaskChannel.EMAIL
  }
  if (normalized === OpsTaskChannel.WEBHOOK) {
    return OpsTaskChannel.WEBHOOK
  }
  return OpsTaskChannel.IN_APP
}

export function sanitizeOpsTaskTemplateInput(input: unknown, fallback = DEFAULT_OPS_TASK_TEMPLATES[0]) {
  const source = toRecord(input)

  return {
    id: sanitizeTextInput(source.id, 80),
    name: sanitizeTextInput(source.name, 80) || fallback.name,
    description: sanitizeMultilineTextInput(source.description, 2000).trim() || fallback.description,
    status: normalizeOpsTaskStatus(source.status),
    scheduleCron: sanitizeTextInput(source.scheduleCron, 120) || fallback.scheduleCron,
    timezone: sanitizeTextInput(source.timezone, 60) || "Asia/Shanghai",
    retryLimit: toInt(source.retryLimit, fallback.retryLimit, 0, 10),
    failAlertEnabled: source.failAlertEnabled !== false,
    defaultChannel: normalizeOpsTaskChannel(source.defaultChannel || fallback.defaultChannel),
    idempotencyWindowMinutes: toInt(source.idempotencyWindowMinutes, 30, 1, 720),
    outputTrackingEnabled: source.outputTrackingEnabled !== false,
    metadata:
      (sanitizeJsonValue(source.metadata, {
        maxDepth: 6,
        maxArrayLength: 40,
        maxKeysPerObject: 30,
        maxStringLength: 600,
      }) as Record<string, unknown> | undefined) || undefined,
  }
}

export function buildOpsTaskTemplateSeed(userId: string) {
  return DEFAULT_OPS_TASK_TEMPLATES.map((item) => ({
    userId,
    name: item.name,
    description: item.description,
    status: OpsTaskStatus.SCHEDULED,
    scheduleCron: item.scheduleCron,
    retryLimit: item.retryLimit,
    defaultChannel: item.defaultChannel,
    failAlertEnabled: true,
    idempotencyWindowMinutes: 30,
    outputTrackingEnabled: true,
    metadata: {
      source: "preset",
      dedupeScope: "template+payload",
    },
  }))
}

export function resolveOpsTaskReplayToken(templateId: string, replayToken: unknown) {
  const normalized = sanitizeTextInput(replayToken, 120)
  if (normalized) {
    return normalized
  }
  return `${templateId}-${Date.now()}`
}

export function simulateOpsTaskExecution({
  template,
  payload,
}: {
  template: {
    id: string
    name: string
    retryLimit: number
    defaultChannel: OpsTaskChannel
  }
  payload: Record<string, unknown>
}) {
  const payloadSize = JSON.stringify(payload || {}).length
  const attempts = Math.max(1, Math.min(1 + Math.floor(payloadSize / 280), template.retryLimit + 1))

  const failRequested = payload.forceFail === true
  const status = failRequested ? OpsTaskStatus.FAILED : OpsTaskStatus.SUCCEEDED

  return {
    status,
    attempts,
    alertSent: failRequested,
    outputSummary: failRequested
      ? `任务 ${template.name} 执行失败，已触发告警。`
      : `任务 ${template.name} 执行完成，已产出运营结果。`,
    outputPayload: {
      channel: template.defaultChannel,
      processedAt: new Date().toISOString(),
      payloadSize,
      idempotent: true,
    },
  }
}
