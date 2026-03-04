import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"

import { PartnerProgramPanel } from "@/components/partners/partner-program-panel"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { buildDefaultPartnerTierSeed, summarizePartnerSettlement } from "@/lib/partner-program"
import { getUserEntitlementSnapshot, hasPartnerProgramAccess } from "@/lib/subscription-entitlements"

export default async function PartnersPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    redirect("/login")
  }

  const snapshot = await getUserEntitlementSnapshot(session.user.id)
  const hasAccess = hasPartnerProgramAccess(snapshot.plan.id)

  const [tierCount, leads, settlements] = await Promise.all([
    hasAccess
      ? prisma.partnerTier.count({
          where: {
            userId: session.user.id,
          },
        })
      : Promise.resolve(0),
    hasAccess
      ? prisma.partnerLead.findMany({
          where: {
            userId: session.user.id,
          },
          include: {
            tier: {
              select: {
                id: true,
                name: true,
                level: true,
              },
            },
          },
          orderBy: [{ createdAt: "desc" }],
          take: 120,
        })
      : Promise.resolve([]),
    hasAccess
      ? prisma.partnerSettlement.findMany({
          where: {
            userId: session.user.id,
          },
          include: {
            tier: {
              select: {
                id: true,
                name: true,
                level: true,
              },
            },
          },
          orderBy: [{ createdAt: "desc" }],
          take: 60,
        })
      : Promise.resolve([]),
  ])

  if (hasAccess && tierCount === 0) {
    await prisma.partnerTier.createMany({
      data: buildDefaultPartnerTierSeed(session.user.id),
    })
  }

  const tiers = hasAccess
    ? await prisma.partnerTier.findMany({
        where: {
          userId: session.user.id,
        },
        orderBy: [{ active: "desc" }, { updatedAt: "desc" }],
        take: 20,
      })
    : []

  const leadSummary = summarizePartnerSettlement(
    leads.map((item) => ({
      status: item.status,
      estimatedDealCents: item.estimatedDealCents,
      closedDealCents: item.closedDealCents,
      commissionBasisPoints: item.commissionBasisPoints,
    }))
  )

  const settlementPendingCents = settlements
    .filter((item) => item.status === "PENDING" || item.status === "PROCESSING")
    .reduce((acc, item) => acc + item.payoutAmountCents + item.reconciledDeltaCents, 0)

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-3">
            <CardTitle>合作伙伴分层与结算</CardTitle>
            <Badge variant="secondary">Week20-004</Badge>
            <Badge>{snapshot.plan.name}</Badge>
          </div>
          <CardDescription>
            建立合作伙伴等级与权益体系，支持线索归因与分成规则，输出合作伙伴仪表板并验证合作收益对账流程。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PartnerProgramPanel
            hasAccess={hasAccess}
            planId={snapshot.plan.id}
            tiers={tiers.map((item) => ({
              id: item.id,
              name: item.name,
              level: item.level,
              minQualifiedLeads: item.minQualifiedLeads,
              revenueShareBasisPoints: item.revenueShareBasisPoints,
              settlementCycleDays: item.settlementCycleDays,
              active: item.active,
            }))}
            leads={leads.map((item) => ({
              id: item.id,
              tierId: item.tierId,
              settlementId: item.settlementId,
              leadName: item.leadName,
              company: item.company,
              sourceChannel: item.sourceChannel,
              attributionCode: item.attributionCode,
              status: item.status,
              estimatedDealCents: item.estimatedDealCents,
              closedDealCents: item.closedDealCents,
              commissionBasisPoints: item.commissionBasisPoints,
            }))}
            settlements={settlements.map((item) => ({
              id: item.id,
              tierId: item.tierId,
              status: item.status,
              periodStart: item.periodStart.toISOString(),
              periodEnd: item.periodEnd.toISOString(),
              leadCount: item.leadCount,
              qualifiedLeadCount: item.qualifiedLeadCount,
              wonLeadCount: item.wonLeadCount,
              grossRevenueCents: item.grossRevenueCents,
              payoutAmountCents: item.payoutAmountCents,
              reconciledDeltaCents: item.reconciledDeltaCents,
              payoutReference: item.payoutReference,
              processedAt: item.processedAt?.toISOString() ?? null,
              createdAt: item.createdAt.toISOString(),
            }))}
            summary={{
              ...leadSummary,
              settlementPendingCents,
            }}
          />
        </CardContent>
      </Card>
    </div>
  )
}
