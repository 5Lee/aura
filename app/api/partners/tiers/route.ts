import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"

import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import {
  DEFAULT_PARTNER_TIERS,
  buildDefaultPartnerTierSeed,
  sanitizePartnerTierInput,
} from "@/lib/partner-program"
import { recordPromptAuditLog } from "@/lib/prompt-audit-log"
import { sanitizeTextInput } from "@/lib/security"
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

  const count = await prisma.partnerTier.count({
    where: {
      userId: session.user.id,
    },
  })

  if (count === 0) {
    await prisma.partnerTier.createMany({
      data: buildDefaultPartnerTierSeed(session.user.id),
    })
  }

  const tiers = await prisma.partnerTier.findMany({
    where: {
      userId: session.user.id,
    },
    orderBy: [{ active: "desc" }, { updatedAt: "desc" }],
    take: 20,
  })

  return NextResponse.json({ tiers })
}

export async function PUT(request: Request) {
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
    const tierId = sanitizeTextInput(body.id, 80)

    const current = tierId
      ? await prisma.partnerTier.findFirst({
          where: {
            id: tierId,
            userId: session.user.id,
          },
        })
      : null

    const fallback = current
      ? {
          name: current.name,
          level: current.level,
          minQualifiedLeads: current.minQualifiedLeads,
          revenueShareBasisPoints: current.revenueShareBasisPoints,
          settlementCycleDays: current.settlementCycleDays,
          benefitPolicy: {
            benefits: DEFAULT_PARTNER_TIERS[0].benefitPolicy.benefits,
            leadRoutingPriority: "standard" as const,
          },
        }
      : DEFAULT_PARTNER_TIERS[0]

    const sanitized = sanitizePartnerTierInput(body, fallback)

    const tier = await prisma.partnerTier.upsert({
      where: {
        id: current?.id || "__create_partner_tier__",
      },
      create: {
        userId: session.user.id,
        name: sanitized.name,
        level: sanitized.level,
        minQualifiedLeads: sanitized.minQualifiedLeads,
        revenueShareBasisPoints: sanitized.revenueShareBasisPoints,
        settlementCycleDays: sanitized.settlementCycleDays,
        benefitPolicy: sanitized.benefitPolicy,
        active: body.active !== false,
      },
      update: {
        name: sanitized.name,
        level: sanitized.level,
        minQualifiedLeads: sanitized.minQualifiedLeads,
        revenueShareBasisPoints: sanitized.revenueShareBasisPoints,
        settlementCycleDays: sanitized.settlementCycleDays,
        benefitPolicy: sanitized.benefitPolicy,
        active: body.active !== false,
      },
    })

    await recordPromptAuditLog({
      actorId: session.user.id,
      action: "partners.tier.upsert",
      resource: "partners",
      request,
      metadata: {
        tierId: tier.id,
        level: tier.level,
      },
    })

    return NextResponse.json({ tier })
  } catch (error) {
    console.error("Save partner tier failed:", error)
    return NextResponse.json({ error: "保存合作伙伴等级失败" }, { status: 500 })
  }
}
