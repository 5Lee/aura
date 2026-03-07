import { PromptCardSkeleton } from "@/components/prompts/prompt-card-skeleton"
import { cn } from "@/lib/utils"

const shimmer =
  "animate-shimmer bg-[length:200%_100%] bg-gradient-to-r from-muted/70 via-muted/40 to-muted/70"

export default function PromptsLoading() {
  return (
    <div className="space-y-6 animate-fade-in" aria-busy="true" aria-live="polite">
      <div className="surface-panel-strong space-y-6 p-6 sm:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <div className={cn("h-3 w-36 rounded-full", shimmer)} />
            <div className={cn("h-10 w-64 rounded-2xl", shimmer)} />
            <div className={cn("h-4 w-full max-w-xl rounded-full", shimmer)} />
          </div>
          <div className="flex gap-3">
            <div className={cn("h-11 w-28 rounded-full", shimmer)} />
            <div className={cn("h-11 w-28 rounded-full", shimmer)} />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className={cn("h-28 rounded-[1.5rem]", shimmer)} />
          ))}
        </div>

        <div className={cn("h-24 rounded-[1.5rem]", shimmer)} />
      </div>

      <div className="surface-panel space-y-4 p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-2">
            <div className={cn("h-4 w-28 rounded-full", shimmer)} />
            <div className={cn("h-4 w-72 rounded-full", shimmer)} />
          </div>
          <div className="flex gap-2">
            <div className={cn("h-9 w-24 rounded-full", shimmer)} />
            <div className={cn("h-9 w-24 rounded-full", shimmer)} />
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-[minmax(0,1.6fr)_minmax(12rem,0.8fr)_auto]">
          <div className={cn("h-12 rounded-full", shimmer)} />
          <div className={cn("h-12 rounded-full", shimmer)} />
          <div className="flex gap-2">
            <div className={cn("h-12 flex-1 rounded-full", shimmer)} />
            <div className={cn("h-12 w-32 rounded-full", shimmer)} />
          </div>
        </div>
      </div>

      <div className="surface-panel p-4 sm:p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="space-y-2">
            <div className={cn("h-4 w-28 rounded-full", shimmer)} />
            <div className={cn("h-4 w-80 rounded-full", shimmer)} />
          </div>
          <div className="flex gap-2">
            <div className={cn("h-9 w-20 rounded-full", shimmer)} />
            <div className={cn("h-9 w-20 rounded-full", shimmer)} />
            <div className={cn("h-9 w-20 rounded-full", shimmer)} />
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          "同步工作区范围与统计",
          "准备筛选和批量工具",
          "渲染提示词卡片与结果概览",
        ].map((label) => (
          <div key={label} className="surface-panel flex items-center gap-3 p-4">
            <div className={cn("h-2.5 w-2.5 rounded-full", shimmer)} />
            <p className="text-sm text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <PromptCardSkeleton key={index} />
        ))}
      </div>
    </div>
  )
}
