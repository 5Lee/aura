import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"

import { OpsAnalyticsPanel } from "@/components/ops/ops-analytics-panel"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import {
  buildOpsAnalyticsSeed,
  buildOpsCohortComparison,
  buildOpsFunnelSummary,
  resolveOpsFunnelConsistency,
} from "@/lib/ops-analytics"
import { getUserEntitlementSnapshot, hasOpsAnalyticsAccess } from "@/lib/subscription-entitlements"

export default async function OpsAnalyticsPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    redirect("/login")
  }

  const snapshot = await getUserEntitlementSnapshot(session.user.id)
  const hasAccess = hasOpsAnalyticsAccess(snapshot.plan.id)

  const count = hasAccess
    ? await prisma.opsAnalyticsSnapshot.count({
        where: {
          userId: session.user.id,
        },
      })
    : 0

  if (hasAccess && count === 0) {
    await prisma.opsAnalyticsSnapshot.createMany({
      data: buildOpsAnalyticsSeed(session.user.id),
    })
  }

  const [snapshots, experiments] = hasAccess
    ? await Promise.all([
        prisma.opsAnalyticsSnapshot.findMany({
          where: {
            userId: session.user.id,
          },
          orderBy: [{ windowEnd: "desc" }],
          take: 180,
        }),
        prisma.growthExperiment.findMany({
          where: {
            userId: session.user.id,
          },
          select: {
            id: true,
            name: true,
            status: true,
          },
          orderBy: [{ updatedAt: "desc" }],
          take: 40,
        }),
      ])
    : [[], []]

  const funnel = buildOpsFunnelSummary(snapshots)
  const cohorts = buildOpsCohortComparison(snapshots)
  const consistency = resolveOpsFunnelConsistency(snapshots)

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-3">
            <CardTitle>运营漏斗与留存队列分析</CardTitle>
            <Badge variant="secondary">Week23-003</Badge>
            <Badge>{snapshot.plan.name}</Badge>
          </div>
          <CardDescription>
            输出激活/留存/复访漏斗，支持 cohort 对比与实验联动分析，确保漏斗口径一致并可追溯。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <OpsAnalyticsPanel
            hasAccess={hasAccess}
            planId={snapshot.plan.id}
            snapshots={snapshots.map((item) => ({
              id: item.id,
              cohortKey: item.cohortKey,
              metricType: item.metricType,
              stage: item.stage,
              activatedUsers: item.activatedUsers,
              retainedUsers: item.retainedUsers,
              revisitUsers: item.revisitUsers,
              conversionUsers: item.conversionUsers,
              experimentId: item.experimentId,
              traceToken: item.traceToken,
              windowEnd: item.windowEnd.toISOString(),
            }))}
            experiments={experiments}
            funnel={funnel}
            cohorts={cohorts}
            consistency={consistency}
          />
        </CardContent>
      </Card>
    </div>
  )
}
