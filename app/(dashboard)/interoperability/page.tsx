import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"

import { InteroperabilityPanel } from "@/components/interoperability/interoperability-panel"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { buildInteropProfileSeed } from "@/lib/prompt-interoperability"
import { getUserEntitlementSnapshot, hasPromptInteropAccess } from "@/lib/subscription-entitlements"

export default async function InteroperabilityPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    redirect("/login")
  }

  const snapshot = await getUserEntitlementSnapshot(session.user.id)
  const hasAccess = hasPromptInteropAccess(snapshot.plan.id)

  const count = hasAccess
    ? await prisma.promptInteropProfile.count({
        where: {
          userId: session.user.id,
        },
      })
    : 0

  if (hasAccess && count === 0) {
    await prisma.promptInteropProfile.createMany({
      data: buildInteropProfileSeed(session.user.id),
    })
  }

  const [profiles, jobs] = hasAccess
    ? await Promise.all([
        prisma.promptInteropProfile.findMany({
          where: {
            userId: session.user.id,
          },
          orderBy: [{ updatedAt: "desc" }],
          take: 60,
        }),
        prisma.promptInteropJob.findMany({
          where: {
            userId: session.user.id,
          },
          include: {
            profile: {
              select: {
                id: true,
                name: true,
                platform: true,
                mode: true,
              },
            },
          },
          orderBy: [{ createdAt: "desc" }],
          take: 160,
        }),
      ])
    : [[], []]

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-3">
            <CardTitle>跨平台适配中心</CardTitle>
            <Badge variant="secondary">Week22-003</Badge>
            <Badge>{snapshot.plan.name}</Badge>
          </div>
          <CardDescription>
            支持 Langfuse / Promptfoo / OpenWebUI 的导入导出映射、批量预览与差异确认，并验证 round-trip 一致性。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <InteroperabilityPanel
            hasAccess={hasAccess}
            planId={snapshot.plan.id}
            profiles={profiles.map((item) => ({
              id: item.id,
              name: item.name,
              platform: item.platform,
              mode: item.mode,
              fieldMapping:
                item.fieldMapping && typeof item.fieldMapping === "object" && !Array.isArray(item.fieldMapping)
                  ? {
                      externalId: String((item.fieldMapping as Record<string, unknown>).externalId || "id"),
                      title: String((item.fieldMapping as Record<string, unknown>).title || "title"),
                      content: String((item.fieldMapping as Record<string, unknown>).content || "content"),
                      description: String((item.fieldMapping as Record<string, unknown>).description || "description"),
                      tags: String((item.fieldMapping as Record<string, unknown>).tags || "tags"),
                      updatedAt: String((item.fieldMapping as Record<string, unknown>).updatedAt || "updatedAt"),
                    }
                  : {
                      externalId: "id",
                      title: "title",
                      content: "content",
                      description: "description",
                      tags: "tags",
                      updatedAt: "updatedAt",
                    },
              conflictPolicy: item.conflictPolicy,
              compatibilityMode: item.compatibilityMode,
              updatedAt: item.updatedAt.toISOString(),
            }))}
            jobs={jobs.map((item) => ({
              id: item.id,
              profileId: item.profileId,
              platform: item.platform,
              mode: item.mode,
              status: item.status,
              appliedCount: item.appliedCount,
              skippedCount: item.skippedCount,
              conflictCount: item.conflictCount,
              errorMessage: item.errorMessage || "",
              previewSummary:
                item.previewSummary && typeof item.previewSummary === "object" && !Array.isArray(item.previewSummary)
                  ? (item.previewSummary as Record<string, unknown>)
                  : {},
              exportedPayload: Array.isArray(item.exportedPayload) ? item.exportedPayload : [],
              createdAt: item.createdAt.toISOString(),
              profile: item.profile,
            }))}
          />
        </CardContent>
      </Card>
    </div>
  )
}
