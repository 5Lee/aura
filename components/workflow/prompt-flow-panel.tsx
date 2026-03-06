"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toaster"

type FlowRow = {
  id: string
  name: string
  description: string
  status: string
  executionMode: string
  nodes: Array<{ id: string; type: string; title: string; config?: Record<string, unknown> }>
  edges: Array<{ from: string; to: string; condition?: string }>
  contextVariables: Array<Record<string, unknown>>
  retryPolicy: {
    maxRetries: number
    backoffSeconds: number
  }
  version: number
  updatedAt: string
}

type RunRow = {
  id: string
  flowId: string
  replayToken: string
  status: string
  executionMode: string
  attempts: number
  errorMessage: string
  startedAt: string
  endedAt: string
  flow: {
    id: string
    name: string
    status: string
    executionMode: string
  }
}

type PromptFlowPanelProps = {
  hasAccess: boolean
  planId: string
  flows: FlowRow[]
  runs: RunRow[]
}

async function requestJson(path: string, init?: RequestInit) {
  const response = await fetch(path, init)
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(String(payload?.error || "请求失败"))
  }
  return payload
}

function safeJsonParse<T>(value: string, fallback: T) {
  try {
    const parsed = JSON.parse(value)
    return parsed as T
  } catch {
    return fallback
  }
}

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat("zh-CN", {
  timeZone: "Asia/Shanghai",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
})

function formatDateTime(value: string) {
  return DATE_TIME_FORMATTER.format(new Date(value))
}

function buildFlowForm(flow: FlowRow | null) {
  return {
    id: flow?.id || "",
    name: flow?.name || "",
    description: flow?.description || "",
    status: flow?.status || "DRAFT",
    executionMode: flow?.executionMode || "SERIAL",
    nodesJson: JSON.stringify(flow?.nodes || [{ id: "node-1", type: "task", title: "示例节点" }], null, 2),
    edgesJson: JSON.stringify(flow?.edges || [], null, 2),
    contextVariablesJson: JSON.stringify(flow?.contextVariables || [], null, 2),
    retryMax: String(flow?.retryPolicy?.maxRetries || 0),
    backoffSeconds: String(flow?.retryPolicy?.backoffSeconds || 0),
  }
}

export function PromptFlowPanel({ hasAccess, planId, flows, runs }: PromptFlowPanelProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [pendingAction, setPendingAction] = useState<string | null>(null)

  const defaultFlow = flows[0] || null
  const [selectedFlowId, setSelectedFlowId] = useState(defaultFlow?.id || "")
  const selectedFlow = useMemo(
    () => flows.find((item) => item.id === selectedFlowId) || null,
    [flows, selectedFlowId]
  )
  const [flowForm, setFlowForm] = useState(() => buildFlowForm(selectedFlow))

  const [runForm, setRunForm] = useState({
    flowId: defaultFlow?.id || "",
    replayToken: "",
  })

  useEffect(() => {
    setFlowForm(buildFlowForm(selectedFlow))
    if (selectedFlow) {
      setRunForm((prev) => ({ ...prev, flowId: selectedFlow.id }))
    }
  }, [selectedFlow])

  async function runAction(actionKey: string, fn: () => Promise<unknown>, success: string) {
    setPendingAction(actionKey)
    try {
      await fn()
      toast({ type: "success", title: success })
      router.refresh()
    } catch (error) {
      toast({
        type: "error",
        title: "操作失败",
        description: error instanceof Error ? error.message : "请稍后重试",
      })
    } finally {
      setPendingAction(null)
    }
  }

  if (!hasAccess) {
    return (
      <div className="rounded-lg border border-border bg-muted/20 p-4 text-sm">
        <p className="font-medium">当前套餐：{planId.toUpperCase()}</p>
        <p className="mt-1 text-muted-foreground">Prompt Flow 节点编排仅对 Pro / Team / Enterprise 套餐开放。</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded-lg border border-border bg-muted/20 p-4">
          <p className="text-xs text-muted-foreground">工作流总数</p>
          <p className="mt-1 text-lg font-semibold">{flows.length}</p>
        </div>
        <div className="rounded-lg border border-border bg-muted/20 p-4">
          <p className="text-xs text-muted-foreground">ACTIVE</p>
          <p className="mt-1 text-lg font-semibold">{flows.filter((item) => item.status === "ACTIVE").length}</p>
        </div>
        <div className="rounded-lg border border-border bg-muted/20 p-4">
          <p className="text-xs text-muted-foreground">运行次数</p>
          <p className="mt-1 text-lg font-semibold">{runs.length}</p>
        </div>
        <div className="rounded-lg border border-border bg-muted/20 p-4">
          <p className="text-xs text-muted-foreground">失败次数</p>
          <p className="mt-1 text-lg font-semibold">{runs.filter((item) => item.status === "FAILED").length}</p>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="space-y-3 rounded-lg border border-border bg-background p-4">
          <p className="text-sm font-medium">工作流节点化编排（Prompt Flow）</p>
          <select
            aria-label="选择工作流"
            value={selectedFlowId}
            onChange={(event) => setSelectedFlowId(event.target.value)}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">新建工作流</option>
            {flows.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} · {item.executionMode} · v{item.version}
              </option>
            ))}
          </select>
          <input
            aria-label="工作流名称"
            value={flowForm.name}
            onChange={(event) => setFlowForm((prev) => ({ ...prev, name: event.target.value }))}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            placeholder="工作流名称"
          />
          <textarea
            aria-label="工作流说明"
            value={flowForm.description}
            onChange={(event) => setFlowForm((prev) => ({ ...prev, description: event.target.value }))}
            className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder="工作流说明"
          />
          <div className="grid gap-2 sm:grid-cols-2">
            <select
              aria-label="工作流状态"
              value={flowForm.status}
              onChange={(event) => setFlowForm((prev) => ({ ...prev, status: event.target.value }))}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="DRAFT">DRAFT</option>
              <option value="ACTIVE">ACTIVE</option>
              <option value="ARCHIVED">ARCHIVED</option>
            </select>
            <select
              aria-label="执行模式"
              value={flowForm.executionMode}
              onChange={(event) => setFlowForm((prev) => ({ ...prev, executionMode: event.target.value }))}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="SERIAL">SERIAL</option>
              <option value="PARALLEL">PARALLEL</option>
            </select>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <input
              aria-label="最大重试次数"
              value={flowForm.retryMax}
              onChange={(event) => setFlowForm((prev) => ({ ...prev, retryMax: event.target.value }))}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              placeholder="最大重试次数"
            />
            <input
              aria-label="重试退避秒数"
              value={flowForm.backoffSeconds}
              onChange={(event) => setFlowForm((prev) => ({ ...prev, backoffSeconds: event.target.value }))}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              placeholder="重试退避秒数"
            />
          </div>
          <textarea
            aria-label="节点结构"
            value={flowForm.nodesJson}
            onChange={(event) => setFlowForm((prev) => ({ ...prev, nodesJson: event.target.value }))}
            className="min-h-28 w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs"
            placeholder="节点结构 JSON"
          />
          <textarea
            aria-label="边结构"
            value={flowForm.edgesJson}
            onChange={(event) => setFlowForm((prev) => ({ ...prev, edgesJson: event.target.value }))}
            className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs"
            placeholder="边结构 JSON"
          />
          <textarea
            aria-label="上下文变量"
            value={flowForm.contextVariablesJson}
            onChange={(event) => setFlowForm((prev) => ({ ...prev, contextVariablesJson: event.target.value }))}
            className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs"
            placeholder="上下文变量 JSON"
          />
          <Button
            disabled={pendingAction !== null}
            onClick={() =>
              runAction(
                "save-flow",
                () =>
                  requestJson("/api/prompt-flow", {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      id: flowForm.id || undefined,
                      name: flowForm.name,
                      description: flowForm.description,
                      status: flowForm.status,
                      executionMode: flowForm.executionMode,
                      nodes: safeJsonParse(flowForm.nodesJson, []),
                      edges: safeJsonParse(flowForm.edgesJson, []),
                      contextVariables: safeJsonParse(flowForm.contextVariablesJson, []),
                      retryPolicy: {
                        maxRetries: Number(flowForm.retryMax),
                        backoffSeconds: Number(flowForm.backoffSeconds),
                      },
                    }),
                  }),
                "Prompt Flow 已保存"
              )
            }
          >
            {pendingAction === "save-flow" ? "保存中..." : "保存工作流编排"}
          </Button>
        </div>

        <div className="space-y-3 rounded-lg border border-border bg-background p-4">
          <p className="text-sm font-medium">可视化流程编辑与运行日志</p>
          {selectedFlow ? (
            <div className="space-y-2 rounded-md border border-border bg-muted/10 p-3 text-sm">
              <p className="font-medium">
                {selectedFlow.name} · {selectedFlow.executionMode} · v{selectedFlow.version}
              </p>
              <p className="text-xs text-muted-foreground">节点</p>
              <div className="flex flex-wrap gap-2">
                {selectedFlow.nodes.map((node) => (
                  <span key={node.id} className="rounded-full border border-border px-2 py-1 text-xs">
                    {node.title}
                  </span>
                ))}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">连线</p>
              <div className="space-y-1 text-xs text-muted-foreground">
                {selectedFlow.edges.map((edge, index) => (
                  <p key={`${edge.from}-${edge.to}-${index}`}>
                    {edge.from} -&gt; {edge.to}
                  </p>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">选择工作流后可查看流程草图。</p>
          )}

          <select
            aria-label="运行工作流"
            value={runForm.flowId}
            onChange={(event) => setRunForm((prev) => ({ ...prev, flowId: event.target.value }))}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">选择工作流</option>
            {flows.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} · {item.executionMode}
              </option>
            ))}
          </select>
          <input
            aria-label="重放 Token"
            value={runForm.replayToken}
            onChange={(event) => setRunForm((prev) => ({ ...prev, replayToken: event.target.value }))}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            placeholder="重放 Token（留空自动生成）"
          />
          <Button
            disabled={pendingAction !== null || !runForm.flowId}
            onClick={() =>
              runAction(
                "execute-flow",
                () =>
                  requestJson("/api/prompt-flow", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      flowId: runForm.flowId,
                      replayToken: runForm.replayToken || undefined,
                    }),
                  }),
                "工作流执行完成"
              )
            }
          >
            {pendingAction === "execute-flow" ? "执行中..." : "执行并记录运行日志"}
          </Button>

          <div className="space-y-2 text-sm">
            {runs.slice(0, 8).map((item) => (
              <div key={item.id} className="rounded-md border border-border bg-muted/10 px-3 py-2">
                <p className="font-medium">
                  {item.flow.name} · {item.status} · {item.executionMode}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  replayToken {item.replayToken} · attempts {item.attempts}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {item.errorMessage || "执行成功"} ·
                  {item.startedAt ? ` ${formatDateTime(item.startedAt)}` : " 未开始"}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
