import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"

import { OpsTaskCenterPanel } from "@/components/ops/ops-task-center-panel"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { buildOpsTaskTemplateSeed } from "@/lib/ops-automation"
import { getUserEntitlementSnapshot, hasOpsAutomationAccess } from "@/lib/subscription-entitlements"

export default async function OpsCenterPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    redirect("/login")
  }

  const snapshot = await getUserEntitlementSnapshot(session.user.id)
  const hasAccess = hasOpsAutomationAccess(snapshot.plan.id)

  const templateCount = hasAccess
    ? await prisma.opsTaskTemplate.count({
        where: {
          userId: session.user.id,
        },
      })
    : 0

  if (hasAccess && templateCount === 0) {
    await prisma.opsTaskTemplate.createMany({
      data: buildOpsTaskTemplateSeed(session.user.id),
    })
  }

  const [templates, runs] = hasAccess
    ? await Promise.all([
        prisma.opsTaskTemplate.findMany({
          where: {
            userId: session.user.id,
          },
          orderBy: [{ updatedAt: "desc" }],
          take: 80,
        }),
        prisma.opsTaskRun.findMany({
          where: {
            userId: session.user.id,
          },
          include: {
            template: {
              select: {
                id: true,
                name: true,
                status: true,
                retryLimit: true,
              },
            },
          },
          orderBy: [{ createdAt: "desc" }],
          take: 150,
        }),
      ])
    : [[], []]

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-3">
            <CardTitle>运营自动化任务中心</CardTitle>
            <Badge variant="secondary">Week23-001</Badge>
            <Badge>{snapshot.plan.name}</Badge>
          </div>
          <CardDescription>
            建立任务模板与执行计划，支持定时执行、失败重试、告警回执与历史产出追踪，验证幂等与异常恢复。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <OpsTaskCenterPanel
            hasAccess={hasAccess}
            planId={snapshot.plan.id}
            templates={templates.map((item) => ({
              id: item.id,
              name: item.name,
              description: item.description,
              status: item.status,
              scheduleCron: item.scheduleCron,
              retryLimit: item.retryLimit,
              defaultChannel: item.defaultChannel,
              lastRunAt: item.lastRunAt ? item.lastRunAt.toISOString() : null,
            }))}
            runs={runs.map((item) => ({
              id: item.id,
              templateId: item.templateId,
              status: item.status,
              attempts: item.attempts,
              outputSummary: item.outputSummary,
              alertSent: item.alertSent,
              createdAt: item.createdAt.toISOString(),
              template: item.template,
            }))}
          />
        </CardContent>
      </Card>
    </div>
  )
}
