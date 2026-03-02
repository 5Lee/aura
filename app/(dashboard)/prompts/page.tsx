import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"

export default async function PromptsPage() {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    redirect("/login")
  }

  // Get user's prompts
  const prompts = await prisma.prompt.findMany({
    where: { authorId: session.user.id },
    include: { category: true, tags: true },
    orderBy: { updatedAt: "desc" },
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">我的提示词</h1>
          <p className="text-gray-600 dark:text-gray-400">
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

      {prompts.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <svg className="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="text-lg font-medium mb-2">还没有提示词</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              开始创建你的第一个 AI 提示词
            </p>
            <Link href="/prompts/new">
              <Button>创建提示词</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {prompts.map((prompt) => (
            <Link key={prompt.id} href={`/prompts/${prompt.id}`}>
              <Card className="h-full hover:shadow-lg transition-shadow cursor-pointer">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-lg line-clamp-1">{prompt.title}</CardTitle>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      prompt.isPublic
                        ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                        : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                    }`}>
                      {prompt.isPublic ? "公开" : "私有"}
                    </span>
                  </div>
                  <CardDescription className="line-clamp-2">
                    {prompt.description || prompt.content}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
                    <span className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 px-2 py-1 rounded">
                      {prompt.category.name}
                    </span>
                    <span className="text-xs">
                      {prompt.tags.map((tag) => tag.name).join(", ")}
                    </span>
                  </div>
                  <div className="mt-4 text-xs text-gray-500">
                    {prompt.updatedAt.toLocaleDateString("zh-CN")}
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
