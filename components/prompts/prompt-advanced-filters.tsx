"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import { BookmarkPlus, ChevronDown, Filter, RotateCcw, Search, Sparkles, Trash2 } from "lucide-react"
import { useRouter } from "next/navigation"

import { usePromptQueryTransition } from "@/components/prompts/prompt-query-transition"
import { Badge } from "@/components/ui/badge"
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
const DEFAULT_FILTERS: PromptAdvancedFilterState = {
  q: "",
  category: "",
  tag: "",
  authorId: "",
  status: "all",
  publishStatus: "all",
  updatedWithin: "",
  scope: "mine",
}

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
  const queryTransition = usePromptQueryTransition()
  const [isLocalPending, startTransition] = useTransition()

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

  const syncLocalFilters = (filters: PromptAdvancedFilterState) => {
    setQ(filters.q)
    setCategory(filters.category)
    setTag(filters.tag)
    setAuthorId(filters.authorId)
    setStatus(filters.status)
    setPublishStatus(filters.publishStatus)
    setUpdatedWithin(filters.updatedWithin)
    setScope(filters.scope)
  }

  useEffect(() => {
    syncLocalFilters(initialFilters)
  }, [initialFilters])

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

  const persistSavedViews = (views: SavedPromptView[]) => {
    setSavedViews(views)
    if (typeof window !== "undefined") {
      window.localStorage.setItem(SAVED_VIEWS_STORAGE_KEY, JSON.stringify(views))
    }
  }

  const activeFilterCount = useMemo(() => {
    return [
      Boolean(currentFilters.q),
      Boolean(currentFilters.category),
      Boolean(currentFilters.tag),
      Boolean(currentFilters.authorId),
      Boolean(currentFilters.updatedWithin),
      currentFilters.status !== "all",
      currentFilters.publishStatus !== "all",
      currentFilters.scope !== "mine",
    ].filter(Boolean).length
  }, [currentFilters])

  const hasActiveFilters = activeFilterCount > 0

  useEffect(() => {
    if (hasActiveFilters) {
      setShowAdvanced(true)
    }
  }, [hasActiveFilters])

  const isPending = queryTransition?.isPending || isLocalPending

  const applyFilters = (filters: PromptAdvancedFilterState) => {
    const params = buildSearchParams(filters)
    const query = params.toString()
    const href = `/prompts${query ? `?${query}` : ""}`

    if (queryTransition) {
      queryTransition.navigate(href, "正在应用筛选并刷新提示词结果。")
      return
    }

    startTransition(() => {
      router.push(href)
    })
  }

  const resetFilters = () => {
    syncLocalFilters(DEFAULT_FILTERS)
    applyFilters(DEFAULT_FILTERS)
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

    syncLocalFilters(selected.filters)
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

  const quickPresets = useMemo(
    () => [
      {
        id: "recent-7d",
        label: "最近 7 天",
        description: "查看近期更新",
        isActive: currentFilters.updatedWithin === "7d",
        filters: {
          ...currentFilters,
          updatedWithin: currentFilters.updatedWithin === "7d" ? "" : "7d",
        },
      },
      {
        id: "drafts",
        label: "草稿优先",
        description: "继续整理草稿",
        isActive: currentFilters.publishStatus === "DRAFT",
        filters: {
          ...currentFilters,
          publishStatus: currentFilters.publishStatus === "DRAFT" ? "all" : "DRAFT",
        },
      },
      {
        id: "private-only",
        label: "仅私有",
        description: "聚焦个人资产",
        isActive: currentFilters.status === "private",
        filters: {
          ...currentFilters,
          status: currentFilters.status === "private" ? "all" : "private",
        },
      },
      {
        id: "public-library",
        label: "公开库",
        description: "浏览共享内容",
        isActive: currentFilters.scope === "shared",
        filters: {
          ...currentFilters,
          scope: currentFilters.scope === "shared" ? "mine" : "shared",
          status: currentFilters.scope === "shared" ? currentFilters.status : "public",
          publishStatus: currentFilters.scope === "shared" ? currentFilters.publishStatus : "PUBLISHED",
        },
      },
    ],
    [currentFilters]
  )

  return (
    <div className="surface-panel content-auto space-y-5 p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <p className="inline-flex items-center gap-2 text-sm font-medium text-foreground">
            <Filter className="h-4 w-4" aria-hidden="true" />
            高级检索
          </p>
          <p className="text-sm text-muted-foreground">从关键词开始，按范围、标签、作者与发布时间逐步收敛。</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant="outline"
            className="rounded-full border-border/70 bg-background/78 px-3 py-1 text-[11px] font-medium text-muted-foreground"
          >
            {hasActiveFilters ? `已启用 ${activeFilterCount} 项筛选` : "默认视图"}
          </Badge>
          <Badge
            variant="outline"
            className="rounded-full border-border/70 bg-background/78 px-3 py-1 text-[11px] font-medium text-muted-foreground"
          >
            已保存 {savedViews.length} 个视图
          </Badge>
          {isPending ? <span className="text-xs text-muted-foreground">正在应用筛选...</span> : null}
        </div>
      </div>

      <div className="rounded-[1.35rem] border border-border/70 bg-background/72 p-4 shadow-card">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="eyebrow-label">Quick combos</p>
            <p className="mt-1 text-sm text-muted-foreground">一键切换到常见检索组合，减少重复设置筛选条件。</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {quickPresets.map((preset) => (
              <Button
                key={preset.id}
                type="button"
                variant={preset.isActive ? "secondary" : "outline"}
                size="sm"
                onClick={() => {
                  syncLocalFilters(preset.filters)
                  applyFilters(preset.filters)
                }}
                disabled={isPending}
                className={preset.isActive ? "rounded-full" : "rounded-full border-border/70 bg-background/78"}
              >
                <Sparkles aria-hidden="true" className="mr-1 h-3.5 w-3.5" />
                {preset.label}
              </Button>
            ))}
          </div>
        </div>
      </div>

      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault()
          applyFilters(currentFilters)
        }}
      >
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1.6fr)_minmax(13rem,0.8fr)_auto]">
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

          <div className="flex flex-wrap gap-2">
            <Button type="submit" variant="secondary" disabled={isPending} className="h-12 rounded-full px-5">
              {isPending ? "筛选中..." : "应用筛选"}
            </Button>
            {hasActiveFilters ? (
              <Button
                type="button"
                variant="outline"
                onClick={resetFilters}
                disabled={isPending}
                className="h-12 rounded-full border-border/70 px-4"
              >
                <RotateCcw className="mr-1 h-4 w-4" aria-hidden="true" />
                重置
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              className="h-12 rounded-full border-border/70 px-4"
              onClick={() => setShowAdvanced((current) => !current)}
              aria-expanded={showAdvanced}
              aria-controls="prompt-advanced-filter-grid"
            >
              更多筛选
              <ChevronDown
                aria-hidden="true"
                className={`ml-1 h-4 w-4 transition-transform ${showAdvanced ? "rotate-180" : ""}`}
              />
            </Button>
          </div>
        </div>

        {showAdvanced ? (
          <div id="prompt-advanced-filter-grid" className="rounded-[1.35rem] border border-border/70 bg-background/72 p-4 shadow-card">
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

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={saveCurrentView}
                disabled={isPending}
                className="rounded-full border-border/70 bg-background/78"
              >
                <BookmarkPlus className="mr-1 h-4 w-4" aria-hidden="true" />
                保存当前视图
              </Button>
              <span className="text-xs text-muted-foreground">保存后可以在下方快速切换这组检索条件。</span>
            </div>
          </div>
        ) : null}
      </form>

      <div className="rounded-[1.4rem] border border-border/60 bg-background/68 p-3 sm:p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="eyebrow-label">Saved views</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {savedViews.length > 0 ? "把常用筛选组合保存下来，后续一键切换。" : "当前还没有保存视图，可以先存一组常用筛选。"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="已保存视图"
              value={activeSavedViewId}
              onChange={(event) => setActiveSavedViewId(event.target.value)}
              className="h-11 min-w-[13rem] rounded-2xl border border-input bg-background/78 px-3 text-sm"
            >
              <option value="">选择已保存筛选视图</option>
              {savedViews.map((view) => (
                <option key={view.id} value={view.id}>
                  {view.name}
                </option>
              ))}
            </select>

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
