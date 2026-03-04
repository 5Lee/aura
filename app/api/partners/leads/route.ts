import { PartnerLeadStatus } from "@prisma/client"
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"

import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import {
  normalizePartnerLeadStatus,
  resolvePartnerLeadAttribution,
  sanitizePartnerLeadInput,
  summarizePartnerSettlement,
} from "@/lib/partner-program"
import { recordPromptAuditLog } from "@/lib/prompt-audit-log"
import { getUserEntitlementSnapshot, hasPartnerProgramAccess } from "@/lib/subscription-entitlements"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 })
  }

  const snapshot = await getUserEntitlementSnapshot(session.user.id)
  if (!hasPartnerProgramAccess(snapshot.plan.id)) {
    return NextResponse.json(
      {
        error: "合作伙伴分层与结算仅对 Pro / Team / Enterprise 套餐开放",
        upgradeRequired: true,
      },
      { status: 403 }
    )
  }

  const leads = await prisma.partnerLead.findMany({
    where: {
      userId: session.user.id,
    },
    include: {
      tier: {
        select: {
          id: true,
          name: true,
          level: true,
          revenueShareBasisPoints: true,
        },
      },
    },
    orderBy: [{ createdAt: "desc" }],
    take: 120,
  })

  const summary = summarizePartnerSettlement(
    leads.map((item) => ({
      status: item.status,
      estimatedDealCents: item.estimatedDealCents,
      closedDealCents: item.closedDealCents,
      commissionBasisPoints: item.commissionBasisPoints,
    }))
  )

  return NextResponse.json({ leads, summary })
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 })
  }

  const snapshot = await getUserEntitlementSnapshot(session.user.id)
  if (!hasPartnerProgramAccess(snapshot.plan.id)) {
    return NextResponse.json(
      {
        error: "合作伙伴分层与结算仅对 Pro / Team / Enterprise 套餐开放",
        upgradeRequired: true,
      },
      { status: 403 }
    )
  }

  try {
    const body = await request.json().catch(() => ({}))
    const sanitized = sanitizePartnerLeadInput(body)

    if (!sanitized.tierId || !sanitized.leadName || !sanitized.attributionCode) {
      return NextResponse.json({ error: "请填写合作伙伴等级、线索名称与归因编码" }, { status: 400 })
    }

    const tier = await prisma.partnerTier.findFirst({
      where: {
        id: sanitized.tierId,
        userId: session.user.id,
        active: true,
      },
    })

    if (!tier) {
      return NextResponse.json({ error: "合作伙伴等级不存在" }, { status: 404 })
    }

    const attribution = resolvePartnerLeadAttribution({
      sourceChannel: sanitized.sourceChannel,
      attributionCode: sanitized.attributionCode,
    })

    const status = normalizePartnerLeadStatus(body.status)
    const now = new Date()

    const lead = await prisma.partnerLead.create({
      data: {
        userId: session.user.id,
        tierId: tier.id,
        leadName: sanitized.leadName,
        company: sanitized.company || null,
        contactEmail: sanitized.contactEmail || null,
        sourceChannel: sanitized.sourceChannel,
        attributionCode: sanitized.attributionCode,
        status,
        estimatedDealCents: sanitized.estimatedDealCents,
        closedDealCents: sanitized.closedDealCents,
        commissionBasisPoints: tier.revenueShareBasisPoints,
        qualifiedAt:
          status === PartnerLeadStatus.QUALIFIED || status === PartnerLeadStatus.WON ? now : null,
        convertedAt: status === PartnerLeadStatus.WON ? now : null,
        metadata: {
          attribution,
          tierName: tier.name,
        },
      },
      include: {
        tier: {
          select: {
            id: true,
            name: true,
            level: true,
            revenueShareBasisPoints: true,
          },
        },
      },
    })

    await recordPromptAuditLog({
      actorId: session.user.id,
      action: "partners.lead.create",
      resource: "partners",
      request,
      metadata: {
        leadId: lead.id,
        status: lead.status,
        attributionKey: attribution.attributionKey,
      },
    })

    return NextResponse.json({ lead }, { status: 201 })
  } catch (error) {
    console.error("Create partner lead failed:", error)
    return NextResponse.json({ error: "创建合作线索失败" }, { status: 500 })
  }
}
