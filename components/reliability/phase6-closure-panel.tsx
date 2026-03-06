"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toaster"

type PhaseClosureStatus = "DRAFT" | "IN_REVIEW" | "SIGNED_OFF" | "FROZEN"

type Phase6ClosurePanelProps = {
  hasAccess: boolean
  planId: string
  report: {
    id: string
    status: PhaseClosureStatus
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

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat("zh-CN", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
  timeZone: "Asia/Shanghai",
})

function formatDateTime(value: string) {
  return DATE_TIME_FORMATTER.format(new Date(value))
}

const STATUS_LABELS: Record<PhaseClosureStatus, string> = {
  DRAFT: "草稿",
  IN_REVIEW: "评审中",
  SIGNED_OFF: "已签收",
  FROZEN: "已冻结",
}

const QUICK_ACTION_LABELS: Partial<Record<PhaseClosureStatus, string>> = {
  IN_REVIEW: "提交评审",
  SIGNED_OFF: "签收终验",
  FROZEN: "冻结基线",
}

function buildFormState(report: Phase6ClosurePanelProps["report"]) {
  return {
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
  }
}

function resolveClosureScore(input: {
  functionalGatePassed: boolean
  performanceGatePassed: boolean
  securityGatePassed: boolean
  runbookUrl: string
  emergencyPlanUrl: string
  trainingMaterialUrl: string
}) {
  const checks = [
    input.functionalGatePassed,
    input.performanceGatePassed,
    input.securityGatePassed,
    Boolean(input.runbookUrl.trim()),
    Boolean(input.emergencyPlanUrl.trim()),
    Boolean(input.trainingMaterialUrl.trim()),
  ]
  const passed = checks.filter(Boolean).length
  const total = checks.length

  return {
    passed,
    total,
    percent: Number(((passed / total) * 100).toFixed(2)),
    readyToFreeze: passed / total >= 0.9,
  }
}

function listPhaseClosureTransitions(status: PhaseClosureStatus, readyToFreeze: boolean): PhaseClosureStatus[] {
  switch (status) {
    case "DRAFT":
      return ["IN_REVIEW"]
    case "IN_REVIEW":
      return readyToFreeze ? ["DRAFT", "SIGNED_OFF"] : ["DRAFT"]
    case "SIGNED_OFF":
      return readyToFreeze ? ["IN_REVIEW", "FROZEN"] : ["IN_REVIEW"]
    case "FROZEN":
    default:
      return []
  }
}

function resolvePrimaryNextStatus(status: PhaseClosureStatus, transitions: PhaseClosureStatus[]) {
  switch (status) {
    case "DRAFT":
      return transitions.includes("IN_REVIEW") ? "IN_REVIEW" : null
    case "IN_REVIEW":
      return transitions.includes("SIGNED_OFF") ? "SIGNED_OFF" : null
    case "SIGNED_OFF":
      return transitions.includes("FROZEN") ? "FROZEN" : null
    case "FROZEN":
    default:
      return null
  }
}

export function Phase6ClosurePanel({ hasAccess, planId, report, score }: Phase6ClosurePanelProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [pending, setPending] = useState(false)
  const [form, setForm] = useState(() => buildFormState(report))

  useEffect(() => {
    setForm(buildFormState(report))
  }, [report.id, report.updatedAt])

  if (!hasAccess) {
    return (
      <div className="rounded-lg border border-border bg-muted/20 p-4 text-sm">
        <p className="font-medium">当前套餐：{planId.toUpperCase()}</p>
        <p className="mt-1 text-muted-foreground">Phase6 终验与运营化交付仅对 Pro / Team / Enterprise 套餐开放。</p>
      </div>
    )
  }

  const localScore = resolveClosureScore({
    functionalGatePassed: form.functionalGatePassed,
    performanceGatePassed: form.performanceGatePassed,
    securityGatePassed: form.securityGatePassed,
    runbookUrl: form.runbookUrl,
    emergencyPlanUrl: form.emergencyPlanUrl,
    trainingMaterialUrl: form.trainingMaterialUrl,
  })
  const availableTransitions = listPhaseClosureTransitions(report.status, localScore.readyToFreeze)
  const selectableStatuses = new Set<PhaseClosureStatus>([report.status, form.status, ...availableTransitions])
  const primaryNextStatus = form.status === report.status ? resolvePrimaryNextStatus(report.status, availableTransitions) : null
  const remainingChecks = Math.max(0, localScore.total - localScore.passed)

  async function submit(nextStatus?: PhaseClosureStatus) {
    const payload = {
      ...form,
      status: nextStatus || form.status,
    }

    setPending(true)
    try {
      await requestJson("/api/reliability/phase6-closure", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      toast({
        type: "success",
        title:
          nextStatus && nextStatus !== report.status
            ? `Phase6 已推进到 ${STATUS_LABELS[nextStatus]}`
            : "Phase6 终验报告已更新",
      })
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
          <p className="mt-1 text-lg font-semibold">{STATUS_LABELS[report.status]} · {report.status}</p>
        </div>
        <div className="rounded-lg border border-border bg-muted/20 p-4">
          <p className="text-xs text-muted-foreground">冻结就绪</p>
          <p className="mt-1 text-lg font-semibold">{score.readyToFreeze ? "Yes" : "No"}</p>
        </div>
        <div className="rounded-lg border border-border bg-muted/20 p-4">
          <p className="text-xs text-muted-foreground">最近更新时间</p>
          <p className="mt-1 text-sm font-semibold">{formatDateTime(report.updatedAt)}</p>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-background p-4 space-y-3">
        <p className="text-sm font-medium">Phase6 功能终验 / 运维手册 / 演练复盘 / 基线冻结</p>
        <div className="rounded-md border border-border bg-muted/10 p-3 text-sm space-y-2">
          <div className="grid gap-2 md:grid-cols-[minmax(0,220px)_1fr] md:items-center">
            <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">终验状态</label>
            <select
              value={form.status}
              onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value as PhaseClosureStatus }))}
              aria-label="closure status"
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              {(["DRAFT", "IN_REVIEW", "SIGNED_OFF", "FROZEN"] as PhaseClosureStatus[]).map((statusOption) => (
                <option key={statusOption} value={statusOption} disabled={!selectableStatuses.has(statusOption)}>
                  {STATUS_LABELS[statusOption]} ({statusOption})
                </option>
              ))}
            </select>
          </div>
          <p className="text-xs text-muted-foreground">
            当前已完成 {localScore.passed}/{localScore.total} 项必备检查。
            {localScore.readyToFreeze
              ? " 可继续签收或冻结基线。"
              : ` 还需补齐 ${remainingChecks} 项检查后才能签收或冻结。`}
          </p>
          <p className="text-xs text-muted-foreground">
            当前可流转到：
            {availableTransitions.length > 0
              ? availableTransitions.map((item) => `${STATUS_LABELS[item]} (${item})`).join(" / ")
              : " 当前状态已锁定，无后续流转。"}
          </p>
        </div>
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
        <div className="flex flex-wrap items-center gap-3">
          <Button disabled={pending} onClick={() => submit()}>
            {pending ? "保存中..." : "保存终验内容"}
          </Button>
          {primaryNextStatus ? (
            <Button disabled={pending} variant="secondary" onClick={() => submit(primaryNextStatus)}>
              {pending ? "推进中..." : QUICK_ACTION_LABELS[primaryNextStatus] || `推进到 ${STATUS_LABELS[primaryNextStatus]}`}
            </Button>
          ) : null}
          {report.frozenAt ? (
            <p className="text-xs text-muted-foreground">已冻结于 {formatDateTime(report.frozenAt)}</p>
          ) : null}
        </div>
      </div>
    </div>
  )
}
