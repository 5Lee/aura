import { LoadingSpinner } from "@/components/ui/loading-spinner"

export default function Loading() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-primary/5 via-background to-secondary/5 dark:from-primary/10 dark:via-background dark:to-secondary/10">
      <div className="pointer-events-none absolute -left-20 top-1/3 h-64 w-64 rounded-full bg-primary/10 blur-3xl dark:bg-primary/20" />
      <div className="pointer-events-none absolute -right-20 top-1/2 h-72 w-72 rounded-full bg-secondary/10 blur-3xl dark:bg-secondary/20" />
      <LoadingSpinner
        label="Aura 正在准备内容..."
        className="relative z-10 rounded-2xl border border-border/70 bg-card/85 p-8 shadow-card backdrop-blur-sm"
      />
    </div>
  )
}
