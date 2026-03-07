import Link from "next/link"
import { PromptPublishStatus } from "@prisma/client"
import { FileSearch, SearchX } from "lucide-react"
import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"

import {
  type PromptAdvancedFilterState,
  PromptAdvancedFilters,
} from "@/components/prompts/prompt-advanced-filters"
import { PromptListWorkspace } from "@/components/prompts/prompt-list-workspace"
import { PromptQueryButton, PromptQueryStatus, PromptQueryTransitionProvider } from "@/components/prompts/prompt-query-transition"
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

const DEFAULT_PAGE_SIZE = 40
const PAGE_SIZE_OPTIONS = [20, 40, 60] as const

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
  mine: "仅我的提示词",
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
  if (!value.trim()) {
    return fallback
  }

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
  if (pageSize !== DEFAULT_PAGE_SIZE) params.set("pageSize", String(pageSize))

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
  const pageSize = resolvePositiveInt(getSingleValue(searchParams.pageSize).trim(), DEFAULT_PAGE_SIZE, 20, 120)
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
        authorId: true,
        isPublic: true,
        publishStatus: true,
        viewCount: true,
        favoriteCount: true,
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
        members: {
          where: { userId: session.user.id },
          select: { role: true },
          take: 1,
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

  const promptCards = prompts.map((prompt) => {
    const canEdit =
      prompt.authorId === session.user.id ||
      prompt.members.some((member) => member.role === "OWNER" || member.role === "EDITOR")

    return {
      id: prompt.id,
      href: `/prompts/${prompt.id}`,
      title: prompt.title,
      description: prompt.description?.trim() || "暂无描述，点击查看详情继续完善这条提示词。",
      category: prompt.category.name,
      visibility: prompt.isPublic ? ("public" as const) : ("private" as const),
      publishStatus: prompt.publishStatus,
      author: prompt.author?.name || prompt.author?.email || "匿名用户",
      tags: prompt.tags.map((promptTag) => promptTag.tag.name),
      updatedAt: prompt.updatedAt.toLocaleDateString("zh-CN"),
      metrics: [
        { kind: "favorites" as const, value: prompt.favoriteCount },
        { kind: "views" as const, value: prompt.viewCount },
      ],
      editHref: canEdit ? `/prompts/${prompt.id}/edit` : undefined,
    }
  })

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
  const activeFilterCount = activeFilterBadges.length

  const scopeQuickLinks = [
    { value: "mine", label: "仅我的", description: "聚焦本人和协作者可操作资产" },
    { value: "all", label: "全部可访问", description: "同时查看我的与公开资产" },
    { value: "shared", label: "公开库", description: "只看公开或共享给我的内容" },
  ] as const

  return (
    <PromptQueryTransitionProvider viewSignature={buildPromptsPageHref(initialFilters, page, pageSize)}>
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

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
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
              <p className="eyebrow-label">Active filters</p>
              <p className="mt-3 text-3xl font-semibold text-foreground">{activeFilterCount}</p>
              <p className="mt-1 text-sm text-muted-foreground">当前生效的筛选条件数量</p>
            </div>
            <div className="rounded-[1.5rem] border border-border/70 bg-background/82 p-4 shadow-card backdrop-blur-sm">
              <p className="eyebrow-label">Page density</p>
              <p className="mt-3 text-3xl font-semibold text-foreground">{pageSize}</p>
              <p className="mt-1 text-sm text-muted-foreground">当前每页加载条数，可平衡速度与密度</p>
            </div>
          </div>

          <div className="space-y-3">
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

            <div className="rounded-[1.5rem] border border-border/70 bg-background/82 p-4 shadow-card backdrop-blur-sm">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="eyebrow-label">Workspace range</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    <PromptQueryStatus
                      idleText="快速切换列表范围，不丢失其他筛选条件。"
                      pendingText="正在切换工作区范围并保留当前筛选条件。"
                    />
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {scopeQuickLinks.map((item) => {
                    const isActive = initialFilters.scope === item.value
                    const href = buildPromptsPageHref({ ...initialFilters, scope: item.value }, 1, pageSize)

                    return (
                      <PromptQueryButton
                        key={item.value}
                        href={href}
                        pendingLabel={`正在切换到${item.label}范围并刷新提示词列表。`}
                        size="sm"
                        variant={isActive ? "secondary" : "outline"}
                        className={isActive ? "rounded-full" : "rounded-full border-border/70 bg-background/72"}
                      >
                        {item.label}
                      </PromptQueryButton>
                    )
                  })}
                </div>
              </div>
            </div>
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

      <section className="surface-panel content-auto p-4 sm:p-5">
        <div className="rounded-[1.35rem] border border-border/70 bg-background/78 p-4 shadow-card">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="eyebrow-label">Load profile</p>
              <p className="mt-3 text-base font-semibold text-foreground">按每页条数平衡速度与密度</p>
              <p className="mt-1 text-sm text-muted-foreground">
                <PromptQueryStatus
                  idleText="更少条目首屏更快，更多条目更适合密集浏览。"
                  pendingText="正在切换每页条数并刷新当前提示词列表。"
                />
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {PAGE_SIZE_OPTIONS.map((size) => (
                <PromptQueryButton
                  key={size}
                  href={buildPromptsPageHref(initialFilters, 1, size)}
                  pendingLabel={`正在切换到每页 ${size} 条并刷新提示词列表。`}
                  size="sm"
                  variant={pageSize === size ? "secondary" : "outline"}
                  className={pageSize === size ? "rounded-full" : "rounded-full border-border/70 bg-background/72"}
                >
                  {size} / 页
                </PromptQueryButton>
              ))}
            </div>
          </div>
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
                {page > 1 ? (
                  <PromptQueryButton
                    href={buildPromptsPageHref(initialFilters, Math.max(1, page - 1), pageSize)}
                    pendingLabel="正在返回上一页并刷新提示词结果。"
                    variant="outline"
                  >
                    上一页
                  </PromptQueryButton>
                ) : (
                  <PromptQueryButton href="/prompts" pendingLabel="正在重置筛选并恢复默认提示词视图。" variant="outline">
                    重置筛选
                  </PromptQueryButton>
                )}
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
        <PromptListWorkspace
          promptCards={promptCards}
          batchPrompts={prompts.map((prompt) => ({
            id: prompt.id,
            title: prompt.title,
            isPublic: prompt.isPublic,
            publishStatus: prompt.publishStatus,
            tags: prompt.tags.map((promptTag) => promptTag.tag.name),
          }))}
          page={page}
          totalPages={totalPages}
          filteredPromptCount={filteredPromptCount}
          pageSize={pageSize}
          hasActiveFilters={hasActiveFilters}
          clearHref="/prompts"
        />
      )}

      {filteredPromptCount > 0 ? (
        <div className="surface-panel flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5">
          <div>
            <p className="eyebrow-label">Pagination</p>
            <p className="mt-1 text-sm text-muted-foreground">
              <PromptQueryStatus
                idleText={`每页 ${pageSize} 条，已定位到第 ${page} 页，共 ${totalPages} 页`}
                pendingText="正在刷新当前分页与提示词列表。"
              />
            </p>
          </div>
          <div className="flex items-center gap-2">
            {hasPrevPage ? (
              <PromptQueryButton
                href={buildPromptsPageHref(initialFilters, page - 1, pageSize)}
                pendingLabel="正在切换到上一页并刷新提示词列表。"
                variant="outline"
                size="sm"
                className="rounded-full border-border/70 bg-background/72"
              >
                上一页
              </PromptQueryButton>
            ) : (
              <Button variant="outline" size="sm" disabled className="rounded-full border-border/70 bg-background/72">
                上一页
              </Button>
            )}
            {hasNextPage ? (
              <PromptQueryButton
                href={buildPromptsPageHref(initialFilters, page + 1, pageSize)}
                pendingLabel="正在切换到下一页并刷新提示词列表。"
                variant="outline"
                size="sm"
                className="rounded-full border-border/70 bg-background/72"
              >
                下一页
              </PromptQueryButton>
            ) : (
              <Button variant="outline" size="sm" disabled className="rounded-full border-border/70 bg-background/72">
                下一页
              </Button>
            )}
          </div>
        </div>
      ) : null}
      </div>
    </PromptQueryTransitionProvider>
  )
}
