import { getServerSession } from "next-auth"
import { redirect, notFound } from "next/navigation"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"

export default async function PromptDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const session = await getServerSession(authOptions)
  const prompt = await prisma.prompt.findUnique({
    where: { id: params.id },
    include: {
      category: true,
      tags: true,
      author: {
        select: { id: true, name: true, email: true },
      },
    },
  })

  if (!prompt) {
    notFound()
  }

  // Check access permission
  const isOwner = session?.user?.id === prompt.authorId
  if (!prompt.isPublic && !isOwner) {
    redirect("/prompts")
  }

  const canEdit = isOwner

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <Link href="/prompts">
          <Button variant="ghost">← 返回列表</Button>
        </Link>
        {canEdit && (
          <div className="flex gap-2">
            <Link href={`/prompts/${prompt.id}/edit`}>
              <Button variant="outline">编辑</Button>
            </Link>
            <Button
              variant="destructive"
              onClick={async () => {
                if (confirm("确定要删除这个提示词吗？")) {
                  await fetch(`/api/prompts/${prompt.id}`, {
                    method: "DELETE",
                  })
                  redirect("/prompts")
                }
              }}
            >
              删除
            </Button>
          </div>
        )}
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle className="text-2xl mb-2">{prompt.title}</CardTitle>
              <CardDescription className="text-base">
                {prompt.description || "暂无描述"}
              </CardDescription>
            </div>
            <span className={`text-xs px-3 py-1 rounded-full ${
              prompt.isPublic
                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
            }`}>
              {prompt.isPublic ? "公开" : "私有"}
            </span>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              提示词内容
            </h3>
            <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg whitespace-pre-wrap">
              {prompt.content}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <span className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 px-3 py-1 rounded-full">
              {prompt.category.name}
            </span>
            {prompt.tags.map((tag) => (
              <span
                key={tag.id}
                className="text-xs bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 px-3 py-1 rounded-full"
              >
                {tag.name}
              </span>
            ))}
          </div>

          <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400 pt-4 border-t">
            <span>
              作者: {prompt.author.name || prompt.author.email}
            </span>
            <span>
              查看 {prompt.viewCount} 次 · 收藏 {prompt.favoriteCount} 次
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
