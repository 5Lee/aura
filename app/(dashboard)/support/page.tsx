import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"

import { EnterpriseSupportProcessPanel } from "@/components/support/enterprise-support-process-panel"
import { SupportTicketPanel } from "@/components/support/support-ticket-panel"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { extractSupportRunbookConfig, resolveCrossTeamCollaborationEfficiency } from "@/lib/enterprise-support"
import {
  getUserEntitlementSnapshot,
  hasEnterpriseSupportProcessAccess,
} from "@/lib/subscription-entitlements"
import { isOpenSupportStatus, resolvePriorityDispatchScore, resolveSupportPolicy } from "@/lib/support-tickets"

function parseStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as string[]
  }
  return value.filter((item): item is string => typeof item === "string")
}

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

  const hasSupportProcessAccess = hasEnterpriseSupportProcessAccess(entitlement.plan.id)

  const [runbookRow, escalationPolicies, escalationEvents, postmortems] = await Promise.all([
    hasSupportProcessAccess
      ? prisma.supportRunbook.findUnique({
          where: {
            userId: session.user.id,
          },
        })
      : Promise.resolve(null),
    hasSupportProcessAccess
      ? prisma.supportEscalationPolicy.findMany({
          where: {
            userId: session.user.id,
            planId: entitlement.plan.id,
          },
          orderBy: [{ level: "asc" }, { updatedAt: "desc" }],
          take: 30,
        })
      : Promise.resolve([]),
    hasSupportProcessAccess
      ? prisma.supportEscalationEvent.findMany({
          where: {
            ticket: {
              userId: session.user.id,
            },
          },
          include: {
            ticket: {
              select: {
                id: true,
                ticketNo: true,
                title: true,
                status: true,
              },
            },
          },
          orderBy: [{ createdAt: "desc" }],
          take: 40,
        })
      : Promise.resolve([]),
    hasSupportProcessAccess
      ? prisma.supportPostmortem.findMany({
          where: {
            tenantUserId: session.user.id,
          },
          include: {
            ticket: {
              select: {
                id: true,
                ticketNo: true,
                title: true,
                status: true,
              },
            },
          },
          orderBy: [{ createdAt: "desc" }],
          take: 40,
        })
      : Promise.resolve([]),
  ])

  const runbookConfig = extractSupportRunbookConfig({
    triageChecklist: runbookRow?.triageChecklist,
    escalationWorkflow: runbookRow?.escalationWorkflow,
    responseWorkflow: runbookRow?.responseWorkflow,
    contactMatrix: runbookRow?.contactMatrix,
    postmortemTemplate: runbookRow?.postmortemTemplate,
  })

  const collaboration = resolveCrossTeamCollaborationEfficiency({
    escalationEvents: escalationEvents.map((item) => ({
      status: item.status,
      createdAt: item.createdAt,
      resolvedAt: item.resolvedAt,
    })),
    postmortems: postmortems.map((item) => ({
      status: item.status,
      createdAt: item.createdAt,
      publishedAt: item.publishedAt,
    })),
  })

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

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-3">
            <CardTitle>企业支持流程标准化</CardTitle>
            <Badge variant="secondary">Week19-004</Badge>
            <Badge>{entitlement.plan.name}</Badge>
          </div>
          <CardDescription>
            定义分级升级路径、故障响应 Runbook 与复盘发布流程，并持续衡量跨团队协作效率。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EnterpriseSupportProcessPanel
            hasAccess={hasSupportProcessAccess}
            planId={entitlement.plan.id}
            runbook={{
              id: runbookRow?.id ?? null,
              config: runbookConfig,
            }}
            policies={escalationPolicies.map((item) => ({
              id: item.id,
              level: item.level,
              fromTier: item.fromTier,
              fromPriority: item.fromPriority,
              targetTier: item.targetTier,
              targetPriority: item.targetPriority,
              targetTeam: item.targetTeam,
              targetRole: item.targetRole,
              responseSlaHours: item.responseSlaHours,
              resolutionSlaHours: item.resolutionSlaHours,
              workflowSteps: parseStringArray(item.workflowSteps),
              active: item.active,
            }))}
            events={escalationEvents.map((item) => ({
              id: item.id,
              ticketId: item.ticketId,
              status: item.status,
              level: item.level,
              targetTeam: item.targetTeam,
              reason: item.reason,
              createdAt: item.createdAt.toISOString(),
              ticket: item.ticket,
            }))}
            postmortems={postmortems.map((item) => ({
              id: item.id,
              ticketId: item.ticketId,
              status: item.status,
              severity: item.severity,
              summary: item.summary,
              impact: item.impact,
              rootCause: item.rootCause,
              timeline: item.timeline,
              actionItems: item.actionItems,
              publishedAt: item.publishedAt?.toISOString() ?? null,
              createdAt: item.createdAt.toISOString(),
              updatedAt: item.updatedAt.toISOString(),
              ticket: item.ticket,
            }))}
            tickets={tickets.map((ticket) => ({
              id: ticket.id,
              ticketNo: ticket.ticketNo,
              title: ticket.title,
              status: ticket.status,
              priority: ticket.priority,
              tier: ticket.tier,
            }))}
            collaboration={collaboration}
          />
        </CardContent>
      </Card>
    </div>
  )
}
