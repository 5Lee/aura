import { cn } from "@/lib/utils"

interface LoadingSpinnerProps {
  className?: string
  label?: string
  size?: "sm" | "md" | "lg"
}

const sizeClasses: Record<NonNullable<LoadingSpinnerProps["size"]>, string> = {
  sm: "h-14 w-14",
  md: "h-20 w-20",
  lg: "h-24 w-24",
}

export function LoadingSpinner({
  className,
  label = "正在加载",
  size = "md",
}: LoadingSpinnerProps) {
  return (
    <div
      className={cn("flex flex-col items-center justify-center gap-4", className)}
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <div className={cn("relative", sizeClasses[size])}>
        <div className="absolute inset-0 rounded-full border-2 border-primary/15" />
        <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-primary border-r-secondary animate-[spin_1.1s_linear_infinite] motion-reduce:animate-none" />
        <div className="absolute inset-3 rounded-full bg-gradient-to-br from-primary/15 via-secondary/10 to-accent/20 animate-pulse-slow motion-reduce:animate-none" />
        <div className="absolute left-1/2 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent shadow-[0_0_0_8px_hsl(var(--accent)/0.12)]" />
      </div>
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <span className="sr-only">{label}</span>
    </div>
  )
}
