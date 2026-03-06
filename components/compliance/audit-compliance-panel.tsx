"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toaster"

type RetentionPolicy = {
  retentionDays: number
  exportEnabled: boolean
  failureBurstThreshold: number
  multiIpBurstThreshold: number
  sensitiveBurstThreshold: number
}

type AuditAnomalyItem = {
  id: string
  type: string
  status: string
  severity: string
  summary: string
  occurrences: number
  lastSeenAt: string
}

type AuditLogItem = {
  id: string
  action: string
  resource: string
  status: string
  riskLevel: string
  requestId: string | null
  entryHash: string | null
  previousHash: string | null
  createdAt: string
}

type VerifyResult = {
  valid: boolean
  verifiedCount: number
  brokenEntries: Array<{ id: string; reason: string }>
  inspectedAt: string
} | null

type AuditCompliancePanelProps = {
  policy: RetentionPolicy
  anomalies: AuditAnomalyItem[]
  logs: AuditLogItem[]
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

export function AuditCompliancePanel({ policy, anomalies, logs }: AuditCompliancePanelProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [pendingAction, setPendingAction] = useState<string | null>(null)
  const [verifyResult, setVerifyResult] = useState<VerifyResult>(null)
  const [form, setForm] = useState({
    retentionDays: String(policy.retentionDays),
    exportEnabled: policy.exportEnabled,
    failureBurstThreshold: String(policy.failureBurstThreshold),
    multiIpBurstThreshold: String(policy.multiIpBurstThreshold),
    sensitiveBurstThreshold: String(policy.sensitiveBurstThreshold),
  })

  const openAnomalyCount = useMemo(
    () => anomalies.filter((item) => item.status === "OPEN").length,
    [anomalies]
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
        title: "操作失败",
        description: error instanceof Error ? error.message : "请稍后重试",
      })
    } finally {
      setPendingAction(null)
    }
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded-lg border border-border bg-muted/20 p-4">
          <p className="text-xs text-muted-foreground">保留天数</p>
          <p className="mt-1 text-lg font-semibold">{policy.retentionDays}</p>
        </div>
        <div className="rounded-lg border border-border bg-muted/20 p-4">
          <p className="text-xs text-muted-foreground">开放异常</p>
          <p className="mt-1 text-lg font-semibold">{openAnomalyCount}</p>
        </div>
        <div className="rounded-lg border border-border bg-muted/20 p-4">
          <p className="text-xs text-muted-foreground">链路校验状态</p>
          <p className="mt-1 text-lg font-semibold">{verifyResult ? (verifyResult.valid ? "PASS" : "FAIL") : "-"}</p>
        </div>
        <div className="rounded-lg border border-border bg-muted/20 p-4">
          <p className="text-xs text-muted-foreground">导出能力</p>
          <p className="mt-1 text-lg font-semibold">{policy.exportEnabled ? "已启用" : "已关闭"}</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-background p-4 space-y-3">
          <p className="text-sm font-medium">审计保留策略</p>
          <input
            value={form.retentionDays}
            onChange={(event) => setForm((prev) => ({ ...prev, retentionDays: event.target.value }))}
            aria-label="retention days"
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            placeholder="retention days"
          />
          <div className="grid gap-2 sm:grid-cols-3">
            <input
              value={form.failureBurstThreshold}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, failureBurstThreshold: event.target.value }))
              }
              aria-label="失败阈值"
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              placeholder="失败阈值"
            />
            <input
              value={form.multiIpBurstThreshold}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, multiIpBurstThreshold: event.target.value }))
              }
              aria-label="多 IP 阈值"
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              placeholder="多 IP 阈值"
            />
            <input
              value={form.sensitiveBurstThreshold}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, sensitiveBurstThreshold: event.target.value }))
              }
              aria-label="敏感阈值"
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              placeholder="敏感阈值"
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.exportEnabled}
              onChange={(event) => setForm((prev) => ({ ...prev, exportEnabled: event.target.checked }))}
            />
            <span>允许审计导出</span>
          </label>
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={pendingAction !== null}
              onClick={() =>
                runAction(
                  "save-policy",
                  () =>
                    requestJson("/api/audit-logs/retention", {
                      method: "PUT",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        retentionDays: Number(form.retentionDays),
                        exportEnabled: form.exportEnabled,
                        failureBurstThreshold: Number(form.failureBurstThreshold),
                        multiIpBurstThreshold: Number(form.multiIpBurstThreshold),
                        sensitiveBurstThreshold: Number(form.sensitiveBurstThreshold),
                      }),
                    }),
                  "审计保留策略已更新"
                )
              }
            >
              {pendingAction === "save-policy" ? "保存中..." : "保存策略"}
            </Button>
            <Button
              variant="outline"
              disabled={pendingAction !== null}
              onClick={() =>
                runAction(
                  "verify-chain",
                  async () => {
                    const result = await requestJson("/api/audit-logs/verify")
                    setVerifyResult(result)
                  },
                  "审计链路校验完成"
                )
              }
            >
              {pendingAction === "verify-chain" ? "校验中..." : "校验不可篡改链"}
            </Button>
            <Button asChild variant="outline" disabled={!form.exportEnabled}>
              <a href="/api/audit-logs?format=csv&take=500&includeExpired=true" target="_blank" rel="noreferrer">
                导出审计日志
              </a>
            </Button>
          </div>

          {verifyResult ? (
            <div className="rounded-md border border-border bg-muted/20 p-3 text-xs">
              <p className="font-medium">
                校验结果：{verifyResult.valid ? "通过" : `失败（${verifyResult.brokenEntries.length} 条异常）`}
              </p>
              <p className="mt-1 text-muted-foreground">
                已校验 {verifyResult.verifiedCount} 条 · {formatDateTime(verifyResult.inspectedAt)}
              </p>
            </div>
          ) : null}
        </div>

        <div className="rounded-lg border border-border bg-background p-4 space-y-3">
          <p className="text-sm font-medium">异常访问检测</p>
          {anomalies.length === 0 ? (
            <p className="text-xs text-muted-foreground">暂无异常事件。</p>
          ) : (
            anomalies.slice(0, 10).map((item) => (
              <div key={item.id} className="rounded-md border border-border px-3 py-2 text-xs">
                <p className="font-medium">
                  [{item.status}] {item.type} · {item.severity}
                </p>
                <p className="mt-1 text-muted-foreground">{item.summary}</p>
                <p className="mt-1 text-muted-foreground">
                  触发次数 {item.occurrences} · 最近 {formatDateTime(item.lastSeenAt)}
                </p>
                {item.status === "OPEN" ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-2"
                    disabled={pendingAction !== null}
                    onClick={() =>
                      runAction(
                        `resolve-${item.id}`,
                        () =>
                          requestJson("/api/audit-logs/anomalies", {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ id: item.id, status: "RESOLVED" }),
                          }),
                        "异常事件已标记为已解决"
                      )
                    }
                  >
                    标记已解决
                  </Button>
                ) : null}
              </div>
            ))
          )}
        </div>
      </div>

      <div className="rounded-lg border border-border bg-background p-4">
        <p className="text-sm font-medium">敏感操作留痕（最近记录）</p>
        {logs.length === 0 ? (
          <p className="mt-2 text-xs text-muted-foreground">暂无审计记录。</p>
        ) : (
          <div className="mt-3 space-y-2 text-xs">
            {logs.slice(0, 12).map((log) => (
              <div key={log.id} className="rounded-md border border-border px-3 py-2">
                <p className="font-medium">
                  {log.action} · {log.status} · {log.riskLevel}
                </p>
                <p className="mt-1 text-muted-foreground">
                  {formatDateTime(log.createdAt)} · requestId: {log.requestId || "-"}
                </p>
                <p className="mt-1 break-all text-muted-foreground">
                  prev: {log.previousHash || "-"} · hash: {log.entryHash || "-"}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
