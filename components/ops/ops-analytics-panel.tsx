"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toaster"

type SnapshotRow = {
  id: string
  cohortKey: string
  metricType: string
  stage: string
  activatedUsers: number
  retainedUsers: number
  revisitUsers: number
  conversionUsers: number
  experimentId: string | null
  traceToken: string
  windowEnd: string
}

type ExperimentRow = {
  id: string
  name: string
  status: string
}

type OpsAnalyticsPanelProps = {
  hasAccess: boolean
  planId: string
  snapshots: SnapshotRow[]
  experiments: ExperimentRow[]
  funnel: {
    activated: number
    retained: number
    revisit: number
    converted: number
    retentionRate: number
    revisitRate: number
    conversionRate: number
  }
  cohorts: Array<{
    cohortKey: string
    activatedUsers: number
    retainedUsers: number
    conversionUsers: number
    retentionRate: number
    conversionRate: number
  }>
  consistency: {
    inconsistentRows: number
    traceable: boolean
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

export function OpsAnalyticsPanel({
  hasAccess,
  planId,
  snapshots,
  experiments,
  funnel,
  cohorts,
  consistency,
}: OpsAnalyticsPanelProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [pending, setPending] = useState(false)
  const [form, setForm] = useState({
    cohortKey: "new-users-w11",
    metricType: "ACTIVATION",
    stage: "activated",
    activatedUsers: "300",
    retainedUsers: "120",
    revisitUsers: "80",
    conversionUsers: "45",
    experimentId: experiments[0]?.id || "",
    traceToken: `manual-${Date.now()}`,
  })

  if (!hasAccess) {
    return (
      <div className="rounded-lg border border-border bg-muted/20 p-4 text-sm">
        <p className="font-medium">当前套餐：{planId.toUpperCase()}</p>
        <p className="mt-1 text-muted-foreground">运营漏斗与留存分析仅对 Pro / Team / Enterprise 套餐开放。</p>
      </div>
    )
  }

  async function submitSnapshot() {
    setPending(true)
    try {
      await requestJson("/api/ops/analytics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          activatedUsers: Number(form.activatedUsers),
          retainedUsers: Number(form.retainedUsers),
          revisitUsers: Number(form.revisitUsers),
          conversionUsers: Number(form.conversionUsers),
        }),
      })
      toast({ type: "success", title: "漏斗快照已记录" })
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
          <p className="text-xs text-muted-foreground">激活用户</p>
          <p className="mt-1 text-lg font-semibold">{funnel.activated}</p>
        </div>
        <div className="rounded-lg border border-border bg-muted/20 p-4">
          <p className="text-xs text-muted-foreground">留存率</p>
          <p className="mt-1 text-lg font-semibold">{funnel.retentionRate}%</p>
        </div>
        <div className="rounded-lg border border-border bg-muted/20 p-4">
          <p className="text-xs text-muted-foreground">复访率</p>
          <p className="mt-1 text-lg font-semibold">{funnel.revisitRate}%</p>
        </div>
        <div className="rounded-lg border border-border bg-muted/20 p-4">
          <p className="text-xs text-muted-foreground">口径一致性</p>
          <p className="mt-1 text-lg font-semibold">{consistency.traceable ? "可追溯" : "需校准"}</p>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-lg border border-border bg-background p-4 space-y-3">
          <p className="text-sm font-medium">激活 / 留存 / 复访漏斗与 cohort 快照</p>
          <input
            value={form.cohortKey}
            onChange={(event) => setForm((prev) => ({ ...prev, cohortKey: event.target.value }))}
            aria-label="cohort"
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            placeholder="cohort key"
          />
          <div className="grid gap-2 sm:grid-cols-3">
            <input
              value={form.activatedUsers}
              onChange={(event) => setForm((prev) => ({ ...prev, activatedUsers: event.target.value }))}
              aria-label="激活"
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              placeholder="激活"
            />
            <input
              value={form.retainedUsers}
              onChange={(event) => setForm((prev) => ({ ...prev, retainedUsers: event.target.value }))}
              aria-label="留存"
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              placeholder="留存"
            />
            <input
              value={form.revisitUsers}
              onChange={(event) => setForm((prev) => ({ ...prev, revisitUsers: event.target.value }))}
              aria-label="复访"
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              placeholder="复访"
            />
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <input
              value={form.conversionUsers}
              onChange={(event) => setForm((prev) => ({ ...prev, conversionUsers: event.target.value }))}
              aria-label="转化"
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              placeholder="转化"
            />
            <select
              value={form.experimentId}
              onChange={(event) => setForm((prev) => ({ ...prev, experimentId: event.target.value }))}
              aria-label="关联实验"
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">不关联实验</option>
              {experiments.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>
          <input
            value={form.traceToken}
            onChange={(event) => setForm((prev) => ({ ...prev, traceToken: event.target.value }))}
            aria-label="trace token"
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            placeholder="trace token"
          />
          <Button disabled={pending} onClick={submitSnapshot}>
            {pending ? "保存中..." : "保存漏斗快照"}
          </Button>
        </div>

        <div className="rounded-lg border border-border bg-background p-4 space-y-3">
          <p className="text-sm font-medium">cohort 对比与实验联动分析</p>
          <div className="space-y-2 text-sm">
            {cohorts.slice(0, 8).map((item) => (
              <div key={item.cohortKey} className="rounded-md border border-border bg-muted/10 px-3 py-2">
                <p className="font-medium">
                  {item.cohortKey} · retention {item.retentionRate}% · conversion {item.conversionRate}%
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  activated {item.activatedUsers} · retained {item.retainedUsers} · converted {item.conversionUsers}
                </p>
              </div>
            ))}
            {cohorts.length === 0 ? <p className="text-muted-foreground">暂无 cohort 数据。</p> : null}
          </div>
          <p className="text-xs text-muted-foreground">
            口径一致性校验：{consistency.traceable ? "通过" : `发现 ${consistency.inconsistentRows} 条异常`}
          </p>
          <div className="space-y-2 text-sm">
            {snapshots.slice(0, 6).map((item) => (
              <div key={item.id} className="rounded-md border border-border bg-muted/5 px-3 py-2">
                <p className="font-medium">
                  {item.cohortKey} · {item.metricType} · trace {item.traceToken}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  experiment {item.experimentId || "-"} · {new Date(item.windowEnd).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
