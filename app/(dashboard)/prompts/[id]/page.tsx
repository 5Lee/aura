import { getServerSession } from "next-auth"
import { redirect, notFound } from "next/navigation"
import dynamic from "next/dynamic"

import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { resolvePromptPermission } from "@/lib/prompt-permissions"
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

const PromptWorkflowPanel = dynamic(
  () =>
    import("@/components/prompts/prompt-workflow-panel").then(
      (module) => module.PromptWorkflowPanel
    ),
  {
    loading: () => (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">发布状态机</CardTitle>
          <CardDescription>正在加载发布流程...</CardDescription>
        </CardHeader>
      </Card>
    ),
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

const PromptMembersPanel = dynamic(
  () =>
    import("@/components/prompts/prompt-members-panel").then(
      (module) => module.PromptMembersPanel
    ),
  {
    loading: () => (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">协作者权限</CardTitle>
          <CardDescription>正在加载权限面板...</CardDescription>
        </CardHeader>
      </Card>
    ),
  }
)

const PromptCodePanel = dynamic(
  () =>
    import("@/components/prompts/prompt-code-panel").then(
      (module) => module.PromptCodePanel
    ),
  {
    loading: () => (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Prompt-as-Code</CardTitle>
          <CardDescription>正在加载导入导出工具...</CardDescription>
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

const PUBLISH_STATUS_LABELS: Record<string, string> = {
  DRAFT: "草稿",
  IN_REVIEW: "待审核",
  PUBLISHED: "已发布",
  ARCHIVED: "已归档",
}

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

  const permission = await resolvePromptPermission(
    {
      promptId: prompt.id,
      isPublic: prompt.isPublic,
      publishStatus: prompt.publishStatus,
      authorId: prompt.authorId,
    },
    session?.user?.id
  )

  if (!permission.canView) {
    redirect("/prompts")
  }

  const canEdit = permission.canEdit
  const canManageMembers = permission.canManageMembers

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
    <div className="mx-auto max-w-3xl space-y-6">
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
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <CardTitle className="mb-2 text-2xl">{prompt.title}</CardTitle>
              <CardDescription className="text-base">
                {prompt.description || "暂无描述"}
              </CardDescription>
            </div>
            <div className="flex flex-col gap-2 text-right">
              <span
                className={`rounded-full px-3 py-1 text-xs ${
                  prompt.isPublic
                    ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                    : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                }`}
              >
                {prompt.isPublic ? "公开" : "私有"}
              </span>
              <span className="rounded-full bg-blue-100 px-3 py-1 text-xs text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                {PUBLISH_STATUS_LABELS[prompt.publishStatus] || prompt.publishStatus}
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <div className="mb-2 flex items-center justify-between gap-3">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">提示词内容</h3>
              <PromptCopyButton content={prompt.content} />
            </div>
            <div className="whitespace-pre-wrap rounded-lg bg-gray-50 p-4 dark:bg-gray-800">
              {prompt.content}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-blue-100 px-3 py-1 text-xs text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
              {prompt.category.name}
            </span>
            {prompt.tags.map((promptTag) => (
              <span
                key={promptTag.tagId}
                className="rounded-full bg-purple-100 px-3 py-1 text-xs text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"
              >
                {promptTag.tag.name}
              </span>
            ))}
          </div>

          <div className="flex items-center justify-between border-t pt-4 text-sm text-gray-600 dark:text-gray-400">
            <span>作者: {prompt.author?.name || prompt.author?.email || "匿名用户"}</span>
            <span>查看 {prompt.viewCount} 次 · 收藏 {prompt.favoriteCount} 次</span>
          </div>
        </CardContent>
      </Card>

      <PromptWorkflowPanel promptId={prompt.id} canManage={permission.canReview} />
      <PromptVersionPanel promptId={prompt.id} canManage={canEdit} />
      <PromptMembersPanel promptId={prompt.id} canManage={canManageMembers} />
      <PromptCodePanel promptId={prompt.id} canManage={canEdit} />
      <PromptTestCasePanel promptId={prompt.id} canManage={canEdit} />
    </div>
  )
}
