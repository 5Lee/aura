import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { FileSearch, SearchX } from "lucide-react"

import {
  type PromptAdvancedFilterState,
  PromptAdvancedFilters,
} from "@/components/prompts/prompt-advanced-filters"
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
    updatedWithin?: string | string[]
    scope?: string | string[]
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
    updatedWithin: getSingleValue(searchParams.updatedWithin).trim(),
    scope: getSingleValue(searchParams.scope).trim() || "mine",
  }

  const updatedWithinDate = resolveUpdatedWithinDate(initialFilters.updatedWithin)
  const filters: Array<Record<string, unknown>> = []

  if (initialFilters.scope === "all") {
    filters.push({ OR: [{ authorId: session.user.id }, { isPublic: true }] })
  } else if (initialFilters.scope === "shared") {
    filters.push({ isPublic: true, NOT: { authorId: session.user.id } })
  } else {
    filters.push({ authorId: session.user.id })
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
    filters.push({ isPublic: false, authorId: session.user.id })
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

  const [prompts, totalPromptCount, categories, tags, authors] = await prisma.$transaction([
    prisma.prompt.findMany({
      where: filters.length > 0 ? { AND: filters } : undefined,
      include: {
        category: true,
        tags: {
          include: { tag: true },
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
    }),
    prisma.prompt.count({
      where: { authorId: session.user.id },
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

  const promptCards = prompts.map((prompt) => ({
    id: prompt.id,
    href: `/prompts/${prompt.id}`,
    title: prompt.title,
    description: prompt.description || prompt.content,
    category: prompt.category.name,
    visibility: prompt.isPublic ? ("public" as const) : ("private" as const),
    author: prompt.author?.name || prompt.author?.email || "匿名用户",
    tags: prompt.tags.map((promptTag) => promptTag.tag.name),
    updatedAt: prompt.updatedAt.toLocaleDateString("zh-CN"),
  }))

  const hasActiveFilters = Boolean(
    initialFilters.q ||
      initialFilters.category ||
      initialFilters.tag ||
      initialFilters.authorId ||
      initialFilters.updatedWithin ||
      initialFilters.status !== "all" ||
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

      <p className="text-sm text-muted-foreground">
        当前结果 {prompts.length} 条（我的提示词总数 {totalPromptCount} 条）
      </p>

      {prompts.length === 0 ? (
        hasActiveFilters ? (
          <EmptyState
            icon={<SearchX aria-hidden="true" className="h-6 w-6" />}
            title="没有找到匹配的提示词"
            description="当前筛选组合无结果，请调整条件或重置筛选。"
            actions={
              <>
                <Button asChild>
                  <Link href="/prompts/new">创建提示词</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/prompts">重置筛选</Link>
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
    </div>
  )
}
