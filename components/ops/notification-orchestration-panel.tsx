"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toaster"

type RuleRow = {
  id: string
  name: string
  enabled: boolean
  channels: unknown
  quietWindowStart: number
  quietWindowEnd: number
  frequencyCapPerHour: number
  dedupeWindowMinutes: number
}

type DeliveryRow = {
  id: string
  ruleId: string
  channel: string
  status: string
  recipient: string
  receiptCode: string | null
  errorMessage: string | null
  createdAt: string
  rule: {
    id: string
    name: string
    frequencyCapPerHour: number
    dedupeWindowMinutes: number
  }
}

type NotificationOrchestrationPanelProps = {
  hasAccess: boolean
  planId: string
  rules: RuleRow[]
  deliveries: DeliveryRow[]
  stats: {
    total: number
    sent: number
    failed: number
    deduped: number
    suppressed: number
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

function toChannels(value: unknown) {
  if (!Array.isArray(value)) {
    return []
  }
  return value.map((item) => String(item))
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

function buildNotificationRuleForm(rule: RuleRow | null) {
  return {
    id: rule?.id || "",
    name: rule?.name || "",
    enabled: rule?.enabled ?? true,
    channels: rule ? toChannels(rule.channels) : ["IN_APP"],
    quietWindowStart: String(rule?.quietWindowStart ?? 23),
    quietWindowEnd: String(rule?.quietWindowEnd ?? 8),
    frequencyCapPerHour: String(rule?.frequencyCapPerHour ?? 3),
    dedupeWindowMinutes: String(rule?.dedupeWindowMinutes ?? 30),
  }
}

export function NotificationOrchestrationPanel({
  hasAccess,
  planId,
  rules,
  deliveries,
  stats,
}: NotificationOrchestrationPanelProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [pending, setPending] = useState<string | null>(null)
  const [selectedRuleId, setSelectedRuleId] = useState(rules[0]?.id || "")
  const selectedRule = useMemo(() => rules.find((item) => item.id === selectedRuleId) || null, [rules, selectedRuleId])

  const [form, setForm] = useState(() => buildNotificationRuleForm(selectedRule))

  const [dispatchForm, setDispatchForm] = useState({
    ruleId: selectedRule?.id || "",
    recipient: "ops@aura.local",
    message: "发布链路告警，请关注。",
  })

  useEffect(() => {
    setForm(buildNotificationRuleForm(selectedRule))
    setDispatchForm((prev) => ({ ...prev, ruleId: selectedRule?.id || "" }))
  }, [selectedRule])

  if (!hasAccess) {
    return (
      <div className="rounded-lg border border-border bg-muted/20 p-4 text-sm">
        <p className="font-medium">当前套餐：{planId.toUpperCase()}</p>
        <p className="mt-1 text-muted-foreground">通知编排仅对 Pro / Team / Enterprise 套餐开放。</p>
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
      <div className="grid gap-3 md:grid-cols-5">
        <div className="rounded-lg border border-border bg-muted/20 p-4">
          <p className="text-xs text-muted-foreground">触达总量</p>
          <p className="mt-1 text-lg font-semibold">{stats.total}</p>
        </div>
        <div className="rounded-lg border border-border bg-muted/20 p-4">
          <p className="text-xs text-muted-foreground">送达</p>
          <p className="mt-1 text-lg font-semibold">{stats.sent}</p>
        </div>
        <div className="rounded-lg border border-border bg-muted/20 p-4">
          <p className="text-xs text-muted-foreground">失败</p>
          <p className="mt-1 text-lg font-semibold">{stats.failed}</p>
        </div>
        <div className="rounded-lg border border-border bg-muted/20 p-4">
          <p className="text-xs text-muted-foreground">去重</p>
          <p className="mt-1 text-lg font-semibold">{stats.deduped}</p>
        </div>
        <div className="rounded-lg border border-border bg-muted/20 p-4">
          <p className="text-xs text-muted-foreground">静默抑制</p>
          <p className="mt-1 text-lg font-semibold">{stats.suppressed}</p>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-lg border border-border bg-background p-4 space-y-3">
          <p className="text-sm font-medium">站内 / 邮件 / Webhook 多通道编排策略</p>
          <select
            value={selectedRuleId}
            onChange={(event) => setSelectedRuleId(event.target.value)}
            aria-label="通知规则"
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">新建规则</option>
            {rules.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          <input
            value={form.name}
            onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
            aria-label="规则名称"
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            placeholder="规则名称"
          />
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.channels.includes("IN_APP")}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    channels: event.target.checked
                      ? Array.from(new Set([...prev.channels, "IN_APP"]))
                      : prev.channels.filter((item) => item !== "IN_APP"),
                  }))
                }
              />
              <span>IN_APP</span>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.channels.includes("EMAIL")}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    channels: event.target.checked
                      ? Array.from(new Set([...prev.channels, "EMAIL"]))
                      : prev.channels.filter((item) => item !== "EMAIL"),
                  }))
                }
              />
              <span>EMAIL</span>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.channels.includes("WEBHOOK")}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    channels: event.target.checked
                      ? Array.from(new Set([...prev.channels, "WEBHOOK"]))
                      : prev.channels.filter((item) => item !== "WEBHOOK"),
                  }))
                }
              />
              <span>WEBHOOK</span>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.enabled}
                onChange={(event) => setForm((prev) => ({ ...prev, enabled: event.target.checked }))}
              />
              <span>启用规则</span>
            </label>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <input
              value={form.quietWindowStart}
              onChange={(event) => setForm((prev) => ({ ...prev, quietWindowStart: event.target.value }))}
              aria-label="静默开始"
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              placeholder="静默开始小时"
            />
            <input
              value={form.quietWindowEnd}
              onChange={(event) => setForm((prev) => ({ ...prev, quietWindowEnd: event.target.value }))}
              aria-label="静默结束"
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              placeholder="静默结束小时"
            />
            <input
              value={form.frequencyCapPerHour}
              onChange={(event) => setForm((prev) => ({ ...prev, frequencyCapPerHour: event.target.value }))}
              aria-label="频控"
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              placeholder="每小时上限"
            />
            <input
              value={form.dedupeWindowMinutes}
              onChange={(event) => setForm((prev) => ({ ...prev, dedupeWindowMinutes: event.target.value }))}
              aria-label="去重窗口"
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              placeholder="去重窗口(分钟)"
            />
          </div>
          <Button
            disabled={pending !== null}
            onClick={() =>
              runAction(
                "save-rule",
                () =>
                  requestJson("/api/ops/notifications", {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      id: form.id || undefined,
                      name: form.name,
                      enabled: form.enabled,
                      channels: form.channels,
                      quietWindowStart: Number(form.quietWindowStart),
                      quietWindowEnd: Number(form.quietWindowEnd),
                      frequencyCapPerHour: Number(form.frequencyCapPerHour),
                      dedupeWindowMinutes: Number(form.dedupeWindowMinutes),
                    }),
                  }),
                "通知规则已保存"
              )
            }
          >
            {pending === "save-rule" ? "保存中..." : "保存编排规则"}
          </Button>
        </div>

        <div className="rounded-lg border border-border bg-background p-4 space-y-3">
          <p className="text-sm font-medium">频控、去重补偿与触达回执</p>
          <select
            value={dispatchForm.ruleId}
            onChange={(event) => setDispatchForm((prev) => ({ ...prev, ruleId: event.target.value }))}
            aria-label="选择规则"
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">选择规则</option>
            {rules.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          <input
            value={dispatchForm.recipient}
            onChange={(event) => setDispatchForm((prev) => ({ ...prev, recipient: event.target.value }))}
            aria-label="接收人"
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            placeholder="接收人"
          />
          <textarea
            value={dispatchForm.message}
            onChange={(event) => setDispatchForm((prev) => ({ ...prev, message: event.target.value }))}
            aria-label="消息"
            className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder="消息内容"
          />
          <Button
            disabled={pending !== null || !dispatchForm.ruleId}
            onClick={() =>
              runAction(
                "dispatch",
                () =>
                  requestJson("/api/ops/notifications", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      ruleId: dispatchForm.ruleId,
                      recipient: dispatchForm.recipient,
                      message: dispatchForm.message,
                      payload: {
                        source: "notification-panel",
                      },
                    }),
                  }),
                "通知已发送"
              )
            }
          >
            {pending === "dispatch" ? "发送中..." : "执行触达"}
          </Button>
          <div className="space-y-2 text-sm">
            {deliveries.slice(0, 8).map((item) => (
              <div key={item.id} className="rounded-md border border-border bg-muted/10 px-3 py-2">
                <p className="font-medium">
                  {item.rule.name} · {item.channel} · {item.status}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {item.recipient} · receipt {item.receiptCode || "-"} · {formatDateTime(item.createdAt)}
                </p>
              </div>
            ))}
            {deliveries.length === 0 ? <p className="text-muted-foreground">暂无触达记录。</p> : null}
          </div>
        </div>
      </div>
    </div>
  )
}
