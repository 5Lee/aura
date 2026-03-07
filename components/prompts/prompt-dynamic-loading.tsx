export function PromptDetailActionsLoading() {
  return (
    <div
      className="grid w-full gap-2 sm:flex sm:flex-wrap"
      role="status"
      aria-live="polite"
      aria-label="操作区加载中"
    >
      <div className="h-10 w-full animate-pulse rounded-full bg-muted sm:w-28" />
      <div className="h-10 w-full animate-pulse rounded-full bg-muted sm:w-24" />
      <div className="h-10 w-full animate-pulse rounded-full bg-muted sm:w-24" />
    </div>
  )
}

export function PromptCopyButtonLoading() {
  return (
    <div
      className="h-10 w-full animate-pulse rounded-full bg-muted"
      role="status"
      aria-live="polite"
      aria-label="复制按钮加载中"
    />
  )
}
