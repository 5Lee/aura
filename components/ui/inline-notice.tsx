import { AlertTriangle, CheckCircle2, Info, ShieldAlert } from "lucide-react"

import { cn } from "@/lib/utils"

export type InlineNoticeTone = "error" | "warning" | "info" | "success"

type InlineNoticeProps = {
  className?: string
  message: string
  tone: InlineNoticeTone
}

const toneStyles: Record<InlineNoticeTone, { container: string; icon: typeof AlertTriangle }> = {
  error: {
    container:
      "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400",
    icon: AlertTriangle,
  },
  warning: {
    container:
      "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300",
    icon: ShieldAlert,
  },
  info: {
    container:
      "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-800 dark:bg-sky-900/20 dark:text-sky-300",
    icon: Info,
  },
  success: {
    container:
      "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300",
    icon: CheckCircle2,
  },
}

export function InlineNotice({ className, message, tone }: InlineNoticeProps) {
  const Icon = toneStyles[tone].icon

  return (
    <div
      role={tone === "error" || tone === "warning" ? "alert" : "status"}
      aria-live={tone === "error" || tone === "warning" ? "assertive" : "polite"}
      className={cn(
        "flex items-start gap-3 rounded-2xl border p-4 text-sm leading-6",
        toneStyles[tone].container,
        className
      )}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <p>{message}</p>
    </div>
  )
}
