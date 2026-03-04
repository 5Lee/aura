import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"

import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { extractSupportRunbookConfig } from "@/lib/enterprise-support"
import { recordPromptAuditLog } from "@/lib/prompt-audit-log"
import {
  getUserEntitlementSnapshot,
  hasEnterpriseSupportProcessAccess,
} from "@/lib/subscription-entitlements"

function toRunbookConfig(row: {
  triageChecklist: unknown
  escalationWorkflow: unknown
  responseWorkflow: unknown
  contactMatrix: unknown
  postmortemTemplate: unknown
}) {
  return extractSupportRunbookConfig({
    triageChecklist: row.triageChecklist,
    escalationWorkflow: row.escalationWorkflow,
    responseWorkflow: row.responseWorkflow,
    contactMatrix: row.contactMatrix,
    postmortemTemplate: row.postmortemTemplate,
  })
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

  const row = await prisma.supportRunbook.findUnique({
    where: {
      userId: session.user.id,
    },
  })

  const config = toRunbookConfig({
    triageChecklist: row?.triageChecklist,
    escalationWorkflow: row?.escalationWorkflow,
    responseWorkflow: row?.responseWorkflow,
    contactMatrix: row?.contactMatrix,
    postmortemTemplate: row?.postmortemTemplate,
  })

  return NextResponse.json({
    runbook: row
      ? {
          ...row,
          config,
        }
      : {
          id: null,
          config,
        },
  })
}

export async function PUT(request: Request) {
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
    const config = extractSupportRunbookConfig(body)

    const updated = await prisma.supportRunbook.upsert({
      where: {
        userId: session.user.id,
      },
      create: {
        userId: session.user.id,
        triageChecklist: config.triageChecklist,
        escalationWorkflow: config.escalationWorkflow,
        responseWorkflow: config.responseWorkflow,
        contactMatrix: config.contactMatrix,
        postmortemTemplate: config.postmortemTemplate,
      },
      update: {
        triageChecklist: config.triageChecklist,
        escalationWorkflow: config.escalationWorkflow,
        responseWorkflow: config.responseWorkflow,
        contactMatrix: config.contactMatrix,
        postmortemTemplate: config.postmortemTemplate,
      },
    })

    await recordPromptAuditLog({
      actorId: session.user.id,
      action: "support.runbook.update",
      resource: "support",
      request,
      metadata: {
        runbookId: updated.id,
      },
    })

    return NextResponse.json({
      runbook: {
        ...updated,
        config,
      },
    })
  } catch (error) {
    console.error("Update support runbook failed:", error)
    return NextResponse.json({ error: "更新支持流程模板失败" }, { status: 500 })
  }
}
