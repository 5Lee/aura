export function PromptDetailActionsLoading() {
  return (
    <div
      className="flex gap-2"
      role="status"
      aria-live="polite"
      aria-label="操作区加载中"
    >
      <div className="h-10 w-24 animate-pulse rounded-md bg-muted" />
      <div className="h-10 w-20 animate-pulse rounded-md bg-muted" />
    </div>
  )
}

export function PromptCopyButtonLoading() {
  return (
    <div
      className="h-9 w-20 animate-pulse rounded-md bg-muted"
      role="status"
      aria-live="polite"
      aria-label="复制按钮加载中"
    />
  )
}
