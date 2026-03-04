import { getServerSession } from "next-auth"
import { redirect, notFound } from "next/navigation"
import dynamic from "next/dynamic"

import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  PromptCopyButtonLoading,
  PromptDetailActionsLoading,
} from "@/components/prompts/prompt-dynamic-loading"
import Link from "next/link"

const PromptCopyButton = dynamic(
  () =>
    import("@/components/prompts/prompt-copy-button").then((module) => module.PromptCopyButton),
  {
    loading: () => <PromptCopyButtonLoading />,
  }
)

const PromptDetailActions = dynamic(
  () =>
    import("@/components/prompts/prompt-detail-actions").then(
      (module) => module.PromptDetailActions
    ),
  {
    loading: () => <PromptDetailActionsLoading />,
  }
)

const PromptVersionPanel = dynamic(
  () =>
    import("@/components/prompts/prompt-version-panel").then(
      (module) => module.PromptVersionPanel
    ),
  {
    loading: () => (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">版本历史</CardTitle>
          <CardDescription>正在加载版本面板...</CardDescription>
        </CardHeader>
      </Card>
    ),
  }
)

const PromptTestCasePanel = dynamic(
  () =>
    import("@/components/prompts/prompt-test-case-panel").then(
      (module) => module.PromptTestCasePanel
    ),
  {
    loading: () => (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">提示词评测用例</CardTitle>
          <CardDescription>正在加载评测面板...</CardDescription>
        </CardHeader>
      </Card>
    ),
  }
)

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
      tags: {
        include: {
          tag: true,
        },
      },
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

  // Check if user has favorited this prompt
  let isFavorited = false
  if (session?.user) {
    const favorite = await prisma.favorite.findUnique({
      where: {
        userId_promptId: {
          userId: session.user.id,
          promptId: prompt.id,
        },
      },
    })
    isFavorited = !!favorite
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <Link href="/prompts">
          <Button variant="ghost">← 返回列表</Button>
        </Link>
        <PromptDetailActions
          promptId={prompt.id}
          canEdit={canEdit}
          isFavorited={isFavorited}
          favoriteCount={prompt.favoriteCount}
        />
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
            <div className="mb-2 flex items-center justify-between gap-3">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                提示词内容
              </h3>
              <PromptCopyButton content={prompt.content} />
            </div>
            <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg whitespace-pre-wrap">
              {prompt.content}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <span className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 px-3 py-1 rounded-full">
              {prompt.category.name}
            </span>
            {prompt.tags.map((promptTag) => (
              <span
                key={promptTag.tagId}
                className="text-xs bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 px-3 py-1 rounded-full"
              >
                {promptTag.tag.name}
              </span>
            ))}
          </div>

          <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400 pt-4 border-t">
            <span>
              作者: {prompt.author?.name || prompt.author?.email || "匿名用户"}
            </span>
            <span>
              查看 {prompt.viewCount} 次 · 收藏 {prompt.favoriteCount} 次
            </span>
          </div>
        </CardContent>
      </Card>

      <PromptVersionPanel promptId={prompt.id} canManage={canEdit} />
      <PromptTestCasePanel promptId={prompt.id} canManage={canEdit} />
    </div>
  )
}
