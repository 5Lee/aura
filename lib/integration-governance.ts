import { PromptAuditLog } from "@prisma/client"

import { sanitizeTextInput } from "@/lib/security"

export const GOVERNANCE_RESOURCE_KEYS = ["connectors", "prompt-flow"] as const

export type GovernanceResourceKey = (typeof GOVERNANCE_RESOURCE_KEYS)[number]

export const FLOW_GOVERNANCE_ACTIONS = ["publish", "rollback", "disable"] as const

export type FlowGovernanceAction = (typeof FLOW_GOVERNANCE_ACTIONS)[number]

export function sanitizeGovernanceResourceFilter(value: unknown): GovernanceResourceKey | "" {
  const normalized = sanitizeTextInput(value, 32).toLowerCase()
  if (normalized === "connectors") {
    return "connectors"
  }
  if (normalized === "prompt-flow") {
    return "prompt-flow"
  }
  return ""
}

export function normalizeFlowGovernanceAction(value: unknown): FlowGovernanceAction | "" {
  const normalized = sanitizeTextInput(value, 20).toLowerCase()
  if (normalized === "publish") {
    return "publish"
  }
  if (normalized === "rollback") {
    return "rollback"
  }
  if (normalized === "disable") {
    return "disable"
  }
  return ""
}

export function resolveConnectorGovernanceAuditActions({
  credentialChanged,
  authorizationChanged,
}: {
  credentialChanged: boolean
  authorizationChanged: boolean
}) {
  const actions: string[] = []
  if (credentialChanged) {
    actions.push("integration.connector.credential.rotate")
  }
  if (authorizationChanged) {
    actions.push("integration.connector.authorization.change")
  }
  return actions
}

export function resolveFlowGovernanceAuditAction(action: FlowGovernanceAction | "") {
  if (action === "publish") {
    return "promptflow.flow.publish"
  }
  if (action === "rollback") {
    return "promptflow.flow.rollback"
  }
  if (action === "disable") {
    return "promptflow.flow.disable"
  }
  return "promptflow.flow.upsert"
}

function asRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {} as Record<string, unknown>
  }
  return value as Record<string, unknown>
}

export function resolveAuditLogResourceMatch(log: PromptAuditLog, resourceId: string) {
  if (!resourceId) {
    return true
  }

  const metadata = asRecord(log.metadata)
  const candidateKeys = [
    "connectorId",
    "flowId",
    "runId",
    "templateId",
    "releaseKey",
    "planId",
    "reportId",
  ]

  return candidateKeys.some((key) => sanitizeTextInput(metadata[key], 120) === resourceId)
}

export function resolveGovernanceIntegritySummary(logs: PromptAuditLog[]) {
  const summary = logs.reduce(
    (acc, item) => {
      const hasHash = Boolean(item.entryHash && item.previousHash !== undefined)
      if (item.immutable && hasHash) {
        acc.verified += 1
      } else {
        acc.unverified += 1
      }
      return acc
    },
    { verified: 0, unverified: 0 }
  )

  return {
    ...summary,
    nonRepudiationRatio:
      logs.length === 0 ? 1 : Number((summary.verified / Math.max(1, logs.length)).toFixed(4)),
  }
}
