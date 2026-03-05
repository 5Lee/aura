import { OpsNotificationStatus, OpsTaskChannel } from "@prisma/client"

import { sanitizeJsonValue, sanitizeMultilineTextInput, sanitizeTextInput } from "@/lib/security"

export const DEFAULT_NOTIFICATION_RULES = [
  {
    name: "增长异常广播",
    channels: [OpsTaskChannel.IN_APP, OpsTaskChannel.EMAIL],
    frequencyCapPerHour: 3,
    dedupeWindowMinutes: 30,
  },
  {
    name: "发布风险通知",
    channels: [OpsTaskChannel.WEBHOOK, OpsTaskChannel.IN_APP],
    frequencyCapPerHour: 6,
    dedupeWindowMinutes: 15,
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

export function normalizeNotificationChannels(value: unknown) {
  if (!Array.isArray(value)) {
    return [OpsTaskChannel.IN_APP]
  }

  const channels = value
    .map((item) => sanitizeTextInput(item, 20).toUpperCase())
    .map((item) => {
      if (item === OpsTaskChannel.EMAIL) {
        return OpsTaskChannel.EMAIL
      }
      if (item === OpsTaskChannel.WEBHOOK) {
        return OpsTaskChannel.WEBHOOK
      }
      return OpsTaskChannel.IN_APP
    })

  return Array.from(new Set(channels))
}

export function sanitizeNotificationRuleInput(input: unknown, fallback = DEFAULT_NOTIFICATION_RULES[0]) {
  const source = toRecord(input)
  const channels = normalizeNotificationChannels(source.channels)

  return {
    id: sanitizeTextInput(source.id, 80),
    name: sanitizeTextInput(source.name, 80) || fallback.name,
    enabled: source.enabled !== false,
    channels: channels.length === 0 ? fallback.channels : channels,
    quietWindowStart: toInt(source.quietWindowStart, 23, 0, 23),
    quietWindowEnd: toInt(source.quietWindowEnd, 8, 0, 23),
    frequencyCapPerHour: toInt(source.frequencyCapPerHour, fallback.frequencyCapPerHour, 1, 60),
    dedupeWindowMinutes: toInt(source.dedupeWindowMinutes, fallback.dedupeWindowMinutes, 1, 720),
    webhookUrl: sanitizeTextInput(source.webhookUrl, 300),
    note: sanitizeMultilineTextInput(source.note, 300).trim(),
  }
}

export function buildNotificationRuleSeed(userId: string) {
  return DEFAULT_NOTIFICATION_RULES.map((item) => ({
    userId,
    name: item.name,
    enabled: true,
    channels: item.channels,
    frequencyCapPerHour: item.frequencyCapPerHour,
    dedupeWindowMinutes: item.dedupeWindowMinutes,
    quietWindowStart: 23,
    quietWindowEnd: 8,
    metadata: {
      source: "preset",
    },
  }))
}

export function resolveNotificationWindowSuppressed({
  now,
  quietWindowStart,
  quietWindowEnd,
}: {
  now: Date
  quietWindowStart: number
  quietWindowEnd: number
}) {
  const hour = now.getHours()
  if (quietWindowStart === quietWindowEnd) {
    return false
  }

  if (quietWindowStart < quietWindowEnd) {
    return hour >= quietWindowStart && hour < quietWindowEnd
  }

  return hour >= quietWindowStart || hour < quietWindowEnd
}

export function resolveNotificationDedupKey({
  ruleId,
  channel,
  payload,
}: {
  ruleId: string
  channel: OpsTaskChannel
  payload: Record<string, unknown>
}) {
  const serialized = JSON.stringify(payload || {})
  const tail = Buffer.from(serialized).toString("base64").slice(0, 16)
  return `${ruleId}:${channel}:${tail}`
}

export function resolveNotificationStatus({
  suppressed,
  deduped,
  forceFail,
}: {
  suppressed: boolean
  deduped: boolean
  forceFail: boolean
}) {
  if (suppressed) {
    return OpsNotificationStatus.SUPPRESSED
  }
  if (deduped) {
    return OpsNotificationStatus.DEDUPED
  }
  if (forceFail) {
    return OpsNotificationStatus.FAILED
  }
  return OpsNotificationStatus.SENT
}

export function sanitizeNotificationPayload(input: unknown) {
  const payload = sanitizeJsonValue(input, {
    maxDepth: 6,
    maxArrayLength: 40,
    maxKeysPerObject: 40,
    maxStringLength: 800,
  })

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return {}
  }

  return payload as Record<string, unknown>
}
