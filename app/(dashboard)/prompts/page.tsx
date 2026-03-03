import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { FileSearch, SearchX } from "lucide-react"

import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { VirtualizedPromptGrid } from "@/components/prompts/virtualized-prompt-grid"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { Input } from "@/components/ui/input"
import Link from "next/link"

interface PromptsPageProps {
  searchParams: {
    q?: string
  }
}

export default async function PromptsPage({ searchParams }: PromptsPageProps) {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    redirect("/login")
  }

  const query = searchParams.q?.trim() ?? ""
  const hasQuery = query.length > 0
  const where: {
    authorId: string
    OR?: Array<{
      title?: { contains: string }
      content?: { contains: string }
      description?: { contains: string }
    }>
  } = {
    authorId: session.user.id,
  }

  if (hasQuery) {
    where.OR = [
      { title: { contains: query } },
      { content: { contains: query } },
      { description: { contains: query } },
    ]
  }

  const [prompts, totalPromptCount] = await prisma.$transaction([
    prisma.prompt.findMany({
      where,
      include: { category: true, tags: { include: { tag: true } } },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.prompt.count({
      where: { authorId: session.user.id },
    }),
  ])

  const promptCards = prompts.map((prompt) => ({
    id: prompt.id,
    href: `/prompts/${prompt.id}`,
    title: prompt.title,
    description: prompt.description || prompt.content,
    category: prompt.category.name,
    visibility: prompt.isPublic ? ("public" as const) : ("private" as const),
    tags: prompt.tags.map((promptTag) => promptTag.tag.name),
    updatedAt: prompt.updatedAt.toLocaleDateString("zh-CN"),
  }))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">我的提示词</h1>
          <p className="text-muted-foreground">
            管理你的 AI 提示词库
          </p>
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

      <form action="/prompts" method="get" className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input
          type="search"
          name="q"
          defaultValue={query}
          placeholder="搜索标题、描述或内容"
          aria-label="搜索我的提示词"
          className="sm:max-w-lg"
        />
        <div className="flex items-center gap-2">
          <Button type="submit" variant="secondary">
            搜索
          </Button>
          {hasQuery && (
            <Button asChild type="button" variant="ghost">
              <Link href="/prompts">清除搜索</Link>
            </Button>
          )}
        </div>
      </form>

      {hasQuery && (
        <p className="text-sm text-muted-foreground">
          关键词 “{query}” 共找到 {prompts.length} 条结果
        </p>
      )}

      {prompts.length === 0 ? (
        hasQuery ? (
          <EmptyState
            icon={<SearchX aria-hidden="true" className="h-6 w-6" />}
            title="没有找到匹配的提示词"
            description={`没有搜索到包含“${query}”的内容，试试更短的关键词或新建一个提示词。`}
            actions={
              <>
                <Button asChild>
                  <Link href="/prompts/new">创建提示词</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/prompts">清除搜索条件</Link>
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
                : "当前筛选条件下没有提示词，请尝试调整搜索。"
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
