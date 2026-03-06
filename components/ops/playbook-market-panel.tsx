"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toaster"

type PlaybookRow = {
  id: string
  name: string
  summary: string
  status: string
  tags: unknown
  version: number
  ratingScore: number
  ratingCount: number
  compatibilityNotes: string | null
  rollbackTargetVersion: number | null
}

type PlaybookMarketPanelProps = {
  hasAccess: boolean
  planId: string
  playbooks: PlaybookRow[]
}

async function requestJson(path: string, init?: RequestInit) {
  const response = await fetch(path, init)
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(String(payload?.error || "请求失败"))
  }
  return payload
}

function toTags(value: unknown) {
  if (!Array.isArray(value)) {
    return []
  }
  return value.map((item) => String(item))
}

function buildPlaybookForm(playbook: PlaybookRow | null) {
  return {
    id: playbook?.id || "",
    name: playbook?.name || "",
    summary: playbook?.summary || "",
    status: playbook?.status || "PUBLISHED",
    tags: toTags(playbook?.tags).join(","),
    compatibilityNotes: playbook?.compatibilityNotes || "",
    rollbackTargetVersion: String(playbook?.rollbackTargetVersion || 0),
    rating: "",
  }
}

export function PlaybookMarketPanel({ hasAccess, planId, playbooks }: PlaybookMarketPanelProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [pending, setPending] = useState<string | null>(null)

  const [selectedPlaybookId, setSelectedPlaybookId] = useState(playbooks[0]?.id || "")
  const selectedPlaybook = useMemo(
    () => playbooks.find((item) => item.id === selectedPlaybookId) || null,
    [playbooks, selectedPlaybookId]
  )
  const [form, setForm] = useState(() => buildPlaybookForm(selectedPlaybook))

  const [applyId, setApplyId] = useState(playbooks[0]?.id || "")

  useEffect(() => {
    setForm(buildPlaybookForm(selectedPlaybook))
  }, [selectedPlaybook])

  if (!hasAccess) {
    return (
      <div className="rounded-lg border border-border bg-muted/20 p-4 text-sm">
        <p className="font-medium">当前套餐：{planId.toUpperCase()}</p>
        <p className="mt-1 text-muted-foreground">运营 Playbook 模板市场仅对 Pro / Team / Enterprise 套餐开放。</p>
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
          <p className="text-xs text-muted-foreground">模板总数</p>
          <p className="mt-1 text-lg font-semibold">{playbooks.length}</p>
        </div>
        <div className="rounded-lg border border-border bg-muted/20 p-4">
          <p className="text-xs text-muted-foreground">已发布模板</p>
          <p className="mt-1 text-lg font-semibold">
            {playbooks.filter((item) => item.status === "PUBLISHED").length}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-muted/20 p-4">
          <p className="text-xs text-muted-foreground">平均评分</p>
          <p className="mt-1 text-lg font-semibold">
            {playbooks.length === 0
              ? "0"
              : (playbooks.reduce((acc, item) => acc + item.ratingScore, 0) / playbooks.length).toFixed(2)}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-muted/20 p-4">
          <p className="text-xs text-muted-foreground">最高版本</p>
          <p className="mt-1 text-lg font-semibold">
            {playbooks.reduce((acc, item) => Math.max(acc, item.version), 0)}
          </p>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-lg border border-border bg-background p-4 space-y-3">
          <p className="text-sm font-medium">模板创建、评分、标签与版本管理</p>
          <select
            value={selectedPlaybookId}
            onChange={(event) => setSelectedPlaybookId(event.target.value)}
            aria-label="选择模板"
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">新建模板</option>
            {playbooks.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} · v{item.version}
              </option>
            ))}
          </select>
          <input
            value={form.name}
            onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
            aria-label="模板名称"
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            placeholder="模板名称"
          />
          <textarea
            value={form.summary}
            onChange={(event) => setForm((prev) => ({ ...prev, summary: event.target.value }))}
            aria-label="模板摘要"
            className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder="模板摘要"
          />
          <div className="grid gap-2 sm:grid-cols-2">
            <input
              value={form.tags}
              onChange={(event) => setForm((prev) => ({ ...prev, tags: event.target.value }))}
              aria-label="标签"
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              placeholder="tag1,tag2"
            />
            <select
              value={form.status}
              onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value }))}
              aria-label="状态"
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="DRAFT">DRAFT</option>
              <option value="PUBLISHED">PUBLISHED</option>
              <option value="ARCHIVED">ARCHIVED</option>
            </select>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <input
              value={form.rollbackTargetVersion}
              onChange={(event) => setForm((prev) => ({ ...prev, rollbackTargetVersion: event.target.value }))}
              aria-label="回滚版本"
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              placeholder="回滚版本"
            />
            <input
              value={form.rating}
              onChange={(event) => setForm((prev) => ({ ...prev, rating: event.target.value }))}
              aria-label="评分"
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              placeholder="评分 1-5"
            />
          </div>
          <textarea
            value={form.compatibilityNotes}
            onChange={(event) => setForm((prev) => ({ ...prev, compatibilityNotes: event.target.value }))}
            aria-label="兼容说明"
            className="min-h-16 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder="兼容说明"
          />
          <Button
            disabled={pending !== null}
            onClick={() =>
              runAction(
                "save-playbook",
                () =>
                  requestJson("/api/ops/playbooks", {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      id: form.id || undefined,
                      name: form.name,
                      summary: form.summary,
                      status: form.status,
                      tags: form.tags
                        .split(",")
                        .map((item) => item.trim())
                        .filter(Boolean),
                      rollbackTargetVersion: Number(form.rollbackTargetVersion),
                      compatibilityNotes: form.compatibilityNotes,
                      rating: form.rating ? Number(form.rating) : undefined,
                    }),
                  }),
                "Playbook 已保存"
              )
            }
          >
            {pending === "save-playbook" ? "保存中..." : "保存模板"}
          </Button>
        </div>

        <div className="rounded-lg border border-border bg-background p-4 space-y-3">
          <p className="text-sm font-medium">一键应用到任务中心并支持升级回滚</p>
          <select
            value={applyId}
            onChange={(event) => setApplyId(event.target.value)}
            aria-label="应用模板"
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">选择模板</option>
            {playbooks.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} · v{item.version} · {item.status}
              </option>
            ))}
          </select>
          <Button
            disabled={pending !== null || !applyId}
            onClick={() =>
              runAction(
                "apply-playbook",
                () =>
                  requestJson("/api/ops/playbooks", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ playbookId: applyId }),
                  }),
                "模板已应用到任务中心"
              )
            }
          >
            {pending === "apply-playbook" ? "应用中..." : "一键应用模板"}
          </Button>
          <div className="space-y-2 text-sm">
            {playbooks.slice(0, 8).map((item) => (
              <div key={item.id} className="rounded-md border border-border bg-muted/10 px-3 py-2">
                <p className="font-medium">
                  {item.name} · v{item.version} · {item.status}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  rating {item.ratingScore.toFixed(2)} ({item.ratingCount}) ·
                  rollback target {item.rollbackTargetVersion || "-"}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
