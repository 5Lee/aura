import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"

import { AuditCompliancePanel } from "@/components/compliance/audit-compliance-panel"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { authOptions } from "@/lib/auth"
import {
  DEFAULT_AUDIT_RETENTION_DAYS,
  getOrCreateAuditRetentionPolicy,
} from "@/lib/compliance-audit"
import { prisma } from "@/lib/db"

export default async function CompliancePage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    redirect("/login")
  }

  const policy = await getOrCreateAuditRetentionPolicy(session.user.id)
  const [logs, anomalies] = await Promise.all([
    prisma.promptAuditLog.findMany({
      where: {
        OR: [{ actorId: session.user.id }, { prompt: { authorId: session.user.id } }],
      },
      orderBy: [{ createdAt: "desc" }],
      take: 30,
      select: {
        id: true,
        action: true,
        resource: true,
        status: true,
        riskLevel: true,
        requestId: true,
        entryHash: true,
        previousHash: true,
        createdAt: true,
      },
    }),
    prisma.auditAnomaly.findMany({
      where: {
        userId: session.user.id,
      },
      orderBy: [{ lastSeenAt: "desc" }],
      take: 30,
      select: {
        id: true,
        type: true,
        status: true,
        severity: true,
        summary: true,
        occurrences: true,
        lastSeenAt: true,
      },
    }),
  ])

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-3">
            <CardTitle>合规审计增强</CardTitle>
            <Badge variant="secondary">Week19-003</Badge>
            <Badge>审计可追溯</Badge>
          </div>
          <CardDescription>
            提供敏感操作留痕、审计导出、保留策略、异常访问检测与不可篡改链路校验。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AuditCompliancePanel
            policy={{
              retentionDays: policy.retentionDays || DEFAULT_AUDIT_RETENTION_DAYS,
              exportEnabled: policy.exportEnabled,
              failureBurstThreshold: policy.failureBurstThreshold,
              multiIpBurstThreshold: policy.multiIpBurstThreshold,
              sensitiveBurstThreshold: policy.sensitiveBurstThreshold,
            }}
            anomalies={anomalies.map((item) => ({
              id: item.id,
              type: item.type,
              status: item.status,
              severity: item.severity,
              summary: item.summary,
              occurrences: item.occurrences,
              lastSeenAt: item.lastSeenAt.toISOString(),
            }))}
            logs={logs.map((item) => ({
              id: item.id,
              action: item.action,
              resource: item.resource,
              status: item.status,
              riskLevel: item.riskLevel,
              requestId: item.requestId,
              entryHash: item.entryHash,
              previousHash: item.previousHash,
              createdAt: item.createdAt.toISOString(),
            }))}
          />
        </CardContent>
      </Card>
    </div>
  )
}
