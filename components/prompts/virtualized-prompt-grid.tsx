"use client"

import { type UIEvent, useCallback, useEffect, useMemo, useRef, useState } from "react"

import { PromptPreviewCard } from "@/components/prompts/prompt-preview-card"
import { cn } from "@/lib/utils"

type PromptMetricKind = "favorites" | "views"
type PromptVisibility = "public" | "private"
type PromptPublishStatus = "DRAFT" | "IN_REVIEW" | "PUBLISHED" | "ARCHIVED"

interface PromptMetric {
  kind: PromptMetricKind
  value: number
}

export interface VirtualizedPromptItem {
  id: string
  href: string
  title: string
  description: string
  category: string
  visibility?: PromptVisibility
  publishStatus?: PromptPublishStatus
  author?: string
  tags?: string[]
  updatedAt?: string
  metrics?: PromptMetric[]
  editHref?: string
}

interface VirtualizedPromptGridProps {
  prompts: VirtualizedPromptItem[]
  className?: string
  viewportLabel?: string
  virtualizeThreshold?: number
  overscanRows?: number
  selectedIds?: string[]
  onToggleSelect?: (promptId: string) => void
}

const VIRTUALIZATION_HEIGHTS: Record<1 | 2 | 3 | 4, number> = {
  1: 420,
  2: 392,
  3: 364,
  4: 348,
}
const STAGGER_INTERVAL_MS = 90
const MAX_STAGGER_STEPS = 10

function getStaggerDelay(index: number): string {
  return `${Math.min(index, MAX_STAGGER_STEPS) * STAGGER_INTERVAL_MS}ms`
}

function getColumnCount(width: number): 1 | 2 | 3 | 4 {
  if (width >= 1536) {
    return 4
  }
  if (width >= 1024) {
    return 3
  }
  if (width >= 768) {
    return 2
  }
  return 1
}

export function VirtualizedPromptGrid({
  prompts,
  className,
  viewportLabel = "提示词列表",
  virtualizeThreshold = 100,
  overscanRows = 2,
  selectedIds = [],
  onToggleSelect,
}: VirtualizedPromptGridProps) {
  const scrollViewportRef = useRef<HTMLDivElement | null>(null)
  const [viewportWidth, setViewportWidth] = useState(0)
  const [viewportHeight, setViewportHeight] = useState(0)
  const [scrollTop, setScrollTop] = useState(0)
  const shouldVirtualize = prompts.length >= virtualizeThreshold
  const columnCount = getColumnCount(viewportWidth)
  const estimatedRowHeight = VIRTUALIZATION_HEIGHTS[columnCount]
  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds])

  useEffect(() => {
    if (!shouldVirtualize) {
      return
    }

    const element = scrollViewportRef.current
    if (!element) {
      return
    }

    const syncViewportSize = () => {
      setViewportWidth(element.clientWidth)
      setViewportHeight(element.clientHeight)
    }

    syncViewportSize()

    if (typeof ResizeObserver === "undefined") {
      return
    }

    const observer = new ResizeObserver(syncViewportSize)
    observer.observe(element)

    return () => observer.disconnect()
  }, [shouldVirtualize])

  const handleScroll = useCallback((event: UIEvent<HTMLDivElement>) => {
    setScrollTop(event.currentTarget.scrollTop)
  }, [])

  const rows = useMemo(() => {
    if (!shouldVirtualize) {
      return []
    }

    const groupedRows: VirtualizedPromptItem[][] = []

    for (let startIndex = 0; startIndex < prompts.length; startIndex += columnCount) {
      groupedRows.push(prompts.slice(startIndex, startIndex + columnCount))
    }

    return groupedRows
  }, [columnCount, prompts, shouldVirtualize])

  if (!shouldVirtualize) {
    return (
      <div className={cn("grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4", className)}>
        {prompts.map((prompt, index) => (
          <div
            key={prompt.id}
            className="content-auto animate-slide-up motion-reduce:animate-none [animation-fill-mode:both]"
            style={{ animationDelay: getStaggerDelay(index) }}
          >
            <PromptPreviewCard
              href={prompt.href}
              title={prompt.title}
              description={prompt.description}
              category={prompt.category}
              visibility={prompt.visibility}
              publishStatus={prompt.publishStatus}
              author={prompt.author}
              tags={prompt.tags}
              updatedAt={prompt.updatedAt}
              metrics={prompt.metrics}
              editHref={prompt.editHref}
              selected={selectedIdSet.has(prompt.id)}
              onToggleSelect={onToggleSelect ? () => onToggleSelect(prompt.id) : undefined}
            />
          </div>
        ))}
      </div>
    )
  }

  const safeViewportHeight = viewportHeight || estimatedRowHeight * 2
  const startRowIndex = Math.max(0, Math.floor(scrollTop / estimatedRowHeight) - overscanRows)
  const endRowIndex = Math.min(
    rows.length,
    Math.ceil((scrollTop + safeViewportHeight) / estimatedRowHeight) + overscanRows
  )
  const visibleRows = rows.slice(startRowIndex, endRowIndex)
  const topSpacerHeight = startRowIndex * estimatedRowHeight
  const bottomSpacerHeight = Math.max(0, (rows.length - endRowIndex) * estimatedRowHeight)

  return (
    <div className={cn("rounded-[1.45rem] border border-border/60 bg-card/35", className)}>
      <div className="flex items-center justify-between border-b border-border/60 px-3 py-2 text-xs text-muted-foreground">
        <span>已启用大列表虚拟滚动</span>
        <span>{prompts.length} 条提示词</span>
      </div>

      <div
        ref={scrollViewportRef}
        onScroll={handleScroll}
        role="region"
        aria-label={viewportLabel}
        className="max-h-[70vh] overflow-y-auto p-2 sm:p-3"
      >
        <div style={{ paddingTop: topSpacerHeight, paddingBottom: bottomSpacerHeight }}>
          {visibleRows.map((row, rowOffset) => (
            <div
              key={`${startRowIndex + rowOffset}-${row[0]?.id ?? "row"}`}
              className="mb-3 grid min-h-[320px] grid-cols-1 gap-3 last:mb-0 sm:mb-4 sm:gap-4 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4"
              style={{ minHeight: estimatedRowHeight }}
            >
              {row.map((prompt, columnOffset) => {
                const promptIndex = (startRowIndex + rowOffset) * columnCount + columnOffset

                return (
                  <div
                    key={prompt.id}
                    className="content-auto animate-slide-up motion-reduce:animate-none [animation-fill-mode:both]"
                    style={{ animationDelay: getStaggerDelay(promptIndex) }}
                  >
                    <PromptPreviewCard
                      href={prompt.href}
                      title={prompt.title}
                      description={prompt.description}
                      category={prompt.category}
                      visibility={prompt.visibility}
                      publishStatus={prompt.publishStatus}
                      author={prompt.author}
                      tags={prompt.tags}
                      updatedAt={prompt.updatedAt}
                      metrics={prompt.metrics}
                      editHref={prompt.editHref}
                      selected={selectedIdSet.has(prompt.id)}
                      onToggleSelect={onToggleSelect ? () => onToggleSelect(prompt.id) : undefined}
                    />
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
