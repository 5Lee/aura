import { Prisma } from "@prisma/client"
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"

import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import {
  normalizeMarketplaceSettlementStatus,
  sanitizeMarketplaceMetadata,
  sanitizeMarketplaceSummary,
} from "@/lib/marketplace-commission"
import { recordPromptAuditLog } from "@/lib/prompt-audit-log"
import { sanitizeTextInput } from "@/lib/security"
import {
  getUserEntitlementSnapshot,
  hasMarketplaceCommissionAccess,
} from "@/lib/subscription-entitlements"

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 })
  }

  const entitlement = await getUserEntitlementSnapshot(session.user.id)
  if (!hasMarketplaceCommissionAccess(entitlement.plan.id)) {
    return NextResponse.json(
      {
        error: "应用市场佣金体系仅对 Pro / Team / Enterprise 套餐开放",
        upgradeRequired: true,
      },
      { status: 403 }
    )
  }

  try {
    const body = await request.json().catch(() => ({}))
    const settlement = await prisma.marketplaceSettlementBatch.findFirst({
      where: {
        id: params.id,
        userId: session.user.id,
      },
    })

    if (!settlement) {
      return NextResponse.json({ error: "结算批次不存在" }, { status: 404 })
    }

    const status = normalizeMarketplaceSettlementStatus(body.status)
    const payoutReference = sanitizeTextInput(body.payoutReference, 120) || settlement.payoutReference
    const summary = sanitizeMarketplaceSummary(body.summary) || settlement.summary

    const updated = await prisma.marketplaceSettlementBatch.update({
      where: {
        id: settlement.id,
      },
      data: {
        status,
        payoutReference,
        summary,
        processedAt: status === "PAID" ? settlement.processedAt || new Date() : settlement.processedAt,
        metadata:
          sanitizeMarketplaceMetadata(body.metadata) ||
          (settlement.metadata === null
            ? Prisma.JsonNull
            : (settlement.metadata as Prisma.InputJsonValue)),
      },
    })

    await recordPromptAuditLog({
      actorId: session.user.id,
      action: "marketplace.settlement.update",
      resource: "marketplace",
      request,
      metadata: {
        batchId: updated.id,
        status: updated.status,
      },
    })

    return NextResponse.json({ settlement: updated })
  } catch (error) {
    console.error("Update marketplace settlement failed:", error)
    return NextResponse.json({ error: "更新结算状态失败" }, { status: 500 })
  }
}
