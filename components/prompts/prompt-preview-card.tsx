import Link from "next/link"
import { CalendarDays, Eye, Globe, Heart, Lock, PencilLine, UserRound } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

type PromptMetricKind = "favorites" | "views"
type PromptVisibility = "public" | "private"
type PromptPublishStatus = "DRAFT" | "IN_REVIEW" | "PUBLISHED" | "ARCHIVED"

interface PromptMetric {
  kind: PromptMetricKind
  value: number
}

interface PromptPreviewCardProps {
  href: string
  title: string
  description: string
  category: string
  visibility?: PromptVisibility
  publishStatus?: PromptPublishStatus
  author?: string
  tags?: string[]
  updatedAt?: string
  metrics?: PromptMetric[]
  className?: string
  selected?: boolean
  onToggleSelect?: () => void
  editHref?: string
}

const metricConfig: Record<PromptMetricKind, { icon: typeof Heart; label: string }> = {
  favorites: {
    icon: Heart,
    label: "收藏",
  },
  views: {
    icon: Eye,
    label: "浏览",
  },
}

const visibilityConfig: Record<PromptVisibility, { label: string; icon: typeof Globe; className: string }> = {
  public: {
    label: "公开",
    icon: Globe,
    className: "border-emerald-300/70 bg-emerald-100/90 text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-500/15 dark:text-emerald-200",
  },
  private: {
    label: "私有",
    icon: Lock,
    className: "border-slate-300/70 bg-slate-100/90 text-slate-700 dark:border-slate-500/30 dark:bg-slate-500/15 dark:text-slate-200",
  },
}

const publishStatusConfig: Record<PromptPublishStatus, { label: string; className: string }> = {
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

export function PromptPreviewCard({
  href,
  title,
  description,
  category,
  visibility,
  publishStatus,
  author,
  tags = [],
  updatedAt,
  metrics = [],
  className,
  selected = false,
  onToggleSelect,
  editHref,
}: PromptPreviewCardProps) {
  const summary = description.trim() || "未填写描述，点击查看详情继续完善这条提示词。"
  const visibleTags = tags.slice(0, 3)
  const hiddenTagCount = Math.max(tags.length - visibleTags.length, 0)
  const visibilityData = visibility ? visibilityConfig[visibility] : null
  const publishStatusData = publishStatus ? publishStatusConfig[publishStatus] : null
  const VisibilityIcon = visibilityData?.icon

  return (
    <article className={cn("group relative h-full w-full", className)}>
      <Card
        className={cn(
          "content-auto relative flex h-full w-full flex-col overflow-hidden rounded-[1.45rem] border-border/70 bg-card/95 shadow-card transition-[transform,box-shadow,border-color] duration-200 motion-reduce:transition-none group-hover:-translate-y-0.5 group-hover:border-primary/35 group-hover:shadow-card-hover motion-reduce:transform-none",
          selected && "border-primary/45 shadow-card-hover ring-1 ring-primary/20"
        )}
      >
        <Link
          href={href}
          aria-label={`查看 ${title}`}
          className="absolute inset-0 z-10 rounded-[1.45rem] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        />

        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-r from-primary/20 via-secondary/15 to-accent/20 opacity-75 transition-opacity duration-200 motion-reduce:transition-none group-hover:opacity-100"
        />

        <CardHeader className="relative z-20 space-y-3 p-5 pb-3 sm:p-5 sm:pb-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="border-primary/25 bg-primary/10 text-primary">
                {category}
              </Badge>
              {publishStatusData ? (
                <Badge variant="outline" className={publishStatusData.className}>
                  {publishStatusData.label}
                </Badge>
              ) : null}
            </div>

            {visibilityData && VisibilityIcon ? (
              <Badge variant="outline" className={cn("inline-flex items-center gap-1", visibilityData.className)}>
                <VisibilityIcon aria-hidden="true" className="h-3 w-3" />
                {visibilityData.label}
              </Badge>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            {editHref ? (
              <Button asChild type="button" variant="outline" size="sm" className="relative z-20 rounded-full border-border/70 bg-background/90 px-3">
                <Link href={editHref}>
                  <PencilLine aria-hidden="true" className="mr-1 h-3.5 w-3.5" />
                  编辑
                </Link>
              </Button>
            ) : null}
            {onToggleSelect ? (
              <Button
                type="button"
                variant={selected ? "secondary" : "outline"}
                size="sm"
                onClick={onToggleSelect}
                aria-pressed={selected}
                className={cn(
                  "relative z-20 rounded-full px-3",
                  selected ? "" : "border-border/70 bg-background/90"
                )}
              >
                {selected ? "已加入批量" : "加入批量"}
              </Button>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <CardTitle className="line-clamp-2 break-words text-lg leading-snug tracking-tight text-card-foreground">
              {title}
            </CardTitle>
            <CardDescription className="line-clamp-3 text-[13px] leading-6 text-muted-foreground sm:text-sm">
              {summary}
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="relative z-20 mt-auto space-y-3 p-5 pt-0">
          {selected ? (
            <div className="rounded-full border border-primary/20 bg-primary/10 px-3 py-2 text-xs font-medium text-primary">
              当前卡片已加入批量选择
            </div>
          ) : null}

          {visibleTags.length > 0 ? (
            <div className="flex flex-wrap items-center gap-1.5">
              {visibleTags.map((tag) => (
                <Badge key={tag} variant="outline" className="border-border/70 bg-muted/70 text-muted-foreground">
                  #{tag}
                </Badge>
              ))}
              {hiddenTagCount > 0 ? (
                <Badge variant="outline" className="border-border/70 bg-muted/70 text-muted-foreground">
                  +{hiddenTagCount}
                </Badge>
              ) : null}
            </div>
          ) : (
            <div className="rounded-full border border-dashed border-border/60 bg-muted/35 px-3 py-2 text-xs text-muted-foreground">
              暂无标签
            </div>
          )}

          {author || updatedAt ? (
            <div className="flex flex-wrap items-center justify-between gap-2.5 text-[11px] text-muted-foreground sm:text-xs">
              {author ? (
                <span className="inline-flex max-w-full items-center gap-1.5 truncate">
                  <UserRound aria-hidden="true" className="h-3.5 w-3.5" />
                  {author}
                </span>
              ) : null}
              {updatedAt ? (
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays aria-hidden="true" className="h-3.5 w-3.5" />
                  {updatedAt}
                </span>
              ) : null}
            </div>
          ) : null}

          {metrics.length > 0 ? (
            <div className="flex items-center gap-3 border-t border-border/60 pt-3 text-[11px] text-muted-foreground sm:gap-4 sm:text-xs">
              {metrics.map((metric) => {
                const config = metricConfig[metric.kind]
                const MetricIcon = config.icon

                return (
                  <span key={metric.kind} className="inline-flex items-center gap-1.5">
                    <MetricIcon aria-hidden="true" className="h-3.5 w-3.5" />
                    {metric.value}
                    <span className="sr-only">{config.label}</span>
                  </span>
                )
              })}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </article>
  )
}
