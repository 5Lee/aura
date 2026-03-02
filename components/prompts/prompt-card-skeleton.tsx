import { cn } from "@/lib/utils"

interface PromptCardSkeletonProps {
  className?: string
}

const shimmer =
  "animate-shimmer bg-[length:200%_100%] bg-gradient-to-r from-muted/70 via-muted/40 to-muted/70"

export function PromptCardSkeleton({ className }: PromptCardSkeletonProps) {
  return (
    <div
      className={cn(
        "h-full rounded-lg border bg-card p-6 shadow-card",
        className
      )}
      aria-hidden="true"
    >
      <div className="mb-5 flex items-start justify-between gap-3">
        <div className={cn("h-5 w-3/4 rounded-md", shimmer)} />
        <div className={cn("h-5 w-14 rounded-full", shimmer)} />
      </div>

      <div className="mb-6 space-y-2">
        <div className={cn("h-3.5 w-full rounded-md", shimmer)} />
        <div className={cn("h-3.5 w-4/5 rounded-md", shimmer)} />
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className={cn("h-5 w-20 rounded-md", shimmer)} />
          <div className={cn("h-3.5 w-24 rounded-md", shimmer)} />
        </div>
        <div className={cn("h-3 w-24 rounded-md", shimmer)} />
      </div>
    </div>
  )
}
