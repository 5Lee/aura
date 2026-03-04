import { getServerSession } from "next-auth"
import Link from "next/link"
import { redirect } from "next/navigation"

import { SubscriptionManagementPanel } from "@/components/billing/subscription-management-panel"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { getUserEntitlementSnapshot } from "@/lib/subscription-entitlements"

function formatLimit(value: number | "unlimited") {
  return value === "unlimited" ? "不限" : value.toLocaleString("zh-CN")
}

function formatTime(value: Date | null | undefined) {
  if (!value) {
    return "-"
  }
  return value.toLocaleString("zh-CN", { hour12: false })
}

function formatStatus(status: string | null | undefined) {
  if (!status) {
    return "FREE"
  }
  return status
}

export default async function BillingPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    redirect("/login")
  }

  const snapshot = await getUserEntitlementSnapshot(session.user.id)
  const billingEvents = await prisma.billingEvent.findMany({
    where: {
      userId: session.user.id,
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  })

  const currentSubscription = snapshot.subscription

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-3">
            <CardTitle>订阅管理与账单中心</CardTitle>
            <Badge variant="secondary">Week17-003</Badge>
            <Badge>{snapshot.plan.name}</Badge>
          </div>
          <CardDescription>
            套餐切换、续费、取消、恢复与账单导出统一在此管理；套餐变更后配额即时生效。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="rounded-lg border border-border bg-muted/20 p-4">
              <p className="text-xs text-muted-foreground">当前状态</p>
              <p className="mt-2 text-xl font-semibold">{formatStatus(currentSubscription?.status)}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                下一计费时间：{formatTime(currentSubscription?.currentPeriodEnd)}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-muted/20 p-4">
              <p className="text-xs text-muted-foreground">提示词用量</p>
              <p className="mt-2 text-xl font-semibold">
                {snapshot.usage.promptCount} / {formatLimit(snapshot.plan.limits.maxPrompts)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                已使用 {snapshot.usage.promptUsagePercent}%
              </p>
            </div>
            <div className="rounded-lg border border-border bg-muted/20 p-4">
              <p className="text-xs text-muted-foreground">月度评测用量</p>
              <p className="mt-2 text-xl font-semibold">
                {snapshot.usage.monthlyEvalRuns} / {formatLimit(snapshot.plan.limits.maxEvalRunsPerMonth)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                已使用 {snapshot.usage.evalUsagePercent}%
              </p>
            </div>
          </div>

          <SubscriptionManagementPanel
            currentPlanId={snapshot.plan.id}
            currentCycle={currentSubscription?.cycle ?? "MONTHLY"}
            currentStatus={currentSubscription?.status ?? null}
            hasSubscription={Boolean(currentSubscription)}
            cancelAtPeriodEnd={Boolean(currentSubscription?.cancelAtPeriodEnd)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>账单事件历史</CardTitle>
              <CardDescription>最近 20 条订阅与计费事件，支持 CSV 下载归档。</CardDescription>
            </div>
            <Button asChild variant="outline">
              <Link href="/api/subscription/history?format=csv">下载 CSV</Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {billingEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground">暂无账单事件记录。</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="text-left text-muted-foreground">
                  <tr>
                    <th className="border-b px-2 py-2 font-medium">时间</th>
                    <th className="border-b px-2 py-2 font-medium">类型</th>
                    <th className="border-b px-2 py-2 font-medium">状态</th>
                    <th className="border-b px-2 py-2 font-medium">渠道</th>
                    <th className="border-b px-2 py-2 font-medium">事件 ID</th>
                  </tr>
                </thead>
                <tbody>
                  {billingEvents.map((event) => (
                    <tr key={event.id}>
                      <td className="border-b px-2 py-2 text-muted-foreground">
                        {formatTime(event.createdAt)}
                      </td>
                      <td className="border-b px-2 py-2">{event.type}</td>
                      <td className="border-b px-2 py-2">{event.status}</td>
                      <td className="border-b px-2 py-2">{event.provider}</td>
                      <td className="border-b px-2 py-2 text-xs text-muted-foreground">
                        {event.providerEventId}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
