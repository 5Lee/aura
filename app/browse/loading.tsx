import { BrowsePromptCardSkeleton } from "@/components/browse/browse-prompt-card-skeleton"
import { cn } from "@/lib/utils"

const shimmer =
  "animate-shimmer bg-[length:200%_100%] bg-gradient-to-r from-muted/70 via-muted/40 to-muted/70"

export default function BrowseLoading() {
  return (
    <div className="min-h-screen bg-transparent">
      <div className="sticky top-0 z-50 border-b border-border/60 bg-background/78 backdrop-blur-xl supports-[backdrop-filter]:bg-background/68">
        <div className="mx-auto flex w-full max-w-[1400px] items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className={cn("h-11 w-11 rounded-2xl", shimmer)} />
            <div className="hidden space-y-2 sm:block">
              <div className={cn("h-4 w-16 rounded-full", shimmer)} />
              <div className={cn("h-3 w-24 rounded-full", shimmer)} />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className={cn("h-10 w-28 rounded-full", shimmer)} />
            <div className={cn("h-10 w-10 rounded-full", shimmer)} />
            <div className={cn("hidden h-10 w-24 rounded-full md:block", shimmer)} />
          </div>
        </div>
      </div>

      <main className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <div className="surface-panel-strong animate-fade-in space-y-6 p-6 sm:p-8" aria-busy="true" aria-live="polite">
          <div className="space-y-3">
            <div className={cn("h-3 w-40 rounded-full", shimmer)} />
            <div className={cn("h-10 w-full max-w-2xl rounded-2xl", shimmer)} />
            <div className={cn("h-4 w-full max-w-xl rounded-full", shimmer)} />
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <div className={cn("h-12 flex-1 rounded-full", shimmer)} />
            <div className={cn("h-12 w-32 rounded-full", shimmer)} />
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className={cn("h-28 rounded-[1.5rem]", shimmer)} />
            ))}
          </div>
        </div>

        <div className="surface-panel flex flex-wrap gap-2 p-4">
          {Array.from({ length: 7 }).map((_, index) => (
            <div key={index} className={cn("h-10 w-20 rounded-full", shimmer)} />
          ))}
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <BrowsePromptCardSkeleton key={index} />
          ))}
        </div>
      </main>
    </div>
  )
}
