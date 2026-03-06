"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toaster"

type ApiKeyRow = {
  id: string
  name: string
  keyPrefix: string
  status: "ACTIVE" | "DISABLED" | "REVOKED"
  planId: string
  monthlyQuota: number
  consumedCallsMonth: number
  rateLimitPerMinute: number
  overageAutoPackEnabled: boolean
  overagePackSize: number
  monthWindowStart: string
  monthWindowEnd: string
  lastUsedAt: string | null
}

type UsageSummary = {
  totalRequestCount: number
  totalAmountCents: number
  blockedCount: number
  byModel: Record<string, { requestCount: number; amountCents: number }>
}

type AlertRow = {
  id: string
  type: string
  status: "OPEN" | "RESOLVED"
  thresholdPercent: number
  observedPercent: number
  message: string
  createdAt: string
}

type PurchaseRow = {
  id: string
  units: number
  amountCents: number
  status: string
  createdAt: string
}

type ApiPricingQuotaPanelProps = {
  hasAccess: boolean
  planId: string
  policy: {
    maxApiKeys: number | "unlimited"
    maxApiCallsPerMonth: number | "unlimited"
    defaultOveragePackUnits: number
    overagePackPriceCents: number
  }
  apiKeys: ApiKeyRow[]
  usageSummary: UsageSummary
  alerts: AlertRow[]
  purchases: PurchaseRow[]
}

async function requestJson(path: string, init?: RequestInit) {
  const response = await fetch(path, init)
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(String(payload?.error || "请求失败"))
  }
  return payload
}

function formatCny(cents: number) {
  return (cents / 100).toLocaleString("zh-CN", {
    style: "currency",
    currency: "CNY",
  })
}

function formatLimit(value: number | "unlimited") {
  return value === "unlimited" ? "不限" : value.toLocaleString("zh-CN")
}

export function ApiPricingQuotaPanel({
  hasAccess,
  planId,
  policy,
  apiKeys,
  usageSummary,
  alerts,
  purchases,
}: ApiPricingQuotaPanelProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [pendingAction, setPendingAction] = useState<string | null>(null)

  const [newKeyName, setNewKeyName] = useState("")
  const [selectedKeyId, setSelectedKeyId] = useState(apiKeys[0]?.id || "")
  const selectedKey = useMemo(
    () => apiKeys.find((item) => item.id === selectedKeyId) || null,
    [apiKeys, selectedKeyId]
  )

  const [consumeForm, setConsumeForm] = useState({
    requestCount: "100",
    billableUnits: "100",
    modelTier: "BASIC",
  })

  const [keyForm, setKeyForm] = useState({
    status: selectedKey?.status || "ACTIVE",
    monthlyQuota: String(selectedKey?.monthlyQuota || 200000),
    rateLimitPerMinute: String(selectedKey?.rateLimitPerMinute || 120),
    overagePackSize: String(selectedKey?.overagePackSize || policy.defaultOveragePackUnits),
    overageAutoPackEnabled: selectedKey?.overageAutoPackEnabled || false,
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
        <p className="mt-1 text-muted-foreground">
          API 定价与配额策略仅对 Pro / Team / Enterprise 套餐开放。
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded-lg border border-border bg-muted/20 p-4">
          <p className="text-xs text-muted-foreground">API Key 上限</p>
          <p className="mt-1 text-lg font-semibold">{formatLimit(policy.maxApiKeys)}</p>
        </div>
        <div className="rounded-lg border border-border bg-muted/20 p-4">
          <p className="text-xs text-muted-foreground">月度 API 调用上限</p>
          <p className="mt-1 text-lg font-semibold">{formatLimit(policy.maxApiCallsPerMonth)}</p>
        </div>
        <div className="rounded-lg border border-border bg-muted/20 p-4">
          <p className="text-xs text-muted-foreground">累计请求量</p>
          <p className="mt-1 text-lg font-semibold">{usageSummary.totalRequestCount.toLocaleString("zh-CN")}</p>
        </div>
        <div className="rounded-lg border border-border bg-muted/20 p-4">
          <p className="text-xs text-muted-foreground">累计账单金额</p>
          <p className="mt-1 text-lg font-semibold">{formatCny(usageSummary.totalAmountCents)}</p>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="space-y-3 rounded-lg border border-border bg-background p-4">
          <p className="text-sm font-medium">API Key 配额与限流联动</p>
          <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
            <input
              value={newKeyName}
              onChange={(event) => setNewKeyName(event.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              aria-label="新 API Key 名称"
              placeholder="新 API Key 名称"
            />
            <Button
              disabled={pendingAction !== null}
              onClick={() =>
                runAction(
                  "create-key",
                  () =>
                    requestJson("/api/developer/keys", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ name: newKeyName }),
                    }),
                  "API Key 已创建"
                )
              }
            >
              {pendingAction === "create-key" ? "创建中..." : "创建 API Key"}
            </Button>
          </div>

          <select
            value={selectedKeyId}
            onChange={(event) => setSelectedKeyId(event.target.value)}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            aria-label="选择 API Key"
          >
            <option value="">选择 API Key</option>
            {apiKeys.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} · {item.status} · {item.keyPrefix}
              </option>
            ))}
          </select>

          {selectedKey ? (
            <div className="space-y-2 rounded-md border border-border p-3">
              <div className="grid gap-2 sm:grid-cols-2">
                <select
                  value={keyForm.status}
                  onChange={(event) =>
                    setKeyForm((prev) => ({
                      ...prev,
                      status: event.target.value as "ACTIVE" | "DISABLED" | "REVOKED",
                    }))
                  }
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                  aria-label="API Key 状态"
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="DISABLED">DISABLED</option>
                  <option value="REVOKED">REVOKED</option>
                </select>
                <input
                  value={keyForm.monthlyQuota}
                  onChange={(event) => setKeyForm((prev) => ({ ...prev, monthlyQuota: event.target.value }))}
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                  aria-label="月度配额"
                  placeholder="月度配额"
                />
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <input
                  value={keyForm.rateLimitPerMinute}
                  onChange={(event) =>
                    setKeyForm((prev) => ({ ...prev, rateLimitPerMinute: event.target.value }))
                  }
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                  aria-label="每分钟限流"
                  placeholder="每分钟限流"
                />
                <input
                  value={keyForm.overagePackSize}
                  onChange={(event) =>
                    setKeyForm((prev) => ({ ...prev, overagePackSize: event.target.value }))
                  }
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                  aria-label="自动扩容包单位"
                  placeholder="自动扩容包单位"
                />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={keyForm.overageAutoPackEnabled}
                  onChange={(event) =>
                    setKeyForm((prev) => ({ ...prev, overageAutoPackEnabled: event.target.checked }))
                  }
                />
                <span>启用超量自动扩容包购买</span>
              </label>
              <Button
                disabled={pendingAction !== null}
                onClick={() =>
                  runAction(
                    "update-key",
                    () =>
                      requestJson(`/api/developer/keys/${selectedKey.id}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          status: keyForm.status,
                          monthlyQuota: Number(keyForm.monthlyQuota),
                          rateLimitPerMinute: Number(keyForm.rateLimitPerMinute),
                          overagePackSize: Number(keyForm.overagePackSize),
                          overageAutoPackEnabled: keyForm.overageAutoPackEnabled,
                        }),
                      }),
                    "API Key 策略已更新"
                  )
                }
              >
                {pendingAction === "update-key" ? "更新中..." : "保存 API Key 策略"}
              </Button>
            </div>
          ) : null}
        </div>

        <div className="space-y-3 rounded-lg border border-border bg-background p-4">
          <p className="text-sm font-medium">调用计费、滥用防护与扩容包</p>
          <div className="grid gap-2 sm:grid-cols-3">
            <input
              value={consumeForm.requestCount}
              onChange={(event) => setConsumeForm((prev) => ({ ...prev, requestCount: event.target.value }))}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              aria-label="请求数"
              placeholder="请求数"
            />
            <input
              value={consumeForm.billableUnits}
              onChange={(event) => setConsumeForm((prev) => ({ ...prev, billableUnits: event.target.value }))}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              aria-label="计费单位"
              placeholder="计费单位"
            />
            <select
              value={consumeForm.modelTier}
              onChange={(event) => setConsumeForm((prev) => ({ ...prev, modelTier: event.target.value }))}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              aria-label="模型级别"
            >
              <option value="BASIC">BASIC</option>
              <option value="ADVANCED">ADVANCED</option>
              <option value="PREMIUM">PREMIUM</option>
            </select>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={pendingAction !== null || !selectedKey}
              onClick={() =>
                runAction(
                  "consume",
                  () =>
                    requestJson(`/api/developer/keys/${selectedKey?.id}/consume`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        requestCount: Number(consumeForm.requestCount),
                        billableUnits: Number(consumeForm.billableUnits),
                        modelTier: consumeForm.modelTier,
                      }),
                    }),
                  "API 调用计费已记录"
                )
              }
            >
              {pendingAction === "consume" ? "执行中..." : "模拟调用计费"}
            </Button>
            <Button
              variant="outline"
              disabled={pendingAction !== null || !selectedKey}
              onClick={() =>
                runAction(
                  "purchase-pack",
                  () =>
                    requestJson("/api/developer/overage", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        apiKeyId: selectedKey?.id,
                        units: Number(keyForm.overagePackSize || policy.defaultOveragePackUnits),
                      }),
                    }),
                  "扩容包购买成功"
                )
              }
            >
              {pendingAction === "purchase-pack" ? "购买中..." : "手动购买扩容包"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            当前超量包参考价：{formatCny(policy.overagePackPriceCents)} / {policy.defaultOveragePackUnits.toLocaleString("zh-CN")} 单位
          </p>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-lg border border-border bg-background p-4">
          <p className="text-sm font-medium">超量预警与风控告警</p>
          {alerts.length === 0 ? (
            <p className="mt-2 text-xs text-muted-foreground">暂无告警。</p>
          ) : (
            <div className="mt-2 space-y-2 text-xs">
              {alerts.slice(0, 10).map((item) => (
                <div key={item.id} className="rounded border border-border px-2 py-1">
                  <p>
                    [{item.status}] {item.type} · {item.observedPercent}%
                  </p>
                  <p className="text-muted-foreground">{item.message}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-lg border border-border bg-background p-4">
          <p className="text-sm font-medium">扩容包购买记录</p>
          {purchases.length === 0 ? (
            <p className="mt-2 text-xs text-muted-foreground">暂无扩容包记录。</p>
          ) : (
            <div className="mt-2 space-y-2 text-xs">
              {purchases.slice(0, 10).map((item) => (
                <div key={item.id} className="rounded border border-border px-2 py-1">
                  <p>
                    {new Date(item.createdAt).toLocaleString("zh-CN")} · +{item.units.toLocaleString("zh-CN")} 单位
                  </p>
                  <p className="text-muted-foreground">{formatCny(item.amountCents)} · {item.status}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
