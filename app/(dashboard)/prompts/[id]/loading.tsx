import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { cn } from "@/lib/utils"

const shimmer =
  "animate-shimmer bg-[length:200%_100%] bg-gradient-to-r from-muted/70 via-muted/40 to-muted/70"

function DetailPanelSkeleton() {
  return (
    <Card className="surface-panel border-0 shadow-none">
      <CardHeader className="space-y-3 pb-4">
        <div className={cn("h-4 w-24 rounded-full", shimmer)} />
        <div className={cn("h-8 w-40 rounded-2xl", shimmer)} />
        <div className={cn("h-4 w-full max-w-sm rounded-full", shimmer)} />
      </CardHeader>
      <CardContent>
        <div className={cn("h-36 rounded-[1.4rem]", shimmer)} />
      </CardContent>
    </Card>
  )
}

export default function PromptDetailLoading() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 sm:space-y-8" aria-busy="true" aria-live="polite">
      <section className="surface-panel-strong space-y-5 p-5 sm:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-4 sm:space-y-5">
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <div className={cn("h-7 w-24 rounded-full", shimmer)} />
                <div className={cn("h-7 w-20 rounded-full", shimmer)} />
              </div>
              <div className={cn("h-10 w-full max-w-xl rounded-2xl", shimmer)} />
              <div className={cn("h-4 w-full max-w-2xl rounded-full", shimmer)} />
            </div>

            <div className="grid grid-cols-2 gap-3 sm:hidden">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className={cn("h-[4.5rem] rounded-[1.2rem]", shimmer)} />
              ))}
            </div>

            <div className="hidden flex-wrap gap-2 sm:flex">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className={cn("h-10 w-28 rounded-full", shimmer)} />
              ))}
            </div>
          </div>

          <div className="grid gap-2 lg:min-w-[18rem] lg:max-w-[18rem]">
            <div className={cn("h-10 w-full rounded-full", shimmer)} />
            <div className={cn("h-10 w-full rounded-full", shimmer)} />
            <div className={cn("h-10 w-full rounded-full", shimmer)} />
            <div className={cn("h-10 w-full rounded-full", shimmer)} />
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)]">
        <Card className="surface-panel border-0 shadow-none">
          <CardHeader className="space-y-3 pb-4">
            <div className={cn("h-4 w-28 rounded-full", shimmer)} />
            <div className={cn("h-8 w-48 rounded-2xl", shimmer)} />
            <div className={cn("h-4 w-full max-w-sm rounded-full", shimmer)} />
          </CardHeader>
          <CardContent>
            <div className={cn("h-72 rounded-[1.5rem]", shimmer)} />
          </CardContent>
        </Card>

        <Card className="surface-panel border-0 shadow-none">
          <CardHeader className="space-y-3 pb-4">
            <div className={cn("h-4 w-24 rounded-full", shimmer)} />
            <div className={cn("h-8 w-36 rounded-2xl", shimmer)} />
            <div className={cn("h-4 w-full max-w-xs rounded-full", shimmer)} />
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <div className={cn("h-24 rounded-[1.3rem]", shimmer)} />
              <div className={cn("h-24 rounded-[1.3rem]", shimmer)} />
            </div>
            <div className={cn("h-28 rounded-[1.3rem]", shimmer)} />
            <div className={cn("h-20 rounded-[1.3rem]", shimmer)} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <DetailPanelSkeleton />
        <DetailPanelSkeleton />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <DetailPanelSkeleton />
        <DetailPanelSkeleton />
      </div>

      <DetailPanelSkeleton />
    </div>
  )
}
