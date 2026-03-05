import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"

import { GovernanceAuditPanel } from "@/components/integrations/governance-audit-panel"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { resolveGovernanceIntegritySummary } from "@/lib/integration-governance"
import {
  getUserEntitlementSnapshot,
  hasIntegrationGovernanceAccess,
} from "@/lib/subscription-entitlements"

export default async function GovernancePage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    redirect("/login")
  }

  const snapshot = await getUserEntitlementSnapshot(session.user.id)
  const hasAccess = hasIntegrationGovernanceAccess(snapshot.plan.id)

  const logs = hasAccess
    ? await prisma.promptAuditLog.findMany({
        where: {
          actorId: session.user.id,
          resource: {
            in: ["connectors", "prompt-flow"],
          },
        },
        orderBy: [{ createdAt: "desc" }],
        take: 120,
      })
    : []

  const integrity = resolveGovernanceIntegritySummary(logs)

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-3">
            <CardTitle>连接器与工作流审计治理</CardTitle>
            <Badge variant="secondary">Week22-004</Badge>
            <Badge>{snapshot.plan.name}</Badge>
          </div>
          <CardDescription>
            记录连接器密钥变更、授权操作与工作流发布/回滚/禁用日志，支持按资源维度检索并验证不可抵赖。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <GovernanceAuditPanel
            hasAccess={hasAccess}
            planId={snapshot.plan.id}
            logs={logs.map((item) => ({
              id: item.id,
              action: item.action,
              resource: item.resource,
              status: item.status,
              immutable: item.immutable,
              entryHash: item.entryHash,
              createdAt: item.createdAt.toISOString(),
              metadata:
                item.metadata && typeof item.metadata === "object" && !Array.isArray(item.metadata)
                  ? (item.metadata as Record<string, unknown>)
                  : null,
            }))}
            integrity={integrity}
          />
        </CardContent>
      </Card>
    </div>
  )
}
