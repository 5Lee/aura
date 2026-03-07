export function PromptFormLoading() {
  return (
    <div className="space-y-6" role="status" aria-live="polite" aria-label="提示词表单加载中">
      <div className="surface-panel space-y-4 p-5 xl:hidden">
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-2">
            <div className="h-4 w-24 animate-pulse rounded-full bg-muted" />
            <div className="h-4 w-44 animate-pulse rounded-full bg-muted" />
          </div>
          <div className="h-8 w-24 animate-pulse rounded-full bg-muted" />
        </div>
        <div className="h-24 animate-pulse rounded-[1.35rem] bg-muted" />
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="h-28 animate-pulse rounded-[1.25rem] bg-muted" />
          <div className="h-28 animate-pulse rounded-[1.25rem] bg-muted" />
          <div className="h-28 animate-pulse rounded-[1.25rem] bg-muted" />
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.95fr)]">
        <div className="space-y-6">
          <div className="surface-panel space-y-4 p-5 sm:p-6">
            <div className="h-4 w-24 animate-pulse rounded-full bg-muted" />
            <div className="h-8 w-48 animate-pulse rounded-full bg-muted" />
            <div className="grid gap-4 md:grid-cols-2">
              <div className="h-12 animate-pulse rounded-2xl bg-muted" />
              <div className="h-12 animate-pulse rounded-2xl bg-muted" />
            </div>
            <div className="h-12 animate-pulse rounded-2xl bg-muted" />
            <div className="h-24 animate-pulse rounded-[1.35rem] bg-muted" />
          </div>

          <div className="surface-panel space-y-4 p-5 sm:p-6">
            <div className="h-4 w-28 animate-pulse rounded-full bg-muted" />
            <div className="h-8 w-44 animate-pulse rounded-full bg-muted" />
            <div className="h-72 animate-pulse rounded-[1.6rem] bg-muted" />
            <div className="h-24 animate-pulse rounded-[1.35rem] bg-muted" />
          </div>

          <div className="surface-panel space-y-4 p-5 sm:p-6">
            <div className="h-4 w-20 animate-pulse rounded-full bg-muted" />
            <div className="h-8 w-40 animate-pulse rounded-full bg-muted" />
            <div className="space-y-3">
              <div className="h-40 animate-pulse rounded-[1.4rem] bg-muted" />
              <div className="h-40 animate-pulse rounded-[1.4rem] bg-muted" />
            </div>
          </div>

          <div className="surface-panel space-y-4 p-5 sm:p-6">
            <div className="h-4 w-24 animate-pulse rounded-full bg-muted" />
            <div className="h-8 w-36 animate-pulse rounded-full bg-muted" />
            <div className="grid gap-4 xl:grid-cols-2">
              <div className="h-64 animate-pulse rounded-[1.45rem] bg-muted" />
              <div className="h-64 animate-pulse rounded-[1.45rem] bg-muted" />
            </div>
          </div>
        </div>

        <div className="hidden space-y-6 xl:block">
          <div className="surface-panel space-y-4 p-5 sm:p-6">
            <div className="h-4 w-20 animate-pulse rounded-full bg-muted" />
            <div className="h-8 w-40 animate-pulse rounded-full bg-muted" />
            <div className="h-28 animate-pulse rounded-[1.45rem] bg-muted" />
            <div className="h-36 animate-pulse rounded-[1.35rem] bg-muted" />
            <div className="h-32 animate-pulse rounded-[1.35rem] bg-muted" />
          </div>
        </div>
      </div>

      <div className="surface-panel-strong flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <div className="h-4 w-40 animate-pulse rounded-full bg-muted" />
          <div className="h-3 w-64 animate-pulse rounded-full bg-muted" />
        </div>
        <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-row">
          <div className="col-span-2 h-11 w-full animate-pulse rounded-full bg-muted sm:w-28" />
          <div className="h-11 w-full animate-pulse rounded-full bg-muted sm:w-24" />
          <div className="h-11 w-full animate-pulse rounded-full bg-muted sm:w-32" />
        </div>
      </div>
    </div>
  )
}
