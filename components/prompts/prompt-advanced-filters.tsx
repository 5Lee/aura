"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import { BookmarkPlus, ChevronDown, Filter, RotateCcw, Search, Trash2 } from "lucide-react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useToast } from "@/components/ui/toaster"

interface FilterOption {
  value: string
  label: string
}

export interface PromptAdvancedFilterState {
  q: string
  category: string
  tag: string
  authorId: string
  status: string
  publishStatus: string
  updatedWithin: string
  scope: string
}

interface SavedPromptView {
  id: string
  name: string
  filters: PromptAdvancedFilterState
  createdAt: string
}

interface PromptAdvancedFiltersProps {
  categories: FilterOption[]
  tags: FilterOption[]
  authors: FilterOption[]
  initialFilters: PromptAdvancedFilterState
}

const SAVED_VIEWS_STORAGE_KEY = "aura:prompts:saved-views:v1"

function buildSearchParams(filters: PromptAdvancedFilterState) {
  const params = new URLSearchParams()

  if (filters.q.trim()) {
    params.set("q", filters.q.trim())
  }

  if (filters.category) {
    params.set("category", filters.category)
  }

  if (filters.tag) {
    params.set("tag", filters.tag)
  }

  if (filters.authorId) {
    params.set("authorId", filters.authorId)
  }

  if (filters.status && filters.status !== "all") {
    params.set("status", filters.status)
  }

  if (filters.publishStatus && filters.publishStatus !== "all") {
    params.set("publishStatus", filters.publishStatus)
  }

  if (filters.updatedWithin) {
    params.set("updatedWithin", filters.updatedWithin)
  }

  if (filters.scope && filters.scope !== "mine") {
    params.set("scope", filters.scope)
  }

  return params
}

function createSavedView(filters: PromptAdvancedFilterState, name: string): SavedPromptView {
  const id =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}`

  return {
    id,
    name,
    filters,
    createdAt: new Date().toISOString(),
  }
}

export function PromptAdvancedFilters({
  categories,
  tags,
  authors,
  initialFilters,
}: PromptAdvancedFiltersProps) {
  const router = useRouter()
  const { toast } = useToast()

  const [q, setQ] = useState(initialFilters.q)
  const [category, setCategory] = useState(initialFilters.category)
  const [tag, setTag] = useState(initialFilters.tag)
  const [authorId, setAuthorId] = useState(initialFilters.authorId)
  const [status, setStatus] = useState(initialFilters.status)
  const [publishStatus, setPublishStatus] = useState(initialFilters.publishStatus)
  const [updatedWithin, setUpdatedWithin] = useState(initialFilters.updatedWithin)
  const [scope, setScope] = useState(initialFilters.scope)
  const [savedViews, setSavedViews] = useState<SavedPromptView[]>([])
  const [activeSavedViewId, setActiveSavedViewId] = useState("")
  const [showAdvanced, setShowAdvanced] = useState(
    Boolean(
      initialFilters.category ||
        initialFilters.tag ||
        initialFilters.authorId ||
        initialFilters.updatedWithin ||
        initialFilters.status !== "all" ||
        initialFilters.publishStatus !== "all" ||
        initialFilters.scope !== "mine"
    )
  )
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    setQ(initialFilters.q)
    setCategory(initialFilters.category)
    setTag(initialFilters.tag)
    setAuthorId(initialFilters.authorId)
    setStatus(initialFilters.status)
    setPublishStatus(initialFilters.publishStatus)
    setUpdatedWithin(initialFilters.updatedWithin)
    setScope(initialFilters.scope)
  }, [
    initialFilters.authorId,
    initialFilters.category,
    initialFilters.publishStatus,
    initialFilters.q,
    initialFilters.scope,
    initialFilters.status,
    initialFilters.tag,
    initialFilters.updatedWithin,
  ])

  useEffect(() => {
    if (typeof window === "undefined") {
      return
    }

    try {
      const raw = window.localStorage.getItem(SAVED_VIEWS_STORAGE_KEY)
      if (!raw) {
        setSavedViews([])
        return
      }

      const parsed = JSON.parse(raw)
      if (!Array.isArray(parsed)) {
        setSavedViews([])
        return
      }

      const normalized = parsed
        .map((item) => {
          if (!item || typeof item !== "object") {
            return null
          }

          const view = item as SavedPromptView
          if (!view.id || !view.name || !view.filters) {
            return null
          }

          return {
            id: String(view.id),
            name: String(view.name),
            filters: {
              q: String(view.filters.q || ""),
              category: String(view.filters.category || ""),
              tag: String(view.filters.tag || ""),
              authorId: String(view.filters.authorId || ""),
              status: String(view.filters.status || "all"),
              publishStatus: String(view.filters.publishStatus || "all"),
              updatedWithin: String(view.filters.updatedWithin || ""),
              scope: String(view.filters.scope || "mine"),
            },
            createdAt: String(view.createdAt || ""),
          }
        })
        .filter((item): item is SavedPromptView => item !== null)

      setSavedViews(normalized)
    } catch {
      setSavedViews([])
    }
  }, [])

  const currentFilters = useMemo(
    () => ({
      q,
      category,
      tag,
      authorId,
      status,
      publishStatus,
      updatedWithin,
      scope,
    }),
    [authorId, category, publishStatus, q, scope, status, tag, updatedWithin]
  )

  const persistSavedViews = (views: SavedPromptView[]) => {
    setSavedViews(views)
    if (typeof window !== "undefined") {
      window.localStorage.setItem(SAVED_VIEWS_STORAGE_KEY, JSON.stringify(views))
    }
  }

  const hasActiveFilters = useMemo(() => {
    return Boolean(
      currentFilters.q ||
        currentFilters.category ||
        currentFilters.tag ||
        currentFilters.authorId ||
        currentFilters.updatedWithin ||
        currentFilters.status !== "all" ||
        currentFilters.publishStatus !== "all" ||
        currentFilters.scope !== "mine"
    )
  }, [currentFilters])

  useEffect(() => {
    if (hasActiveFilters) {
      setShowAdvanced(true)
    }
  }, [hasActiveFilters])

  const applyFilters = (filters: PromptAdvancedFilterState) => {
    const params = buildSearchParams(filters)
    const query = params.toString()

    startTransition(() => {
      router.push(`/prompts${query ? `?${query}` : ""}`)
    })
  }

  const saveCurrentView = () => {
    const suggestedName = `视图 ${savedViews.length + 1}`
    const inputName = window.prompt("请输入筛选视图名称", suggestedName)
    const name = inputName?.trim()

    if (!name) {
      return
    }

    const nextView = createSavedView(currentFilters, name)
    const deduped = [nextView, ...savedViews.filter((view) => view.name !== name)].slice(0, 12)
    persistSavedViews(deduped)
    setActiveSavedViewId(nextView.id)

    toast({
      type: "success",
      title: "筛选视图已保存",
      description: `已保存为“${name}”。`,
    })
  }

  const applySavedView = () => {
    const selected = savedViews.find((view) => view.id === activeSavedViewId)
    if (!selected) {
      toast({
        type: "info",
        title: "请选择一个视图",
        description: "先选择已保存的筛选视图，再执行应用。",
      })
      return
    }

    setQ(selected.filters.q)
    setCategory(selected.filters.category)
    setTag(selected.filters.tag)
    setAuthorId(selected.filters.authorId)
    setStatus(selected.filters.status)
    setPublishStatus(selected.filters.publishStatus)
    setUpdatedWithin(selected.filters.updatedWithin)
    setScope(selected.filters.scope)

    applyFilters(selected.filters)
  }

  const removeSavedView = () => {
    if (!activeSavedViewId) {
      return
    }

    const nextViews = savedViews.filter((view) => view.id !== activeSavedViewId)
    persistSavedViews(nextViews)
    setActiveSavedViewId("")

    toast({
      type: "success",
      title: "已删除筛选视图",
      description: "该视图已从本地保存记录移除。",
    })
  }

  return (
    <div className="surface-panel space-y-4 p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <p className="inline-flex items-center gap-2 text-sm font-medium text-foreground">
            <Filter className="h-4 w-4" aria-hidden="true" />
            高级检索
          </p>
          <p className="text-sm text-muted-foreground">从关键词开始，按范围、标签、作者与发布时间逐步收敛。</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {hasActiveFilters ? (
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary">
              已启用筛选
            </span>
          ) : null}
          {isPending ? <span className="text-xs text-muted-foreground">正在应用筛选...</span> : null}
        </div>
      </div>

      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault()
          applyFilters(currentFilters)
        }}
      >
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1.7fr)_minmax(12rem,0.7fr)_auto]">
          <div className="relative">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              type="search"
              value={q}
              onChange={(event) => setQ(event.target.value)}
              placeholder="关键词搜索、用途、场景、灵感方向"
              aria-label="关键词搜索"
              className="h-12 rounded-full border-border/70 bg-background/78 pl-11 pr-4"
            />
          </div>

          <select
            aria-label="按范围筛选"
            value={scope}
            onChange={(event) => setScope(event.target.value)}
            className="h-12 rounded-full border border-input bg-background/78 px-4 text-sm"
          >
            <option value="mine">仅我的提示词</option>
            <option value="all">我的 + 公开提示词</option>
            <option value="shared">仅公开提示词</option>
          </select>

          <div className="flex gap-2">
            <Button type="submit" variant="secondary" disabled={isPending} className="h-12 rounded-full px-5">
              {isPending ? "筛选中..." : "应用筛选"}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-12 rounded-full border-border/70 px-4"
              onClick={() => setShowAdvanced((current) => !current)}
              aria-expanded={showAdvanced}
              aria-controls="prompt-advanced-filter-grid"
            >
              更多
              <ChevronDown
                aria-hidden="true"
                className={`ml-1 h-4 w-4 transition-transform ${showAdvanced ? "rotate-180" : ""}`}
              />
            </Button>
          </div>
        </div>

        {showAdvanced ? (
          <div id="prompt-advanced-filter-grid" className="grid gap-3">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <select
                aria-label="按可见性筛选"
                value={status}
                onChange={(event) => setStatus(event.target.value)}
                className="h-11 rounded-2xl border border-input bg-background/78 px-3 text-sm"
              >
                <option value="all">全部可见性</option>
                <option value="public">公开</option>
                <option value="private">私有</option>
              </select>

              <select
                aria-label="按发布状态筛选"
                value={publishStatus}
                onChange={(event) => setPublishStatus(event.target.value)}
                className="h-11 rounded-2xl border border-input bg-background/78 px-3 text-sm"
              >
                <option value="all">全部发布状态</option>
                <option value="DRAFT">草稿</option>
                <option value="IN_REVIEW">待审核</option>
                <option value="PUBLISHED">已发布</option>
                <option value="ARCHIVED">已归档</option>
              </select>

              <select
                aria-label="按分类筛选"
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                className="h-11 rounded-2xl border border-input bg-background/78 px-3 text-sm"
              >
                <option value="">全部分类</option>
                {categories.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>

              <select
                aria-label="按标签筛选"
                value={tag}
                onChange={(event) => setTag(event.target.value)}
                className="h-11 rounded-2xl border border-input bg-background/78 px-3 text-sm"
              >
                <option value="">全部标签</option>
                {tags.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>

              <select
                aria-label="按作者筛选"
                value={authorId}
                onChange={(event) => setAuthorId(event.target.value)}
                className="h-11 rounded-2xl border border-input bg-background/78 px-3 text-sm"
              >
                <option value="">全部作者</option>
                {authors.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>

              <select
                aria-label="按更新时间筛选"
                value={updatedWithin}
                onChange={(event) => setUpdatedWithin(event.target.value)}
                className="h-11 rounded-2xl border border-input bg-background/78 px-3 text-sm"
              >
                <option value="">全部时间</option>
                <option value="24h">最近 24 小时</option>
                <option value="7d">最近 7 天</option>
                <option value="30d">最近 30 天</option>
                <option value="90d">最近 90 天</option>
              </select>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  const resetFilters: PromptAdvancedFilterState = {
                    q: "",
                    category: "",
                    tag: "",
                    authorId: "",
                    status: "all",
                    publishStatus: "all",
                    updatedWithin: "",
                    scope: "mine",
                  }

                  setQ("")
                  setCategory("")
                  setTag("")
                  setAuthorId("")
                  setStatus("all")
                  setPublishStatus("all")
                  setUpdatedWithin("")
                  setScope("mine")
                  applyFilters(resetFilters)
                }}
                disabled={!hasActiveFilters || isPending}
                className="rounded-full border-border/70 bg-background/72"
              >
                <RotateCcw className="mr-1 h-4 w-4" aria-hidden="true" />
                重置筛选
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={saveCurrentView}
                disabled={isPending}
                className="rounded-full border-border/70 bg-background/72"
              >
                <BookmarkPlus className="mr-1 h-4 w-4" aria-hidden="true" />
                保存视图
              </Button>
            </div>
          </div>
        ) : null}
      </form>

      <div className="rounded-[1.4rem] border border-border/60 bg-background/68 p-3 sm:p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <select
            aria-label="已保存视图"
            value={activeSavedViewId}
            onChange={(event) => setActiveSavedViewId(event.target.value)}
            className="h-11 min-w-0 flex-1 rounded-2xl border border-input bg-background/78 px-3 text-sm"
          >
            <option value="">选择已保存筛选视图</option>
            {savedViews.map((view) => (
              <option key={view.id} value={view.id}>
                {view.name}
              </option>
            ))}
          </select>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={applySavedView}
              disabled={!activeSavedViewId || isPending}
              className="rounded-full"
            >
              应用视图
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={removeSavedView}
              disabled={!activeSavedViewId || isPending}
              className="rounded-full"
            >
              <Trash2 className="mr-1 h-4 w-4" aria-hidden="true" />
              删除
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
