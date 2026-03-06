"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toaster"

type PlanRow = {
  id: string
  name: string
  status: string
  releaseWindowStart: string
  releaseWindowEnd: string
  canaryTrafficPercent: number
  rollbackThresholdPercent: number
  impactSummary: string | null
}

type RollbackRow = {
  id: string
  planId: string
  reason: string
  impactScore: number
  estimatedUsers: number
  rollbackAt: string
  plan: {
    id: string
    name: string
    status: string
    canaryTrafficPercent: number
  }
}

type ReleaseOrchestrationPanelProps = {
  hasAccess: boolean
  planId: string
  plans: PlanRow[]
  rollbackEvents: RollbackRow[]
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

function toLocalDateTimeValue(value: string) {
  const parsed = new Date(value)
  const local = new Date(parsed.getTime() - parsed.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 16)
}

function buildDefaultReleaseWindow() {
  const start = new Date(Date.now() + 60 * 60 * 1000)
  const end = new Date(start.getTime() + 60 * 60 * 1000)
  return {
    releaseWindowStart: toLocalDateTimeValue(start.toISOString()),
    releaseWindowEnd: toLocalDateTimeValue(end.toISOString()),
  }
}

function formatPlanOptionLabel(item: PlanRow) {
  return `${item.name} · ${item.status} · ${item.id.slice(-6)}`
}

export function ReleaseOrchestrationPanel({
  hasAccess,
  planId,
  plans,
  rollbackEvents,
}: ReleaseOrchestrationPanelProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [pending, setPending] = useState<string | null>(null)
  const [form, setForm] = useState(() => ({
    id: plans[0]?.id || "",
    name: plans[0]?.name || "",
    status: plans[0]?.status || "READY",
    releaseWindowStart: plans[0]?.releaseWindowStart ? toLocalDateTimeValue(plans[0].releaseWindowStart) : "",
    releaseWindowEnd: plans[0]?.releaseWindowEnd ? toLocalDateTimeValue(plans[0].releaseWindowEnd) : "",
    canaryTrafficPercent: String(plans[0]?.canaryTrafficPercent || 10),
    rollbackThresholdPercent: String(plans[0]?.rollbackThresholdPercent || 5),
    impactSummary: plans[0]?.impactSummary || "",
  }))

  const [rollbackForm, setRollbackForm] = useState({
    planId: plans[0]?.id || "",
    reason: "灰度指标异常，触发回滚",
    estimatedUsers: "1200",
    impactedServices: "gateway,ops-api",
  })

  useEffect(() => {
    if (plans.length > 0) {
      return
    }
    setForm((prev) => {
      if (prev.id || prev.releaseWindowStart || prev.releaseWindowEnd) {
        return prev
      }
      return { ...prev, ...buildDefaultReleaseWindow() }
    })
  }, [plans.length])

  if (!hasAccess) {
    return (
      <div className="rounded-lg border border-border bg-muted/20 p-4 text-sm">
        <p className="font-medium">当前套餐：{planId.toUpperCase()}</p>
        <p className="mt-1 text-muted-foreground">发布演练与灰度回滚编排仅对 Pro / Team / Enterprise 套餐开放。</p>
      </div>
    )
  }

  async function runAction(action: string, fn: () => Promise<unknown>, success: string) {
    setPending(action)
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
      setPending(null)
    }
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded-lg border border-border bg-muted/20 p-4">
          <p className="text-xs text-muted-foreground">发布计划</p>
          <p className="mt-1 text-lg font-semibold">{plans.length}</p>
        </div>
        <div className="rounded-lg border border-border bg-muted/20 p-4">
          <p className="text-xs text-muted-foreground">灰度中</p>
          <p className="mt-1 text-lg font-semibold">{plans.filter((item) => item.status === "ROLLING").length}</p>
        </div>
        <div className="rounded-lg border border-border bg-muted/20 p-4">
          <p className="text-xs text-muted-foreground">回滚次数</p>
          <p className="mt-1 text-lg font-semibold">{rollbackEvents.length}</p>
        </div>
        <div className="rounded-lg border border-border bg-muted/20 p-4">
          <p className="text-xs text-muted-foreground">平均影响分</p>
          <p className="mt-1 text-lg font-semibold">
            {rollbackEvents.length === 0
              ? "0"
              : (
                  rollbackEvents.reduce((acc, item) => acc + item.impactScore, 0) / rollbackEvents.length
                ).toFixed(2)}
          </p>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-lg border border-border bg-background p-4 space-y-3">
          <p className="text-sm font-medium">灰度发布窗口、演练脚本与流量开关</p>
          <select
            value={form.id}
            onChange={(event) => {
              const selected = plans.find((item) => item.id === event.target.value)
              const defaultWindow = buildDefaultReleaseWindow()
              setForm({
                id: event.target.value,
                name: selected?.name || "",
                status: selected?.status || "READY",
                releaseWindowStart: selected?.releaseWindowStart
                  ? toLocalDateTimeValue(selected.releaseWindowStart)
                  : defaultWindow.releaseWindowStart,
                releaseWindowEnd: selected?.releaseWindowEnd
                  ? toLocalDateTimeValue(selected.releaseWindowEnd)
                  : defaultWindow.releaseWindowEnd,
                canaryTrafficPercent: String(selected?.canaryTrafficPercent || 10),
                rollbackThresholdPercent: String(selected?.rollbackThresholdPercent || 5),
                impactSummary: selected?.impactSummary || "",
              })
              setRollbackForm((prev) => ({ ...prev, planId: event.target.value }))
            }}
            aria-label="计划"
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">新建计划</option>
            {plans.map((item) => (
              <option key={item.id} value={item.id}>
                {formatPlanOptionLabel(item)}
              </option>
            ))}
          </select>
          <input
            value={form.name}
            onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
            aria-label="计划名称"
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            placeholder="计划名称"
          />
          <div className="grid gap-2 sm:grid-cols-3">
            <select
              value={form.status}
              onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value }))}
              aria-label="状态"
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="DRAFT">DRAFT</option>
              <option value="READY">READY</option>
              <option value="ROLLING">ROLLING</option>
              <option value="ROLLED_BACK">ROLLED_BACK</option>
              <option value="COMPLETED">COMPLETED</option>
              <option value="FAILED">FAILED</option>
            </select>
            <input
              value={form.canaryTrafficPercent}
              onChange={(event) => setForm((prev) => ({ ...prev, canaryTrafficPercent: event.target.value }))}
              aria-label="灰度流量"
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              placeholder="灰度流量%"
            />
            <input
              value={form.rollbackThresholdPercent}
              onChange={(event) => setForm((prev) => ({ ...prev, rollbackThresholdPercent: event.target.value }))}
              aria-label="回滚阈值"
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              placeholder="回滚阈值%"
            />
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <input
              type="datetime-local"
              value={form.releaseWindowStart}
              onChange={(event) => setForm((prev) => ({ ...prev, releaseWindowStart: event.target.value }))}
              aria-label="开始时间"
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            />
            <input
              type="datetime-local"
              value={form.releaseWindowEnd}
              onChange={(event) => setForm((prev) => ({ ...prev, releaseWindowEnd: event.target.value }))}
              aria-label="结束时间"
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            />
          </div>
          <textarea
            value={form.impactSummary}
            onChange={(event) => setForm((prev) => ({ ...prev, impactSummary: event.target.value }))}
            aria-label="演练总结"
            className="min-h-16 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder="演练总结"
          />
          <Button
            disabled={pending !== null}
            onClick={() =>
              runAction(
                "save-plan",
                async () => {
                  const payload = (await requestJson("/api/reliability/releases", {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      id: form.id || undefined,
                      name: form.name,
                      status: form.status,
                      releaseWindowStart: new Date(form.releaseWindowStart).toISOString(),
                      releaseWindowEnd: new Date(form.releaseWindowEnd).toISOString(),
                      canaryTrafficPercent: Number(form.canaryTrafficPercent),
                      rollbackThresholdPercent: Number(form.rollbackThresholdPercent),
                      impactSummary: form.impactSummary,
                    }),
                  })) as { plan?: PlanRow }
                  const nextPlan = payload.plan
                  if (!nextPlan) {
                    return
                  }
                  setForm({
                    id: nextPlan.id,
                    name: nextPlan.name,
                    status: nextPlan.status,
                    releaseWindowStart: toLocalDateTimeValue(nextPlan.releaseWindowStart),
                    releaseWindowEnd: toLocalDateTimeValue(nextPlan.releaseWindowEnd),
                    canaryTrafficPercent: String(nextPlan.canaryTrafficPercent),
                    rollbackThresholdPercent: String(nextPlan.rollbackThresholdPercent),
                    impactSummary: nextPlan.impactSummary || "",
                  })
                  setRollbackForm((prev) => ({ ...prev, planId: nextPlan.id }))
                },
                "发布计划已保存"
              )
            }
          >
            {pending === "save-plan" ? "保存中..." : "保存发布计划"}
          </Button>
        </div>

        <div className="rounded-lg border border-border bg-background p-4 space-y-3">
          <p className="text-sm font-medium">一键回滚与影响面评估</p>
          <select
            value={rollbackForm.planId}
            onChange={(event) => setRollbackForm((prev) => ({ ...prev, planId: event.target.value }))}
            aria-label="回滚计划"
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">选择计划</option>
            {plans.map((item) => (
              <option key={item.id} value={item.id}>
                {formatPlanOptionLabel(item)}
              </option>
            ))}
          </select>
          <textarea
            value={rollbackForm.reason}
            onChange={(event) => setRollbackForm((prev) => ({ ...prev, reason: event.target.value }))}
            aria-label="回滚原因"
            className="min-h-16 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder="回滚原因"
          />
          <div className="grid gap-2 sm:grid-cols-2">
            <input
              value={rollbackForm.estimatedUsers}
              onChange={(event) => setRollbackForm((prev) => ({ ...prev, estimatedUsers: event.target.value }))}
              aria-label="影响用户"
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              placeholder="影响用户"
            />
            <input
              value={rollbackForm.impactedServices}
              onChange={(event) => setRollbackForm((prev) => ({ ...prev, impactedServices: event.target.value }))}
              aria-label="影响服务"
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              placeholder="serviceA,serviceB"
            />
          </div>
          <Button
            disabled={pending !== null || !rollbackForm.planId}
            onClick={() =>
              runAction(
                "rollback",
                () =>
                  requestJson("/api/reliability/releases", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      planId: rollbackForm.planId,
                      reason: rollbackForm.reason,
                      estimatedUsers: Number(rollbackForm.estimatedUsers),
                      impactedServices: rollbackForm.impactedServices
                        .split(",")
                        .map((item) => item.trim())
                        .filter(Boolean),
                    }),
                  }),
                "回滚执行完成"
              )
            }
          >
            {pending === "rollback" ? "回滚中..." : "执行一键回滚"}
          </Button>
          <div className="space-y-2 text-sm">
            {rollbackEvents.slice(0, 8).map((item) => (
              <div key={item.id} className="rounded-md border border-border bg-muted/10 px-3 py-2">
                <p className="font-medium">
                  {item.plan.name} · impact {item.impactScore}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {item.reason} · users {item.estimatedUsers} · {formatDateTime(item.rollbackAt)}
                </p>
              </div>
            ))}
            {rollbackEvents.length === 0 ? <p className="text-muted-foreground">暂无回滚记录。</p> : null}
          </div>
        </div>
      </div>
    </div>
  )
}
