"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toaster"

type ConnectorRow = {
  id: string
  name: string
  provider: string
  status: string
  apiBaseUrl: string | null
  credentialPreview: string | null
  secretVersion: number
  lastRotatedAt: string
  lastCheckedAt: string
  lastCheckStatus: string
  lastCheckMessage: string
}

type HealthCheckRow = {
  id: string
  connectorId: string
  status: string
  message: string
  latencyMs: number
  checkAt: string
  connector: {
    id: string
    name: string
    provider: string
    status: string
  }
}

type ConnectorCatalogPanelProps = {
  hasAccess: boolean
  planId: string
  connectors: ConnectorRow[]
  healthChecks: HealthCheckRow[]
}

async function requestJson(path: string, init?: RequestInit) {
  const response = await fetch(path, init)
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(String(payload?.error || "请求失败"))
  }
  return payload
}

export function ConnectorCatalogPanel({
  hasAccess,
  planId,
  connectors,
  healthChecks,
}: ConnectorCatalogPanelProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [pendingAction, setPendingAction] = useState<string | null>(null)

  const [form, setForm] = useState({
    id: "",
    name: connectors[0]?.name || "",
    provider: connectors[0]?.provider || "OPENAI",
    status: connectors[0]?.status || "DISABLED",
    apiBaseUrl: connectors[0]?.apiBaseUrl || "",
    credential: "",
    note: "",
  })

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
        <p className="mt-1 text-muted-foreground">连接器目录仅对 Pro / Team / Enterprise 套餐开放。</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded-lg border border-border bg-muted/20 p-4">
          <p className="text-xs text-muted-foreground">连接器总数</p>
          <p className="mt-1 text-lg font-semibold">{connectors.length}</p>
        </div>
        <div className="rounded-lg border border-border bg-muted/20 p-4">
          <p className="text-xs text-muted-foreground">ACTIVE</p>
          <p className="mt-1 text-lg font-semibold">
            {connectors.filter((item) => item.status === "ACTIVE").length}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-muted/20 p-4">
          <p className="text-xs text-muted-foreground">DEGRADED</p>
          <p className="mt-1 text-lg font-semibold">
            {connectors.filter((item) => item.status === "DEGRADED").length}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-muted/20 p-4">
          <p className="text-xs text-muted-foreground">最近健康检查</p>
          <p className="mt-1 text-lg font-semibold">{healthChecks.length}</p>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="space-y-3 rounded-lg border border-border bg-background p-4">
          <p className="text-sm font-medium">第三方模型与工具连接器目录</p>
          <select
            aria-label="选择连接器"
            value={form.id}
            onChange={(event) => {
              const selected = connectors.find((item) => item.id === event.target.value)
              setForm((prev) => ({
                ...prev,
                id: event.target.value,
                name: selected?.name || prev.name,
                provider: selected?.provider || prev.provider,
                status: selected?.status || prev.status,
                apiBaseUrl: selected?.apiBaseUrl || "",
              }))
            }}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">新建连接器</option>
            {connectors.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} · {item.provider} · {item.status}
              </option>
            ))}
          </select>
          <input
            aria-label="连接器名称"
            value={form.name}
            onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            placeholder="连接器名称"
          />
          <div className="grid gap-2 sm:grid-cols-2">
            <select
              aria-label="连接器提供方"
              value={form.provider}
              onChange={(event) => setForm((prev) => ({ ...prev, provider: event.target.value }))}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="OPENAI">OPENAI</option>
              <option value="ANTHROPIC">ANTHROPIC</option>
              <option value="LANGFUSE">LANGFUSE</option>
              <option value="PROMPTFOO">PROMPTFOO</option>
              <option value="OPENWEBUI">OPENWEBUI</option>
              <option value="CUSTOM">CUSTOM</option>
            </select>
            <select
              aria-label="连接器状态"
              value={form.status}
              onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value }))}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="ACTIVE">ACTIVE</option>
              <option value="DEGRADED">DEGRADED</option>
              <option value="DISABLED">DISABLED</option>
            </select>
          </div>
          <input
            aria-label="API Base URL"
            value={form.apiBaseUrl}
            onChange={(event) => setForm((prev) => ({ ...prev, apiBaseUrl: event.target.value }))}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            placeholder="API Base URL"
          />
          <input
            aria-label="API Key/Secret"
            value={form.credential}
            onChange={(event) => setForm((prev) => ({ ...prev, credential: event.target.value }))}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            placeholder="API Key / Secret（仅用于安全存储，不会明文返回）"
          />
          <textarea
            aria-label="连接器备注"
            value={form.note}
            onChange={(event) => setForm((prev) => ({ ...prev, note: event.target.value }))}
            className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder="连接器备注"
          />
          <Button
            disabled={pendingAction !== null}
            onClick={() =>
              runAction(
                "save-connector",
                () =>
                  requestJson("/api/connectors", {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      id: form.id || undefined,
                      name: form.name,
                      provider: form.provider,
                      status: form.status,
                      apiBaseUrl: form.apiBaseUrl,
                      credential: form.credential,
                      note: form.note,
                    }),
                  }),
                "连接器配置已保存"
              )
            }
          >
            {pendingAction === "save-connector" ? "保存中..." : "保存连接器配置"}
          </Button>
        </div>

        <div className="space-y-3 rounded-lg border border-border bg-background p-4">
          <p className="text-sm font-medium">API Key/Secret 安全存储与轮换</p>
          {connectors.length === 0 ? (
            <p className="text-sm text-muted-foreground">暂无连接器。</p>
          ) : (
            <div className="space-y-2 text-sm">
              {connectors.slice(0, 8).map((item) => (
                <div key={item.id} className="rounded-md border border-border bg-muted/10 px-3 py-2">
                  <p className="font-medium">
                    {item.name} · {item.provider}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    凭据预览 {item.credentialPreview || "未设置"} · Secret v{item.secretVersion} · 状态
                    {item.status}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    最后轮换 {item.lastRotatedAt ? new Date(item.lastRotatedAt).toLocaleString() : "未轮换"}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-border bg-background p-4 space-y-3">
        <p className="text-sm font-medium">连接健康检查与故障诊断</p>
        {connectors.length === 0 ? (
          <p className="text-sm text-muted-foreground">暂无连接器可检测。</p>
        ) : (
          <div className="space-y-2 text-sm">
            {connectors.slice(0, 8).map((item) => (
              <div key={item.id} className="rounded-md border border-border bg-muted/10 px-3 py-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">
                    {item.name} · {item.provider} · {item.lastCheckStatus || "未检测"}
                  </p>
                  <Button
                    disabled={pendingAction !== null}
                    onClick={() =>
                      runAction(
                        `health-${item.id}`,
                        () =>
                          requestJson("/api/connectors", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ id: item.id }),
                          }),
                        "健康检查完成"
                      )
                    }
                  >
                    {pendingAction === `health-${item.id}` ? "检测中..." : "执行健康检查"}
                  </Button>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {item.lastCheckMessage || "暂无诊断信息"} ·
                  最近检测 {item.lastCheckedAt ? new Date(item.lastCheckedAt).toLocaleString() : "未检测"}
                </p>
              </div>
            ))}
          </div>
        )}

        <div className="space-y-2 text-sm">
          {healthChecks.slice(0, 8).map((item) => (
            <div key={item.id} className="rounded-md border border-border bg-muted/5 px-3 py-2">
              <p className="font-medium">
                {item.connector.name} · {item.status} · {item.latencyMs}ms
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {item.message} · {new Date(item.checkAt).toLocaleString()}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
