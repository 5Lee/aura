"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toaster"

type TemplateRow = {
  id: string
  name: string
  description: string | null
  status: string
  scheduleCron: string | null
  retryLimit: number
  defaultChannel: string
  lastRunAt: string | null
}

type RunRow = {
  id: string
  templateId: string
  status: string
  attempts: number
  outputSummary: string | null
  alertSent: boolean
  createdAt: string
  template: {
    id: string
    name: string
    status: string
    retryLimit: number
  }
}

type OpsTaskCenterPanelProps = {
  hasAccess: boolean
  planId: string
  templates: TemplateRow[]
  runs: RunRow[]
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

export function OpsTaskCenterPanel({ hasAccess, planId, templates, runs }: OpsTaskCenterPanelProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [pending, setPending] = useState<string | null>(null)
  const [form, setForm] = useState({
    id: templates[0]?.id || "",
    name: templates[0]?.name || "",
    description: templates[0]?.description || "",
    status: templates[0]?.status || "SCHEDULED",
    scheduleCron: templates[0]?.scheduleCron || "0 9 * * *",
    retryLimit: String(templates[0]?.retryLimit || 2),
    defaultChannel: templates[0]?.defaultChannel || "IN_APP",
  })
  const [runTemplateId, setRunTemplateId] = useState(templates[0]?.id || "")

  if (!hasAccess) {
    return (
      <div className="rounded-lg border border-border bg-muted/20 p-4 text-sm">
        <p className="font-medium">当前套餐：{planId.toUpperCase()}</p>
        <p className="mt-1 text-muted-foreground">运营自动化任务中心仅对 Pro / Team / Enterprise 套餐开放。</p>
      </div>
    )
  }

  async function runAction(actionKey: string, fn: () => Promise<unknown>, successTitle: string) {
    setPending(actionKey)
    try {
      await fn()
      toast({ type: "success", title: successTitle })
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
          <p className="text-xs text-muted-foreground">任务模板</p>
          <p className="mt-1 text-lg font-semibold">{templates.length}</p>
        </div>
        <div className="rounded-lg border border-border bg-muted/20 p-4">
          <p className="text-xs text-muted-foreground">执行历史</p>
          <p className="mt-1 text-lg font-semibold">{runs.length}</p>
        </div>
        <div className="rounded-lg border border-border bg-muted/20 p-4">
          <p className="text-xs text-muted-foreground">失败告警</p>
          <p className="mt-1 text-lg font-semibold">{runs.filter((item) => item.alertSent).length}</p>
        </div>
        <div className="rounded-lg border border-border bg-muted/20 p-4">
          <p className="text-xs text-muted-foreground">幂等回放</p>
          <p className="mt-1 text-lg font-semibold">{runs.filter((item) => item.attempts > 1).length}</p>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-lg border border-border bg-background p-4 space-y-3">
          <p className="text-sm font-medium">建立运营任务模板与执行计划模型</p>
          <select
            aria-label="选择模板"
            value={form.id}
            onChange={(event) => {
              const selected = templates.find((item) => item.id === event.target.value)
              setForm((prev) => ({
                ...prev,
                id: event.target.value,
                name: selected?.name || prev.name,
                description: selected?.description || "",
                status: selected?.status || prev.status,
                scheduleCron: selected?.scheduleCron || prev.scheduleCron,
                retryLimit: String(selected?.retryLimit || prev.retryLimit),
                defaultChannel: selected?.defaultChannel || prev.defaultChannel,
              }))
            }}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">新建模板</option>
            {templates.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} · {item.status}
              </option>
            ))}
          </select>
          <input
            aria-label="模板名称"
            value={form.name}
            onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            placeholder="任务模板名称"
          />
          <textarea
            aria-label="模板描述"
            value={form.description}
            onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
            className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder="模板描述"
          />
          <div className="grid gap-2 sm:grid-cols-2">
            <select
              aria-label="状态"
              value={form.status}
              onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value }))}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="DRAFT">DRAFT</option>
              <option value="SCHEDULED">SCHEDULED</option>
              <option value="PAUSED">PAUSED</option>
            </select>
            <select
              aria-label="默认通道"
              value={form.defaultChannel}
              onChange={(event) => setForm((prev) => ({ ...prev, defaultChannel: event.target.value }))}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="IN_APP">IN_APP</option>
              <option value="EMAIL">EMAIL</option>
              <option value="WEBHOOK">WEBHOOK</option>
            </select>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <input
              aria-label="Cron"
              value={form.scheduleCron}
              onChange={(event) => setForm((prev) => ({ ...prev, scheduleCron: event.target.value }))}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              placeholder="Cron"
            />
            <input
              aria-label="重试次数"
              value={form.retryLimit}
              onChange={(event) => setForm((prev) => ({ ...prev, retryLimit: event.target.value }))}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              placeholder="重试次数"
            />
          </div>
          <Button
            disabled={pending !== null}
            onClick={() =>
              runAction(
                "save-template",
                () =>
                  requestJson("/api/ops/tasks", {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      id: form.id || undefined,
                      name: form.name,
                      description: form.description,
                      status: form.status,
                      scheduleCron: form.scheduleCron,
                      retryLimit: Number(form.retryLimit),
                      defaultChannel: form.defaultChannel,
                    }),
                  }),
                "任务模板已保存"
              )
            }
          >
            {pending === "save-template" ? "保存中..." : "保存任务模板"}
          </Button>
        </div>

        <div className="rounded-lg border border-border bg-background p-4 space-y-3">
          <p className="text-sm font-medium">定时执行、重试、失败告警与运行历史追踪</p>
          <select
            value={runTemplateId}
            onChange={(event) => setRunTemplateId(event.target.value)}
            aria-label="执行模板"
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">选择模板</option>
            {templates.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} · retry {item.retryLimit}
              </option>
            ))}
          </select>
          <Button
            disabled={pending !== null || !runTemplateId}
            onClick={() =>
              runAction(
                "run-template",
                () =>
                  requestJson("/api/ops/tasks", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      templateId: runTemplateId,
                      payload: {
                        trigger: "manual",
                        from: "ops-center-panel",
                      },
                    }),
                  }),
                "任务执行完成"
              )
            }
          >
            {pending === "run-template" ? "执行中..." : "执行任务并追踪产出"}
          </Button>
          <div className="space-y-2 text-sm">
            {runs.slice(0, 8).map((item) => (
              <div key={item.id} className="rounded-md border border-border bg-muted/10 px-3 py-2">
                <p className="font-medium">
                  {item.template.name} · {item.status} · attempts {item.attempts}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {item.outputSummary || "暂无执行摘要"} · {formatDateTime(item.createdAt)}
                </p>
              </div>
            ))}
            {runs.length === 0 ? <p className="text-muted-foreground">暂无运行历史。</p> : null}
          </div>
        </div>
      </div>
    </div>
  )
}
