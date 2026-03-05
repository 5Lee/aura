import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"

import { PromptFlowPanel } from "@/components/workflow/prompt-flow-panel"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { buildPromptFlowSeed } from "@/lib/prompt-flow"
import { getUserEntitlementSnapshot, hasPromptFlowAccess } from "@/lib/subscription-entitlements"

export default async function PromptFlowPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    redirect("/login")
  }

  const snapshot = await getUserEntitlementSnapshot(session.user.id)
  const hasAccess = hasPromptFlowAccess(snapshot.plan.id)

  const count = hasAccess
    ? await prisma.promptFlowDefinition.count({
        where: {
          userId: session.user.id,
        },
      })
    : 0

  if (hasAccess && count === 0) {
    await prisma.promptFlowDefinition.createMany({
      data: buildPromptFlowSeed(session.user.id),
    })
  }

  const [flows, runs] = hasAccess
    ? await Promise.all([
        prisma.promptFlowDefinition.findMany({
          where: {
            userId: session.user.id,
          },
          orderBy: [{ updatedAt: "desc" }],
          take: 60,
        }),
        prisma.promptFlowRun.findMany({
          where: {
            userId: session.user.id,
          },
          include: {
            flow: {
              select: {
                id: true,
                name: true,
                status: true,
                executionMode: true,
              },
            },
          },
          orderBy: [{ createdAt: "desc" }],
          take: 200,
        }),
      ])
    : [[], []]

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-3">
            <CardTitle>Prompt Flow 编排中心</CardTitle>
            <Badge variant="secondary">Week22-002</Badge>
            <Badge>{snapshot.plan.name}</Badge>
          </div>
          <CardDescription>
            定义节点、边与上下文变量结构，支持串并行执行与失败重试，并输出可视化编排与运行日志。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PromptFlowPanel
            hasAccess={hasAccess}
            planId={snapshot.plan.id}
            flows={flows.map((item) => ({
              id: item.id,
              name: item.name,
              description: item.description || "",
              status: item.status,
              executionMode: item.executionMode,
              nodes: Array.isArray(item.nodes)
                ? item.nodes
                    .map((node) => {
                      const source =
                        node && typeof node === "object" && !Array.isArray(node)
                          ? (node as Record<string, unknown>)
                          : {}

                      return {
                        id: String(source.id || ""),
                        type: String(source.type || "task"),
                        title: String(source.title || ""),
                        config:
                          source.config && typeof source.config === "object" && !Array.isArray(source.config)
                            ? (source.config as Record<string, unknown>)
                            : undefined,
                      }
                    })
                    .filter((node) => node.id && node.title)
                : [],
              edges: Array.isArray(item.edges)
                ? item.edges
                    .map((edge) => {
                      const source =
                        edge && typeof edge === "object" && !Array.isArray(edge)
                          ? (edge as Record<string, unknown>)
                          : {}
                      return {
                        from: String(source.from || ""),
                        to: String(source.to || ""),
                        condition: String(source.condition || ""),
                      }
                    })
                    .filter((edge) => edge.from && edge.to)
                : [],
              contextVariables: Array.isArray(item.contextVariables)
                ? item.contextVariables
                    .map((current) =>
                      current && typeof current === "object" && !Array.isArray(current)
                        ? (current as Record<string, unknown>)
                        : {}
                    )
                : [],
              retryPolicy:
                item.retryPolicy && typeof item.retryPolicy === "object" && !Array.isArray(item.retryPolicy)
                  ? {
                      maxRetries: Number((item.retryPolicy as Record<string, unknown>).maxRetries || 0),
                      backoffSeconds: Number((item.retryPolicy as Record<string, unknown>).backoffSeconds || 0),
                    }
                  : {
                      maxRetries: 0,
                      backoffSeconds: 0,
                    },
              version: item.version,
              updatedAt: item.updatedAt.toISOString(),
            }))}
            runs={runs.map((item) => ({
              id: item.id,
              flowId: item.flowId,
              replayToken: item.replayToken,
              status: item.status,
              executionMode: item.executionMode,
              attempts: item.attempts,
              errorMessage: item.errorMessage || "",
              startedAt: item.startedAt ? item.startedAt.toISOString() : "",
              endedAt: item.endedAt ? item.endedAt.toISOString() : "",
              flow: item.flow,
            }))}
          />
        </CardContent>
      </Card>
    </div>
  )
}
