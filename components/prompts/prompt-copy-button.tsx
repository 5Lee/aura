"use client"

import { useEffect, useRef, useState } from "react"
import { Check, Copy } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface PromptCopyButtonProps {
  content: string
  className?: string
}

export const COPY_TOAST_DURATION_MS = 3000

export function PromptCopyButton({ content, className }: PromptCopyButtonProps) {
  const [isCopied, setIsCopied] = useState(false)
  const [isToastVisible, setIsToastVisible] = useState(false)
  const hideToastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (hideToastTimeoutRef.current) {
        clearTimeout(hideToastTimeoutRef.current)
      }
    }
  }, [])

  const scheduleToastDismiss = () => {
    if (hideToastTimeoutRef.current) {
      clearTimeout(hideToastTimeoutRef.current)
    }

    hideToastTimeoutRef.current = setTimeout(() => {
      setIsCopied(false)
      setIsToastVisible(false)
    }, COPY_TOAST_DURATION_MS)
  }

  const handleCopy = async () => {
    if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
      return
    }

    await navigator.clipboard.writeText(content)
    setIsCopied(true)
    setIsToastVisible(true)
    scheduleToastDismiss()
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleCopy}
        aria-label="复制提示词内容"
        className={cn("gap-2 rounded-full border-border/70 bg-background/75 px-4", className)}
      >
        {isCopied ? <Check aria-hidden="true" className="h-4 w-4" /> : <Copy aria-hidden="true" className="h-4 w-4" />}
        <span>{isCopied ? "已复制" : "复制内容"}</span>
      </Button>

      {isToastVisible ? (
        <div
          role="status"
          aria-live="polite"
          className="pointer-events-none fixed right-4 top-4 z-[700] inline-flex items-center rounded-md border border-emerald-400/40 bg-emerald-500 px-4 py-2 text-sm font-medium text-white shadow-lg transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none"
        >
          提示词内容已复制到剪贴板
        </div>
      ) : null}
    </>
  )
}
