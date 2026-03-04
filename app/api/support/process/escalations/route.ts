import { SupportEscalationStatus, SupportTicketStatus, type Prisma } from "@prisma/client"
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"

import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import {
  buildSupportEscalationPolicySeed,
  normalizeSupportEscalationLevel,
  resolveCrossTeamCollaborationEfficiency,
  resolveEscalationPath,
} from "@/lib/enterprise-support"
import { recordPromptAuditLog } from "@/lib/prompt-audit-log"
import { sanitizeMultilineTextInput, sanitizeTextInput } from "@/lib/security"
import {
  getUserEntitlementSnapshot,
  hasEnterpriseSupportProcessAccess,
} from "@/lib/subscription-entitlements"

function parseStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as string[]
  }
  return value.filter((item): item is string => typeof item === "string")
}

function toPolicyResponse(policy: {
  id: string
  planId: string
  level: string
  fromTier: string
  fromPriority: string
  targetTier: string
  targetPriority: string
  targetTeam: string
  targetRole: string | null
  responseSlaHours: number
  resolutionSlaHours: number
  workflowSteps: unknown
  active: boolean
  updatedAt: Date
}) {
  return {
    ...policy,
    workflowSteps: parseStringArray(policy.workflowSteps),
    updatedAt: policy.updatedAt.toISOString(),
  }
}

function toEscalationEventResponse(event: {
  id: string
  ticketId: string
  policyId: string | null
  status: string
  level: string
  fromTier: string
  toTier: string
  fromPriority: string
  toPriority: string
  targetTeam: string
  reason: string
  handoffChecklist: unknown
  acknowledgedAt: Date | null
  resolvedAt: Date | null
  createdAt: Date
  ticket: {
    id: string
    ticketNo: string
    title: string
    status: string
  }
}) {
  return {
    ...event,
    handoffChecklist: parseStringArray(event.handoffChecklist),
    createdAt: event.createdAt.toISOString(),
    acknowledgedAt: event.acknowledgedAt?.toISOString() ?? null,
    resolvedAt: event.resolvedAt?.toISOString() ?? null,
  }
}

function resolveTicketMetadata(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {} as Record<string, unknown>
  }
  return value as Record<string, unknown>
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 })
  }

  const entitlement = await getUserEntitlementSnapshot(session.user.id)
  if (!hasEnterpriseSupportProcessAccess(entitlement.plan.id)) {
    return NextResponse.json(
      {
        error: "企业支持流程标准化仅对 Team / Enterprise 套餐开放",
        upgradeRequired: true,
      },
      { status: 403 }
    )
  }

  const existingPolicyCount = await prisma.supportEscalationPolicy.count({
    where: {
      userId: session.user.id,
      planId: entitlement.plan.id,
    },
  })

  if (existingPolicyCount === 0) {
    const seedRows = buildSupportEscalationPolicySeed(entitlement.plan.id)
    if (seedRows.length > 0) {
      await prisma.supportEscalationPolicy.createMany({
        data: seedRows.map((item) => ({
          userId: session.user.id,
          planId: item.planId,
          level: item.level,
          fromTier: item.fromTier,
          fromPriority: item.fromPriority,
          targetTier: item.targetTier,
          targetPriority: item.targetPriority,
          targetTeam: item.targetTeam,
          targetRole: item.targetRole,
          responseSlaHours: item.responseSlaHours,
          resolutionSlaHours: item.resolutionSlaHours,
          workflowSteps: item.workflowSteps,
          active: true,
        })),
      })
    }
  }

  const [policies, events, postmortems] = await Promise.all([
    prisma.supportEscalationPolicy.findMany({
      where: {
        userId: session.user.id,
        planId: entitlement.plan.id,
      },
      orderBy: [{ level: "asc" }, { updatedAt: "desc" }],
    }),
    prisma.supportEscalationEvent.findMany({
      where: {
        ticket: {
          userId: session.user.id,
        },
      },
      include: {
        ticket: {
          select: {
            id: true,
            ticketNo: true,
            title: true,
            status: true,
          },
        },
      },
      orderBy: [{ createdAt: "desc" }],
      take: 50,
    }),
    prisma.supportPostmortem.findMany({
      where: {
        tenantUserId: session.user.id,
      },
      select: {
        status: true,
        publishedAt: true,
        createdAt: true,
      },
      take: 200,
    }),
  ])

  const collaboration = resolveCrossTeamCollaborationEfficiency({
    escalationEvents: events.map((item) => ({
      status: item.status,
      createdAt: item.createdAt,
      resolvedAt: item.resolvedAt,
    })),
    postmortems,
  })

  return NextResponse.json({
    policies: policies.map(toPolicyResponse),
    events: events.map(toEscalationEventResponse),
    collaboration,
  })
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 })
  }

  const entitlement = await getUserEntitlementSnapshot(session.user.id)
  if (!hasEnterpriseSupportProcessAccess(entitlement.plan.id)) {
    return NextResponse.json(
      {
        error: "企业支持流程标准化仅对 Team / Enterprise 套餐开放",
        upgradeRequired: true,
      },
      { status: 403 }
    )
  }

  try {
    const body = await request.json().catch(() => ({}))
    const ticketId = sanitizeTextInput(body.ticketId, 80)
    const reason = sanitizeMultilineTextInput(body.reason, 2000).trim()
    const requestedLevel = normalizeSupportEscalationLevel(body.level)

    if (!ticketId || !reason) {
      return NextResponse.json({ error: "请提供工单 ID 与升级原因" }, { status: 400 })
    }

    const ticket = await prisma.supportTicket.findFirst({
      where: {
        id: ticketId,
        userId: session.user.id,
      },
    })

    if (!ticket) {
      return NextResponse.json({ error: "工单不存在" }, { status: 404 })
    }

    const activePolicies = await prisma.supportEscalationPolicy.findMany({
      where: {
        userId: session.user.id,
        planId: entitlement.plan.id,
        active: true,
      },
      orderBy: [{ updatedAt: "desc" }],
    })

    const matchedPolicy =
      activePolicies.find(
        (item) =>
          item.level === requestedLevel &&
          item.fromTier === ticket.tier &&
          item.fromPriority === ticket.priority
      ) ||
      activePolicies.find((item) => item.level === requestedLevel && item.fromTier === ticket.tier) ||
      activePolicies.find((item) => item.level === requestedLevel)

    const fallbackPath = resolveEscalationPath({
      planId: entitlement.plan.id,
      tier: ticket.tier,
      priority: ticket.priority,
    })

    const targetTier = matchedPolicy?.targetTier || fallbackPath?.targetTier || ticket.tier
    const targetPriority =
      matchedPolicy?.targetPriority || fallbackPath?.targetPriority || ticket.priority
    const targetTeam =
      sanitizeTextInput(body.targetTeam, 80) ||
      matchedPolicy?.targetTeam ||
      fallbackPath?.targetTeam ||
      "enterprise-support"

    const handoffChecklist =
      parseStringArray(matchedPolicy?.workflowSteps).length > 0
        ? parseStringArray(matchedPolicy?.workflowSteps)
        : fallbackPath?.workflowSteps || []

    const now = new Date()
    const [updatedTicket, escalation] = await prisma.$transaction(async (tx) => {
      const updated = await tx.supportTicket.update({
        where: {
          id: ticket.id,
        },
        data: {
          tier: targetTier,
          priority: targetPriority,
          status: SupportTicketStatus.IN_PROGRESS,
          firstResponseAt: ticket.firstResponseAt || now,
          metadata: {
            ...resolveTicketMetadata(ticket.metadata),
            lastEscalationAt: now.toISOString(),
            lastEscalationLevel: matchedPolicy?.level || fallbackPath?.level || requestedLevel,
            lastEscalationTeam: targetTeam,
          } as Prisma.InputJsonValue,
        },
      })

      const createdEscalation = await tx.supportEscalationEvent.create({
        data: {
          ticketId: ticket.id,
          actorId: session.user.id,
          policyId: matchedPolicy?.id || null,
          status: SupportEscalationStatus.OPEN,
          level: matchedPolicy?.level || fallbackPath?.level || requestedLevel,
          fromTier: ticket.tier,
          toTier: targetTier,
          fromPriority: ticket.priority,
          toPriority: targetPriority,
          targetTeam,
          reason,
          handoffChecklist: handoffChecklist.length > 0 ? handoffChecklist : undefined,
        },
      })

      await tx.supportTicketEvent.create({
        data: {
          ticketId: ticket.id,
          actorId: session.user.id,
          action: "ticket.escalated",
          fromStatus: ticket.status,
          toStatus: SupportTicketStatus.IN_PROGRESS,
          note: `Escalated to ${targetTeam}`,
          metadata: {
            escalationId: createdEscalation.id,
            fromTier: ticket.tier,
            toTier: targetTier,
            fromPriority: ticket.priority,
            toPriority: targetPriority,
          },
        },
      })

      return [updated, createdEscalation] as const
    })

    await recordPromptAuditLog({
      actorId: session.user.id,
      action: "support.escalation.create",
      resource: "support",
      request,
      metadata: {
        ticketId: ticket.id,
        escalationId: escalation.id,
        targetTeam,
      },
    })

    return NextResponse.json({
      ticket: {
        ...updatedTicket,
        createdAt: updatedTicket.createdAt.toISOString(),
        updatedAt: updatedTicket.updatedAt.toISOString(),
        firstResponseAt: updatedTicket.firstResponseAt?.toISOString() ?? null,
        responseDueAt: updatedTicket.responseDueAt?.toISOString() ?? null,
        resolvedAt: updatedTicket.resolvedAt?.toISOString() ?? null,
        closedAt: updatedTicket.closedAt?.toISOString() ?? null,
      },
      escalation: {
        ...escalation,
        createdAt: escalation.createdAt.toISOString(),
        updatedAt: escalation.updatedAt.toISOString(),
        acknowledgedAt: escalation.acknowledgedAt?.toISOString() ?? null,
        resolvedAt: escalation.resolvedAt?.toISOString() ?? null,
      },
    })
  } catch (error) {
    console.error("Create support escalation failed:", error)
    return NextResponse.json({ error: "创建升级事件失败" }, { status: 500 })
  }
}
