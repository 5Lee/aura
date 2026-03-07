import { RefreshCw } from "lucide-react"

import { cn } from "@/lib/utils"

type CaptchaPreviewButtonProps = {
  alt: string
  className?: string
  disabled?: boolean
  onRefresh: () => void
  src: string
}

export function CaptchaPreviewButton({
  alt,
  className,
  disabled = false,
  onRefresh,
  src,
}: CaptchaPreviewButtonProps) {
  return (
    <button
      type="button"
      onClick={onRefresh}
      disabled={disabled}
      aria-label={`${alt}，点击刷新`}
      className={cn(
        "group flex w-full max-w-[180px] flex-col overflow-hidden rounded-[18px] border border-slate-200 bg-white shadow-sm transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 motion-reduce:transform-none motion-reduce:transition-none disabled:cursor-not-allowed disabled:opacity-60",
        className
      )}
    >
      <span className="flex min-h-[72px] items-center justify-center bg-[linear-gradient(180deg,rgba(248,250,252,0.96),rgba(241,245,249,0.92))] px-2 py-2">
        <img src={src} alt={alt} width={180} height={64} className="h-auto w-full max-w-[180px] transition-transform duration-300 group-hover:scale-[1.02] motion-reduce:transition-none" />
      </span>
      <span className="flex items-center justify-center gap-1.5 border-t border-slate-200 bg-slate-50/90 px-3 py-2 text-[11px] font-medium tracking-[0.08em] text-slate-600 uppercase">
        <RefreshCw className="h-3.5 w-3.5" />
        看不清？换一张
      </span>
    </button>
  )
}
