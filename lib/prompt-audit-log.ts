import { AuditRiskLevel, Prisma } from "@prisma/client"

import {
  buildAuditEntryHash,
  extractRequestAuditContext,
  getOrCreateAuditRetentionPolicy,
  resolveAuditRiskLevel,
  resolveRetentionUntil,
  runAuditAnomalyRules,
  sanitizeAuditMetadata,
} from "@/lib/compliance-audit"
import { prisma } from "@/lib/db"

interface RecordPromptAuditLogOptions {
  promptId?: string | null
  actorId?: string | null
  action: string
  resource?: string
  status?: "success" | "failure"
  riskLevel?: AuditRiskLevel
  immutable?: boolean
  request?: Request | null
  metadata?: Record<string, unknown>
}

export async function recordPromptAuditLog({
  promptId,
  actorId,
  action,
  resource = "prompt",
  status = "success",
  riskLevel,
  immutable = true,
  request,
  metadata,
}: RecordPromptAuditLogOptions) {
  const context = extractRequestAuditContext(request)
  const policy = actorId ? await getOrCreateAuditRetentionPolicy(actorId) : null
  const actor = actorId
    ? await prisma.user.findUnique({
        where: { id: actorId },
        select: { email: true },
      })
    : null
  const previous = await prisma.promptAuditLog.findFirst({
    orderBy: {
      createdAt: "desc",
    },
    select: {
      entryHash: true,
    },
  })

  const sanitizedMetadata = sanitizeAuditMetadata(metadata)
  const previousHash = previous?.entryHash || ""
  const auditTimestamp = new Date()
  const entryHash = buildAuditEntryHash({
    action,
    status,
    resource,
    promptId: promptId || "",
    actorId: actorId || "",
    metadata: sanitizedMetadata || null,
    createdAt: auditTimestamp.toISOString(),
    previousHash,
  })

  const created = await prisma.promptAuditLog.create({
    data: {
      promptId: promptId || null,
      actorId: actorId || null,
      action,
      resource,
      status,
      riskLevel: resolveAuditRiskLevel({
        action,
        status,
        requestedRiskLevel: riskLevel,
      }),
      requestId: context.requestId || null,
      actorEmail: actor?.email || null,
      ipHash: context.ipHash || null,
      userAgent: context.userAgent || null,
      previousHash: previousHash || null,
      entryHash,
      immutable,
      retentionUntil: resolveRetentionUntil(policy?.retentionDays || 365),
      metadata: (sanitizedMetadata as Prisma.InputJsonValue | undefined) || undefined,
      createdAt: auditTimestamp,
    },
  })

  await runAuditAnomalyRules({
    actorId,
    action,
    status,
    ipHash: context.ipHash,
    promptId,
  })

  return created
}
