"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toaster"

type GovernanceLogRow = {
  id: string
  action: string
  resource: string
  status: string
  immutable: boolean
  entryHash: string | null
  createdAt: string
  metadata: Record<string, unknown> | null
}

type GovernanceAuditPanelProps = {
  hasAccess: boolean
  planId: string
  logs: GovernanceLogRow[]
  integrity: {
    verified: number
    unverified: number
    nonRepudiationRatio: number
  }
}

async function requestJson(path: string) {
  const response = await fetch(path)
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(String(payload?.error || "请求失败"))
  }
  return payload
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

export function GovernanceAuditPanel({ hasAccess, planId, logs, integrity }: GovernanceAuditPanelProps) {
  const { toast } = useToast()
  const [resource, setResource] = useState("")
  const [resourceId, setResourceId] = useState("")
  const [fetchedLogs, setFetchedLogs] = useState<GovernanceLogRow[]>(logs)
  const [fetchedIntegrity, setFetchedIntegrity] = useState(integrity)
  const [loading, setLoading] = useState(false)

  if (!hasAccess) {
    return (
      <div className="rounded-lg border border-border bg-muted/20 p-4 text-sm">
        <p className="font-medium">当前套餐：{planId.toUpperCase()}</p>
        <p className="mt-1 text-muted-foreground">治理审计仅对 Pro / Team / Enterprise 套餐开放。</p>
      </div>
    )
  }

  async function fetchLogs() {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (resource) {
        params.set("resource", resource)
      }
      if (resourceId) {
        params.set("resourceId", resourceId)
      }
      const payload = await requestJson(`/api/governance/audit?${params.toString()}`)
      setFetchedLogs(payload.logs || [])
      setFetchedIntegrity(payload.integrity || integrity)
      toast({ type: "success", title: "审计检索已更新" })
    } catch (error) {
      toast({
        type: "error",
        title: "查询失败",
        description: error instanceof Error ? error.message : "请稍后重试",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-lg border border-border bg-muted/20 p-4">
          <p className="text-xs text-muted-foreground">审计条目</p>
          <p className="mt-1 text-lg font-semibold">{fetchedLogs.length}</p>
        </div>
        <div className="rounded-lg border border-border bg-muted/20 p-4">
          <p className="text-xs text-muted-foreground">不可抵赖验证</p>
          <p className="mt-1 text-lg font-semibold">{fetchedIntegrity.verified}</p>
        </div>
        <div className="rounded-lg border border-border bg-muted/20 p-4">
          <p className="text-xs text-muted-foreground">完整性比率</p>
          <p className="mt-1 text-lg font-semibold">{(fetchedIntegrity.nonRepudiationRatio * 100).toFixed(1)}%</p>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-background p-4 space-y-3">
        <p className="text-sm font-medium">连接器与工作流审计治理</p>
        <div className="grid gap-2 sm:grid-cols-3">
          <select
            value={resource}
            onChange={(event) => setResource(event.target.value)}
            aria-label="资源维度"
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">全部资源</option>
            <option value="connectors">connectors</option>
            <option value="prompt-flow">prompt-flow</option>
          </select>
          <input
            value={resourceId}
            onChange={(event) => setResourceId(event.target.value)}
            aria-label="资源ID"
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            placeholder="resourceId"
          />
          <Button disabled={loading} onClick={fetchLogs}>
            {loading ? "检索中..." : "按资源维度检索"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          记录连接器密钥变更、授权变更、工作流发布/回滚/禁用，确保敏感操作可追溯且不可抵赖。
        </p>
      </div>

      <div className="rounded-lg border border-border bg-background p-4 space-y-2 text-sm">
        {fetchedLogs.slice(0, 12).map((log) => (
          <div key={log.id} className="rounded-md border border-border bg-muted/10 px-3 py-2">
            <p className="font-medium">
              {log.action} · {log.resource} · {log.status}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              immutable={String(log.immutable)} · hash={log.entryHash ? "present" : "missing"} ·
              {formatDateTime(log.createdAt)}
            </p>
          </div>
        ))}
        {fetchedLogs.length === 0 ? <p className="text-muted-foreground">暂无审计数据。</p> : null}
      </div>
    </div>
  )
}
