import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"

import { PlaybookMarketPanel } from "@/components/ops/playbook-market-panel"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { buildPlaybookSeed } from "@/lib/ops-playbook"
import { getUserEntitlementSnapshot, hasOpsPlaybookAccess } from "@/lib/subscription-entitlements"

export default async function PlaybookMarketPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    redirect("/login")
  }

  const snapshot = await getUserEntitlementSnapshot(session.user.id)
  const hasAccess = hasOpsPlaybookAccess(snapshot.plan.id)

  const count = hasAccess
    ? await prisma.opsPlaybookTemplate.count({
        where: {
          userId: session.user.id,
        },
      })
    : 0

  if (hasAccess && count === 0) {
    await prisma.opsPlaybookTemplate.createMany({
      data: buildPlaybookSeed(session.user.id),
    })
  }

  const playbooks = hasAccess
    ? await prisma.opsPlaybookTemplate.findMany({
        where: {
          userId: session.user.id,
        },
        orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
        take: 120,
      })
    : []

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-3">
            <CardTitle>运营 Playbook 模板市场</CardTitle>
            <Badge variant="secondary">Week23-004</Badge>
            <Badge>{snapshot.plan.name}</Badge>
          </div>
          <CardDescription>
            提供剧本模板创建与复用能力，支持评分、标签、版本管理，并可一键应用到任务中心。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PlaybookMarketPanel
            hasAccess={hasAccess}
            planId={snapshot.plan.id}
            playbooks={playbooks.map((item) => ({
              id: item.id,
              name: item.name,
              summary: item.summary,
              status: item.status,
              tags: item.tags,
              version: item.version,
              ratingScore: item.ratingScore,
              ratingCount: item.ratingCount,
              compatibilityNotes: item.compatibilityNotes,
              rollbackTargetVersion: item.rollbackTargetVersion,
            }))}
          />
        </CardContent>
      </Card>
    </div>
  )
}
