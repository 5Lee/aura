import { Prisma } from "@prisma/client"

import { prisma } from "@/lib/db"

interface RecordPromptAuditLogOptions {
  promptId?: string | null
  actorId?: string | null
  action: string
  status?: "success" | "failure"
  metadata?: Record<string, unknown>
}

export async function recordPromptAuditLog({
  promptId,
  actorId,
  action,
  status = "success",
  metadata,
}: RecordPromptAuditLogOptions) {
  return prisma.promptAuditLog.create({
    data: {
      promptId: promptId || null,
      actorId: actorId || null,
      action,
      status,
      metadata: (metadata as Prisma.InputJsonValue | undefined) || undefined,
    },
  })
}
