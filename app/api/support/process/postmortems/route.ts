import { type Prisma, SupportPostmortemStatus } from "@prisma/client"
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"

import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { sanitizePostmortemInput } from "@/lib/enterprise-support"
import { recordPromptAuditLog } from "@/lib/prompt-audit-log"
import { sanitizeTextInput } from "@/lib/security"
import {
  getUserEntitlementSnapshot,
  hasEnterpriseSupportProcessAccess,
} from "@/lib/subscription-entitlements"

function toPostmortemResponse(postmortem: {
  id: string
  ticketId: string
  tenantUserId: string
  authorId: string | null
  status: SupportPostmortemStatus
  severity: string
  summary: string
  impact: string | null
  rootCause: string | null
  timeline: unknown
  actionItems: unknown
  collaborationMeta: unknown
  publishedAt: Date | null
  createdAt: Date
  updatedAt: Date
  ticket?: {
    id: string
    ticketNo: string
    title: string
    status: string
  }
}) {
  return {
    ...postmortem,
    publishedAt: postmortem.publishedAt?.toISOString() ?? null,
    createdAt: postmortem.createdAt.toISOString(),
    updatedAt: postmortem.updatedAt.toISOString(),
  }
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

  const postmortems = await prisma.supportPostmortem.findMany({
    where: {
      tenantUserId: session.user.id,
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
    take: 60,
  })

  return NextResponse.json({
    postmortems: postmortems.map(toPostmortemResponse),
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
    const postmortemInput = sanitizePostmortemInput(body)

    if (!ticketId) {
      return NextResponse.json({ error: "请指定工单" }, { status: 400 })
    }

    const ticket = await prisma.supportTicket.findFirst({
      where: {
        id: ticketId,
        userId: session.user.id,
      },
      select: {
        id: true,
        ticketNo: true,
        title: true,
        priority: true,
        status: true,
      },
    })

    if (!ticket) {
      return NextResponse.json({ error: "工单不存在" }, { status: 404 })
    }

    const summary =
      postmortemInput.summary ||
      `${ticket.ticketNo} ${ticket.title} 复盘草稿`

    const created = await prisma.supportPostmortem.create({
      data: {
        ticketId: ticket.id,
        tenantUserId: session.user.id,
        authorId: session.user.id,
        status: SupportPostmortemStatus.DRAFT,
        severity: postmortemInput.severity,
        summary,
        impact: postmortemInput.impact || null,
        rootCause: postmortemInput.rootCause || null,
        timeline: (postmortemInput.timeline as Prisma.InputJsonValue | undefined) || undefined,
        actionItems: (postmortemInput.actionItems as Prisma.InputJsonValue | undefined) || undefined,
        collaborationMeta: {
          source: "support-process",
          createdFromTicketStatus: ticket.status,
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
    })

    await recordPromptAuditLog({
      actorId: session.user.id,
      action: "support.postmortem.create",
      resource: "support",
      request,
      metadata: {
        postmortemId: created.id,
        ticketId: ticket.id,
        status: created.status,
      },
    })

    return NextResponse.json(
      {
        postmortem: toPostmortemResponse(created),
      },
      { status: 201 }
    )
  } catch (error) {
    console.error("Create support postmortem failed:", error)
    return NextResponse.json({ error: "创建复盘草稿失败" }, { status: 500 })
  }
}
