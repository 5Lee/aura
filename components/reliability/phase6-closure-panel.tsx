"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toaster"

type Phase6ClosurePanelProps = {
  hasAccess: boolean
  planId: string
  report: {
    id: string
    status: string
    functionalGatePassed: boolean
    performanceGatePassed: boolean
    securityGatePassed: boolean
    runbookUrl: string | null
    emergencyPlanUrl: string | null
    trainingMaterialUrl: string | null
    rehearsalSummary: string | null
    roadmap: string | null
    baselineTag: string | null
    frozenAt: string | null
    updatedAt: string
  }
  score: {
    passed: number
    total: number
    percent: number
    readyToFreeze: boolean
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

export function Phase6ClosurePanel({ hasAccess, planId, report, score }: Phase6ClosurePanelProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [pending, setPending] = useState(false)
  const [form, setForm] = useState({
    status: report.status,
    functionalGatePassed: report.functionalGatePassed,
    performanceGatePassed: report.performanceGatePassed,
    securityGatePassed: report.securityGatePassed,
    runbookUrl: report.runbookUrl || "",
    emergencyPlanUrl: report.emergencyPlanUrl || "",
    trainingMaterialUrl: report.trainingMaterialUrl || "",
    rehearsalSummary: report.rehearsalSummary || "",
    roadmap: report.roadmap || "",
    baselineTag: report.baselineTag || "phase6-baseline",
  })

  if (!hasAccess) {
    return (
      <div className="rounded-lg border border-border bg-muted/20 p-4 text-sm">
        <p className="font-medium">当前套餐：{planId.toUpperCase()}</p>
        <p className="mt-1 text-muted-foreground">Phase6 终验与运营化交付仅对 Pro / Team / Enterprise 套餐开放。</p>
      </div>
    )
  }

  async function submit() {
    setPending(true)
    try {
      await requestJson("/api/reliability/phase6-closure", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      toast({ type: "success", title: "Phase6 终验报告已更新" })
      router.refresh()
    } catch (error) {
      toast({
        type: "error",
        title: "保存失败",
        description: error instanceof Error ? error.message : "请稍后重试",
      })
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded-lg border border-border bg-muted/20 p-4">
          <p className="text-xs text-muted-foreground">终验完成度</p>
          <p className="mt-1 text-lg font-semibold">{score.percent}%</p>
        </div>
        <div className="rounded-lg border border-border bg-muted/20 p-4">
          <p className="text-xs text-muted-foreground">当前状态</p>
          <p className="mt-1 text-lg font-semibold">{report.status}</p>
        </div>
        <div className="rounded-lg border border-border bg-muted/20 p-4">
          <p className="text-xs text-muted-foreground">冻结就绪</p>
          <p className="mt-1 text-lg font-semibold">{score.readyToFreeze ? "Yes" : "No"}</p>
        </div>
        <div className="rounded-lg border border-border bg-muted/20 p-4">
          <p className="text-xs text-muted-foreground">最近更新时间</p>
          <p className="mt-1 text-sm font-semibold">{new Date(report.updatedAt).toLocaleString()}</p>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-background p-4 space-y-3">
        <p className="text-sm font-medium">Phase6 功能终验 / 运维手册 / 演练复盘 / 基线冻结</p>
        <div className="grid gap-2 sm:grid-cols-3 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.functionalGatePassed}
              onChange={(event) => setForm((prev) => ({ ...prev, functionalGatePassed: event.target.checked }))}
            />
            <span>功能门禁通过</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.performanceGatePassed}
              onChange={(event) => setForm((prev) => ({ ...prev, performanceGatePassed: event.target.checked }))}
            />
            <span>性能门禁通过</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.securityGatePassed}
              onChange={(event) => setForm((prev) => ({ ...prev, securityGatePassed: event.target.checked }))}
            />
            <span>安全门禁通过</span>
          </label>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <input
            value={form.runbookUrl}
            onChange={(event) => setForm((prev) => ({ ...prev, runbookUrl: event.target.value }))}
            aria-label="runbook"
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            placeholder="运维手册 URL"
          />
          <input
            value={form.emergencyPlanUrl}
            onChange={(event) => setForm((prev) => ({ ...prev, emergencyPlanUrl: event.target.value }))}
            aria-label="emergency plan"
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            placeholder="应急预案 URL"
          />
          <input
            value={form.trainingMaterialUrl}
            onChange={(event) => setForm((prev) => ({ ...prev, trainingMaterialUrl: event.target.value }))}
            aria-label="training"
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            placeholder="培训资料 URL"
          />
          <input
            value={form.baselineTag}
            onChange={(event) => setForm((prev) => ({ ...prev, baselineTag: event.target.value }))}
            aria-label="baseline"
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            placeholder="基线标记"
          />
        </div>
        <textarea
          value={form.rehearsalSummary}
          onChange={(event) => setForm((prev) => ({ ...prev, rehearsalSummary: event.target.value }))}
          aria-label="rehearsal summary"
          className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          placeholder="全链路演练与复盘总结"
        />
        <textarea
          value={form.roadmap}
          onChange={(event) => setForm((prev) => ({ ...prev, roadmap: event.target.value }))}
          aria-label="roadmap"
          className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          placeholder="下一阶段路线图"
        />
        <div className="flex items-center gap-3">
          <Button disabled={pending} onClick={submit}>
            {pending ? "保存中..." : "更新终验报告"}
          </Button>
          {report.frozenAt ? (
            <p className="text-xs text-muted-foreground">已冻结于 {new Date(report.frozenAt).toLocaleString()}</p>
          ) : null}
        </div>
      </div>
    </div>
  )
}
