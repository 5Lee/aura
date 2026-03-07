import Image from "next/image"
import Link from "next/link"
import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { ArrowRight, BarChart3, Heart, Plus, Sparkles } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { authOptions } from "@/lib/auth"
import { getAdvancedAnalyticsDashboard } from "@/lib/advanced-analytics"
import { prisma } from "@/lib/db"
import { getPromptQualityDashboard } from "@/lib/prompt-evals"
import { COVER_BLUR_DATA_URL, getPromptCoverByCategory } from "@/lib/prompt-cover"
import { getUserEntitlementSnapshot, hasAdvancedAnalyticsAccess } from "@/lib/subscription-entitlements"

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    redirect("/login")
  }

  const [promptCount, favoriteCount, qualityDashboard, entitlementSnapshot, recentPrompts] = await Promise.all([
    prisma.prompt.count({
      where: { authorId: session.user.id },
    }),
    prisma.favorite.count({
      where: { userId: session.user.id },
    }),
    getPromptQualityDashboard(session.user.id),
    getUserEntitlementSnapshot(session.user.id),
    prisma.prompt.findMany({
      where: { authorId: session.user.id },
      include: { category: true },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ])

  const hasAdvancedAccess = hasAdvancedAnalyticsAccess(entitlementSnapshot.plan.id)
  const advancedAnalytics = hasAdvancedAccess ? await getAdvancedAnalyticsDashboard(session.user.id) : null
  const userLabel = session.user.name || session.user.email || "Aura 用户"

  return (
    <div className="space-y-6 sm:space-y-8">
      <section className="surface-panel-strong relative overflow-hidden p-6 sm:p-8">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.18),transparent_36%),radial-gradient(circle_at_bottom_right,hsl(var(--accent)/0.16),transparent_28%)]"
        />
        <div className="relative grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(18rem,0.7fr)] lg:items-end">
          <div className="space-y-5">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="eyebrow-label">Workspace overview</span>
                <span className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/72 px-3 py-1.5 text-xs text-muted-foreground">
                  当前套餐：{entitlementSnapshot.plan.name}
                </span>
              </div>
              <div className="space-y-3">
                <h1 className="max-w-3xl text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                  欢迎回来，{userLabel}。今天从整理提示词库开始，把常用资产更快地拿到手边。
                </h1>
                <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
                  仪表板聚合最近创建、质量状态和套餐能力，减少在多个页面之间反复跳转。
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button asChild className="rounded-full px-5 shadow-primary">
                <Link href="/prompts/new">
                  <Plus aria-hidden="true" className="mr-2 h-4 w-4" />
                  创建新提示词
                </Link>
              </Button>
              <Button asChild variant="outline" className="rounded-full border-border/70 bg-background/72 px-5">
                <Link href="/prompts">
                  查看提示词库
                  <ArrowRight aria-hidden="true" className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            <div className="rounded-[1.5rem] border border-border/70 bg-background/84 p-4 shadow-card backdrop-blur-sm">
              <p className="eyebrow-label">Prompt assets</p>
              <p className="mt-3 text-3xl font-semibold text-foreground">{promptCount}</p>
              <p className="mt-1 text-sm text-muted-foreground">可管理提示词总量</p>
            </div>
            <div className="rounded-[1.5rem] border border-border/70 bg-background/84 p-4 shadow-card backdrop-blur-sm">
              <p className="eyebrow-label">Favorites</p>
              <p className="mt-3 text-3xl font-semibold text-foreground">{favoriteCount}</p>
              <p className="mt-1 text-sm text-muted-foreground">已收藏灵感与参考模板</p>
            </div>
            <div className="rounded-[1.5rem] border border-border/70 bg-background/84 p-4 shadow-card backdrop-blur-sm">
              <p className="eyebrow-label">Quality</p>
              <p className="mt-3 text-3xl font-semibold text-foreground">{qualityDashboard.overview.averagePassRate}%</p>
              <p className="mt-1 text-sm text-muted-foreground">最近评测平均通过率</p>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(20rem,0.9fr)]">
        <Card className="surface-panel overflow-hidden border-0 shadow-none">
          <CardHeader className="pb-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="eyebrow-label">Recent prompts</p>
                <CardTitle className="mt-1 text-2xl">最近创建</CardTitle>
                <CardDescription>你最近创建的提示词，方便继续编辑或复用。</CardDescription>
              </div>
              <Button asChild variant="ghost" size="sm" className="rounded-full">
                <Link href="/prompts">查看全部</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {recentPrompts.length === 0 ? (
              <div className="rounded-[1.4rem] border border-dashed border-border/70 bg-background/60 p-8 text-center">
                <p className="text-sm text-muted-foreground">还没有创建任何提示词</p>
                <Button asChild className="mt-4 rounded-full shadow-primary">
                  <Link href="/prompts/new">创建第一个提示词</Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {recentPrompts.map((prompt, index) => (
                  <Link
                    key={prompt.id}
                    href={`/prompts/${prompt.id}`}
                    className="group flex items-start gap-4 rounded-[1.4rem] border border-border/70 bg-background/70 p-3 transition-[transform,border-color,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-card-hover motion-reduce:transform-none"
                  >
                    <div className="relative h-20 w-28 shrink-0 overflow-hidden rounded-[1rem]">
                      <Image
                        src={getPromptCoverByCategory(prompt.category.name)}
                        alt={`${prompt.category.name} prompt cover`}
                        fill
                        sizes="112px"
                        placeholder="blur"
                        blurDataURL={COVER_BLUR_DATA_URL}
                        className="object-cover"
                        priority={index === 0}
                      />
                    </div>
                    <div className="flex min-w-0 flex-1 items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="eyebrow-label">{prompt.category.name}</p>
                        <h3 className="mt-1 truncate text-base font-semibold text-foreground">{prompt.title}</h3>
                        <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">{prompt.description || prompt.content}</p>
                      </div>
                      <span className="hidden rounded-full border border-border/70 bg-background/70 px-3 py-1 text-xs text-muted-foreground sm:inline-flex">
                        继续编辑
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="surface-panel border-0 shadow-none content-auto">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
                <BarChart3 aria-hidden="true" className="h-5 w-5" />
              </span>
              <div>
                <p className="eyebrow-label">Plan insights</p>
                <CardTitle className="mt-1 text-2xl">高级分析看板</CardTitle>
              </div>
            </div>
            <CardDescription>转化漏斗、质量趋势和留存指标会随套餐能力逐步开放。</CardDescription>
          </CardHeader>
          <CardContent>
            {!advancedAnalytics ? (
              <div className="rounded-[1.4rem] border border-border/70 bg-background/68 p-4">
                <p className="text-sm font-medium text-foreground">当前套餐：{entitlementSnapshot.plan.name}</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  高级分析仅对 Pro / Team 套餐开放，升级后可以查看转化漏斗、版本质量趋势和使用留存指标。
                </p>
                <Button asChild size="sm" className="mt-4 rounded-full shadow-primary">
                  <Link href="/pricing">升级查看高级分析</Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-[1.3rem] border border-border/70 bg-background/68 p-4">
                    <p className="eyebrow-label">Template coverage</p>
                    <p className="mt-3 text-2xl font-semibold text-foreground">{advancedAnalytics.conversionFunnel.ratios.templateCoverage}%</p>
                  </div>
                  <div className="rounded-[1.3rem] border border-border/70 bg-background/68 p-4">
                    <p className="eyebrow-label">Publish coverage</p>
                    <p className="mt-3 text-2xl font-semibold text-foreground">{advancedAnalytics.conversionFunnel.ratios.publishCoverage}%</p>
                  </div>
                </div>

                <div className="rounded-[1.3rem] border border-border/70 bg-background/68 p-4">
                  <p className="text-sm font-medium text-foreground">版本质量趋势（8 周）</p>
                  <div className="mt-3 space-y-3 text-sm">
                    {advancedAnalytics.versionQualityTrend.map((item) => (
                      <div key={item.weekStart} className="flex items-center justify-between gap-3">
                        <span className="text-muted-foreground">{item.weekStart}</span>
                        <span className="text-muted-foreground">通过率 {item.avgPassRate}% · 评测 {item.evalRuns}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="surface-panel border-0 shadow-none content-auto">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="eyebrow-label">Quality board</p>
              <CardTitle className="mt-1 text-2xl">提示词质量看板</CardTitle>
              <CardDescription>按项目、作者与分类观察评测通过率、失败类型与回滚风险。</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/72 px-3 py-2">
                <Sparkles aria-hidden="true" className="h-4 w-4" />
                最近评测 {qualityDashboard.overview.totalRuns} 次
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/72 px-3 py-2">
                <Heart aria-hidden="true" className="h-4 w-4" />
                回滚 {qualityDashboard.overview.rollbackCount}
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-3 md:grid-cols-4">
            <div className="rounded-[1.3rem] border border-border/70 bg-background/68 p-4">
              <p className="eyebrow-label">Runs</p>
              <p className="mt-3 text-3xl font-semibold text-foreground">{qualityDashboard.overview.totalRuns}</p>
              <p className="mt-1 text-sm text-muted-foreground">近期待测批次</p>
            </div>
            <div className="rounded-[1.3rem] border border-border/70 bg-background/68 p-4">
              <p className="eyebrow-label">Pass rate</p>
              <p className="mt-3 text-3xl font-semibold text-foreground">{qualityDashboard.overview.averagePassRate}%</p>
              <p className="mt-1 text-sm text-muted-foreground">平均通过率</p>
            </div>
            <div className="rounded-[1.3rem] border border-border/70 bg-background/68 p-4">
              <p className="eyebrow-label">Failed asserts</p>
              <p className="mt-3 text-3xl font-semibold text-foreground">{qualityDashboard.overview.failedAssertions}</p>
              <p className="mt-1 text-sm text-muted-foreground">失败断言</p>
            </div>
            <div className="rounded-[1.3rem] border border-border/70 bg-background/68 p-4">
              <p className="eyebrow-label">Rollback</p>
              <p className="mt-3 text-3xl font-semibold text-foreground">{qualityDashboard.overview.rollbackCount}</p>
              <p className="mt-1 text-sm text-muted-foreground">回滚频次</p>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-[1.4rem] border border-border/70 bg-background/68 p-4">
              <p className="text-sm font-medium text-foreground">分类质量对比</p>
              {qualityDashboard.categoryComparison.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">暂无分类评测数据</p>
              ) : (
                <div className="mt-3 space-y-3 text-sm">
                  {qualityDashboard.categoryComparison.slice(0, 6).map((item) => (
                    <div key={item.categoryId} className="flex items-center justify-between gap-3">
                      <span className="truncate text-foreground">{item.category}</span>
                      <span className="text-muted-foreground">{item.passRate}% · {item.count} 次</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-[1.4rem] border border-border/70 bg-background/68 p-4">
              <p className="text-sm font-medium text-foreground">失败类型分布</p>
              {qualityDashboard.failureTypeDistribution.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">暂无失败断言</p>
              ) : (
                <div className="mt-3 space-y-3 text-sm">
                  {qualityDashboard.failureTypeDistribution.map((item) => (
                    <div key={item.type} className="flex items-center justify-between gap-3">
                      <span className="text-foreground">{item.type}</span>
                      <span className="text-muted-foreground">{item.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="rounded-[1.4rem] border border-border/70 bg-background/68 p-4">
            <p className="text-sm font-medium text-foreground">高风险提示词</p>
            {qualityDashboard.highRiskPrompts.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">暂无高风险提示词</p>
            ) : (
              <div className="mt-3 space-y-2 text-sm">
                {qualityDashboard.highRiskPrompts.map((item) => (
                  <Link
                    key={item.promptId}
                    href={`/prompts/${item.promptId}`}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-border/70 bg-background/70 px-4 py-3 transition-colors hover:border-primary/35"
                  >
                    <span className="truncate text-foreground">{item.title}</span>
                    <span className="text-xs text-muted-foreground">通过率 {item.passRate}% · 回滚 {item.rollbackCount}</span>
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
