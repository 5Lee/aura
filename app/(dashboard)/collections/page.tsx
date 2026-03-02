import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
          author: {
            select: { name: true, email: true },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">我的收藏</h1>
        <p className="text-gray-600 dark:text-gray-400">
          收藏的提示词
        </p>
      </div>

      {favorites.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <svg className="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
            <h3 className="text-lg font-medium mb-2">还没有收藏</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              浏览提示词并收藏你喜欢的
            </p>
            <Link href="/prompts">
              <Button>浏览提示词</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {favorites.map((favorite) => (
            <Link key={favorite.id} href={`/prompts/${favorite.promptId}`}>
              <Card className="h-full hover:shadow-lg transition-shadow cursor-pointer">
                <CardHeader>
                  <CardTitle className="text-lg line-clamp-1">
                    {favorite.prompt.title}
                  </CardTitle>
                  <CardDescription className="line-clamp-2">
                    {favorite.prompt.description || favorite.prompt.content}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-blue-600 dark:text-blue-400">
                      {favorite.prompt.category.name}
                    </span>
                    <span className="text-gray-600 dark:text-gray-400">
                      {favorite.prompt.author.name || favorite.prompt.author.email}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
