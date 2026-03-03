export function PromptFormLoading() {
  return (
    <div
      className="space-y-4"
      role="status"
      aria-live="polite"
      aria-label="提示词表单加载中"
    >
      <div className="h-11 w-full animate-pulse rounded-md bg-muted" />
      <div className="h-11 w-full animate-pulse rounded-md bg-muted" />
      <div className="h-11 w-full animate-pulse rounded-md bg-muted" />
      <div className="h-32 w-full animate-pulse rounded-md bg-muted" />
      <div className="h-11 w-full animate-pulse rounded-md bg-muted" />
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="h-11 w-full animate-pulse rounded-md bg-muted sm:w-28" />
        <div className="h-11 w-full animate-pulse rounded-md bg-muted sm:w-24" />
      </div>
    </div>
  )
}
