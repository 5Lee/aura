import Link from "next/link"
import { PromptPublishStatus } from "@prisma/client"
import { Compass, Layers3, Sparkles } from "lucide-react"
import { getServerSession } from "next-auth"

import { BrowseNavbar } from "@/components/layout/browse-navbar"
import { SearchBox } from "@/components/search/search-box"
import { VirtualizedPromptGrid } from "@/components/prompts/virtualized-prompt-grid"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { cn } from "@/lib/utils"

export default async function BrowsePage({
  searchParams,
}: {
  searchParams: { category?: string; q?: string }
}) {
  const session = await getServerSession(authOptions)

  const where: Record<string, unknown> = {
    isPublic: true,
    publishStatus: PromptPublishStatus.PUBLISHED,
  }

  if (searchParams.category) {
    where.categoryId = searchParams.category
  }

  if (searchParams.q) {
    where.OR = [
      { title: { contains: searchParams.q } },
      { content: { contains: searchParams.q } },
      { description: { contains: searchParams.q } },
    ]
  }

  const [categories, prompts] = await Promise.all([
    prisma.category.findMany({
      orderBy: { order: "asc" },
      select: { id: true, name: true },
    }),
    prisma.prompt.findMany({
      where,
      select: {
        id: true,
        title: true,
        description: true,
        content: true,
        favoriteCount: true,
        viewCount: true,
        category: {
          select: { name: true },
        },
        tags: {
          select: {
            tag: {
              select: { name: true },
            },
          },
        },
        author: {
          select: { name: true, email: true },
        },
      },
      orderBy: { updatedAt: "desc" },
    }),
  ])

  const activeCategoryName = categories.find((category) => category.id === searchParams.category)?.name
  const promptCards = prompts.map((prompt) => ({
    id: prompt.id,
    href: `/prompts/${prompt.id}`,
    title: prompt.title,
    description: prompt.description || prompt.content,
    category: prompt.category.name,
    author: prompt.author?.name || prompt.author?.email || "匿名用户",
    tags: prompt.tags.map((promptTag) => promptTag.tag.name),
    metrics: [
      { kind: "favorites" as const, value: prompt.favoriteCount },
      { kind: "views" as const, value: prompt.viewCount },
    ],
  }))

  const categoryLinks = categories.map((category) => ({
    id: category.id,
    name: category.name,
    href: searchParams.q
      ? `/browse?category=${category.id}&q=${encodeURIComponent(searchParams.q)}`
      : `/browse?category=${category.id}`,
  }))

  return (
    <div className="min-h-screen bg-transparent">
      <BrowseNavbar session={session} />

      <main className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <section className="surface-panel-strong relative overflow-hidden p-6 sm:p-8">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.18),transparent_38%),radial-gradient(circle_at_bottom_right,hsl(var(--accent)/0.14),transparent_32%)]"
          />
          <div className="relative grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(20rem,0.8fr)] lg:items-end">
            <div className="space-y-5">
              <div className="space-y-3">
                <p className="eyebrow-label">Community prompt library</p>
                <div className="space-y-3">
                  <h1 className="max-w-3xl text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                    更快发现值得复用的 AI 提示词，而不是在列表里盲找。
                  </h1>
                  <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
                    从分类、热门主题和实时搜索切入，快速锁定可以直接启发工作流的提示词模板。
                  </p>
                </div>
              </div>

              <SearchBox defaultQuery={searchParams.q} category={searchParams.category} />

              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <Badge variant="outline" className="border-primary/20 bg-primary/10 text-primary">
                  {categories.length} 个内容分类
                </Badge>
                <Badge variant="outline" className="border-border/70 bg-background/72 text-muted-foreground">
                  {prompts.length} 条结果
                </Badge>
                {activeCategoryName ? (
                  <Badge variant="outline" className="border-border/70 bg-background/72 text-foreground">
                    分类：{activeCategoryName}
                  </Badge>
                ) : null}
                {searchParams.q ? (
                  <Badge variant="outline" className="border-border/70 bg-background/72 text-foreground">
                    关键词：{searchParams.q}
                  </Badge>
                ) : null}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
              <div className="rounded-[1.5rem] border border-border/70 bg-background/82 p-4 shadow-card backdrop-blur-sm">
                <p className="eyebrow-label">Browse focus</p>
                <p className="mt-3 text-3xl font-semibold text-foreground">{prompts.length}</p>
                <p className="mt-1 text-sm text-muted-foreground">当前可浏览结果</p>
              </div>
              <div className="rounded-[1.5rem] border border-border/70 bg-background/82 p-4 shadow-card backdrop-blur-sm">
                <p className="eyebrow-label">Category</p>
                <p className="mt-3 text-lg font-semibold text-foreground">{activeCategoryName || "全部主题"}</p>
                <p className="mt-1 text-sm text-muted-foreground">从场景切入更快收敛结果</p>
              </div>
              <div className="rounded-[1.5rem] border border-border/70 bg-background/82 p-4 shadow-card backdrop-blur-sm">
                <p className="eyebrow-label">Next action</p>
                {session ? (
                  <Button asChild variant="outline" className="mt-3 w-full rounded-full border-border/70 bg-background/70">
                    <Link href="/prompts">查看我的提示词</Link>
                  </Button>
                ) : (
                  <Button asChild className="mt-3 w-full rounded-full shadow-primary">
                    <Link href="/register">注册后收藏灵感</Link>
                  </Button>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="surface-panel p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={searchParams.q ? `/browse?q=${encodeURIComponent(searchParams.q)}` : "/browse"}
              className={cn(
                "inline-flex min-h-10 items-center rounded-full border px-4 py-2 text-sm font-medium transition-colors",
                !searchParams.category
                  ? "border-foreground bg-foreground text-background"
                  : "border-border/70 bg-background/72 text-muted-foreground hover:text-foreground"
              )}
            >
              全部
            </Link>
            {categoryLinks.map((category) => {
              const active = searchParams.category === category.id

              return (
                <Link
                  key={category.id}
                  href={category.href}
                  className={cn(
                    "inline-flex min-h-10 items-center rounded-full border px-4 py-2 text-sm font-medium transition-colors",
                    active
                      ? "border-foreground bg-foreground text-background"
                      : "border-border/70 bg-background/72 text-muted-foreground hover:text-foreground"
                  )}
                >
                  {category.name}
                </Link>
              )
            })}
          </div>
        </section>

        {prompts.length === 0 ? (
          <EmptyState
            icon={<Compass aria-hidden="true" className="h-6 w-6" />}
            title="当前还没有可浏览的公开提示词"
            description={
              searchParams.q || searchParams.category
                ? "当前筛选条件下没有匹配结果，建议切换分类或清空关键词后重试。"
                : "社区内容正在准备中。你可以先创建自己的提示词，或稍后再来查看最新公开模板。"
            }
            actions={
              <>
                <Button asChild>
                  <Link href={session ? "/prompts/new" : "/register"}>{session ? "创建我的提示词" : "注册并开始"}</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/browse">清空筛选</Link>
                </Button>
              </>
            }
            className="surface-panel"
          />
        ) : (
          <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="eyebrow-label">Prompt feed</p>
                <h2 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">社区推荐</h2>
              </div>
              <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/72 px-3 py-2">
                  <Layers3 aria-hidden="true" className="h-4 w-4" />
                  分类筛选已就绪
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/72 px-3 py-2">
                  <Sparkles aria-hidden="true" className="h-4 w-4" />
                  列表支持渐进加载动效
                </span>
              </div>
            </div>
            <VirtualizedPromptGrid prompts={promptCards} viewportLabel="公开提示词列表" />
          </section>
        )}
      </main>
    </div>
  )
}
