"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toaster"

type PatternRow = {
  id: string
  name: string
  defectSignature: string
  fixTemplate: string
  regressionScript: string
  confidenceScore: number
  successRate: number
  enabled: boolean
}

type ExecutionRow = {
  id: string
  patternId: string
  status: string
  defectReference: string
  suggestion: string
  patchPreview: string | null
  createdAt: string
  appliedAt: string | null
  pattern: {
    id: string
    name: string
    defectSignature: string
  }
}

type SelfHealPanelProps = {
  hasAccess: boolean
  planId: string
  patterns: PatternRow[]
  executions: ExecutionRow[]
  efficiency: {
    totalRuns: number
    appliedRuns: number
    improvePercent: number
    averageFixMinutes: number
  }
}

async function requestJson(path: string, init?: RequestInit) {
  const response = await fetch(path, init)
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(String(payload?.error || "请求失败"))
  }
  return payload
}

function buildSelfHealEfficiencySummary(rows: ExecutionRow[]) {
  const applied = rows.filter((item) => item.status === "APPLIED")
  const averageFixMinutes =
    applied.length === 0
      ? 0
      : Number(
          (
            applied.reduce((acc, item) => {
              if (!item.appliedAt) {
                return acc
              }
              return acc + (new Date(item.appliedAt).getTime() - new Date(item.createdAt).getTime()) / 60000
            }, 0) / applied.length
          ).toFixed(1)
        )

  return {
    totalRuns: rows.length,
    appliedRuns: applied.length,
    improvePercent: rows.length === 0 ? 0 : Number(((applied.length / rows.length) * 100).toFixed(2)),
    averageFixMinutes,
  }
}

export function SelfHealPanel({
  hasAccess,
  planId,
  patterns,
  executions,
  efficiency,
}: SelfHealPanelProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [pending, setPending] = useState<string | null>(null)
  const [executionRows, setExecutionRows] = useState(executions)
  const [efficiencyState, setEfficiencyState] = useState(efficiency)
  const [patternForm, setPatternForm] = useState({
    id: patterns[0]?.id || "",
    name: patterns[0]?.name || "",
    defectSignature: patterns[0]?.defectSignature || "",
    fixTemplate: patterns[0]?.fixTemplate || "",
    regressionScript: patterns[0]?.regressionScript || "",
    confidenceScore: String(patterns[0]?.confidenceScore || 0.75),
    enabled: patterns[0]?.enabled ?? true,
  })
  const [suggestionForm, setSuggestionForm] = useState({
    patternId: patterns[0]?.id || "",
    defectReference: "INC-2026-001",
  })

  useEffect(() => {
    setExecutionRows(executions)
    setEfficiencyState(efficiency)
  }, [executions, efficiency])

  if (!hasAccess) {
    return (
      <div className="rounded-lg border border-border bg-muted/20 p-4 text-sm">
        <p className="font-medium">当前套餐：{planId.toUpperCase()}</p>
        <p className="mt-1 text-muted-foreground">回归资产与自愈修复仅对 Pro / Team / Enterprise 套餐开放。</p>
      </div>
    )
  }

  async function runAction(action: string, fn: () => Promise<unknown>, success: string, refresh = true) {
    setPending(action)
    try {
      await fn()
      toast({ type: "success", title: success })
      if (refresh) {
        router.refresh()
      }
    } catch (error) {
      toast({
        type: "error",
        title: "操作失败",
        description: error instanceof Error ? error.message : "请稍后重试",
      })
    } finally {
      setPending(null)
    }
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded-lg border border-border bg-muted/20 p-4">
          <p className="text-xs text-muted-foreground">修复建议总数</p>
          <p className="mt-1 text-lg font-semibold">{efficiencyState.totalRuns}</p>
        </div>
        <div className="rounded-lg border border-border bg-muted/20 p-4">
          <p className="text-xs text-muted-foreground">已应用</p>
          <p className="mt-1 text-lg font-semibold">{efficiencyState.appliedRuns}</p>
        </div>
        <div className="rounded-lg border border-border bg-muted/20 p-4">
          <p className="text-xs text-muted-foreground">修复效率提升</p>
          <p className="mt-1 text-lg font-semibold">{efficiencyState.improvePercent}%</p>
        </div>
        <div className="rounded-lg border border-border bg-muted/20 p-4">
          <p className="text-xs text-muted-foreground">平均修复耗时</p>
          <p className="mt-1 text-lg font-semibold">{efficiencyState.averageFixMinutes} min</p>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-lg border border-border bg-background p-4 space-y-3">
          <p className="text-sm font-medium">回归脚本资产库与缺陷修复模板</p>
          <select
            value={patternForm.id}
            onChange={(event) => {
              const selected = patterns.find((item) => item.id === event.target.value)
              setPatternForm({
                id: event.target.value,
                name: selected?.name || "",
                defectSignature: selected?.defectSignature || "",
                fixTemplate: selected?.fixTemplate || "",
                regressionScript: selected?.regressionScript || "",
                confidenceScore: String(selected?.confidenceScore || 0.75),
                enabled: selected?.enabled ?? true,
              })
            }}
            aria-label="模式"
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">新建模式</option>
            {patterns.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          <input
            value={patternForm.name}
            onChange={(event) => setPatternForm((prev) => ({ ...prev, name: event.target.value }))}
            aria-label="名称"
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            placeholder="模式名称"
          />
          <input
            value={patternForm.defectSignature}
            onChange={(event) => setPatternForm((prev) => ({ ...prev, defectSignature: event.target.value }))}
            aria-label="signature"
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            placeholder="缺陷签名"
          />
          <textarea
            value={patternForm.fixTemplate}
            onChange={(event) => setPatternForm((prev) => ({ ...prev, fixTemplate: event.target.value }))}
            aria-label="修复模板"
            className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder="修复模板"
          />
          <textarea
            value={patternForm.regressionScript}
            onChange={(event) => setPatternForm((prev) => ({ ...prev, regressionScript: event.target.value }))}
            aria-label="回归脚本"
            className="min-h-16 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder="回归脚本"
          />
          <div className="grid gap-2 sm:grid-cols-2">
            <input
              value={patternForm.confidenceScore}
              onChange={(event) => setPatternForm((prev) => ({ ...prev, confidenceScore: event.target.value }))}
              aria-label="置信度"
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              placeholder="置信度"
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={patternForm.enabled}
                onChange={(event) => setPatternForm((prev) => ({ ...prev, enabled: event.target.checked }))}
              />
              <span>启用自动建议</span>
            </label>
          </div>
          <Button
            disabled={pending !== null}
            onClick={() =>
              runAction(
                "save-pattern",
                () =>
                  requestJson("/api/reliability/self-heal", {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      id: patternForm.id || undefined,
                      name: patternForm.name,
                      defectSignature: patternForm.defectSignature,
                      fixTemplate: patternForm.fixTemplate,
                      regressionScript: patternForm.regressionScript,
                      confidenceScore: Number(patternForm.confidenceScore),
                      enabled: patternForm.enabled,
                    }),
                  }),
                "自愈模式已保存"
              )
            }
          >
            {pending === "save-pattern" ? "保存中..." : "保存自愈模式"}
          </Button>
        </div>

        <div className="rounded-lg border border-border bg-background p-4 space-y-3">
          <p className="text-sm font-medium">自动修复建议 + 人工确认应用</p>
          <select
            value={suggestionForm.patternId}
            onChange={(event) => setSuggestionForm((prev) => ({ ...prev, patternId: event.target.value }))}
            aria-label="选择模式"
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">选择模式</option>
            {patterns.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          <input
            value={suggestionForm.defectReference}
            onChange={(event) => setSuggestionForm((prev) => ({ ...prev, defectReference: event.target.value }))}
            aria-label="缺陷引用"
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            placeholder="INC-2026-001"
          />
          <Button
            disabled={pending !== null || !suggestionForm.patternId}
            onClick={() =>
              runAction(
                "create-suggestion",
                async () => {
                  const payload = await requestJson("/api/reliability/self-heal", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(suggestionForm),
                  })

                  if (payload?.execution) {
                    const nextRows = [payload.execution as ExecutionRow, ...executionRows.filter((item) => item.id !== payload.execution.id)]
                    setExecutionRows(nextRows)
                    setEfficiencyState(buildSelfHealEfficiencySummary(nextRows))
                  }
                },
                "自愈建议已生成",
                false
              )
            }
          >
            {pending === "create-suggestion" ? "生成中..." : "生成修复建议"}
          </Button>
          <div className="space-y-2 text-sm">
            {executionRows.slice(0, 8).map((item) => (
              <div key={item.id} className="rounded-md border border-border bg-muted/10 px-3 py-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">
                      {item.pattern.name} · {item.status}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">{item.defectReference}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={pending !== null || item.status === "APPLIED"}
                      onClick={() =>
                        runAction(
                          `apply-${item.id}`,
                          async () => {
                            const payload = await requestJson("/api/reliability/self-heal", {
                              method: "PATCH",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ executionId: item.id, status: "APPLIED" }),
                            })

                            if (payload?.execution) {
                              const nextRows = executionRows.map((entry) =>
                                entry.id === item.id
                                  ? {
                                      ...entry,
                                      status: payload.execution.status,
                                      appliedAt: payload.execution.appliedAt,
                                    }
                                  : entry
                              )
                              setExecutionRows(nextRows)
                              setEfficiencyState(buildSelfHealEfficiencySummary(nextRows))
                            }
                          },
                          "建议已应用",
                          false
                        )
                      }
                    >
                      应用
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={pending !== null || item.status === "DISMISSED"}
                      onClick={() =>
                        runAction(
                          `dismiss-${item.id}`,
                          async () => {
                            const payload = await requestJson("/api/reliability/self-heal", {
                              method: "PATCH",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ executionId: item.id, status: "DISMISSED" }),
                            })

                            if (payload?.execution) {
                              const nextRows = executionRows.map((entry) =>
                                entry.id === item.id
                                  ? {
                                      ...entry,
                                      status: payload.execution.status,
                                      appliedAt: payload.execution.appliedAt,
                                    }
                                  : entry
                              )
                              setExecutionRows(nextRows)
                              setEfficiencyState(buildSelfHealEfficiencySummary(nextRows))
                            }
                          },
                          "建议已忽略",
                          false
                        )
                      }
                    >
                      忽略
                    </Button>
                  </div>
                </div>
                <p className="mt-2 text-xs text-muted-foreground line-clamp-3">{item.suggestion}</p>
              </div>
            ))}
            {executionRows.length === 0 ? <p className="text-muted-foreground">暂无修复建议。</p> : null}
          </div>
        </div>
      </div>
    </div>
  )
}
