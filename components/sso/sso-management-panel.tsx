"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toaster"

type ProviderRow = {
  id: string
  type: "OIDC" | "SAML"
  status: "DISABLED" | "ACTIVE"
  name: string
  issuerUrl: string
  ssoUrl: string
  clientId: string
  clientSecretMasked: string
  hasClientSecret: boolean
  domains: string[]
  roleMapping: Record<string, string>
  defaultRole: string
  enforceSso: boolean
  allowLocalFallback: boolean
  lastSyncedAt: string | null
  updatedAt: string
}

type SyncRunRow = {
  id: string
  status: "SUCCESS" | "PARTIAL" | "FAILED"
  totalUsers: number
  createdUsers: number
  linkedUsers: number
  conflictCount: number
  summary: string | null
  startedAt: string
  finishedAt: string | null
}

type ConflictRow = {
  id: string
  provider: {
    id: string
    name: string
    type: string
  }
  externalUserId: string
  incomingEmail: string
  incomingName: string | null
  existingUser: {
    id: string
    email: string
    name: string | null
  }
  reason: string
  status: "OPEN" | "RESOLVED"
  createdAt: string
  updatedAt: string
}

type SsoManagementPanelProps = {
  hasAccess: boolean
  planId: string
  providers: ProviderRow[]
  syncRuns: SyncRunRow[]
  conflicts: ConflictRow[]
}

async function requestJson(path: string, init?: RequestInit) {
  const response = await fetch(path, init)
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(String(payload?.error || "请求失败"))
  }
  return payload
}

const DEFAULT_DIRECTORY_SAMPLE = JSON.stringify(
  [
    {
      externalUserId: "corp_u_001",
      email: "alice@enterprise.example.com",
      name: "Alice",
      role: "admin",
    },
    {
      externalUserId: "corp_u_002",
      email: "bob@enterprise.example.com",
      name: "Bob",
      role: "member",
    },
  ],
  null,
  2
)

export function SsoManagementPanel({
  hasAccess,
  planId,
  providers,
  syncRuns,
  conflicts,
}: SsoManagementPanelProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [pendingAction, setPendingAction] = useState<string | null>(null)
  const [selectedProviderId, setSelectedProviderId] = useState(providers[0]?.id || "")
  const activeProvider = useMemo(
    () => providers.find((item) => item.id === selectedProviderId) || null,
    [providers, selectedProviderId]
  )

  const [form, setForm] = useState({
    id: activeProvider?.id || "",
    type: activeProvider?.type || "OIDC",
    status: activeProvider?.status || "DISABLED",
    name: activeProvider?.name || "企业 SSO",
    issuerUrl: activeProvider?.issuerUrl || "",
    ssoUrl: activeProvider?.ssoUrl || "",
    clientId: activeProvider?.clientId || "",
    clientSecret: "",
    domains: (activeProvider?.domains || []).join(","),
    roleMapping: JSON.stringify(activeProvider?.roleMapping || { admin: "OWNER", member: "EDITOR" }, null, 2),
    defaultRole: activeProvider?.defaultRole || "VIEWER",
    enforceSso: activeProvider?.enforceSso || false,
    allowLocalFallback: activeProvider?.allowLocalFallback ?? true,
  })

  const [directoryPayload, setDirectoryPayload] = useState(DEFAULT_DIRECTORY_SAMPLE)

  function selectProvider(providerId: string) {
    setSelectedProviderId(providerId)
    const provider = providers.find((item) => item.id === providerId)
    if (!provider) {
      setForm({
        id: "",
        type: "OIDC",
        status: "DISABLED",
        name: "企业 SSO",
        issuerUrl: "",
        ssoUrl: "",
        clientId: "",
        clientSecret: "",
        domains: "",
        roleMapping: JSON.stringify({ admin: "OWNER", member: "EDITOR" }, null, 2),
        defaultRole: "VIEWER",
        enforceSso: false,
        allowLocalFallback: true,
      })
      return
    }

    setForm({
      id: provider.id,
      type: provider.type,
      status: provider.status,
      name: provider.name,
      issuerUrl: provider.issuerUrl,
      ssoUrl: provider.ssoUrl,
      clientId: provider.clientId,
      clientSecret: "",
      domains: provider.domains.join(","),
      roleMapping: JSON.stringify(provider.roleMapping, null, 2),
      defaultRole: provider.defaultRole,
      enforceSso: provider.enforceSso,
      allowLocalFallback: provider.allowLocalFallback,
    })
  }

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
        <p className="mt-1 text-muted-foreground">SSO 与企业身份集成仅对 Enterprise 套餐开放。</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-border bg-muted/20 p-4 text-sm">
        <p className="font-medium">身份源策略</p>
        <p className="mt-1 text-muted-foreground">
          支持 OIDC/SAML，目录同步后将自动执行角色映射并记录冲突。
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3 rounded-lg border border-border bg-background p-4">
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={selectedProviderId}
              onChange={(event) => selectProvider(event.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">新建身份源</option>
              {providers.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} ({item.type})
                </option>
              ))}
            </select>
            <Button
              variant="outline"
              size="sm"
              disabled={pendingAction !== null}
              onClick={() => selectProvider("")}
            >
              新建
            </Button>
            {activeProvider ? (
              <Button asChild variant="outline" size="sm">
                <a href={`/api/sso/login?providerId=${activeProvider.id}&callbackUrl=%2Fdashboard`} target="_blank" rel="noreferrer">
                  测试 SSO 跳转
                </a>
              </Button>
            ) : null}
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <label className="space-y-1 text-sm">
              <span className="text-muted-foreground">类型</span>
              <select
                value={form.type}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, type: event.target.value as "OIDC" | "SAML" }))
                }
                className="h-9 w-full rounded-md border border-input bg-background px-3"
              >
                <option value="OIDC">OIDC</option>
                <option value="SAML">SAML</option>
              </select>
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-muted-foreground">状态</span>
              <select
                value={form.status}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    status: event.target.value as "DISABLED" | "ACTIVE",
                  }))
                }
                className="h-9 w-full rounded-md border border-input bg-background px-3"
              >
                <option value="DISABLED">DISABLED</option>
                <option value="ACTIVE">ACTIVE</option>
              </select>
            </label>
          </div>

          <input
            value={form.name}
            onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            placeholder="身份源名称"
          />
          <input
            value={form.issuerUrl}
            onChange={(event) => setForm((prev) => ({ ...prev, issuerUrl: event.target.value }))}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            placeholder="Issuer URL"
          />
          <input
            value={form.ssoUrl}
            onChange={(event) => setForm((prev) => ({ ...prev, ssoUrl: event.target.value }))}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            placeholder="SSO URL（可选）"
          />
          <input
            value={form.clientId}
            onChange={(event) => setForm((prev) => ({ ...prev, clientId: event.target.value }))}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            placeholder="Client ID"
          />
          <input
            value={form.clientSecret}
            onChange={(event) => setForm((prev) => ({ ...prev, clientSecret: event.target.value }))}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            placeholder={activeProvider?.hasClientSecret ? `Client Secret（已配置：${activeProvider.clientSecretMasked}）` : "Client Secret"}
          />
          <input
            value={form.domains}
            onChange={(event) => setForm((prev) => ({ ...prev, domains: event.target.value }))}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            placeholder="租户域名，逗号分隔"
          />
          <input
            value={form.defaultRole}
            onChange={(event) => setForm((prev) => ({ ...prev, defaultRole: event.target.value }))}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            placeholder="默认角色（VIEWER）"
          />

          <textarea
            value={form.roleMapping}
            onChange={(event) => setForm((prev) => ({ ...prev, roleMapping: event.target.value }))}
            className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder="角色映射 JSON"
          />

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.enforceSso}
              onChange={(event) => setForm((prev) => ({ ...prev, enforceSso: event.target.checked }))}
            />
            <span>启用强制 SSO</span>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.allowLocalFallback}
              onChange={(event) => setForm((prev) => ({ ...prev, allowLocalFallback: event.target.checked }))}
            />
            <span>允许本地账号回退</span>
          </label>

          <Button
            disabled={pendingAction !== null}
            onClick={() =>
              runAction(
                "save-provider",
                async () => {
                  const roleMapping = JSON.parse(form.roleMapping || "{}")
                  await requestJson("/api/sso/providers", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      id: form.id,
                      type: form.type,
                      status: form.status,
                      name: form.name,
                      issuerUrl: form.issuerUrl,
                      ssoUrl: form.ssoUrl,
                      clientId: form.clientId,
                      clientSecret: form.clientSecret,
                      domains: form.domains,
                      roleMapping,
                      defaultRole: form.defaultRole,
                      enforceSso: form.enforceSso,
                      allowLocalFallback: form.allowLocalFallback,
                    }),
                  })
                },
                "SSO 配置已保存"
              )
            }
          >
            {pendingAction === "save-provider" ? "保存中..." : "保存 SSO 配置"}
          </Button>
        </div>

        <div className="space-y-3 rounded-lg border border-border bg-background p-4">
          <p className="text-sm font-medium">目录同步</p>
          <textarea
            value={directoryPayload}
            onChange={(event) => setDirectoryPayload(event.target.value)}
            className="min-h-52 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder="目录用户 JSON"
          />
          <Button
            disabled={pendingAction !== null || !selectedProviderId}
            onClick={() =>
              runAction(
                "run-sync",
                async () => {
                  const users = JSON.parse(directoryPayload)
                  await requestJson("/api/sso/directory-sync", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      providerId: selectedProviderId,
                      users,
                    }),
                  })
                },
                "目录同步已执行"
              )
            }
          >
            {pendingAction === "run-sync" ? "同步中..." : "执行目录同步"}
          </Button>

          <div className="space-y-2 text-xs">
            <p className="font-medium">最近同步记录</p>
            {syncRuns.length === 0 ? (
              <p className="text-muted-foreground">暂无同步记录。</p>
            ) : (
              syncRuns.slice(0, 6).map((run) => (
                <div key={run.id} className="rounded-md border border-border px-3 py-2">
                  <p>
                    {run.status} · 总数 {run.totalUsers} · 新增 {run.createdUsers} · 关联 {run.linkedUsers} · 冲突 {run.conflictCount}
                  </p>
                  <p className="mt-1 text-muted-foreground">
                    {new Date(run.startedAt).toLocaleString("zh-CN")}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-background p-4">
        <p className="text-sm font-medium">身份冲突处理</p>
        {conflicts.length === 0 ? (
          <p className="mt-2 text-xs text-muted-foreground">暂无冲突记录。</p>
        ) : (
          <div className="mt-3 space-y-2 text-xs">
            {conflicts.slice(0, 12).map((conflict) => (
              <div key={conflict.id} className="rounded-md border border-border px-3 py-2">
                <p className="font-medium">
                  [{conflict.status}] {conflict.provider.name} · {conflict.incomingEmail}
                </p>
                <p className="mt-1 text-muted-foreground">{conflict.reason}</p>
                <p className="mt-1 text-muted-foreground">
                  现有账号：{conflict.existingUser.email} · 外部 ID：{conflict.externalUserId}
                </p>
                {conflict.status === "OPEN" ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-2"
                    disabled={pendingAction !== null}
                    onClick={() =>
                      runAction(
                        `resolve-${conflict.id}`,
                        () =>
                          requestJson("/api/sso/identity/conflicts", {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              id: conflict.id,
                              status: "RESOLVED",
                            }),
                          }),
                        "冲突已标记为已解决"
                      )
                    }
                  >
                    标记已解决
                  </Button>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
