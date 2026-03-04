import { PromptPublishStatus } from "@prisma/client"
import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { FileSearch, SearchX } from "lucide-react"

import {
  type PromptAdvancedFilterState,
  PromptAdvancedFilters,
} from "@/components/prompts/prompt-advanced-filters"
import { PromptBatchToolbar } from "@/components/prompts/prompt-batch-toolbar"
import { VirtualizedPromptGrid } from "@/components/prompts/virtualized-prompt-grid"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import Link from "next/link"

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
      OR: [
        { authorId: session.user.id },
        { members: { some: { userId: session.user.id } } },
      ],
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
      OR: [
        { authorId: session.user.id },
        { members: { some: { userId: session.user.id } } },
      ],
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
        OR: [
          { authorId: session.user.id },
          { members: { some: { userId: session.user.id } } },
        ],
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">我的提示词</h1>
          <p className="text-muted-foreground">管理、筛选并快速定位可复用提示词。</p>
        </div>
        <Link href="/prompts/new">
          <Button>
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            新建提示词
          </Button>
        </Link>
      </div>

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

      <p className="text-sm text-muted-foreground">
        当前第 {page} / {totalPages} 页，本页 {prompts.length} 条（筛选结果共 {filteredPromptCount} 条，可操作提示词总数 {totalPromptCount} 条）
      </p>

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
                    <Link href={buildPromptsPageHref(initialFilters, Math.max(1, page - 1), pageSize)}>
                      上一页
                    </Link>
                  ) : (
                    <Link href="/prompts">重置筛选</Link>
                  )}
                </Button>
              </>
            }
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
          />
        )
      ) : (
        <VirtualizedPromptGrid prompts={promptCards} viewportLabel="我的提示词列表" />
      )}

      {filteredPromptCount > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/60 bg-card/40 px-3 py-2 text-sm">
          <p className="text-muted-foreground">
            每页 {pageSize} 条，已定位到第 {page} 页
          </p>
          <div className="flex items-center gap-2">
            {hasPrevPage ? (
              <Button variant="outline" size="sm" asChild>
                <Link href={buildPromptsPageHref(initialFilters, page - 1, pageSize)}>上一页</Link>
              </Button>
            ) : (
              <Button variant="outline" size="sm" disabled>
                上一页
              </Button>
            )}
            {hasNextPage ? (
              <Button variant="outline" size="sm" asChild>
                <Link href={buildPromptsPageHref(initialFilters, page + 1, pageSize)}>下一页</Link>
              </Button>
            ) : (
              <Button variant="outline" size="sm" disabled>
                下一页
              </Button>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
