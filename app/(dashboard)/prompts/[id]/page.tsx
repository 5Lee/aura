import dynamic from "next/dynamic"
import Link from "next/link"
import { getServerSession } from "next-auth"
import { notFound, redirect } from "next/navigation"
import { CalendarDays, Eye, FileText, Globe, Heart, Lock, PencilLine, UserRound } from "lucide-react"

import {
  PromptCopyButtonLoading,
  PromptDetailActionsLoading,
} from "@/components/prompts/prompt-dynamic-loading"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { resolvePromptPermission } from "@/lib/prompt-permissions"

const PromptCopyButton = dynamic(
  () => import("@/components/prompts/prompt-copy-button").then((module) => module.PromptCopyButton),
  {
    loading: () => <PromptCopyButtonLoading />,
  }
)

const PromptDetailActions = dynamic(
  () => import("@/components/prompts/prompt-detail-actions").then((module) => module.PromptDetailActions),
  {
    loading: () => <PromptDetailActionsLoading />,
  }
)

function PromptPanelLoadingCard({ title, description }: { title: string; description: string }) {
  return (
    <Card className="surface-panel border-0 shadow-none">
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
    </Card>
  )
}

const PromptWorkflowPanel = dynamic(
  () => import("@/components/prompts/prompt-workflow-panel").then((module) => module.PromptWorkflowPanel),
  {
    loading: () => <PromptPanelLoadingCard title="发布状态机" description="正在加载发布流程..." />,
  }
)

const PromptVersionPanel = dynamic(
  () => import("@/components/prompts/prompt-version-panel").then((module) => module.PromptVersionPanel),
  {
    loading: () => <PromptPanelLoadingCard title="版本历史" description="正在加载版本面板..." />,
  }
)

const PromptMembersPanel = dynamic(
  () => import("@/components/prompts/prompt-members-panel").then((module) => module.PromptMembersPanel),
  {
    loading: () => <PromptPanelLoadingCard title="协作者权限" description="正在加载权限面板..." />,
  }
)

const PromptCodePanel = dynamic(
  () => import("@/components/prompts/prompt-code-panel").then((module) => module.PromptCodePanel),
  {
    loading: () => <PromptPanelLoadingCard title="Prompt-as-Code" description="正在加载导入导出工具..." />,
  }
)

const PromptTestCasePanel = dynamic(
  () => import("@/components/prompts/prompt-test-case-panel").then((module) => module.PromptTestCasePanel),
  {
    loading: () => <PromptPanelLoadingCard title="提示词评测用例" description="正在加载评测面板..." />,
  }
)

const PUBLISH_STATUS_META: Record<string, { label: string; className: string }> = {
  DRAFT: {
    label: "草稿",
    className: "border-slate-300/70 bg-slate-100/90 text-slate-700 dark:border-slate-500/30 dark:bg-slate-500/15 dark:text-slate-200",
  },
  IN_REVIEW: {
    label: "待审核",
    className: "border-amber-300/70 bg-amber-100/90 text-amber-700 dark:border-amber-400/30 dark:bg-amber-500/15 dark:text-amber-200",
  },
  PUBLISHED: {
    label: "已发布",
    className: "border-emerald-300/70 bg-emerald-100/90 text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-500/15 dark:text-emerald-200",
  },
  ARCHIVED: {
    label: "已归档",
    className: "border-purple-300/70 bg-purple-100/90 text-purple-700 dark:border-purple-400/30 dark:bg-purple-500/15 dark:text-purple-200",
  },
}

function getVisibilityMeta(isPublic: boolean) {
  return isPublic
    ? {
        label: "公开",
        icon: Globe,
        className: "border-emerald-300/70 bg-emerald-100/90 text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-500/15 dark:text-emerald-200",
      }
    : {
        label: "私有",
        icon: Lock,
        className: "border-slate-300/70 bg-slate-100/90 text-slate-700 dark:border-slate-500/30 dark:bg-slate-500/15 dark:text-slate-200",
      }
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

  const publishStatusMeta =
    PUBLISH_STATUS_META[prompt.publishStatus] || PUBLISH_STATUS_META.DRAFT
  const visibilityMeta = getVisibilityMeta(prompt.isPublic)
  const VisibilityIcon = visibilityMeta.icon
  const authorLabel = prompt.author?.name || prompt.author?.email || "匿名用户"
  const mobileQuickFacts = [
    { label: "分类", value: prompt.category.name },
    { label: "作者", value: authorLabel },
    { label: "更新", value: prompt.updatedAt.toLocaleDateString("zh-CN") },
    { label: "浏览", value: `${prompt.viewCount}` },
  ]

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 sm:space-y-8">
      <section className="surface-panel-strong relative overflow-hidden p-5 sm:p-8">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.16),transparent_38%),radial-gradient(circle_at_bottom_right,hsl(var(--accent)/0.14),transparent_28%)]"
        />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-4 sm:space-y-5">
            <Link href="/prompts" className="hidden sm:inline-flex">
              <Button variant="ghost" className="rounded-full px-4 text-muted-foreground hover:text-foreground">
                ← 返回列表
              </Button>
            </Link>

            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <p className="eyebrow-label">Prompt detail</p>
                <Badge variant="outline" className={publishStatusMeta.className}>
                  {publishStatusMeta.label}
                </Badge>
                <Badge variant="outline" className={visibilityMeta.className}>
                  <VisibilityIcon aria-hidden="true" className="mr-1 h-3.5 w-3.5" />
                  {visibilityMeta.label}
                </Badge>
              </div>
              <div className="space-y-2">
                <h1 className="max-w-3xl text-2xl font-semibold tracking-tight text-foreground sm:text-4xl">
                  {prompt.title}
                </h1>
                <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
                  {prompt.description || "当前提示词暂无描述，你可以继续编辑补充背景、用途和适用场景。"}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:hidden">
              {mobileQuickFacts.map((item) => (
                <div
                  key={item.label}
                  className="rounded-[1.2rem] border border-border/70 bg-background/78 px-4 py-3 shadow-card backdrop-blur-sm"
                >
                  <p className="eyebrow-label">{item.label}</p>
                  <p className="mt-2 text-sm font-semibold text-foreground">{item.value}</p>
                </div>
              ))}
            </div>

            <div className="hidden flex-wrap gap-2 text-sm text-muted-foreground sm:flex">
              <span className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/72 px-3 py-2">
                <FileText aria-hidden="true" className="h-4 w-4" />
                {prompt.category.name}
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/72 px-3 py-2">
                <UserRound aria-hidden="true" className="h-4 w-4" />
                {authorLabel}
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/72 px-3 py-2">
                <Eye aria-hidden="true" className="h-4 w-4" />
                浏览 {prompt.viewCount}
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/72 px-3 py-2">
                <Heart aria-hidden="true" className="h-4 w-4" />
                收藏 {prompt.favoriteCount}
              </span>
            </div>
          </div>

          <div className="shrink-0 lg:min-w-[18rem] lg:max-w-[18rem]">
            <div className="space-y-2">
              <PromptCopyButton content={prompt.content} className="w-full justify-center" />
              <PromptDetailActions
                promptId={prompt.id}
                canEdit={canEdit}
                isAuthenticated={Boolean(session?.user)}
                isFavorited={isFavorited}
                favoriteCount={prompt.favoriteCount}
              />
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)]">
        <Card className="surface-panel border-0 shadow-none">
          <CardHeader className="pb-4">
            <div>
              <p className="eyebrow-label">Prompt content</p>
              <CardTitle className="mt-1 text-2xl">提示词内容</CardTitle>
              <CardDescription>复制、复用或继续基于当前内容做编辑迭代。</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-[1.5rem] border border-border/70 bg-background/70 p-5 text-sm leading-7 text-foreground sm:p-6 sm:text-[15px]">
              <div className="whitespace-pre-wrap break-words">{prompt.content}</div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="surface-panel border-0 shadow-none">
            <CardHeader className="pb-4">
              <p className="eyebrow-label">Overview</p>
              <CardTitle className="mt-1 text-2xl">资产信息</CardTitle>
              <CardDescription>快速查看当前提示词的分享状态、时间信息和主题标签。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                <div className="rounded-[1.3rem] border border-border/70 bg-background/70 p-4">
                  <p className="eyebrow-label">Visibility</p>
                  <p className="mt-3 text-lg font-semibold text-foreground">{visibilityMeta.label}</p>
                  <p className="mt-1 text-sm text-muted-foreground">决定其他用户是否可查看该提示词。</p>
                </div>
                <div className="rounded-[1.3rem] border border-border/70 bg-background/70 p-4">
                  <p className="eyebrow-label">Publish status</p>
                  <p className="mt-3 text-lg font-semibold text-foreground">{publishStatusMeta.label}</p>
                  <p className="mt-1 text-sm text-muted-foreground">状态机会影响提审、发布和归档操作。</p>
                </div>
              </div>

              <div className="space-y-3 rounded-[1.3rem] border border-border/70 bg-background/70 p-4 text-sm text-muted-foreground">
                <div className="flex items-center justify-between gap-3">
                  <span className="inline-flex items-center gap-2">
                    <CalendarDays aria-hidden="true" className="h-4 w-4" />
                    创建时间
                  </span>
                  <span>{prompt.createdAt.toLocaleDateString("zh-CN")}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="inline-flex items-center gap-2">
                    <PencilLine aria-hidden="true" className="h-4 w-4" />
                    最后更新
                  </span>
                  <span>{prompt.updatedAt.toLocaleDateString("zh-CN")}</span>
                </div>
              </div>

              <div>
                <p className="mb-3 text-sm font-medium text-foreground">主题标签</p>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className="border-primary/20 bg-primary/10 text-primary">
                    {prompt.category.name}
                  </Badge>
                  {prompt.tags.length > 0 ? (
                    prompt.tags.map((promptTag) => (
                      <Badge
                        key={promptTag.tagId}
                        variant="outline"
                        className="border-border/70 bg-background/72 text-foreground"
                      >
                        #{promptTag.tag.name}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-sm text-muted-foreground">暂无标签</span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid gap-6 content-auto xl:grid-cols-2">
        <PromptWorkflowPanel promptId={prompt.id} canManage={permission.canReview} />
        <PromptVersionPanel promptId={prompt.id} canManage={canEdit} />
      </div>

      <div className="grid gap-6 content-auto xl:grid-cols-2">
        <PromptMembersPanel promptId={prompt.id} canManage={canManageMembers} />
        <PromptCodePanel promptId={prompt.id} canManage={canEdit} />
      </div>

      <div className="content-auto">
        <PromptTestCasePanel promptId={prompt.id} canManage={canEdit} />
      </div>
    </div>
  )
}
