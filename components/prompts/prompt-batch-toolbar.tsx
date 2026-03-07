"use client"

import { useMemo, useState, useTransition } from "react"
import { CheckCircle2, ChevronDown, Layers, RefreshCw } from "lucide-react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useToast } from "@/components/ui/toaster"

export interface PromptBatchItem {
  id: string
  title: string
  isPublic: boolean
  publishStatus: string
  tags: string[]
}

interface PromptBatchToolbarProps {
  prompts: PromptBatchItem[]
  selectedIds: string[]
  onSelectedIdsChange: (ids: string[]) => void
  expanded: boolean
  onExpandedChange: (expanded: boolean) => void
}

type BatchAction = "update-tags" | "set-visibility" | "archive" | "restore"

export function PromptBatchToolbar({
  prompts,
  selectedIds,
  onSelectedIdsChange,
  expanded,
  onExpandedChange,
}: PromptBatchToolbarProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [isPending, startTransition] = useTransition()

  const [action, setAction] = useState<BatchAction>("update-tags")
  const [tagMode, setTagMode] = useState<"replace" | "add" | "remove">("replace")
  const [tagsText, setTagsText] = useState("")
  const [targetVisibility, setTargetVisibility] = useState<"public" | "private">("public")

  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds])
  const selectedPromptCount = selectedIds.length
  const allSelected = selectedPromptCount > 0 && selectedPromptCount === prompts.length

  const selectedPromptPreview = useMemo(() => {
    return prompts.filter((item) => selectedIdSet.has(item.id)).slice(0, 3)
  }, [prompts, selectedIdSet])

  const promptStats = useMemo(() => {
    const source = selectedPromptCount > 0 ? prompts.filter((item) => selectedIdSet.has(item.id)) : prompts

    return {
      privateCount: source.filter((item) => !item.isPublic).length,
      publicCount: source.filter((item) => item.isPublic).length,
      draftCount: source.filter((item) => item.publishStatus === "DRAFT").length,
    }
  }, [prompts, selectedIdSet, selectedPromptCount])

  const quickSelections = useMemo(
    () => [
      {
        label: `全选当前页 (${prompts.length})`,
        disabled: prompts.length === 0 || allSelected,
        onClick: () => onSelectedIdsChange(prompts.map((item) => item.id)),
      },
      {
        label: `仅私有 (${prompts.filter((item) => !item.isPublic).length})`,
        disabled: prompts.every((item) => item.isPublic),
        onClick: () => onSelectedIdsChange(prompts.filter((item) => !item.isPublic).map((item) => item.id)),
      },
      {
        label: `仅草稿 (${prompts.filter((item) => item.publishStatus === "DRAFT").length})`,
        disabled: prompts.every((item) => item.publishStatus !== "DRAFT"),
        onClick: () => onSelectedIdsChange(prompts.filter((item) => item.publishStatus === "DRAFT").map((item) => item.id)),
      },
      {
        label: "清空选择",
        disabled: selectedPromptCount === 0,
        onClick: () => onSelectedIdsChange([]),
      },
    ],
    [allSelected, onSelectedIdsChange, prompts, selectedPromptCount]
  )

  const actionSummary = useMemo(() => {
    if (action === "update-tags") {
      return tagMode === "replace"
        ? "用输入的标签整体替换当前所选提示词标签。"
        : tagMode === "add"
          ? "把输入标签追加到已选提示词，不影响原有标签。"
          : "从所选提示词中移除输入的标签。"
    }

    if (action === "set-visibility") {
      return targetVisibility === "public"
        ? "把所选提示词批量设置为公开。"
        : "把所选提示词批量设置为私有。"
    }

    if (action === "archive") {
      return "把所选提示词批量归档，适合集中清理旧资产。"
    }

    return "把所选提示词恢复为草稿，便于继续编辑。"
  }, [action, tagMode, targetVisibility])

  const togglePrompt = (promptId: string) => {
    onSelectedIdsChange(
      selectedIds.includes(promptId)
        ? selectedIds.filter((item) => item !== promptId)
        : [...selectedIds, promptId]
    )
  }

  const toggleAll = () => {
    if (allSelected) {
      onSelectedIdsChange([])
      return
    }

    onSelectedIdsChange(prompts.map((item) => item.id))
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

    startTransition(() => {
      void (async () => {
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
            onSelectedIdsChange(payload.unauthorized)
          } else {
            onSelectedIdsChange([])
          }

          router.refresh()
        } catch (error) {
          toast({
            type: "error",
            title: "批量操作失败",
            description: error instanceof Error ? error.message : "请稍后重试",
          })
        }
      })()
    })
  }

  if (prompts.length === 0) {
    return null
  }

  return (
    <div className="surface-panel content-auto space-y-5 p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <p className="inline-flex items-center gap-2 text-sm font-medium text-foreground">
            <Layers className="h-4 w-4" aria-hidden="true" />
            批量操作
          </p>
          <p className="text-sm text-muted-foreground">在同一列表里一次完成标签、可见性或归档调整。</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/72 px-3 py-1.5 text-xs text-muted-foreground">
            已选 {selectedPromptCount} / {prompts.length}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onExpandedChange(!expanded)}
            className="rounded-full border-border/70 bg-background/72"
            aria-expanded={expanded}
            aria-controls="prompt-batch-toolbar-panel"
          >
            {expanded ? "收起" : "展开"}
            <ChevronDown aria-hidden="true" className={`ml-1 h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`} />
          </Button>
        </div>
      </div>

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <div className="space-y-3 rounded-[1.35rem] border border-border/70 bg-background/75 p-4 shadow-card">
          <div className="flex flex-wrap items-center gap-2">
            {quickSelections.map((item) => (
              <Button
                key={item.label}
                type="button"
                variant="outline"
                size="sm"
                onClick={item.onClick}
                disabled={item.disabled || isPending}
                className="rounded-full border-border/70 bg-background/72"
              >
                {item.label}
              </Button>
            ))}
          </div>

          {selectedPromptPreview.length > 0 ? (
            <div className="rounded-[1.2rem] border border-primary/20 bg-primary/10 px-3 py-3 text-sm text-primary">
              <div className="flex items-start gap-2">
                <CheckCircle2 aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <p className="font-medium">选中预览</p>
                  <p className="mt-1 text-primary/90">
                    {selectedPromptPreview.map((item) => item.title).join("、")}
                    {selectedPromptCount > selectedPromptPreview.length ? ` 等 ${selectedPromptCount} 条` : ""}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-[1.2rem] border border-dashed border-border/70 bg-muted/35 px-3 py-3 text-sm text-muted-foreground">
              先选择一批提示词，再进行批量调整；常用的选择入口已经放在上方。
            </div>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
          <div className="rounded-[1.35rem] border border-border/70 bg-background/75 p-4 shadow-card">
            <p className="eyebrow-label">Private</p>
            <p className="mt-3 text-2xl font-semibold text-foreground">{promptStats.privateCount}</p>
            <p className="mt-1 text-sm text-muted-foreground">当前选择中的私有提示词</p>
          </div>
          <div className="rounded-[1.35rem] border border-border/70 bg-background/75 p-4 shadow-card">
            <p className="eyebrow-label">Public</p>
            <p className="mt-3 text-2xl font-semibold text-foreground">{promptStats.publicCount}</p>
            <p className="mt-1 text-sm text-muted-foreground">当前选择中的公开提示词</p>
          </div>
          <div className="rounded-[1.35rem] border border-border/70 bg-background/75 p-4 shadow-card">
            <p className="eyebrow-label">Draft</p>
            <p className="mt-3 text-2xl font-semibold text-foreground">{promptStats.draftCount}</p>
            <p className="mt-1 text-sm text-muted-foreground">当前选择中的草稿数量</p>
          </div>
        </div>
      </div>

      {expanded ? (
        <div id="prompt-batch-toolbar-panel" className="space-y-4">
          <div className="max-h-52 space-y-1 overflow-auto rounded-[1.2rem] border border-border/60 bg-background/68 p-2.5">
            <label className="flex items-center gap-2 rounded-xl px-2 py-2 text-sm hover:bg-muted/40">
              <input type="checkbox" checked={allSelected} onChange={toggleAll} />
              <span>全选当前列表</span>
            </label>

            {prompts.map((prompt) => (
              <label key={prompt.id} className="flex items-center gap-2 rounded-xl px-2 py-2 text-sm hover:bg-muted/40">
                <input
                  type="checkbox"
                  checked={selectedIdSet.has(prompt.id)}
                  onChange={() => togglePrompt(prompt.id)}
                />
                <span className="line-clamp-1 flex-1">{prompt.title}</span>
                <span className="text-xs text-muted-foreground">{prompt.publishStatus}</span>
              </label>
            ))}
          </div>

          <div className="rounded-[1.35rem] border border-border/70 bg-background/75 p-4 shadow-card">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="eyebrow-label">Action</p>
                <p className="mt-1 text-sm text-muted-foreground">{actionSummary}</p>
              </div>
              <span className="inline-flex items-center rounded-full border border-border/70 bg-muted/35 px-3 py-1.5 text-xs text-muted-foreground">
                已选 {selectedPromptCount} 条
              </span>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(12rem,0.9fr)_minmax(12rem,0.9fr)_minmax(0,1.2fr)_auto]">
              <select
                aria-label="批量操作类型"
                value={action}
                onChange={(event) => setAction(event.target.value as BatchAction)}
                className="h-11 rounded-2xl border border-input bg-background/78 px-3 text-sm"
              >
                <option value="update-tags">批量改标签</option>
                <option value="set-visibility">批量改可见性</option>
                <option value="archive">批量归档</option>
                <option value="restore">批量恢复到草稿</option>
              </select>

              {action === "update-tags" ? (
                <select
                  aria-label="标签更新模式"
                  value={tagMode}
                  onChange={(event) => setTagMode(event.target.value as "replace" | "add" | "remove")}
                  className="h-11 rounded-2xl border border-input bg-background/78 px-3 text-sm"
                >
                  <option value="replace">替换标签</option>
                  <option value="add">追加标签</option>
                  <option value="remove">移除标签</option>
                </select>
              ) : action === "set-visibility" ? (
                <select
                  aria-label="批量可见性设置"
                  value={targetVisibility}
                  onChange={(event) => setTargetVisibility(event.target.value as "public" | "private")}
                  className="h-11 rounded-2xl border border-input bg-background/78 px-3 text-sm"
                >
                  <option value="public">设为公开</option>
                  <option value="private">设为私有</option>
                </select>
              ) : (
                <div className="rounded-2xl border border-dashed border-border/70 bg-background/55 px-3 py-3 text-sm text-muted-foreground">
                  当前操作无需额外参数
                </div>
              )}

              {action === "update-tags" ? (
                <Input
                  aria-label="批量标签输入"
                  value={tagsText}
                  onChange={(event) => setTagsText(event.target.value)}
                  placeholder="输入标签，逗号分隔"
                  className="rounded-2xl border-border/70 bg-background/78"
                />
              ) : (
                <div className="rounded-2xl border border-dashed border-border/70 bg-background/55 px-3 py-3 text-sm text-muted-foreground">
                  选中后可直接执行当前批量动作
                </div>
              )}

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleBatchApply}
                  disabled={isPending || selectedPromptCount === 0}
                  className="rounded-full"
                >
                  {isPending ? "执行中..." : "执行"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    onSelectedIdsChange([])
                    setTagsText("")
                    setAction("update-tags")
                    setTagMode("replace")
                    setTargetVisibility("public")
                  }}
                  disabled={isPending}
                  className="rounded-full border-border/70 bg-background/72"
                >
                  <RefreshCw className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                  重置
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
