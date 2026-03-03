import { cn } from "@/lib/utils"

interface BrowsePromptCardSkeletonProps {
  className?: string
}

const shimmer =
  "animate-shimmer bg-[length:200%_100%] bg-gradient-to-r from-muted/70 via-muted/40 to-muted/70"

export function BrowsePromptCardSkeleton({ className }: BrowsePromptCardSkeletonProps) {
  return (
    <div
      className={cn(
        "h-full rounded-lg border bg-card p-6 shadow-card",
        className
      )}
      aria-hidden="true"
    >
      <div className="mb-5 space-y-3">
        <div className={cn("h-5 w-4/5 rounded-md", shimmer)} />
        <div className={cn("h-3.5 w-full rounded-md", shimmer)} />
        <div className={cn("h-3.5 w-2/3 rounded-md", shimmer)} />
      </div>

      <div className="mb-4 flex items-center justify-between gap-3">
        <div className={cn("h-5 w-16 rounded-full", shimmer)} />
        <div className={cn("h-3.5 w-24 rounded-md", shimmer)} />
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className={cn("h-3 w-14 rounded-md", shimmer)} />
        <div className={cn("h-3 w-14 rounded-md", shimmer)} />
      </div>
    </div>
  )
}
