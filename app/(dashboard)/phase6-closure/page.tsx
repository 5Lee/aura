import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"

import { Phase6ClosurePanel } from "@/components/reliability/phase6-closure-panel"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { resolvePhase6ClosureScore } from "@/lib/phase6-closure"
import { getUserEntitlementSnapshot, hasPhase6ClosureAccess } from "@/lib/subscription-entitlements"

export default async function Phase6ClosurePage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    redirect("/login")
  }

  const snapshot = await getUserEntitlementSnapshot(session.user.id)
  const hasAccess = hasPhase6ClosureAccess(snapshot.plan.id)

  const report = hasAccess
    ? (await prisma.phase6ClosureReport.findFirst({
        where: {
          userId: session.user.id,
        },
        orderBy: {
          updatedAt: "desc",
        },
      })) ||
      (await prisma.phase6ClosureReport.create({
        data: {
          userId: session.user.id,
        },
      }))
    : null

  const score =
    report === null
      ? {
          passed: 0,
          total: 6,
          percent: 0,
          readyToFreeze: false,
        }
      : resolvePhase6ClosureScore({
          functionalGatePassed: report.functionalGatePassed,
          performanceGatePassed: report.performanceGatePassed,
          securityGatePassed: report.securityGatePassed,
          runbookUrl: report.runbookUrl || "",
          emergencyPlanUrl: report.emergencyPlanUrl || "",
          trainingMaterialUrl: report.trainingMaterialUrl || "",
        })

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-3">
            <CardTitle>Phase6 终验与运营化交付</CardTitle>
            <Badge variant="secondary">Week24-004</Badge>
            <Badge>{snapshot.plan.name}</Badge>
          </div>
          <CardDescription>
            完成 Phase6 功能和指标终验，补齐运维手册、应急预案、培训材料，执行上线演练并冻结基线。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Phase6ClosurePanel
            hasAccess={hasAccess}
            planId={snapshot.plan.id}
            report={
              report
                ? {
                    id: report.id,
                    status: report.status,
                    functionalGatePassed: report.functionalGatePassed,
                    performanceGatePassed: report.performanceGatePassed,
                    securityGatePassed: report.securityGatePassed,
                    runbookUrl: report.runbookUrl,
                    emergencyPlanUrl: report.emergencyPlanUrl,
                    trainingMaterialUrl: report.trainingMaterialUrl,
                    rehearsalSummary: report.rehearsalSummary,
                    roadmap: report.roadmap,
                    baselineTag: report.baselineTag,
                    frozenAt: report.frozenAt ? report.frozenAt.toISOString() : null,
                    updatedAt: report.updatedAt.toISOString(),
                  }
                : {
                    id: "",
                    status: "DRAFT",
                    functionalGatePassed: false,
                    performanceGatePassed: false,
                    securityGatePassed: false,
                    runbookUrl: "",
                    emergencyPlanUrl: "",
                    trainingMaterialUrl: "",
                    rehearsalSummary: "",
                    roadmap: "",
                    baselineTag: "",
                    frozenAt: null,
                    updatedAt: new Date().toISOString(),
                  }
            }
            score={score}
          />
        </CardContent>
      </Card>
    </div>
  )
}
