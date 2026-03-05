import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"

import { ReleaseOrchestrationPanel } from "@/components/reliability/release-orchestration-panel"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { buildReleasePlanSeed } from "@/lib/release-orchestration"
import { getUserEntitlementSnapshot, hasReleaseOrchestrationAccess } from "@/lib/subscription-entitlements"

export default async function ReleaseOrchestrationPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    redirect("/login")
  }

  const snapshot = await getUserEntitlementSnapshot(session.user.id)
  const hasAccess = hasReleaseOrchestrationAccess(snapshot.plan.id)

  const count = hasAccess
    ? await prisma.releaseOrchestrationPlan.count({
        where: {
          userId: session.user.id,
        },
      })
    : 0

  if (hasAccess && count === 0) {
    await prisma.releaseOrchestrationPlan.create({
      data: buildReleasePlanSeed(session.user.id),
    })
  }

  const [plans, rollbackEvents] = hasAccess
    ? await Promise.all([
        prisma.releaseOrchestrationPlan.findMany({
          where: {
            userId: session.user.id,
          },
          orderBy: [{ updatedAt: "desc" }],
          take: 80,
        }),
        prisma.releaseRollbackEvent.findMany({
          where: {
            userId: session.user.id,
          },
          include: {
            plan: {
              select: {
                id: true,
                name: true,
                status: true,
                canaryTrafficPercent: true,
              },
            },
          },
          orderBy: [{ rollbackAt: "desc" }],
          take: 120,
        }),
      ])
    : [[], []]

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-3">
            <CardTitle>发布演练与灰度回滚编排</CardTitle>
            <Badge variant="secondary">Week24-003</Badge>
            <Badge>{snapshot.plan.name}</Badge>
          </div>
          <CardDescription>
            提供灰度发布窗口与流量开关，执行发布演练脚本和检查清单，支持一键回滚与影响面评估。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ReleaseOrchestrationPanel
            hasAccess={hasAccess}
            planId={snapshot.plan.id}
            plans={plans.map((item) => ({
              id: item.id,
              name: item.name,
              status: item.status,
              releaseWindowStart: item.releaseWindowStart.toISOString(),
              releaseWindowEnd: item.releaseWindowEnd.toISOString(),
              canaryTrafficPercent: item.canaryTrafficPercent,
              rollbackThresholdPercent: item.rollbackThresholdPercent,
              impactSummary: item.impactSummary,
            }))}
            rollbackEvents={rollbackEvents.map((item) => ({
              id: item.id,
              planId: item.planId,
              reason: item.reason,
              impactScore: item.impactScore,
              estimatedUsers: item.estimatedUsers,
              rollbackAt: item.rollbackAt.toISOString(),
              plan: item.plan,
            }))}
          />
        </CardContent>
      </Card>
    </div>
  )
}
