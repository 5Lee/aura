import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"

import { SlaMonitoringPanel } from "@/components/sla/sla-monitoring-panel"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { resolveSlaPolicy } from "@/lib/sla-monitoring"
import { getUserEntitlementSnapshot } from "@/lib/subscription-entitlements"

export default async function SlaPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    redirect("/login")
  }

  const [entitlement, snapshots, alerts] = await Promise.all([
    getUserEntitlementSnapshot(session.user.id),
    prisma.slaSnapshot.findMany({
      where: { userId: session.user.id },
      orderBy: [{ windowEnd: "desc" }],
      take: 20,
    }),
    prisma.slaAlert.findMany({
      where: { userId: session.user.id },
      orderBy: [{ triggeredAt: "desc" }],
      take: 20,
    }),
  ])

  const policy = resolveSlaPolicy(entitlement.plan.id)
  const openAlertCount = alerts.filter((alert) => alert.status === "OPEN").length

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-3">
            <CardTitle>SLA 监控与告警</CardTitle>
            <Badge variant="secondary">Week18-004</Badge>
            <Badge>{entitlement.plan.name}</Badge>
          </div>
          <CardDescription>
            按套餐目标实时生成 SLA 报表，覆盖可用性、错误率、延迟阈值告警，并支持故障注入与恢复验证。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-lg border border-border bg-muted/20 p-4">
              <p className="text-xs text-muted-foreground">当前开放告警</p>
              <p className="mt-1 text-lg font-semibold">{openAlertCount}</p>
            </div>
            <div className="rounded-lg border border-border bg-muted/20 p-4">
              <p className="text-xs text-muted-foreground">报表窗口</p>
              <p className="mt-1 text-lg font-semibold">{policy.reportWindowHours} 小时</p>
            </div>
            <div className="rounded-lg border border-border bg-muted/20 p-4">
              <p className="text-xs text-muted-foreground">最近快照数</p>
              <p className="mt-1 text-lg font-semibold">{snapshots.length}</p>
            </div>
          </div>

          <SlaMonitoringPanel
            planId={entitlement.plan.id}
            policy={policy}
            snapshots={snapshots.map((item) => ({
              id: item.id,
              windowStart: item.windowStart.toISOString(),
              windowEnd: item.windowEnd.toISOString(),
              availabilityRate: item.availabilityRate,
              errorRate: item.errorRate,
              latencyP95Ms: item.latencyP95Ms,
              totalChecks: item.totalChecks,
              failedChecks: item.failedChecks,
              metadata: item.metadata,
            }))}
            alerts={alerts.map((item) => ({
              id: item.id,
              metric: item.metric,
              status: item.status,
              threshold: item.threshold,
              observed: item.observed,
              summary: item.summary,
              triggeredAt: item.triggeredAt.toISOString(),
              recoveredAt: item.recoveredAt?.toISOString() ?? null,
            }))}
          />
        </CardContent>
      </Card>
    </div>
  )
}
