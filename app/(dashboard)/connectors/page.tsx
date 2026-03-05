import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"

import { ConnectorCatalogPanel } from "@/components/integrations/connector-catalog-panel"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { buildConnectorSeed } from "@/lib/integration-connectors"
import { getUserEntitlementSnapshot, hasConnectorCatalogAccess } from "@/lib/subscription-entitlements"

export default async function ConnectorsPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    redirect("/login")
  }

  const snapshot = await getUserEntitlementSnapshot(session.user.id)
  const hasAccess = hasConnectorCatalogAccess(snapshot.plan.id)

  const count = hasAccess
    ? await prisma.integrationConnector.count({
        where: {
          userId: session.user.id,
        },
      })
    : 0

  if (hasAccess && count === 0) {
    await prisma.integrationConnector.createMany({
      data: buildConnectorSeed(session.user.id),
    })
  }

  const [connectors, healthChecks] = hasAccess
    ? await Promise.all([
        prisma.integrationConnector.findMany({
          where: {
            userId: session.user.id,
          },
          orderBy: [{ updatedAt: "desc" }],
          take: 80,
        }),
        prisma.integrationConnectorHealthCheck.findMany({
          where: {
            userId: session.user.id,
          },
          include: {
            connector: {
              select: {
                id: true,
                name: true,
                provider: true,
                status: true,
              },
            },
          },
          orderBy: [{ checkAt: "desc" }],
          take: 120,
        }),
      ])
    : [[], []]

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-3">
            <CardTitle>连接器目录中心</CardTitle>
            <Badge variant="secondary">Week22-001</Badge>
            <Badge>{snapshot.plan.name}</Badge>
          </div>
          <CardDescription>
            建立第三方模型与工具连接器清单，支持 API Key/Secret 安全存储与轮换，并提供健康检查与诊断。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ConnectorCatalogPanel
            hasAccess={hasAccess}
            planId={snapshot.plan.id}
            connectors={connectors.map((item) => ({
              id: item.id,
              name: item.name,
              provider: item.provider,
              status: item.status,
              apiBaseUrl: item.apiBaseUrl,
              credentialPreview: item.credentialPreview,
              secretVersion: item.secretVersion,
              lastRotatedAt: item.lastRotatedAt ? item.lastRotatedAt.toISOString() : "",
              lastCheckedAt: item.lastCheckedAt ? item.lastCheckedAt.toISOString() : "",
              lastCheckStatus: item.lastCheckStatus || "",
              lastCheckMessage: item.lastCheckMessage || "",
            }))}
            healthChecks={healthChecks.map((item) => ({
              id: item.id,
              connectorId: item.connectorId,
              status: item.status,
              message: item.message,
              latencyMs: item.latencyMs,
              checkAt: item.checkAt.toISOString(),
              connector: item.connector,
            }))}
          />
        </CardContent>
      </Card>
    </div>
  )
}
