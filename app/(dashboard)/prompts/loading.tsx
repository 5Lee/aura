import { PromptCardSkeleton } from "@/components/prompts/prompt-card-skeleton"
import { cn } from "@/lib/utils"

const shimmer =
  "animate-shimmer bg-[length:200%_100%] bg-gradient-to-r from-muted/70 via-muted/40 to-muted/70"

export default function PromptsLoading() {
  return (
    <div className="space-y-6 animate-fade-in" aria-busy="true" aria-live="polite">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-3">
          <div className={cn("h-8 w-40 rounded-md", shimmer)} />
          <div className={cn("h-4 w-48 rounded-md", shimmer)} />
        </div>
        <div className={cn("h-10 w-28 rounded-lg", shimmer)} />
      </div>

      <p className="text-sm text-muted-foreground">正在加载提示词列表...</p>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <PromptCardSkeleton key={index} />
        ))}
      </div>
    </div>
  )
}
