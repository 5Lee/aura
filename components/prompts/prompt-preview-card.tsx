import Link from "next/link"
import { CalendarDays, Eye, Globe, Heart, Lock, UserRound } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

type PromptMetricKind = "favorites" | "views"
type PromptVisibility = "public" | "private"

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
  author?: string
  tags?: string[]
  updatedAt?: string
  metrics?: PromptMetric[]
  className?: string
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
    className: "border-success/30 bg-success/10 text-success",
  },
  private: {
    label: "私有",
    icon: Lock,
    className: "border-muted-foreground/25 bg-muted text-muted-foreground",
  },
}

export function PromptPreviewCard({
  href,
  title,
  description,
  category,
  visibility,
  author,
  tags = [],
  updatedAt,
  metrics = [],
  className,
}: PromptPreviewCardProps) {
  const visibleTags = tags.slice(0, 2)
  const hiddenTagCount = Math.max(tags.length - visibleTags.length, 0)
  const visibilityData = visibility ? visibilityConfig[visibility] : null
  const VisibilityIcon = visibilityData?.icon

  return (
    <Link
      href={href}
      className={cn(
        "group block h-full w-full rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        className
      )}
    >
      <Card className="relative h-full w-full overflow-hidden border-border/70 bg-card/95 shadow-card transition-[transform,box-shadow,border-color] duration-200 motion-reduce:transition-none group-hover:-translate-y-0.5 group-hover:border-primary/35 group-hover:shadow-card-hover motion-reduce:transform-none">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-r from-primary/20 via-secondary/15 to-accent/20 opacity-70 transition-opacity duration-200 motion-reduce:transition-none group-hover:opacity-100"
        />

        <CardHeader className="relative space-y-2.5 pb-3 sm:space-y-3 sm:pb-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Badge
              variant="outline"
              className="border-primary/25 bg-primary/10 text-primary"
            >
              {category}
            </Badge>

            {visibilityData && VisibilityIcon && (
              <Badge
                variant="outline"
                className={cn("inline-flex items-center gap-1", visibilityData.className)}
              >
                <VisibilityIcon aria-hidden="true" className="h-3 w-3" />
                {visibilityData.label}
              </Badge>
            )}
          </div>

          <div className="space-y-2">
            <CardTitle className="line-clamp-2 break-words text-lg leading-snug tracking-tight text-card-foreground sm:text-xl">
              {title}
            </CardTitle>
            <CardDescription className="line-clamp-2 text-[13px] leading-relaxed text-muted-foreground sm:text-sm">
              {description}
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="relative space-y-3.5 sm:space-y-4">
          {visibleTags.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              {visibleTags.map((tag) => (
                <Badge
                  key={tag}
                  variant="outline"
                  className="border-border/70 bg-muted/70 text-muted-foreground"
                >
                  #{tag}
                </Badge>
              ))}
              {hiddenTagCount > 0 && (
                <Badge
                  variant="outline"
                  className="border-border/70 bg-muted/70 text-muted-foreground"
                >
                  +{hiddenTagCount}
                </Badge>
              )}
            </div>
          )}

          {(author || updatedAt) && (
            <div className="flex flex-wrap items-center justify-between gap-2.5 text-[11px] text-muted-foreground sm:gap-3 sm:text-xs">
              {author && (
                <span className="inline-flex max-w-full items-center gap-1.5 truncate">
                  <UserRound aria-hidden="true" className="h-3.5 w-3.5" />
                  {author}
                </span>
              )}
              {updatedAt && (
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays aria-hidden="true" className="h-3.5 w-3.5" />
                  {updatedAt}
                </span>
              )}
            </div>
          )}

          {metrics.length > 0 && (
            <div className="flex items-center gap-3 border-t border-border/60 pt-2.5 text-[11px] text-muted-foreground sm:gap-4 sm:pt-3 sm:text-xs">
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
          )}
        </CardContent>
      </Card>
    </Link>
  )
}
