"use client"

import { useEffect, useMemo, useState } from "react"
import { LayoutGrid, SlidersHorizontal, Sparkles, Workflow } from "lucide-react"

import { PromptBatchToolbar, type PromptBatchItem } from "@/components/prompts/prompt-batch-toolbar"
import { PromptQueryButton } from "@/components/prompts/prompt-query-transition"
import { VirtualizedPromptGrid, type VirtualizedPromptItem } from "@/components/prompts/virtualized-prompt-grid"

interface PromptListWorkspaceProps {
  promptCards: VirtualizedPromptItem[]
  batchPrompts: PromptBatchItem[]
  page: number
  totalPages: number
  filteredPromptCount: number
  pageSize: number
  hasActiveFilters: boolean
  clearHref: string
}

export function PromptListWorkspace({
  promptCards,
  batchPrompts,
  page,
  totalPages,
  filteredPromptCount,
  pageSize,
  hasActiveFilters,
  clearHref,
}: PromptListWorkspaceProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [batchExpanded, setBatchExpanded] = useState(false)

  const promptIdSet = useMemo(() => new Set(promptCards.map((item) => item.id)), [promptCards])
  const selectedCount = selectedIds.length

  useEffect(() => {
    setSelectedIds((prev) => prev.filter((item) => promptIdSet.has(item)))
  }, [promptIdSet])

  useEffect(() => {
    if (selectedCount > 0) {
      setBatchExpanded(true)
    }
  }, [selectedCount])

  const handleToggleSelect = (promptId: string) => {
    setSelectedIds((prev) =>
      prev.includes(promptId) ? prev.filter((item) => item !== promptId) : [...prev, promptId]
    )
  }

  return (
    <div className="space-y-4">
      <PromptBatchToolbar
        prompts={batchPrompts}
        selectedIds={selectedIds}
        onSelectedIdsChange={setSelectedIds}
        expanded={batchExpanded}
        onExpandedChange={setBatchExpanded}
      />

      <section className="surface-panel content-auto space-y-4 px-4 py-4 sm:px-5">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="eyebrow-label">Result overview</p>
            <p className="mt-1 text-sm text-muted-foreground">
              当前第 {page} / {totalPages} 页，本页 {promptCards.length} 条，筛选结果共 {filteredPromptCount} 条。
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-sm">
            <span className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/72 px-3 py-2 text-muted-foreground">
              <Workflow aria-hidden="true" className="h-4 w-4" />
              卡片多选与批量操作联动
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/72 px-3 py-2 text-muted-foreground">
              <Sparkles aria-hidden="true" className="h-4 w-4" />
              卡片右上角可直接加入批量
            </span>
            {hasActiveFilters ? (
              <PromptQueryButton
                href={clearHref}
                pendingLabel="正在清空筛选并恢复默认提示词视图。"
                variant="outline"
                size="sm"
                className="rounded-full border-border/70 bg-background/72"
              >
                清空筛选
              </PromptQueryButton>
            ) : null}
          </div>
        </div>

        <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="rounded-[1.35rem] border border-border/70 bg-background/78 p-4 shadow-card">
            <p className="eyebrow-label">Browse rhythm</p>
            <p className="mt-3 text-base font-semibold text-foreground">按更新时间倒序排列</p>
            <p className="mt-1 text-sm text-muted-foreground">优先处理最新调整过的提示词，更适合连续整理与回归检查。</p>
          </div>
          <div className="rounded-[1.35rem] border border-border/70 bg-background/78 p-4 shadow-card">
            <p className="eyebrow-label">Selection state</p>
            <p className="mt-3 text-base font-semibold text-foreground">已选 {selectedCount} 条提示词</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {selectedCount > 0
                ? "你可以继续点卡片右上角取消选择，或直接在批量工具栏里执行动作。"
                : "在卡片里直接加入批量，减少来回滚动到工具栏再勾选的操作。"}
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <SlidersHorizontal aria-hidden="true" className="h-4 w-4" />
            <span>当前列表按更新时间倒序排列，适合优先处理最新变更。</span>
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/72 px-3 py-2">
              <LayoutGrid aria-hidden="true" className="h-3.5 w-3.5" />
              宽屏自动切换更高密度网格
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/72 px-3 py-2">
              每页 {pageSize} 条
            </span>
          </div>
        </div>

        <VirtualizedPromptGrid
          prompts={promptCards}
          viewportLabel="我的提示词列表"
          selectedIds={selectedIds}
          onToggleSelect={handleToggleSelect}
        />
      </section>
    </div>
  )
}
