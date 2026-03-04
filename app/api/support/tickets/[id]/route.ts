import { SupportTicketStatus } from "@prisma/client"
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"

import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { sanitizeMultilineTextInput } from "@/lib/security"
import { getUserEntitlementSnapshot } from "@/lib/subscription-entitlements"
import {
  capPriorityByPlan,
  normalizeSupportTicketPriority,
  resolveSupportStatus,
} from "@/lib/support-tickets"

const ALLOWED_TRANSITIONS: Record<SupportTicketStatus, SupportTicketStatus[]> = {
  [SupportTicketStatus.OPEN]: [
    SupportTicketStatus.IN_PROGRESS,
    SupportTicketStatus.WAITING_USER,
    SupportTicketStatus.RESOLVED,
    SupportTicketStatus.CLOSED,
  ],
  [SupportTicketStatus.IN_PROGRESS]: [
    SupportTicketStatus.WAITING_USER,
    SupportTicketStatus.RESOLVED,
    SupportTicketStatus.CLOSED,
  ],
  [SupportTicketStatus.WAITING_USER]: [
    SupportTicketStatus.IN_PROGRESS,
    SupportTicketStatus.RESOLVED,
    SupportTicketStatus.CLOSED,
  ],
  [SupportTicketStatus.RESOLVED]: [
    SupportTicketStatus.CLOSED,
    SupportTicketStatus.IN_PROGRESS,
  ],
  [SupportTicketStatus.CLOSED]: [
    SupportTicketStatus.IN_PROGRESS,
  ],
}

function canTransition(fromStatus: SupportTicketStatus, toStatus: SupportTicketStatus) {
  if (fromStatus === toStatus) {
    return true
  }
  return ALLOWED_TRANSITIONS[fromStatus].includes(toStatus)
}

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 })
  }

  const ticket = await prisma.supportTicket.findFirst({
    where: {
      id: params.id,
      userId: session.user.id,
    },
    include: {
      events: {
        orderBy: { createdAt: "desc" },
        take: 50,
      },
    },
  })

  if (!ticket) {
    return NextResponse.json({ error: "工单不存在" }, { status: 404 })
  }

  return NextResponse.json({ ticket })
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 })
  }

  try {
    const ticket = await prisma.supportTicket.findFirst({
      where: {
        id: params.id,
        userId: session.user.id,
      },
    })

    if (!ticket) {
      return NextResponse.json({ error: "工单不存在" }, { status: 404 })
    }

    const body = await request.json().catch(() => ({}))
    const nextStatus = body.status ? resolveSupportStatus(body.status) : ticket.status
    const requestedPriority = body.priority
      ? normalizeSupportTicketPriority(body.priority)
      : ticket.priority
    const note = sanitizeMultilineTextInput(body.note, 800).trim() || null
    const entitlement = await getUserEntitlementSnapshot(session.user.id)
    const nextPriority = capPriorityByPlan(entitlement.plan.id, requestedPriority)

    if (!canTransition(ticket.status, nextStatus)) {
      return NextResponse.json({ error: "不允许的状态流转" }, { status: 400 })
    }

    const now = new Date()
    const shouldSetFirstResponse =
      !ticket.firstResponseAt &&
      (nextStatus === SupportTicketStatus.IN_PROGRESS || nextStatus === SupportTicketStatus.WAITING_USER)
    const resolvedAt =
      nextStatus === SupportTicketStatus.RESOLVED || nextStatus === SupportTicketStatus.CLOSED
        ? ticket.resolvedAt || now
        : ticket.resolvedAt
    const closedAt = nextStatus === SupportTicketStatus.CLOSED ? now : null

    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.supportTicket.update({
        where: { id: ticket.id },
        data: {
          status: nextStatus,
          priority: nextPriority,
          firstResponseAt: shouldSetFirstResponse ? now : ticket.firstResponseAt,
          resolvedAt,
          closedAt,
          metadata: {
            ...(ticket.metadata && typeof ticket.metadata === "object" ? ticket.metadata : {}),
            lastRequestedPriority: requestedPriority,
            lastAssignedPriority: nextPriority,
          },
        },
      })

      await tx.supportTicketEvent.create({
        data: {
          ticketId: ticket.id,
          actorId: session.user.id,
          action: "ticket.updated",
          fromStatus: ticket.status,
          toStatus: nextStatus,
          note: note || undefined,
          metadata: {
            previousPriority: ticket.priority,
            requestedPriority,
            assignedPriority: nextPriority,
          },
        },
      })

      return row
    })

    return NextResponse.json({
      ticket: updated,
      priorityDowngraded: requestedPriority !== nextPriority,
    })
  } catch (error) {
    console.error("Update support ticket failed:", error)
    return NextResponse.json({ error: "更新工单失败，请稍后重试" }, { status: 500 })
  }
}
