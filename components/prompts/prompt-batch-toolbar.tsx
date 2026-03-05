"use client"

import { useMemo, useState, useTransition } from "react"
import { Layers, RefreshCw } from "lucide-react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useToast } from "@/components/ui/toaster"

interface PromptBatchItem {
  id: string
  title: string
  isPublic: boolean
  publishStatus: string
  tags: string[]
}

interface PromptBatchToolbarProps {
  prompts: PromptBatchItem[]
}

type BatchAction = "update-tags" | "set-visibility" | "archive" | "restore"

export function PromptBatchToolbar({ prompts }: PromptBatchToolbarProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [isPending, startTransition] = useTransition()

  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [action, setAction] = useState<BatchAction>("update-tags")
  const [tagMode, setTagMode] = useState<"replace" | "add" | "remove">("replace")
  const [tagsText, setTagsText] = useState("")
  const [targetVisibility, setTargetVisibility] = useState<"public" | "private">("public")

  const selectedPromptCount = selectedIds.length
  const allSelected = selectedPromptCount > 0 && selectedPromptCount === prompts.length

  const selectedPromptPreview = useMemo(() => {
    const selected = new Set(selectedIds)
    return prompts.filter((item) => selected.has(item.id)).slice(0, 3)
  }, [prompts, selectedIds])

  const togglePrompt = (promptId: string) => {
    setSelectedIds((prev) =>
      prev.includes(promptId) ? prev.filter((item) => item !== promptId) : [...prev, promptId]
    )
  }

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds([])
      return
    }

    setSelectedIds(prompts.map((item) => item.id))
  }

  const handleBatchApply = async () => {
    if (selectedIds.length === 0) {
      toast({
        type: "info",
        title: "请先选择提示词",
        description: "至少选择一条提示词后再执行批量操作。",
      })
      return
    }

    const body: Record<string, unknown> = {
      promptIds: selectedIds,
      action,
    }

    if (action === "update-tags") {
      body.tags = tagsText
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
      body.mode = tagMode
    }

    if (action === "set-visibility") {
      body.isPublic = targetVisibility === "public"
    }

    startTransition(async () => {
      try {
        const response = await fetch("/api/prompts/batch", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        })

        const payload = await response.json()
        if (!response.ok) {
          throw new Error(payload?.error || "批量操作失败")
        }

        toast({
          type: "success",
          title: "批量操作完成",
          description: `成功 ${payload.successIds?.length || 0} 条，拒绝 ${payload.unauthorized?.length || 0} 条。`,
        })

        if (Array.isArray(payload.unauthorized) && payload.unauthorized.length > 0) {
          setSelectedIds(payload.unauthorized)
        } else {
          setSelectedIds([])
        }

        router.refresh()
      } catch (error) {
        toast({
          type: "error",
          title: "批量操作失败",
          description: error instanceof Error ? error.message : "请稍后重试",
        })
      }
    })
  }

  if (prompts.length === 0) {
    return null
  }

  return (
    <div className="space-y-3 rounded-xl border border-border/70 bg-card p-4 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="inline-flex items-center gap-2 text-sm font-medium">
          <Layers className="h-4 w-4" aria-hidden="true" />
          批量操作
        </p>
        <p className="text-xs text-muted-foreground">已选 {selectedPromptCount} / {prompts.length}</p>
      </div>

      <div className="max-h-40 space-y-1 overflow-auto rounded-md border border-border/60 bg-muted/20 p-2">
        <label className="flex items-center gap-2 rounded px-1 py-1 text-sm hover:bg-muted/40">
          <input type="checkbox" checked={allSelected} onChange={toggleAll} />
          <span>全选当前列表</span>
        </label>

        {prompts.map((prompt) => (
          <label key={prompt.id} className="flex items-center gap-2 rounded px-1 py-1 text-sm hover:bg-muted/40">
            <input
              type="checkbox"
              checked={selectedIds.includes(prompt.id)}
              onChange={() => togglePrompt(prompt.id)}
            />
            <span className="line-clamp-1 flex-1">{prompt.title}</span>
            <span className="text-xs text-muted-foreground">{prompt.publishStatus}</span>
          </label>
        ))}
      </div>

      {selectedPromptPreview.length > 0 ? (
        <p className="text-xs text-muted-foreground">
          选中预览：{selectedPromptPreview.map((item) => item.title).join("、")}
          {selectedPromptCount > selectedPromptPreview.length ? ` 等 ${selectedPromptCount} 条` : ""}
        </p>
      ) : null}

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <select
          aria-label="批量操作类型"
          value={action}
          onChange={(event) => setAction(event.target.value as BatchAction)}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="update-tags">批量改标签</option>
          <option value="set-visibility">批量改可见性</option>
          <option value="archive">批量归档</option>
          <option value="restore">批量恢复到草稿</option>
        </select>

        {action === "update-tags" ? (
          <>
            <select
              aria-label="标签更新模式"
              value={tagMode}
              onChange={(event) => setTagMode(event.target.value as "replace" | "add" | "remove")}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="replace">替换标签</option>
              <option value="add">追加标签</option>
              <option value="remove">移除标签</option>
            </select>
            <Input
              aria-label="批量标签输入"
              value={tagsText}
              onChange={(event) => setTagsText(event.target.value)}
              placeholder="输入标签，逗号分隔"
              className="sm:col-span-2"
            />
          </>
        ) : null}

        {action === "set-visibility" ? (
          <select
            aria-label="批量可见性设置"
            value={targetVisibility}
            onChange={(event) => setTargetVisibility(event.target.value as "public" | "private")}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="public">设为公开</option>
            <option value="private">设为私有</option>
          </select>
        ) : null}

        <div className="flex items-center gap-2">
          <Button type="button" variant="secondary" onClick={handleBatchApply} disabled={isPending}>
            {isPending ? "执行中..." : "执行"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setSelectedIds([])
              setTagsText("")
              router.refresh()
            }}
            disabled={isPending}
          >
            <RefreshCw className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
            重置
          </Button>
        </div>
      </div>
    </div>
  )
}
