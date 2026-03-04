import { randomUUID } from "node:crypto"
import { SupportTicketPriority, SupportTicketStatus, SupportTicketTier } from "@prisma/client"

import { isSubscriptionPlanId, type SubscriptionPlanId } from "@/lib/subscription-plans"

export type SupportPolicy = {
  planId: SubscriptionPlanId
  tier: SupportTicketTier
  slaHours: number
  maxPriority: SupportTicketPriority
  label: string
}

const PRIORITY_ORDER: SupportTicketPriority[] = [
  SupportTicketPriority.LOW,
  SupportTicketPriority.NORMAL,
  SupportTicketPriority.HIGH,
  SupportTicketPriority.URGENT,
]

const PLAN_SUPPORT_POLICY: Record<SubscriptionPlanId, SupportPolicy> = {
  free: {
    planId: "free",
    tier: SupportTicketTier.COMMUNITY,
    slaHours: 72,
    maxPriority: SupportTicketPriority.NORMAL,
    label: "社区支持",
  },
  pro: {
    planId: "pro",
    tier: SupportTicketTier.STANDARD,
    slaHours: 24,
    maxPriority: SupportTicketPriority.HIGH,
    label: "标准支持",
  },
  team: {
    planId: "team",
    tier: SupportTicketTier.PRIORITY,
    slaHours: 8,
    maxPriority: SupportTicketPriority.URGENT,
    label: "优先支持",
  },
  enterprise: {
    planId: "enterprise",
    tier: SupportTicketTier.DEDICATED,
    slaHours: 2,
    maxPriority: SupportTicketPriority.URGENT,
    label: "专属支持",
  },
}

export function resolveSupportPolicy(planId: string): SupportPolicy {
  if (!isSubscriptionPlanId(planId)) {
    return PLAN_SUPPORT_POLICY.free
  }

  return PLAN_SUPPORT_POLICY[planId]
}

function getPriorityRank(priority: SupportTicketPriority) {
  const index = PRIORITY_ORDER.indexOf(priority)
  return index === -1 ? PRIORITY_ORDER.indexOf(SupportTicketPriority.NORMAL) : index
}

export function normalizeSupportTicketPriority(value: unknown) {
  const normalized = String(value ?? "").trim().toUpperCase()
  if (
    normalized === SupportTicketPriority.LOW ||
    normalized === SupportTicketPriority.NORMAL ||
    normalized === SupportTicketPriority.HIGH ||
    normalized === SupportTicketPriority.URGENT
  ) {
    return normalized as SupportTicketPriority
  }

  return SupportTicketPriority.NORMAL
}

export function capPriorityByPlan(planId: string, requestedPriority: SupportTicketPriority) {
  const policy = resolveSupportPolicy(planId)
  const maxRank = getPriorityRank(policy.maxPriority)
  const currentRank = getPriorityRank(requestedPriority)

  if (currentRank <= maxRank) {
    return requestedPriority
  }

  return policy.maxPriority
}

export function computeResponseDueAt(planId: string, now = new Date()) {
  const policy = resolveSupportPolicy(planId)
  return new Date(now.getTime() + policy.slaHours * 60 * 60 * 1000)
}

export function generateTicketNo(now = new Date()) {
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const day = String(now.getDate()).padStart(2, "0")
  const suffix = randomUUID().replace(/-/g, "").slice(0, 5).toUpperCase()
  return `SUP-${year}${month}${day}-${suffix}`
}

export function isOpenSupportStatus(status: SupportTicketStatus) {
  return (
    status === SupportTicketStatus.OPEN ||
    status === SupportTicketStatus.IN_PROGRESS ||
    status === SupportTicketStatus.WAITING_USER
  )
}

export function resolvePriorityDispatchScore(
  tier: SupportTicketTier,
  priority: SupportTicketPriority,
  waitingHours: number
) {
  const tierWeight: Record<SupportTicketTier, number> = {
    [SupportTicketTier.COMMUNITY]: 10,
    [SupportTicketTier.STANDARD]: 20,
    [SupportTicketTier.PRIORITY]: 30,
    [SupportTicketTier.DEDICATED]: 40,
  }
  const priorityWeight: Record<SupportTicketPriority, number> = {
    [SupportTicketPriority.LOW]: 5,
    [SupportTicketPriority.NORMAL]: 10,
    [SupportTicketPriority.HIGH]: 20,
    [SupportTicketPriority.URGENT]: 30,
  }

  const normalizedWaitingHours = Math.max(0, waitingHours)
  return tierWeight[tier] + priorityWeight[priority] + normalizedWaitingHours
}

export function resolveSupportStatus(value: unknown) {
  const normalized = String(value ?? "").trim().toUpperCase()
  if (
    normalized === SupportTicketStatus.OPEN ||
    normalized === SupportTicketStatus.IN_PROGRESS ||
    normalized === SupportTicketStatus.WAITING_USER ||
    normalized === SupportTicketStatus.RESOLVED ||
    normalized === SupportTicketStatus.CLOSED
  ) {
    return normalized as SupportTicketStatus
  }

  return SupportTicketStatus.OPEN
}
