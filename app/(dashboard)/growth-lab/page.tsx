import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"

import { GrowthExperimentPanel } from "@/components/growth/growth-experiment-panel"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { buildGrowthExperimentSeed, resolveGrowthSnapshotMetrics } from "@/lib/growth-lab"
import { getUserEntitlementSnapshot, hasGrowthLabAccess } from "@/lib/subscription-entitlements"

export default async function GrowthLabPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    redirect("/login")
  }

  const snapshot = await getUserEntitlementSnapshot(session.user.id)
  const hasAccess = hasGrowthLabAccess(snapshot.plan.id)

  const [count, experiments, snapshots, segments, audiences] = await Promise.all([
    hasAccess
      ? prisma.growthExperiment.count({
          where: {
            userId: session.user.id,
          },
        })
      : Promise.resolve(0),
    hasAccess
      ? prisma.growthExperiment.findMany({
          where: {
            userId: session.user.id,
          },
          orderBy: [{ updatedAt: "desc" }],
          take: 80,
        })
      : Promise.resolve([]),
    hasAccess
      ? prisma.growthMetricSnapshot.findMany({
          where: {
            userId: session.user.id,
          },
          orderBy: [{ windowEnd: "desc" }],
          take: 300,
        })
      : Promise.resolve([]),
    hasAccess
      ? prisma.growthAudienceSegment.findMany({
          where: {
            userId: session.user.id,
          },
          orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
          take: 80,
        })
      : Promise.resolve([]),
    hasAccess
      ? prisma.growthExperimentAudience.findMany({
          where: {
            userId: session.user.id,
          },
          include: {
            segment: {
              select: {
                id: true,
                name: true,
                key: true,
                estimatedUsers: true,
                status: true,
              },
            },
          },
          orderBy: [{ updatedAt: "desc" }],
          take: 160,
        })
      : Promise.resolve([]),
  ])

  if (hasAccess && count === 0) {
    await prisma.growthExperiment.createMany({
      data: buildGrowthExperimentSeed(session.user.id),
    })
  }

  const summaryCore = snapshots.reduce(
    (acc, item) => {
      acc.totalExposures += item.exposures
      acc.totalConversions += item.conversions
      acc.totalRetainedUsers += item.retainedUsers
      acc.totalRevenueCents += item.revenueCents
      return acc
    },
    {
      totalExposures: 0,
      totalConversions: 0,
      totalRetainedUsers: 0,
      totalRevenueCents: 0,
    }
  )

  const averageBaselineMetric =
    experiments.length === 0
      ? 0
      : Number(
          (experiments.reduce((acc, item) => acc + item.baselineMetric, 0) / experiments.length).toFixed(2)
        )

  const averageTargetMetric =
    experiments.length === 0
      ? 0
      : Number((experiments.reduce((acc, item) => acc + item.targetMetric, 0) / experiments.length).toFixed(2))

  const conversion = resolveGrowthSnapshotMetrics({
    baselineMetric: averageBaselineMetric,
    targetMetric: averageTargetMetric,
    exposures: summaryCore.totalExposures,
    conversions: summaryCore.totalConversions,
  })

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-3">
            <CardTitle>增长实验中心</CardTitle>
            <Badge variant="secondary">Week21-001</Badge>
            <Badge>{snapshot.plan.name}</Badge>
          </div>
          <CardDescription>
            建立实验定义、指标采集与状态流转能力，帮助运营团队持续迭代增长策略并追踪实验效果。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <GrowthExperimentPanel
            hasAccess={hasAccess}
            planId={snapshot.plan.id}
            experiments={experiments.map((item) => ({
              id: item.id,
              name: item.name,
              hypothesis: item.hypothesis,
              segmentKey: item.segmentKey,
              status: item.status,
              baselineMetric: item.baselineMetric,
              targetMetric: item.targetMetric,
              liftTargetPercent: item.liftTargetPercent,
              startAt: item.startAt.toISOString(),
              endAt: item.endAt.toISOString(),
            }))}
            snapshots={snapshots.map((item) => ({
              id: item.id,
              experimentId: item.experimentId,
              metricType: item.metricType,
              exposures: item.exposures,
              conversions: item.conversions,
              retainedUsers: item.retainedUsers,
              revenueCents: item.revenueCents,
              conversionRate: item.conversionRate,
              liftPercent: item.liftPercent,
              windowStart: item.windowStart.toISOString(),
              windowEnd: item.windowEnd.toISOString(),
            }))}
            segments={segments.map((item) => ({
              id: item.id,
              name: item.name,
              key: item.key,
              status: item.status,
              version: item.version,
              matchMode: item.matchMode,
              estimatedUsers: item.estimatedUsers,
            }))}
            audiences={audiences.map((item) => ({
              id: item.id,
              experimentId: item.experimentId,
              segmentId: item.segmentId,
              rolloutPercent: item.rolloutPercent,
              excludedSegmentKeys:
                Array.isArray(item.excludedSegmentKeys) && item.excludedSegmentKeys.length > 0
                  ? item.excludedSegmentKeys.filter((value) => typeof value === "string")
                  : [],
              status: item.status,
              segment: item.segment,
            }))}
            summary={{
              ...summaryCore,
              ...conversion,
            }}
          />
        </CardContent>
      </Card>
    </div>
  )
}
