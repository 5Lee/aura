import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"

import { QualityGatePanel } from "@/components/reliability/quality-gate-panel"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { buildReliabilityGateSummary } from "@/lib/reliability-gates"
import { getUserEntitlementSnapshot, hasReliabilityGateAccess } from "@/lib/subscription-entitlements"

export default async function ReliabilityGatesPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    redirect("/login")
  }

  const snapshot = await getUserEntitlementSnapshot(session.user.id)
  const hasAccess = hasReliabilityGateAccess(snapshot.plan.id)

  const runs = hasAccess
    ? await prisma.reliabilityGateRun.findMany({
        where: {
          userId: session.user.id,
        },
        orderBy: [{ createdAt: "desc" }],
        take: 150,
      })
    : []

  const summary = buildReliabilityGateSummary(runs)

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-3">
            <CardTitle>全链路质量闸门</CardTitle>
            <Badge variant="secondary">Week24-001</Badge>
            <Badge>{snapshot.plan.name}</Badge>
          </div>
          <CardDescription>
            统一功能、性能、安全回归门禁，按风险分级执行阻断并对接分支保护与发布门禁。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <QualityGatePanel
            hasAccess={hasAccess}
            planId={snapshot.plan.id}
            runs={runs.map((item) => ({
              id: item.id,
              releaseKey: item.releaseKey,
              gateType: item.gateType,
              severity: item.severity,
              status: item.status,
              environment: item.environment,
              blockReason: item.blockReason,
              createdAt: item.createdAt.toISOString(),
            }))}
            summary={summary}
          />
        </CardContent>
      </Card>
    </div>
  )
}
