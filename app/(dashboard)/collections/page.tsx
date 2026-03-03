import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { Heart } from "lucide-react"

import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { VirtualizedPromptGrid } from "@/components/prompts/virtualized-prompt-grid"
import Link from "next/link"

export default async function CollectionsPage() {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    redirect("/login")
  }

  // Get user's favorites
  const favorites = await prisma.favorite.findMany({
    where: { userId: session.user.id },
    include: {
      prompt: {
        include: {
          category: true,
          tags: { include: { tag: true } },
          author: {
            select: { name: true, email: true },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  })

  const promptCards = favorites.map((favorite) => ({
    id: favorite.id,
    href: `/prompts/${favorite.promptId}`,
    title: favorite.prompt.title,
    description: favorite.prompt.description || favorite.prompt.content,
    category: favorite.prompt.category.name,
    author: favorite.prompt.author?.name || favorite.prompt.author?.email || "匿名用户",
    tags: favorite.prompt.tags.map((promptTag) => promptTag.tag.name),
    updatedAt: favorite.prompt.updatedAt.toLocaleDateString("zh-CN"),
    metrics: [
      { kind: "favorites" as const, value: favorite.prompt.favoriteCount },
      { kind: "views" as const, value: favorite.prompt.viewCount },
    ],
  }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">我的收藏</h1>
        <p className="text-muted-foreground">
          收藏的提示词
        </p>
      </div>

      {favorites.length === 0 ? (
        <EmptyState
          icon={<Heart aria-hidden="true" className="h-6 w-6" />}
          title="还没有收藏的提示词"
          description="去公开社区逛一逛，收藏常用提示词后，就可以在这里快速回看。"
          actions={
            <>
              <Button asChild>
                <Link href="/browse">浏览公开提示词</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/prompts">管理我的提示词</Link>
              </Button>
            </>
          }
        />
      ) : (
        <VirtualizedPromptGrid prompts={promptCards} viewportLabel="收藏提示词列表" />
      )}
    </div>
  )
}
