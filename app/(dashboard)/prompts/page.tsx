import Link from "next/link"
import { PromptPublishStatus } from "@prisma/client"
import { FileSearch, SearchX, SlidersHorizontal, Sparkles, Workflow } from "lucide-react"
import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"

import {
  type PromptAdvancedFilterState,
  PromptAdvancedFilters,
} from "@/components/prompts/prompt-advanced-filters"
import { PromptBatchToolbar } from "@/components/prompts/prompt-batch-toolbar"
import { VirtualizedPromptGrid } from "@/components/prompts/virtualized-prompt-grid"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"

interface PromptsPageProps {
  searchParams: {
    q?: string | string[]
    category?: string | string[]
    tag?: string | string[]
    authorId?: string | string[]
    status?: string | string[]
    publishStatus?: string | string[]
    updatedWithin?: string | string[]
    scope?: string | string[]
    page?: string | string[]
    pageSize?: string | string[]
  }
}

const UPDATED_WITHIN_DAYS: Record<string, number> = {
  "24h": 1,
  "7d": 7,
  "30d": 30,
  "90d": 90,
}

const UPDATED_WITHIN_LABELS: Record<string, string> = {
  "24h": "最近 24 小时",
  "7d": "最近 7 天",
  "30d": "最近 30 天",
  "90d": "最近 90 天",
}

const STATUS_LABELS: Record<string, string> = {
  public: "仅公开",
  private: "仅私有",
}

const PUBLISH_STATUS_LABELS: Record<string, string> = {
  DRAFT: "草稿",
  IN_REVIEW: "待审核",
  PUBLISHED: "已发布",
  ARCHIVED: "已归档",
}

const SCOPE_LABELS: Record<string, string> = {
  all: "我的 + 公开提示词",
  shared: "仅公开提示词",
}

function getSingleValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] || ""
  }
  return value || ""
}

function resolveUpdatedWithinDate(value: string) {
  const days = UPDATED_WITHIN_DAYS[value]
  if (!days) {
    return null
  }

  return new Date(Date.now() - days * 24 * 60 * 60 * 1000)
}

function resolvePublishStatus(value: string) {
  if (!value || value === "all") {
    return null
  }

  const normalized = value.toUpperCase()
  if (!Object.values(PromptPublishStatus).includes(normalized as PromptPublishStatus)) {
    return null
  }

  return normalized as PromptPublishStatus
}

function resolvePositiveInt(value: string, fallback: number, min: number, max: number) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    return fallback
  }

  const rounded = Math.floor(parsed)
  if (rounded < min) {
    return min
  }
  if (rounded > max) {
    return max
  }
  return rounded
}

function buildPromptsPageHref(filters: PromptAdvancedFilterState, page: number, pageSize: number) {
  const params = new URLSearchParams()

  if (filters.q) params.set("q", filters.q)
  if (filters.category) params.set("category", filters.category)
  if (filters.tag) params.set("tag", filters.tag)
  if (filters.authorId) params.set("authorId", filters.authorId)
  if (filters.status && filters.status !== "all") params.set("status", filters.status)
  if (filters.publishStatus && filters.publishStatus !== "all") params.set("publishStatus", filters.publishStatus)
  if (filters.updatedWithin) params.set("updatedWithin", filters.updatedWithin)
  if (filters.scope && filters.scope !== "mine") params.set("scope", filters.scope)
  if (page > 1) params.set("page", String(page))
  if (pageSize !== 60) params.set("pageSize", String(pageSize))

  const query = params.toString()
  return `/prompts${query ? `?${query}` : ""}`
}

export default async function PromptsPage({ searchParams }: PromptsPageProps) {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    redirect("/login")
  }

  const initialFilters: PromptAdvancedFilterState = {
    q: getSingleValue(searchParams.q).trim(),
    category: getSingleValue(searchParams.category).trim(),
    tag: getSingleValue(searchParams.tag).trim(),
    authorId: getSingleValue(searchParams.authorId).trim(),
    status: getSingleValue(searchParams.status).trim() || "all",
    publishStatus: getSingleValue(searchParams.publishStatus).trim() || "all",
    updatedWithin: getSingleValue(searchParams.updatedWithin).trim(),
    scope: getSingleValue(searchParams.scope).trim() || "mine",
  }

  const updatedWithinDate = resolveUpdatedWithinDate(initialFilters.updatedWithin)
  const publishStatusFilter = resolvePublishStatus(initialFilters.publishStatus)
  const page = resolvePositiveInt(getSingleValue(searchParams.page).trim(), 1, 1, 10000)
  const pageSize = resolvePositiveInt(getSingleValue(searchParams.pageSize).trim(), 60, 20, 120)
  const skip = (page - 1) * pageSize

  const filters: Array<Record<string, unknown>> = []

  if (initialFilters.scope === "all") {
    filters.push({
      OR: [
        { authorId: session.user.id },
        { members: { some: { userId: session.user.id } } },
        { isPublic: true, publishStatus: PromptPublishStatus.PUBLISHED },
      ],
    })
  } else if (initialFilters.scope === "shared") {
    filters.push({
      OR: [
        {
          isPublic: true,
          publishStatus: PromptPublishStatus.PUBLISHED,
          NOT: { authorId: session.user.id },
        },
        { members: { some: { userId: session.user.id } } },
      ],
    })
  } else {
    filters.push({
      OR: [{ authorId: session.user.id }, { members: { some: { userId: session.user.id } } }],
    })
  }

  if (initialFilters.category) {
    filters.push({ categoryId: initialFilters.category })
  }

  if (initialFilters.tag) {
    filters.push({
      tags: {
        some: {
          tag: { name: initialFilters.tag },
        },
      },
    })
  }

  if (initialFilters.authorId) {
    filters.push({ authorId: initialFilters.authorId })
  }

  if (initialFilters.status === "public") {
    filters.push({ isPublic: true })
  } else if (initialFilters.status === "private") {
    filters.push({
      isPublic: false,
      OR: [{ authorId: session.user.id }, { members: { some: { userId: session.user.id } } }],
    })
  }

  if (publishStatusFilter) {
    filters.push({ publishStatus: publishStatusFilter })
  }

  if (updatedWithinDate) {
    filters.push({ updatedAt: { gte: updatedWithinDate } })
  }

  if (initialFilters.q) {
    filters.push({
      OR: [
        { title: { contains: initialFilters.q } },
        { content: { contains: initialFilters.q } },
        { description: { contains: initialFilters.q } },
      ],
    })
  }

  const filteredWhere = filters.length > 0 ? { AND: filters } : undefined

  const [prompts, filteredPromptCount, totalPromptCount, categories, tags, authors] = await prisma.$transaction([
    prisma.prompt.findMany({
      where: filteredWhere,
      select: {
        id: true,
        title: true,
        description: true,
        content: true,
        isPublic: true,
        publishStatus: true,
        updatedAt: true,
        category: {
          select: {
            name: true,
          },
        },
        tags: {
          select: {
            tag: {
              select: {
                name: true,
              },
            },
            tagId: true,
          },
        },
        author: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { updatedAt: "desc" },
      take: pageSize,
      skip,
    }),
    prisma.prompt.count({
      where: filteredWhere,
    }),
    prisma.prompt.count({
      where: {
        OR: [{ authorId: session.user.id }, { members: { some: { userId: session.user.id } } }],
      },
    }),
    prisma.category.findMany({
      orderBy: { order: "asc" },
      select: { id: true, name: true },
    }),
    prisma.tag.findMany({
      orderBy: { name: "asc" },
      take: 120,
      select: { name: true },
    }),
    prisma.user.findMany({
      where: {
        OR: [{ id: session.user.id }, { prompts: { some: { isPublic: true } } }],
      },
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, email: true },
      take: 120,
    }),
  ])

  const totalPages = Math.max(1, Math.ceil(filteredPromptCount / pageSize))
  const hasPrevPage = page > 1
  const hasNextPage = page < totalPages

  const promptCards = prompts.map((prompt) => ({
    id: prompt.id,
    href: `/prompts/${prompt.id}`,
    title: prompt.title,
    description: `${prompt.description || prompt.content}\n状态：${prompt.publishStatus}`,
    category: prompt.category.name,
    visibility: prompt.isPublic ? ("public" as const) : ("private" as const),
    author: prompt.author?.name || prompt.author?.email || "匿名用户",
    tags: [...prompt.tags.map((promptTag) => promptTag.tag.name), `status:${prompt.publishStatus}`],
    updatedAt: prompt.updatedAt.toLocaleDateString("zh-CN"),
  }))

  const hasActiveFilters = Boolean(
    initialFilters.q ||
      initialFilters.category ||
      initialFilters.tag ||
      initialFilters.authorId ||
      initialFilters.updatedWithin ||
      initialFilters.status !== "all" ||
      initialFilters.publishStatus !== "all" ||
      initialFilters.scope !== "mine"
  )

  const activeFilterBadges = [
    initialFilters.q ? `关键词：${initialFilters.q}` : null,
    initialFilters.category
      ? `分类：${categories.find((item) => item.id === initialFilters.category)?.name || initialFilters.category}`
      : null,
    initialFilters.tag ? `标签：${initialFilters.tag}` : null,
    initialFilters.authorId
      ? `作者：${authors.find((item) => item.id === initialFilters.authorId)?.name || authors.find((item) => item.id === initialFilters.authorId)?.email || initialFilters.authorId}`
      : null,
    initialFilters.status !== "all" ? STATUS_LABELS[initialFilters.status] || `可见性：${initialFilters.status}` : null,
    initialFilters.publishStatus !== "all"
      ? `发布状态：${PUBLISH_STATUS_LABELS[initialFilters.publishStatus] || initialFilters.publishStatus}`
      : null,
    initialFilters.updatedWithin ? UPDATED_WITHIN_LABELS[initialFilters.updatedWithin] || initialFilters.updatedWithin : null,
    initialFilters.scope !== "mine" ? SCOPE_LABELS[initialFilters.scope] || initialFilters.scope : null,
  ].filter(Boolean) as string[]

  return (
    <div className="space-y-6">
      <section className="surface-panel-strong relative overflow-hidden p-6 sm:p-8">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.16),transparent_40%),radial-gradient(circle_at_bottom_right,hsl(var(--accent)/0.12),transparent_30%)]"
        />
        <div className="relative space-y-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-3">
              <p className="eyebrow-label">Prompt workspace</p>
              <div className="space-y-2">
                <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">我的提示词</h1>
                <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
                  把搜索、筛选、批量处理和资产整理集中在一个视图里，减少来回切页与重复操作。
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button asChild variant="outline" className="rounded-full border-border/70 bg-background/72 px-5">
                <Link href="/browse">浏览公开提示词</Link>
              </Button>
              <Button asChild className="rounded-full px-5 shadow-primary">
                <Link href="/prompts/new">新建提示词</Link>
              </Button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-[1.5rem] border border-border/70 bg-background/82 p-4 shadow-card backdrop-blur-sm">
              <p className="eyebrow-label">Library size</p>
              <p className="mt-3 text-3xl font-semibold text-foreground">{totalPromptCount}</p>
              <p className="mt-1 text-sm text-muted-foreground">当前可操作提示词总数</p>
            </div>
            <div className="rounded-[1.5rem] border border-border/70 bg-background/82 p-4 shadow-card backdrop-blur-sm">
              <p className="eyebrow-label">Filtered results</p>
              <p className="mt-3 text-3xl font-semibold text-foreground">{filteredPromptCount}</p>
              <p className="mt-1 text-sm text-muted-foreground">当前检索组合命中的结果</p>
            </div>
            <div className="rounded-[1.5rem] border border-border/70 bg-background/82 p-4 shadow-card backdrop-blur-sm">
              <p className="eyebrow-label">Page state</p>
              <p className="mt-3 text-3xl font-semibold text-foreground">{page}/{totalPages}</p>
              <p className="mt-1 text-sm text-muted-foreground">每页 {pageSize} 条，支持批量处理</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {activeFilterBadges.length > 0 ? (
              activeFilterBadges.map((item) => (
                <Badge key={item} variant="outline" className="border-border/70 bg-background/72 text-foreground">
                  {item}
                </Badge>
              ))
            ) : (
              <Badge variant="outline" className="border-primary/20 bg-primary/10 text-primary">
                当前为默认视图，展示你的可操作提示词
              </Badge>
            )}
          </div>
        </div>
      </section>

      <PromptAdvancedFilters
        categories={categories.map((item) => ({ value: item.id, label: item.name }))}
        tags={tags.map((item) => ({ value: item.name, label: item.name }))}
        authors={authors.map((item) => ({
          value: item.id,
          label: item.name || item.email || "匿名用户",
        }))}
        initialFilters={initialFilters}
      />

      <PromptBatchToolbar
        prompts={prompts.map((prompt) => ({
          id: prompt.id,
          title: prompt.title,
          isPublic: prompt.isPublic,
          publishStatus: prompt.publishStatus,
          tags: prompt.tags.map((promptTag) => promptTag.tag.name),
        }))}
      />

      <section className="surface-panel flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div>
          <p className="eyebrow-label">Result overview</p>
          <p className="mt-1 text-sm text-muted-foreground">
            当前第 {page} / {totalPages} 页，本页 {prompts.length} 条，筛选结果共 {filteredPromptCount} 条。
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          <span className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/72 px-3 py-2 text-muted-foreground">
            <Workflow aria-hidden="true" className="h-4 w-4" />
            批量操作与筛选联动
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/72 px-3 py-2 text-muted-foreground">
            <Sparkles aria-hidden="true" className="h-4 w-4" />
            卡片列表支持渐进加载动效
          </span>
          {hasActiveFilters ? (
            <Button asChild variant="outline" size="sm" className="rounded-full border-border/70 bg-background/72">
              <Link href="/prompts">清空筛选</Link>
            </Button>
          ) : null}
        </div>
      </section>

      {prompts.length === 0 ? (
        hasActiveFilters || page > 1 ? (
          <EmptyState
            icon={<SearchX aria-hidden="true" className="h-6 w-6" />}
            title="没有找到匹配的提示词"
            description={
              page > 1 && filteredPromptCount > 0
                ? "当前页无数据，请返回上一页或重置筛选。"
                : "当前筛选组合无结果，请调整条件或重置筛选。"
            }
            actions={
              <>
                <Button asChild>
                  <Link href="/prompts/new">创建提示词</Link>
                </Button>
                <Button asChild variant="outline">
                  {page > 1 ? (
                    <Link href={buildPromptsPageHref(initialFilters, Math.max(1, page - 1), pageSize)}>上一页</Link>
                  ) : (
                    <Link href="/prompts">重置筛选</Link>
                  )}
                </Button>
              </>
            }
            className="surface-panel"
          />
        ) : (
          <EmptyState
            icon={<FileSearch aria-hidden="true" className="h-6 w-6" />}
            title="还没有提示词"
            description={
              totalPromptCount === 0
                ? "从你的第一个 AI 提示词开始，建立可复用的个人提示词库。"
                : "当前条件下没有提示词，请尝试调整检索范围。"
            }
            actions={
              <>
                <Button asChild>
                  <Link href="/prompts/new">创建提示词</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/browse">浏览公开提示词</Link>
                </Button>
              </>
            }
            className="surface-panel"
          />
        )
      ) : (
        <section className="space-y-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <SlidersHorizontal aria-hidden="true" className="h-4 w-4" />
            <span>当前列表按更新时间倒序排列，方便优先处理最新提示词。</span>
          </div>
          <VirtualizedPromptGrid prompts={promptCards} viewportLabel="我的提示词列表" />
        </section>
      )}

      {filteredPromptCount > 0 ? (
        <div className="surface-panel flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5">
          <div>
            <p className="eyebrow-label">Pagination</p>
            <p className="mt-1 text-sm text-muted-foreground">每页 {pageSize} 条，已定位到第 {page} 页</p>
          </div>
          <div className="flex items-center gap-2">
            {hasPrevPage ? (
              <Button variant="outline" size="sm" asChild className="rounded-full border-border/70 bg-background/72">
                <Link href={buildPromptsPageHref(initialFilters, page - 1, pageSize)}>上一页</Link>
              </Button>
            ) : (
              <Button variant="outline" size="sm" disabled className="rounded-full border-border/70 bg-background/72">
                上一页
              </Button>
            )}
            {hasNextPage ? (
              <Button variant="outline" size="sm" asChild className="rounded-full border-border/70 bg-background/72">
                <Link href={buildPromptsPageHref(initialFilters, page + 1, pageSize)}>下一页</Link>
              </Button>
            ) : (
              <Button variant="outline" size="sm" disabled className="rounded-full border-border/70 bg-background/72">
                下一页
              </Button>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
