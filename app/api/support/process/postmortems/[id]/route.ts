import { Prisma } from "@prisma/client"
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"

import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { normalizePostmortemStatus, sanitizePostmortemInput } from "@/lib/enterprise-support"
import { recordPromptAuditLog } from "@/lib/prompt-audit-log"
import {
  getUserEntitlementSnapshot,
  hasEnterpriseSupportProcessAccess,
} from "@/lib/subscription-entitlements"

function hasOwn(source: Record<string, unknown>, key: string) {
  return Object.prototype.hasOwnProperty.call(source, key)
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
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
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>

    const postmortem = await prisma.supportPostmortem.findFirst({
      where: {
        id: params.id,
        tenantUserId: session.user.id,
      },
    })

    if (!postmortem) {
      return NextResponse.json({ error: "复盘记录不存在" }, { status: 404 })
    }

    const normalized = sanitizePostmortemInput(body)
    const data: Prisma.SupportPostmortemUpdateInput = {
      author: {
        connect: {
          id: session.user.id,
        },
      },
    }

    if (hasOwn(body, "summary") && normalized.summary) {
      data.summary = normalized.summary
    }
    if (hasOwn(body, "impact")) {
      data.impact = normalized.impact || null
    }
    if (hasOwn(body, "rootCause")) {
      data.rootCause = normalized.rootCause || null
    }
    if (hasOwn(body, "severity")) {
      data.severity = normalized.severity
    }
    if (hasOwn(body, "timeline")) {
      data.timeline =
        normalized.timeline === undefined
          ? Prisma.JsonNull
          : (normalized.timeline as Prisma.InputJsonValue)
    }
    if (hasOwn(body, "actionItems")) {
      data.actionItems =
        normalized.actionItems === undefined
          ? Prisma.JsonNull
          : (normalized.actionItems as Prisma.InputJsonValue)
    }

    if (hasOwn(body, "status")) {
      const nextStatus = normalizePostmortemStatus(body.status)
      data.status = nextStatus
      if (nextStatus === "PUBLISHED") {
        data.publishedAt = postmortem.publishedAt || new Date()
      }
      if (nextStatus === "DRAFT") {
        data.publishedAt = null
      }
    }

    const updated = await prisma.supportPostmortem.update({
      where: {
        id: postmortem.id,
      },
      data,
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
      action: "support.postmortem.update",
      resource: "support",
      request,
      metadata: {
        postmortemId: updated.id,
        status: updated.status,
      },
    })

    return NextResponse.json({
      postmortem: {
        ...updated,
        publishedAt: updated.publishedAt?.toISOString() ?? null,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
      },
    })
  } catch (error) {
    console.error("Update support postmortem failed:", error)
    return NextResponse.json({ error: "更新复盘记录失败" }, { status: 500 })
  }
}
