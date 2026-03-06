"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { SlaAlertStatus, SlaMetricType } from "@prisma/client"

import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toaster"
import type { SlaPolicy } from "@/lib/sla-monitoring"

type SnapshotRow = {
  id: string
  windowStart: string
  windowEnd: string
  availabilityRate: number
  errorRate: number
  latencyP95Ms: number
  totalChecks: number
  failedChecks: number
  metadata: unknown
}

type AlertRow = {
  id: string
  metric: SlaMetricType
  status: SlaAlertStatus
  threshold: number
  observed: number
  summary: string
  triggeredAt: string
  recoveredAt: string | null
}

type SlaMonitoringPanelProps = {
  planId: string
  policy: SlaPolicy
  snapshots: SnapshotRow[]
  alerts: AlertRow[]
}

async function requestJson(path: string, init?: RequestInit) {
  const response = await fetch(path, init)
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(String(payload?.error || "请求失败"))
  }
  return payload
}

function resolveMetricLabel(metric: SlaMetricType) {
  if (metric === "LATENCY") {
    return "延迟"
  }
  if (metric === "ERROR_RATE") {
    return "错误率"
  }
  return "可用性"
}

function parseSnapshotSource(metadata: unknown) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return "runtime"
  }

  const source = Reflect.get(metadata, "source")
  if (typeof source === "string") {
    return source
  }

  return "runtime"
}

const DEFAULT_SCENARIO = "latency_spike"
const SCENARIO_STORAGE_KEY = "aura:sla-monitoring:scenario"
const AVAILABLE_SCENARIOS = [DEFAULT_SCENARIO, "error_burst", "downtime_blip"] as const

type FaultScenario = (typeof AVAILABLE_SCENARIOS)[number]

function isFaultScenario(value: string): value is FaultScenario {
  return AVAILABLE_SCENARIOS.includes(value as FaultScenario)
}

const dateTimeFormatter = new Intl.DateTimeFormat("zh-CN", {
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
  return dateTimeFormatter.format(new Date(value))
}

export function SlaMonitoringPanel({ planId, policy, snapshots, alerts }: SlaMonitoringPanelProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [scenario, setScenario] = useState<FaultScenario>(DEFAULT_SCENARIO)
  const [windowHours, setWindowHours] = useState(policy.reportWindowHours)
  const [pendingAction, setPendingAction] = useState<string | null>(null)

  useEffect(() => {
    const persistedScenario = window.localStorage.getItem(SCENARIO_STORAGE_KEY)
    if (persistedScenario && isFaultScenario(persistedScenario)) {
      setScenario(persistedScenario)
    }
  }, [])

  function updateScenario(nextScenario: FaultScenario) {
    window.localStorage.setItem(SCENARIO_STORAGE_KEY, nextScenario)
    setScenario(nextScenario)
  }

  const latestSnapshot = snapshots[0] ?? null
  const openAlerts = useMemo(
    () => alerts.filter((alert) => alert.status === SlaAlertStatus.OPEN).length,
    [alerts]
  )

  async function runAction(actionKey: string, fn: () => Promise<unknown>, success: string) {
    setPendingAction(actionKey)
    try {
      await fn()
      toast({ type: "success", title: success })
      router.refresh()
    } catch (error) {
      toast({
        type: "error",
        title: "执行失败",
        description: error instanceof Error ? error.message : "请稍后重试",
      })
    } finally {
      setPendingAction(null)
    }
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-lg border border-border bg-muted/20 p-4">
          <p className="text-xs text-muted-foreground">当前套餐</p>
          <p className="mt-1 text-lg font-semibold">{planId.toUpperCase()}</p>
        </div>
        <div className="rounded-lg border border-border bg-muted/20 p-4">
          <p className="text-xs text-muted-foreground">可用性目标</p>
          <p className="mt-1 text-lg font-semibold">{policy.targetAvailability}%</p>
        </div>
        <div className="rounded-lg border border-border bg-muted/20 p-4">
          <p className="text-xs text-muted-foreground">错误率阈值</p>
          <p className="mt-1 text-lg font-semibold">≤ {policy.maxErrorRate}%</p>
        </div>
        <div className="rounded-lg border border-border bg-muted/20 p-4">
          <p className="text-xs text-muted-foreground">P95 延迟阈值</p>
          <p className="mt-1 text-lg font-semibold">≤ {policy.maxLatencyP95Ms}ms</p>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-background p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            disabled={pendingAction !== null}
            onClick={() =>
              runAction(
                "refresh-report",
                () => requestJson(`/api/sla/report?windowHours=${windowHours}`),
                "SLA 报表已更新"
              )
            }
          >
            {pendingAction === "refresh-report" ? "刷新中..." : "刷新 SLA 报表"}
          </Button>

          <select
            aria-label="报表时间窗口"
            value={windowHours}
            onChange={(event) => setWindowHours(Number(event.target.value) || policy.reportWindowHours)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            disabled={pendingAction !== null}
          >
            <option value={6}>最近 6 小时</option>
            <option value={12}>最近 12 小时</option>
            <option value={24}>最近 24 小时</option>
            <option value={48}>最近 48 小时</option>
          </select>

          <select
            aria-label="故障注入场景"
            value={scenario}
            onChange={(event) => {
              const nextScenario = event.target.value
              if (isFaultScenario(nextScenario)) {
                updateScenario(nextScenario)
              }
            }}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            disabled={pendingAction !== null}
          >
            <option value="latency_spike">延迟突增</option>
            <option value="error_burst">错误率突增</option>
            <option value="downtime_blip">可用性波动</option>
          </select>

          <Button
            disabled={pendingAction !== null}
            onClick={() =>
              runAction(
                "inject-fault",
                () =>
                  requestJson("/api/sla/fault-injection", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ scenario }),
                  }),
                "故障注入已完成"
              )
            }
          >
            {pendingAction === "inject-fault" ? "执行中..." : "注入故障"}
          </Button>

          <Button
            variant="outline"
            disabled={pendingAction !== null}
            onClick={() =>
              runAction(
                "recover-check",
                () =>
                  requestJson("/api/sla/fault-injection", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ scenario: "recover" }),
                  }),
                "恢复检查已完成"
              )
            }
          >
            {pendingAction === "recover-check" ? "检查中..." : "执行恢复检查"}
          </Button>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <div className="rounded-md border border-border px-3 py-2">
            <p className="text-xs text-muted-foreground">当前可用性</p>
            <p className="mt-1 text-base font-semibold">
              {latestSnapshot ? `${latestSnapshot.availabilityRate}%` : "-"}
            </p>
          </div>
          <div className="rounded-md border border-border px-3 py-2">
            <p className="text-xs text-muted-foreground">当前错误率</p>
            <p className="mt-1 text-base font-semibold">
              {latestSnapshot ? `${latestSnapshot.errorRate}%` : "-"}
            </p>
          </div>
          <div className="rounded-md border border-border px-3 py-2">
            <p className="text-xs text-muted-foreground">当前 P95 延迟</p>
            <p className="mt-1 text-base font-semibold">
              {latestSnapshot ? `${latestSnapshot.latencyP95Ms}ms` : "-"}
            </p>
          </div>
          <div className="rounded-md border border-border px-3 py-2">
            <p className="text-xs text-muted-foreground">未恢复告警</p>
            <p className="mt-1 text-base font-semibold">{openAlerts}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-background p-4">
          <p className="text-sm font-medium">最近告警</p>
          {alerts.length === 0 ? (
            <p className="mt-2 text-xs text-muted-foreground">暂无告警记录。</p>
          ) : (
            <div className="mt-3 space-y-2 text-sm">
              {alerts.slice(0, 8).map((alert) => (
                <div key={alert.id} className="rounded-md border border-border px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium">{resolveMetricLabel(alert.metric)}</p>
                    <span className="text-xs text-muted-foreground">
                      {alert.status === SlaAlertStatus.OPEN ? "OPEN" : "RECOVERED"}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{alert.summary}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    触发 {formatDateTime(alert.triggeredAt)}
                    {alert.recoveredAt ? ` · 恢复 ${formatDateTime(alert.recoveredAt)}` : ""}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-lg border border-border bg-background p-4">
          <p className="text-sm font-medium">SLA 快照历史</p>
          {snapshots.length === 0 ? (
            <p className="mt-2 text-xs text-muted-foreground">暂无快照，请先刷新报表。</p>
          ) : (
            <div className="mt-3 space-y-2 text-xs">
              {snapshots.slice(0, 10).map((snapshot) => (
                <div key={snapshot.id} className="rounded-md border border-border px-3 py-2">
                  <p className="font-medium text-foreground">
                    {formatDateTime(snapshot.windowEnd)} · {parseSnapshotSource(snapshot.metadata)}
                  </p>
                  <p className="mt-1 text-muted-foreground">
                    可用性 {snapshot.availabilityRate}% · 错误率 {snapshot.errorRate}% · P95 {snapshot.latencyP95Ms}ms
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
