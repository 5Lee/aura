import {
  SupportTicketPriority,
  SupportTicketStatus,
} from "@prisma/client"
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"

import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { sanitizeMultilineTextInput, sanitizeTextInput } from "@/lib/security"
import { getUserEntitlementSnapshot } from "@/lib/subscription-entitlements"
import {
  capPriorityByPlan,
  computeResponseDueAt,
  generateTicketNo,
  isOpenSupportStatus,
  normalizeSupportTicketPriority,
  resolvePriorityDispatchScore,
  resolveSupportPolicy,
} from "@/lib/support-tickets"

function resolvePositiveInt(value: string | null, fallback: number, min: number, max: number) {
  const parsed = Number(value || "")
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

export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const page = resolvePositiveInt(searchParams.get("page"), 1, 1, 1000)
  const pageSize = resolvePositiveInt(searchParams.get("pageSize"), 20, 10, 100)
  const skip = (page - 1) * pageSize

  const [tickets, total, entitlement] = await Promise.all([
    prisma.supportTicket.findMany({
      where: { userId: session.user.id },
      orderBy: [{ createdAt: "desc" }],
      skip,
      take: pageSize,
      include: {
        events: {
          orderBy: { createdAt: "desc" },
          take: 3,
        },
      },
    }),
    prisma.supportTicket.count({
      where: { userId: session.user.id },
    }),
    getUserEntitlementSnapshot(session.user.id),
  ])

  const now = Date.now()
  const transformed = tickets.map((ticket) => {
    const waitingHours = Math.max(0, (now - ticket.createdAt.getTime()) / (60 * 60 * 1000))
    const dispatchScore = resolvePriorityDispatchScore(ticket.tier, ticket.priority, waitingHours)
    return {
      ...ticket,
      dispatchScore: Number(dispatchScore.toFixed(2)),
    }
  })

  const openCount = transformed.filter((ticket) => isOpenSupportStatus(ticket.status)).length
  const policy = resolveSupportPolicy(entitlement.plan.id)

  return NextResponse.json({
    data: transformed,
    policy,
    meta: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      openCount,
    },
  })
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 })
  }

  try {
    const body = await request.json().catch(() => ({}))
    const title = sanitizeTextInput(body.title, 180)
    const description = sanitizeMultilineTextInput(body.description, 5000).trim()
    const category = sanitizeTextInput(body.category, 80) || "general"
    const requestedPriority = normalizeSupportTicketPriority(body.priority)

    if (!title || !description) {
      return NextResponse.json({ error: "工单标题和描述不能为空" }, { status: 400 })
    }

    const entitlement = await getUserEntitlementSnapshot(session.user.id)
    const policy = resolveSupportPolicy(entitlement.plan.id)
    const assignedPriority = capPriorityByPlan(entitlement.plan.id, requestedPriority)
    const now = new Date()

    const ticket = await prisma.supportTicket.create({
      data: {
        ticketNo: generateTicketNo(now),
        userId: session.user.id,
        title,
        description,
        category,
        planId: entitlement.plan.id,
        tier: policy.tier,
        priority: assignedPriority,
        status: SupportTicketStatus.OPEN,
        responseDueAt: computeResponseDueAt(entitlement.plan.id, now),
        metadata: {
          requestedPriority,
          priorityDowngraded: requestedPriority !== assignedPriority,
        },
      },
    })

    await prisma.supportTicketEvent.create({
      data: {
        ticketId: ticket.id,
        actorId: session.user.id,
        action: "ticket.created",
        toStatus: SupportTicketStatus.OPEN,
        note: `Ticket created with ${assignedPriority} priority`,
        metadata: {
          requestedPriority,
          assignedPriority,
          planId: entitlement.plan.id,
          tier: policy.tier,
        },
      },
    })

    return NextResponse.json(
      {
        ticket,
        policy,
        priorityDowngraded: requestedPriority !== assignedPriority,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error("Create support ticket failed:", error)
    return NextResponse.json({ error: "创建工单失败，请稍后重试" }, { status: 500 })
  }
}
