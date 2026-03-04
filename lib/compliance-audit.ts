import { AuditRiskLevel, Prisma, type PromptAuditLog } from "@prisma/client"
import { createHash } from "node:crypto"

import { prisma } from "@/lib/db"
import { sanitizeJsonValue, sanitizeTextInput } from "@/lib/security"

export const DEFAULT_AUDIT_RETENTION_DAYS = 365
export const AUDIT_RETENTION_MIN_DAYS = 30
export const AUDIT_RETENTION_MAX_DAYS = 3650

const SENSITIVE_ACTION_PATTERNS = [
  /delete/i,
  /rollback/i,
  /publish/i,
  /billing/i,
  /subscription/i,
  /member/i,
  /sso/i,
  /permission/i,
  /archive/i,
]

export function isSensitiveAuditAction(action: string) {
  return SENSITIVE_ACTION_PATTERNS.some((pattern) => pattern.test(action))
}

function normalizeRiskLevel(value: string) {
  const normalized = sanitizeTextInput(value, 16).toUpperCase()
  if (normalized === AuditRiskLevel.CRITICAL) {
    return AuditRiskLevel.CRITICAL
  }
  if (normalized === AuditRiskLevel.HIGH) {
    return AuditRiskLevel.HIGH
  }
  if (normalized === AuditRiskLevel.MEDIUM) {
    return AuditRiskLevel.MEDIUM
  }
  return AuditRiskLevel.LOW
}

export function resolveAuditRiskLevel({
  action,
  status,
  requestedRiskLevel,
}: {
  action: string
  status: string
  requestedRiskLevel?: string
}) {
  const explicitRisk = requestedRiskLevel ? normalizeRiskLevel(requestedRiskLevel) : null
  if (explicitRisk) {
    return explicitRisk
  }

  const normalizedStatus = sanitizeTextInput(status, 20).toLowerCase()
  if (normalizedStatus === "failure") {
    return isSensitiveAuditAction(action) ? AuditRiskLevel.HIGH : AuditRiskLevel.MEDIUM
  }

  if (isSensitiveAuditAction(action)) {
    return AuditRiskLevel.MEDIUM
  }

  return AuditRiskLevel.LOW
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value)
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`
  }

  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
    a.localeCompare(b)
  )
  return `{${entries
    .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`)
    .join(",")}}`
}

function hashText(value: string) {
  return createHash("sha256").update(value).digest("hex")
}

export function hashIpAddress(raw: string) {
  const normalized = sanitizeTextInput(raw, 200)
  if (!normalized) {
    return ""
  }
  return hashText(`ip:${normalized}`)
}

export function extractRequestAuditContext(request?: Request | null) {
  if (!request) {
    return {
      requestId: "",
      ipHash: "",
      userAgent: "",
    }
  }

  const requestId =
    sanitizeTextInput(request.headers.get("x-request-id"), 120) ||
    sanitizeTextInput(request.headers.get("x-correlation-id"), 120) ||
    ""

  const forwardedFor = sanitizeTextInput(request.headers.get("x-forwarded-for"), 260)
  const realIp = sanitizeTextInput(request.headers.get("x-real-ip"), 120)
  const remoteIp = forwardedFor.split(",")[0]?.trim() || realIp

  return {
    requestId,
    ipHash: remoteIp ? hashIpAddress(remoteIp) : "",
    userAgent: sanitizeTextInput(request.headers.get("user-agent"), 240),
  }
}

export async function getOrCreateAuditRetentionPolicy(userId: string) {
  return prisma.auditRetentionPolicy.upsert({
    where: {
      userId,
    },
    create: {
      userId,
      retentionDays: DEFAULT_AUDIT_RETENTION_DAYS,
    },
    update: {},
  })
}

export function resolveRetentionDays(input: unknown, fallback: number) {
  const parsed = Number(input)
  if (!Number.isFinite(parsed)) {
    return fallback
  }

  const rounded = Math.floor(parsed)
  if (rounded < AUDIT_RETENTION_MIN_DAYS) {
    return AUDIT_RETENTION_MIN_DAYS
  }

  if (rounded > AUDIT_RETENTION_MAX_DAYS) {
    return AUDIT_RETENTION_MAX_DAYS
  }

  return rounded
}

export function resolveRetentionUntil(retentionDays: number, now = new Date()) {
  const ms = retentionDays * 24 * 60 * 60 * 1000
  return new Date(now.getTime() + ms)
}

export function buildAuditEntryHash(payload: Record<string, unknown>) {
  return hashText(stableStringify(payload))
}

export async function verifyAuditHashChain(logs: Array<
  Pick<PromptAuditLog, "id" | "action" | "status" | "resource" | "promptId" | "actorId" | "metadata" | "createdAt" | "previousHash" | "entryHash">
>) {
  const brokenEntries: Array<{ id: string; reason: string }> = []
  let expectedPreviousHash = ""

  for (const log of logs) {
    const payload = {
      action: log.action,
      status: log.status,
      resource: log.resource,
      promptId: log.promptId || "",
      actorId: log.actorId || "",
      metadata: log.metadata || null,
      createdAt: log.createdAt.toISOString(),
      previousHash: log.previousHash || "",
    }

    const computedHash = buildAuditEntryHash(payload)
    if (!log.entryHash) {
      brokenEntries.push({ id: log.id, reason: "missing_entry_hash" })
    } else if (log.entryHash !== computedHash) {
      brokenEntries.push({ id: log.id, reason: "entry_hash_mismatch" })
    }

    if ((log.previousHash || "") !== expectedPreviousHash) {
      brokenEntries.push({ id: log.id, reason: "previous_hash_mismatch" })
    }

    expectedPreviousHash = log.entryHash || ""
  }

  return {
    valid: brokenEntries.length === 0,
    brokenEntries,
    verifiedCount: logs.length,
  }
}

export function exportAuditLogsAsCsv(
  logs: Array<
    Pick<PromptAuditLog, "id" | "action" | "resource" | "status" | "riskLevel" | "actorId" | "promptId" | "requestId" | "ipHash" | "entryHash" | "previousHash" | "createdAt"> & {
      actor?: { name: string | null; email: string } | null
      prompt?: { title: string } | null
    }
  >
) {
  const header = [
    "id",
    "createdAt",
    "action",
    "resource",
    "status",
    "riskLevel",
    "actorId",
    "actorEmail",
    "actorName",
    "promptId",
    "promptTitle",
    "requestId",
    "ipHash",
    "previousHash",
    "entryHash",
  ]

  const rows = logs.map((log) => [
    log.id,
    log.createdAt.toISOString(),
    log.action,
    log.resource,
    log.status,
    log.riskLevel,
    log.actorId || "",
    log.actor?.email || "",
    log.actor?.name || "",
    log.promptId || "",
    log.prompt?.title || "",
    log.requestId || "",
    log.ipHash || "",
    log.previousHash || "",
    log.entryHash || "",
  ])

  return [header, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n")
}

async function upsertAuditAnomaly({
  userId,
  promptId,
  type,
  severity,
  summary,
  matchedRule,
  metadata,
}: {
  userId: string
  promptId?: string | null
  type: string
  severity: AuditRiskLevel
  summary: string
  matchedRule: string
  metadata?: Record<string, unknown>
}) {
  const open = await prisma.auditAnomaly.findFirst({
    where: {
      userId,
      promptId: promptId || null,
      type,
      status: "OPEN",
    },
    orderBy: [{ updatedAt: "desc" }],
  })

  if (open) {
    return prisma.auditAnomaly.update({
      where: {
        id: open.id,
      },
      data: {
        severity,
        summary,
        matchedRule,
        occurrences: open.occurrences + 1,
        lastSeenAt: new Date(),
        metadata:
          (metadata as Prisma.InputJsonValue | undefined) ||
          (open.metadata as Prisma.InputJsonValue | undefined) ||
          undefined,
      },
    })
  }

  return prisma.auditAnomaly.create({
    data: {
      userId,
      promptId: promptId || null,
      type,
      severity,
      summary,
      matchedRule,
      metadata: (metadata as Prisma.InputJsonValue | undefined) || undefined,
      status: "OPEN",
    },
  })
}

export async function runAuditAnomalyRules({
  actorId,
  action,
  status,
  ipHash,
  promptId,
}: {
  actorId?: string | null
  action: string
  status: string
  ipHash?: string
  promptId?: string | null
}) {
  if (!actorId) {
    return
  }

  const policy = await getOrCreateAuditRetentionPolicy(actorId)
  const now = new Date()

  if (sanitizeTextInput(status, 20).toLowerCase() === "failure") {
    const failureWindowStart = new Date(now.getTime() - 10 * 60 * 1000)
    const failedCount = await prisma.promptAuditLog.count({
      where: {
        actorId,
        status: "failure",
        createdAt: {
          gte: failureWindowStart,
        },
      },
    })

    if (failedCount >= policy.failureBurstThreshold) {
      await upsertAuditAnomaly({
        userId: actorId,
        promptId,
        type: "AUTH_FAILURE_BURST",
        severity: AuditRiskLevel.HIGH,
        summary: `10 分钟内失败审计事件达到 ${failedCount} 次。`,
        matchedRule: "failure_burst_threshold",
        metadata: {
          failedCount,
          threshold: policy.failureBurstThreshold,
        },
      })
    }
  }

  if (ipHash) {
    const ipWindowStart = new Date(now.getTime() - 60 * 60 * 1000)
    const logs = await prisma.promptAuditLog.findMany({
      where: {
        actorId,
        createdAt: {
          gte: ipWindowStart,
        },
      },
      select: {
        ipHash: true,
      },
      take: 200,
    })

    const uniqueIpCount = new Set(logs.map((item) => item.ipHash).filter(Boolean)).size
    if (uniqueIpCount >= policy.multiIpBurstThreshold) {
      await upsertAuditAnomaly({
        userId: actorId,
        promptId,
        type: "MULTI_IP_BURST",
        severity: AuditRiskLevel.MEDIUM,
        summary: `1 小时内检测到 ${uniqueIpCount} 个不同来源访问。`,
        matchedRule: "multi_ip_burst_threshold",
        metadata: {
          uniqueIpCount,
          threshold: policy.multiIpBurstThreshold,
        },
      })
    }
  }

  if (isSensitiveAuditAction(action)) {
    const sensitiveWindowStart = new Date(now.getTime() - 15 * 60 * 1000)
    const sensitiveCount = await prisma.promptAuditLog.count({
      where: {
        actorId,
        action: {
          contains: ".",
        },
        riskLevel: {
          in: [AuditRiskLevel.MEDIUM, AuditRiskLevel.HIGH, AuditRiskLevel.CRITICAL],
        },
        createdAt: {
          gte: sensitiveWindowStart,
        },
      },
    })

    if (sensitiveCount >= policy.sensitiveBurstThreshold) {
      await upsertAuditAnomaly({
        userId: actorId,
        promptId,
        type: "SENSITIVE_ACTION_BURST",
        severity: AuditRiskLevel.HIGH,
        summary: `15 分钟内敏感操作达到 ${sensitiveCount} 次。`,
        matchedRule: "sensitive_burst_threshold",
        metadata: {
          sensitiveCount,
          threshold: policy.sensitiveBurstThreshold,
        },
      })
    }
  }
}

export function sanitizeAuditMetadata(metadata: unknown) {
  const sanitized = sanitizeJsonValue(metadata, {
    maxDepth: 5,
    maxKeysPerObject: 64,
    maxArrayLength: 128,
    maxStringLength: 1000,
  })

  if (!sanitized || typeof sanitized !== "object" || Array.isArray(sanitized)) {
    return undefined
  }

  return sanitized as Record<string, unknown>
}
