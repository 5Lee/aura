import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import Image from "next/image"
import { getAdvancedAnalyticsDashboard } from "@/lib/advanced-analytics"
import { COVER_BLUR_DATA_URL, getPromptCoverByCategory } from "@/lib/prompt-cover"
import { getPromptQualityDashboard } from "@/lib/prompt-evals"
import { getUserEntitlementSnapshot, hasAdvancedAnalyticsAccess } from "@/lib/subscription-entitlements"

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    redirect("/login")
  }

  // Get user stats
  const [promptCount, favoriteCount, qualityDashboard, entitlementSnapshot] = await Promise.all([
    prisma.prompt.count({
      where: { authorId: session.user.id },
    }),
    prisma.favorite.count({
      where: { userId: session.user.id },
    }),
    getPromptQualityDashboard(session.user.id),
    getUserEntitlementSnapshot(session.user.id),
  ])

  const hasAdvancedAccess = hasAdvancedAnalyticsAccess(entitlementSnapshot.plan.id)
  const advancedAnalytics = hasAdvancedAccess
    ? await getAdvancedAnalyticsDashboard(session.user.id)
    : null

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

      <Card>
        <CardHeader>
          <CardTitle>高级分析看板</CardTitle>
          <CardDescription>包含转化漏斗、版本质量趋势与使用留存指标（Pro / Team）。</CardDescription>
        </CardHeader>
        <CardContent>
          {!advancedAnalytics ? (
            <div className="rounded-lg border border-border bg-muted/20 p-4">
              <p className="text-sm font-medium text-foreground">当前套餐：{entitlementSnapshot.plan.name}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                高级分析仅对 Pro / Team 套餐开放，升级后可查看转化漏斗、版本质量趋势和留存指标。
              </p>
              <div className="mt-3">
                <Button asChild size="sm">
                  <Link href="/pricing">升级查看高级分析</Link>
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-4">
                <div className="rounded-lg border border-border bg-muted/20 p-3">
                  <p className="text-xs text-muted-foreground">模板覆盖率</p>
                  <p className="mt-1 text-2xl font-semibold">{advancedAnalytics.conversionFunnel.ratios.templateCoverage}%</p>
                </div>
                <div className="rounded-lg border border-border bg-muted/20 p-3">
                  <p className="text-xs text-muted-foreground">测试覆盖率</p>
                  <p className="mt-1 text-2xl font-semibold">{advancedAnalytics.conversionFunnel.ratios.testCoverage}%</p>
                </div>
                <div className="rounded-lg border border-border bg-muted/20 p-3">
                  <p className="text-xs text-muted-foreground">评测覆盖率</p>
                  <p className="mt-1 text-2xl font-semibold">{advancedAnalytics.conversionFunnel.ratios.evaluationCoverage}%</p>
                </div>
                <div className="rounded-lg border border-border bg-muted/20 p-3">
                  <p className="text-xs text-muted-foreground">发布覆盖率</p>
                  <p className="mt-1 text-2xl font-semibold">{advancedAnalytics.conversionFunnel.ratios.publishCoverage}%</p>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-lg border border-border bg-background p-3">
                  <p className="text-sm font-medium">版本质量趋势（8 周）</p>
                  <div className="mt-2 space-y-2 text-sm">
                    {advancedAnalytics.versionQualityTrend.map((item) => (
                      <div key={item.weekStart} className="flex items-center justify-between gap-3">
                        <span className="text-muted-foreground">{item.weekStart}</span>
                        <span className="text-muted-foreground">
                          通过率 {item.avgPassRate}% · 评测 {item.evalRuns} · 版本变更 {item.versionChanges}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-lg border border-border bg-background p-3">
                  <p className="text-sm font-medium">使用留存指标</p>
                  <div className="mt-2 space-y-2 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <span>7 日活跃天数</span>
                      <span className="text-muted-foreground">{advancedAnalytics.retention.activeDays7} 天</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>30 日活跃天数</span>
                      <span className="text-muted-foreground">{advancedAnalytics.retention.activeDays30} 天</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>7 日留存率</span>
                      <span className="text-muted-foreground">{advancedAnalytics.retention.retentionRate7}%</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>30 日留存率</span>
                      <span className="text-muted-foreground">{advancedAnalytics.retention.retentionRate30}%</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>连续活跃天数</span>
                      <span className="text-muted-foreground">{advancedAnalytics.retention.currentStreak} 天</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>提示词质量看板</CardTitle>
          <CardDescription>按项目、作者与分类观察评测通过率、失败类型与回滚风险。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 md:grid-cols-4">
            <div className="rounded-lg border border-border bg-muted/20 p-3">
              <p className="text-xs text-muted-foreground">近期待测批次</p>
              <p className="mt-1 text-2xl font-semibold">{qualityDashboard.overview.totalRuns}</p>
            </div>
            <div className="rounded-lg border border-border bg-muted/20 p-3">
              <p className="text-xs text-muted-foreground">平均通过率</p>
              <p className="mt-1 text-2xl font-semibold">{qualityDashboard.overview.averagePassRate}%</p>
            </div>
            <div className="rounded-lg border border-border bg-muted/20 p-3">
              <p className="text-xs text-muted-foreground">失败断言</p>
              <p className="mt-1 text-2xl font-semibold">{qualityDashboard.overview.failedAssertions}</p>
            </div>
            <div className="rounded-lg border border-border bg-muted/20 p-3">
              <p className="text-xs text-muted-foreground">回滚频次</p>
              <p className="mt-1 text-2xl font-semibold">{qualityDashboard.overview.rollbackCount}</p>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-lg border border-border bg-background p-3">
              <p className="text-sm font-medium">分类质量对比</p>
              {qualityDashboard.categoryComparison.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">暂无分类评测数据</p>
              ) : (
                <div className="mt-2 space-y-2 text-sm">
                  {qualityDashboard.categoryComparison.slice(0, 6).map((item) => (
                    <div key={item.categoryId} className="flex items-center justify-between gap-3">
                      <span className="truncate">{item.category}</span>
                      <span className="text-muted-foreground">{item.passRate}% · {item.count} 次</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-lg border border-border bg-background p-3">
              <p className="text-sm font-medium">失败类型分布</p>
              {qualityDashboard.failureTypeDistribution.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">暂无失败断言</p>
              ) : (
                <div className="mt-2 space-y-2 text-sm">
                  {qualityDashboard.failureTypeDistribution.map((item) => (
                    <div key={item.type} className="flex items-center justify-between gap-3">
                      <span>{item.type}</span>
                      <span className="text-muted-foreground">{item.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-border bg-background p-3">
            <p className="text-sm font-medium">高风险提示词</p>
            {qualityDashboard.highRiskPrompts.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">暂无高风险提示词</p>
            ) : (
              <div className="mt-2 space-y-2 text-sm">
                {qualityDashboard.highRiskPrompts.map((item) => (
                  <Link
                    key={item.promptId}
                    href={`/prompts/${item.promptId}`}
                    className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2 hover:border-primary/40"
                  >
                    <span className="truncate">{item.title}</span>
                    <span className="text-xs text-muted-foreground">
                      通过率 {item.passRate}% · 回滚 {item.rollbackCount}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
