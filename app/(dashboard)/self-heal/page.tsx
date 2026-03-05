import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"

import { SelfHealPanel } from "@/components/reliability/self-heal-panel"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { buildSelfHealPatternSeed, resolveSelfHealEfficiency } from "@/lib/self-heal"
import { getUserEntitlementSnapshot, hasSelfHealAccess } from "@/lib/subscription-entitlements"

export default async function SelfHealPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    redirect("/login")
  }

  const snapshot = await getUserEntitlementSnapshot(session.user.id)
  const hasAccess = hasSelfHealAccess(snapshot.plan.id)

  const patternCount = hasAccess
    ? await prisma.selfHealPattern.count({
        where: {
          userId: session.user.id,
        },
      })
    : 0

  if (hasAccess && patternCount === 0) {
    await prisma.selfHealPattern.createMany({
      data: buildSelfHealPatternSeed(session.user.id),
    })
  }

  const [patterns, executions] = hasAccess
    ? await Promise.all([
        prisma.selfHealPattern.findMany({
          where: {
            userId: session.user.id,
          },
          orderBy: [{ updatedAt: "desc" }],
          take: 80,
        }),
        prisma.selfHealExecution.findMany({
          where: {
            userId: session.user.id,
          },
          include: {
            pattern: {
              select: {
                id: true,
                name: true,
                defectSignature: true,
              },
            },
          },
          orderBy: [{ createdAt: "desc" }],
          take: 180,
        }),
      ])
    : [[], []]

  const efficiency = resolveSelfHealEfficiency(
    executions.map((item) => ({
      status: item.status,
      createdAt: item.createdAt,
      appliedAt: item.appliedAt,
    }))
  )

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-3">
            <CardTitle>回归资产与自愈修复</CardTitle>
            <Badge variant="secondary">Week24-002</Badge>
            <Badge>{snapshot.plan.name}</Badge>
          </div>
          <CardDescription>
            沉淀高价值回归脚本资产与缺陷模式，自动生成修复建议并支持人工确认落地，持续提升重复缺陷修复效率。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SelfHealPanel
            hasAccess={hasAccess}
            planId={snapshot.plan.id}
            patterns={patterns.map((item) => ({
              id: item.id,
              name: item.name,
              defectSignature: item.defectSignature,
              fixTemplate: item.fixTemplate,
              regressionScript: item.regressionScript,
              confidenceScore: item.confidenceScore,
              successRate: item.successRate,
              enabled: item.enabled,
            }))}
            executions={executions.map((item) => ({
              id: item.id,
              patternId: item.patternId,
              status: item.status,
              defectReference: item.defectReference,
              suggestion: item.suggestion,
              patchPreview: item.patchPreview,
              createdAt: item.createdAt.toISOString(),
              appliedAt: item.appliedAt ? item.appliedAt.toISOString() : null,
              pattern: item.pattern,
            }))}
            efficiency={efficiency}
          />
        </CardContent>
      </Card>
    </div>
  )
}
