import { OpsNotificationStatus } from "@prisma/client"
import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"

import { NotificationOrchestrationPanel } from "@/components/ops/notification-orchestration-panel"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { buildNotificationRuleSeed } from "@/lib/ops-notifications"
import {
  getUserEntitlementSnapshot,
  hasNotificationOrchestrationAccess,
} from "@/lib/subscription-entitlements"

export default async function NotificationOrchestrationPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    redirect("/login")
  }

  const snapshot = await getUserEntitlementSnapshot(session.user.id)
  const hasAccess = hasNotificationOrchestrationAccess(snapshot.plan.id)

  const count = hasAccess
    ? await prisma.opsNotificationRule.count({
        where: {
          userId: session.user.id,
        },
      })
    : 0

  if (hasAccess && count === 0) {
    await prisma.opsNotificationRule.createMany({
      data: buildNotificationRuleSeed(session.user.id),
    })
  }

  const [rules, deliveries] = hasAccess
    ? await Promise.all([
        prisma.opsNotificationRule.findMany({
          where: {
            userId: session.user.id,
          },
          orderBy: [{ updatedAt: "desc" }],
          take: 60,
        }),
        prisma.opsNotificationDelivery.findMany({
          where: {
            userId: session.user.id,
          },
          include: {
            rule: {
              select: {
                id: true,
                name: true,
                frequencyCapPerHour: true,
                dedupeWindowMinutes: true,
              },
            },
          },
          orderBy: [{ createdAt: "desc" }],
          take: 150,
        }),
      ])
    : [[], []]

  const stats = deliveries.reduce(
    (acc, item) => {
      acc.total += 1
      if (item.status === OpsNotificationStatus.SENT) {
        acc.sent += 1
      }
      if (item.status === OpsNotificationStatus.FAILED) {
        acc.failed += 1
      }
      if (item.status === OpsNotificationStatus.DEDUPED) {
        acc.deduped += 1
      }
      if (item.status === OpsNotificationStatus.SUPPRESSED) {
        acc.suppressed += 1
      }
      return acc
    },
    { total: 0, sent: 0, failed: 0, deduped: 0, suppressed: 0 }
  )

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-3">
            <CardTitle>通知编排与多通道触达</CardTitle>
            <Badge variant="secondary">Week23-002</Badge>
            <Badge>{snapshot.plan.name}</Badge>
          </div>
          <CardDescription>
            支持站内、邮件、Webhook 通道，提供用户级静默窗口、频控与重复消息去重补偿，并回收送达回执。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <NotificationOrchestrationPanel
            hasAccess={hasAccess}
            planId={snapshot.plan.id}
            rules={rules.map((item) => ({
              id: item.id,
              name: item.name,
              enabled: item.enabled,
              channels: item.channels,
              quietWindowStart: item.quietWindowStart,
              quietWindowEnd: item.quietWindowEnd,
              frequencyCapPerHour: item.frequencyCapPerHour,
              dedupeWindowMinutes: item.dedupeWindowMinutes,
            }))}
            deliveries={deliveries.map((item) => ({
              id: item.id,
              ruleId: item.ruleId,
              channel: item.channel,
              status: item.status,
              recipient: item.recipient,
              receiptCode: item.receiptCode,
              errorMessage: item.errorMessage,
              createdAt: item.createdAt.toISOString(),
              rule: item.rule,
            }))}
            stats={stats}
          />
        </CardContent>
      </Card>
    </div>
  )
}
