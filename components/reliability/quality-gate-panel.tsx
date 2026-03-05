"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toaster"

type GateRunRow = {
  id: string
  releaseKey: string
  gateType: string
  severity: string
  status: string
  environment: string
  blockReason: string | null
  createdAt: string
}

type QualityGatePanelProps = {
  hasAccess: boolean
  planId: string
  runs: GateRunRow[]
  summary: {
    total: number
    pass: number
    warn: number
    fail: number
    blocked: number
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

export function QualityGatePanel({ hasAccess, planId, runs, summary }: QualityGatePanelProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [pending, setPending] = useState(false)
  const [form, setForm] = useState({
    releaseKey: "phase6-main",
    gateType: "FUNCTIONAL",
    severity: "MEDIUM",
    environment: "staging",
    blockReason: "",
    findingsJson: '[{"name":"ui-regression","severity":"high"}]',
  })

  if (!hasAccess) {
    return (
      <div className="rounded-lg border border-border bg-muted/20 p-4 text-sm">
        <p className="font-medium">当前套餐：{planId.toUpperCase()}</p>
        <p className="mt-1 text-muted-foreground">全链路质量闸门仅对 Pro / Team / Enterprise 套餐开放。</p>
      </div>
    )
  }

  async function submitGate() {
    setPending(true)
    try {
      let findings: unknown = []
      try {
        findings = JSON.parse(form.findingsJson)
      } catch {
        findings = []
      }

      await requestJson("/api/reliability/gates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          releaseKey: form.releaseKey,
          gateType: form.gateType,
          severity: form.severity,
          environment: form.environment,
          blockReason: form.blockReason,
          findings,
        }),
      })
      toast({ type: "success", title: "质量闸门执行完成" })
      router.refresh()
    } catch (error) {
      toast({
        type: "error",
        title: "执行失败",
        description: error instanceof Error ? error.message : "请稍后重试",
      })
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3 md:grid-cols-5">
        <div className="rounded-lg border border-border bg-muted/20 p-4">
          <p className="text-xs text-muted-foreground">总闸门</p>
          <p className="mt-1 text-lg font-semibold">{summary.total}</p>
        </div>
        <div className="rounded-lg border border-border bg-muted/20 p-4">
          <p className="text-xs text-muted-foreground">PASS</p>
          <p className="mt-1 text-lg font-semibold">{summary.pass}</p>
        </div>
        <div className="rounded-lg border border-border bg-muted/20 p-4">
          <p className="text-xs text-muted-foreground">WARN</p>
          <p className="mt-1 text-lg font-semibold">{summary.warn}</p>
        </div>
        <div className="rounded-lg border border-border bg-muted/20 p-4">
          <p className="text-xs text-muted-foreground">FAIL</p>
          <p className="mt-1 text-lg font-semibold">{summary.fail}</p>
        </div>
        <div className="rounded-lg border border-border bg-muted/20 p-4">
          <p className="text-xs text-muted-foreground">BLOCKED</p>
          <p className="mt-1 text-lg font-semibold">{summary.blocked}</p>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-lg border border-border bg-background p-4 space-y-3">
          <p className="text-sm font-medium">统一功能/性能/安全门禁与阻断策略</p>
          <input
            value={form.releaseKey}
            onChange={(event) => setForm((prev) => ({ ...prev, releaseKey: event.target.value }))}
            aria-label="release key"
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            placeholder="release key"
          />
          <div className="grid gap-2 sm:grid-cols-3">
            <select
              value={form.gateType}
              onChange={(event) => setForm((prev) => ({ ...prev, gateType: event.target.value }))}
              aria-label="gate type"
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="FUNCTIONAL">FUNCTIONAL</option>
              <option value="PERFORMANCE">PERFORMANCE</option>
              <option value="SECURITY">SECURITY</option>
            </select>
            <select
              value={form.severity}
              onChange={(event) => setForm((prev) => ({ ...prev, severity: event.target.value }))}
              aria-label="severity"
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="LOW">LOW</option>
              <option value="MEDIUM">MEDIUM</option>
              <option value="HIGH">HIGH</option>
              <option value="CRITICAL">CRITICAL</option>
            </select>
            <select
              value={form.environment}
              onChange={(event) => setForm((prev) => ({ ...prev, environment: event.target.value }))}
              aria-label="environment"
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="staging">staging</option>
              <option value="production">production</option>
            </select>
          </div>
          <input
            value={form.blockReason}
            onChange={(event) => setForm((prev) => ({ ...prev, blockReason: event.target.value }))}
            aria-label="block reason"
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            placeholder="阻断原因（留空则按结果自动判定）"
          />
          <textarea
            value={form.findingsJson}
            onChange={(event) => setForm((prev) => ({ ...prev, findingsJson: event.target.value }))}
            aria-label="findings"
            className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
            placeholder='[{"name":"test","severity":"critical"}]'
          />
          <Button disabled={pending} onClick={submitGate}>
            {pending ? "执行中..." : "执行质量闸门"}
          </Button>
        </div>

        <div className="rounded-lg border border-border bg-background p-4 space-y-2 text-sm">
          <p className="text-sm font-medium">分支保护 / 发布门禁执行记录</p>
          {runs.slice(0, 10).map((item) => (
            <div key={item.id} className="rounded-md border border-border bg-muted/10 px-3 py-2">
              <p className="font-medium">
                {item.releaseKey} · {item.gateType} · {item.status}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                severity {item.severity} · env {item.environment} · {new Date(item.createdAt).toLocaleString()}
              </p>
              {item.blockReason ? <p className="mt-1 text-xs text-destructive">阻断：{item.blockReason}</p> : null}
            </div>
          ))}
          {runs.length === 0 ? <p className="text-muted-foreground">暂无闸门执行记录。</p> : null}
        </div>
      </div>
    </div>
  )
}
