import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import Image from "next/image"
import { COVER_BLUR_DATA_URL, getPromptCoverByCategory } from "@/lib/prompt-cover"

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    redirect("/login")
  }

  // Get user stats
  const [promptCount, favoriteCount] = await Promise.all([
    prisma.prompt.count({
      where: { authorId: session.user.id },
    }),
    prisma.favorite.count({
      where: { userId: session.user.id },
    }),
  ])

  // Get recent prompts
  const recentPrompts = await prisma.prompt.findMany({
    where: { authorId: session.user.id },
    include: { category: true },
    orderBy: { createdAt: "desc" },
    take: 5,
  })

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <Card className="overflow-hidden border border-white/30 bg-white/80 shadow-lg backdrop-blur-sm dark:border-white/10 dark:bg-slate-900/70">
        <div className="relative aspect-[5/2] w-full">
          <Image
            src="/images/prompt-covers/hero-dashboard.svg"
            alt="Prompt dashboard visual"
            fill
            priority
            sizes="(max-width: 768px) 100vw, 960px"
            placeholder="blur"
            blurDataURL={COVER_BLUR_DATA_URL}
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-900/75 via-slate-900/35 to-slate-900/10" />
          <div className="absolute inset-0 flex items-end p-6 sm:p-8">
            <div className="space-y-2 text-white">
              <h1 className="text-2xl font-bold sm:text-3xl">
                欢迎, {session.user.name || session.user.email}!
              </h1>
              <p className="max-w-xl text-sm text-white/85 sm:text-base">
                开始管理你的 AI 提示词，系统会为列表中的图片自动启用懒加载与占位符，提升首次渲染体验。
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* Stats */}
      <div className="grid md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">我的提示词</CardTitle>
            <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{promptCount}</div>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
              已创建的提示词
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">收藏的提示词</CardTitle>
            <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{favoriteCount}</div>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
              收藏的数量
            </p>
          </CardContent>
        </Card>

        <Card className="flex items-center justify-center">
          <CardContent className="p-6">
            <Link href="/prompts/new">
              <Button className="w-full">
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                创建新提示词
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Recent Prompts */}
      <Card>
        <CardHeader>
          <CardTitle>最近创建</CardTitle>
          <CardDescription>你最近创建的提示词</CardDescription>
        </CardHeader>
        <CardContent>
          {recentPrompts.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <p>还没有创建任何提示词</p>
              <Link href="/prompts/new" className="text-blue-600 hover:underline mt-2 inline-block">
                创建第一个提示词
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {recentPrompts.map((prompt) => (
                <Link
                  key={prompt.id}
                  href={`/prompts/${prompt.id}`}
                  className="flex items-start gap-4 rounded-lg border border-gray-200 p-4 transition-colors hover:border-blue-300 dark:border-gray-700 dark:hover:border-blue-600"
                >
                  <div className="relative h-16 w-24 shrink-0 overflow-hidden rounded-md">
                    <Image
                      src={getPromptCoverByCategory(prompt.category.name)}
                      alt={`${prompt.category.name} prompt cover`}
                      fill
                      sizes="96px"
                      placeholder="blur"
                      blurDataURL={COVER_BLUR_DATA_URL}
                      className="object-cover"
                    />
                  </div>
                  <div className="flex flex-1 items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate font-medium">{prompt.title}</h3>
                      <p className="mt-1 line-clamp-1 text-sm text-gray-600 dark:text-gray-400">
                        {prompt.content}
                      </p>
                    </div>
                    <span className="text-xs text-gray-500">
                      {prompt.category.name}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
