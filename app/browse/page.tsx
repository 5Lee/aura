import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { BrowseNavbar } from "@/components/layout/browse-navbar"
import { SearchBox } from "@/components/search/search-box"

export default async function BrowsePage({
  searchParams,
}: {
  searchParams: { category?: string; q?: string }
}) {
  const session = await getServerSession(authOptions)

  const categories = await prisma.category.findMany({
    orderBy: { order: "asc" },
  })

  const where: any = { isPublic: true }
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

  const prompts = await prisma.prompt.findMany({
    where,
    include: {
      category: true,
      tags: true,
      author: {
        select: { name: true, email: true },
      },
    },
    orderBy: { updatedAt: "desc" },
  })

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <BrowseNavbar session={session} />

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">浏览公开提示词</h1>
          <p className="text-gray-600 dark:text-gray-400">
            发现社区分享的优质 AI 提示词
          </p>
        </div>

        {/* Search */}
        <div className="mb-6">
          <SearchBox />
        </div>

        {/* Category Filter */}
        <div className="mb-8 flex flex-wrap gap-2">
          <Link href={searchParams.q ? `/browse?q=${searchParams.q}` : "/browse"}>
            <Button
              variant={!searchParams.category ? "default" : "outline"}
              size="sm"
            >
              全部
            </Button>
          </Link>
          {categories.map((cat) => {
            const href = searchParams.q
              ? `/browse?category=${cat.id}&q=${encodeURIComponent(searchParams.q)}`
              : `/browse?category=${cat.id}`
            return (
              <Link key={cat.id} href={href}>
                <Button
                  variant={searchParams.category === cat.id ? "default" : "outline"}
                  size="sm"
                >
                  {cat.name}
                </Button>
              </Link>
            )
          })}
        </div>

        {searchParams.q && (
          <div className="mb-6">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              搜索结果: <strong>"{searchParams.q}"</strong> ({prompts.length} 个结果)
            </p>
          </div>
        )}

        {prompts.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <svg className="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h3 className="text-lg font-medium mb-2">没有找到提示词</h3>
              <p className="text-gray-600 dark:text-gray-400">
                {searchParams.q
                  ? `没有找到包含 "${searchParams.q}" 的提示词`
                  : "该分类下还没有公开的提示词"}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {prompts.map((prompt) => (
              <Link key={prompt.id} href={`/prompts/${prompt.id}`}>
                <Card className="h-full hover:shadow-lg transition-shadow cursor-pointer">
                  <CardHeader>
                    <CardTitle className="text-lg line-clamp-1">{prompt.title}</CardTitle>
                    <CardDescription className="line-clamp-2">
                      {prompt.description || prompt.content}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 px-2 py-1 rounded">
                        {prompt.category.name}
                      </span>
                      <span className="text-gray-600 dark:text-gray-400">
                        {prompt.author.name || prompt.author.email}
                      </span>
                    </div>
                    <div className="mt-4 flex items-center justify-between text-xs text-gray-500">
                      <span>❤️ {prompt.favoriteCount}</span>
                      <span>👁️ {prompt.viewCount}</span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
