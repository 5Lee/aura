import { prisma } from "@/lib/db"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"

export default async function BrowsePromptsPage() {
  // Get public prompts
  const prompts = await prisma.prompt.findMany({
    where: { isPublic: true },
    include: {
      category: true,
      tags: true,
      author: {
        select: { id: true, name: true, email: true },
      },
    },
    orderBy: { updatedAt: "desc" },
    take: 20,
  })

  // Get categories
  const categories = await prisma.category.findMany({
    orderBy: { order: "asc" },
  })

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Header */}
      <header className="border-b bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Aura
          </Link>
          <nav className="flex gap-4">
            <Link
              href="/login"
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white transition-colors"
            >
              登录
            </Link>
            <Link
              href="/register"
              className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              注册
            </Link>
          </nav>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">浏览提示词</h1>
          <p className="text-gray-600 dark:text-gray-400">
            发现社区分享的优质 AI 提示词
          </p>
        </div>

        {/* Categories */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-4">分类</h2>
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => (
              <Link key={cat.id} href={`/prompts?category=${cat.id}`}>
                <Button variant="outline" size="sm">
                  {cat.name}
                </Button>
              </Link>
            ))}
          </div>
        </div>

        {/* Prompts Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
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
                  <div className="flex flex-wrap gap-2 mb-4">
                    <Badge variant="secondary">{prompt.category.name}</Badge>
                    {prompt.tags.slice(0, 2).map((tag) => (
                      <Badge key={tag.id} variant="outline">
                        {tag.name}
                      </Badge>
                    ))}
                  </div>
                  <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
                    <span>
                      {prompt.author.name || prompt.author.email}
                    </span>
                    <span>
                      {prompt.viewCount} 次查看
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        {prompts.length === 0 && (
          <Card>
            <CardContent className="text-center py-12">
              <p className="text-gray-600 dark:text-gray-400">
                还没有公开的提示词
              </p>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  )
}
