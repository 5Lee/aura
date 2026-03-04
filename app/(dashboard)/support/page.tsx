import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"

import { SupportTicketPanel } from "@/components/support/support-ticket-panel"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { getUserEntitlementSnapshot } from "@/lib/subscription-entitlements"
import { isOpenSupportStatus, resolvePriorityDispatchScore, resolveSupportPolicy } from "@/lib/support-tickets"

export default async function SupportPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    redirect("/login")
  }

  const [entitlement, tickets] = await Promise.all([
    getUserEntitlementSnapshot(session.user.id),
    prisma.supportTicket.findMany({
      where: {
        userId: session.user.id,
      },
      orderBy: [{ createdAt: "desc" }],
      take: 30,
    }),
  ])

  const policy = resolveSupportPolicy(entitlement.plan.id)
  const now = Date.now()
  const queuePreview = tickets
    .map((ticket) => {
      const waitingHours = Math.max(0, (now - ticket.createdAt.getTime()) / (60 * 60 * 1000))
      return {
        ticketNo: ticket.ticketNo,
        title: ticket.title,
        status: ticket.status,
        dispatchScore: resolvePriorityDispatchScore(ticket.tier, ticket.priority, waitingHours),
      }
    })
    .sort((a, b) => b.dispatchScore - a.dispatchScore)
    .slice(0, 5)

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-3">
            <CardTitle>专属支持通道与工单体系</CardTitle>
            <Badge variant="secondary">Week18-002</Badge>
            <Badge>{entitlement.plan.name}</Badge>
          </div>
          <CardDescription>
            工单优先级与响应时效按套餐分层，确保高价值用户问题获得更高调度权重。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-lg border border-border bg-muted/20 p-4">
              <p className="text-xs text-muted-foreground">支持等级</p>
              <p className="mt-1 text-lg font-semibold">{policy.label}</p>
            </div>
            <div className="rounded-lg border border-border bg-muted/20 p-4">
              <p className="text-xs text-muted-foreground">SLA 响应目标</p>
              <p className="mt-1 text-lg font-semibold">{policy.slaHours} 小时</p>
            </div>
            <div className="rounded-lg border border-border bg-muted/20 p-4">
              <p className="text-xs text-muted-foreground">开放工单数</p>
              <p className="mt-1 text-lg font-semibold">
                {tickets.filter((ticket) => isOpenSupportStatus(ticket.status)).length}
              </p>
            </div>
          </div>

          <SupportTicketPanel
            policy={policy}
            tickets={tickets.map((ticket) => ({
              id: ticket.id,
              ticketNo: ticket.ticketNo,
              title: ticket.title,
              category: ticket.category,
              status: ticket.status,
              priority: ticket.priority,
              tier: ticket.tier,
              responseDueAt: ticket.responseDueAt?.toISOString() ?? null,
              createdAt: ticket.createdAt.toISOString(),
            }))}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>调度优先级预览</CardTitle>
          <CardDescription>按照套餐等级、优先级与等待时长计算的调度分数（越高越优先）。</CardDescription>
        </CardHeader>
        <CardContent>
          {queuePreview.length === 0 ? (
            <p className="text-sm text-muted-foreground">暂无工单。</p>
          ) : (
            <div className="space-y-2 text-sm">
              {queuePreview.map((item) => (
                <div
                  key={item.ticketNo}
                  className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{item.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {item.ticketNo} · {item.status}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground">{item.dispatchScore.toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
