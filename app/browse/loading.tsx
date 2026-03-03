import { BrowsePromptCardSkeleton } from "@/components/browse/browse-prompt-card-skeleton"
import { cn } from "@/lib/utils"

const shimmer =
  "animate-shimmer bg-[length:200%_100%] bg-gradient-to-r from-muted/70 via-muted/40 to-muted/70"

export default function BrowseLoading() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="border-b glass sticky top-0 z-50">
        <div className="container mx-auto flex items-center justify-between px-4 py-3">
          <div className={cn("h-7 w-16 rounded-md", shimmer)} />
          <div className="flex items-center gap-3">
            <div className={cn("h-9 w-12 rounded-lg", shimmer)} />
            <div className={cn("h-9 w-9 rounded-lg", shimmer)} />
            <div className={cn("h-9 w-14 rounded-lg", shimmer)} />
            <div className={cn("h-9 w-16 rounded-lg", shimmer)} />
          </div>
        </div>
      </div>

      <main className="container mx-auto px-4 py-8">
        <div className="animate-fade-in space-y-6" aria-busy="true" aria-live="polite">
          <div className="mb-2 space-y-3">
            <div className={cn("h-9 w-52 rounded-md", shimmer)} />
            <div className={cn("h-4 w-64 rounded-md", shimmer)} />
          </div>

          <div className="max-w-md">
            <div className={cn("h-10 w-full rounded-lg", shimmer)} />
          </div>

          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 7 }).map((_, index) => (
              <div key={index} className={cn("h-8 w-16 rounded-lg", shimmer)} />
            ))}
          </div>

          <p className="text-sm text-muted-foreground">正在加载公开提示词...</p>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <BrowsePromptCardSkeleton key={index} />
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}
