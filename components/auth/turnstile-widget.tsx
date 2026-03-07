"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Script from "next/script"

import { cn } from "@/lib/utils"

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: {
          action?: string
          callback?: (token: string) => void
          "error-callback"?: () => void
          "expired-callback"?: () => void
          sitekey: string
          theme?: "light" | "dark" | "auto"
        }
      ) => string
      reset: (widgetId?: string) => void
      remove: (widgetId: string) => void
    }
  }
}

const TURNSTILE_SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"

type TurnstileWidgetProps = {
  action: string
  className?: string
  onTokenChange: (token: string) => void
  resetSignal: number
  siteKey: string
}

export function TurnstileWidget({
  action,
  className,
  onTokenChange,
  resetSignal,
  siteKey,
}: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const widgetIdRef = useRef<string | null>(null)
  const [scriptReady, setScriptReady] = useState(false)

  useEffect(() => {
    if (typeof window !== "undefined" && window.turnstile) {
      setScriptReady(true)
    }
  }, [])

  const renderWidget = useCallback(() => {
    if (!siteKey || !containerRef.current || !window.turnstile || widgetIdRef.current) {
      return
    }

    widgetIdRef.current = window.turnstile.render(containerRef.current, {
      sitekey: siteKey,
      action,
      theme: "light",
      callback: (token) => onTokenChange(token),
      "expired-callback": () => onTokenChange(""),
      "error-callback": () => onTokenChange(""),
    })
  }, [action, onTokenChange, siteKey])

  useEffect(() => {
    if (!scriptReady) {
      return
    }

    renderWidget()
  }, [renderWidget, scriptReady])

  useEffect(() => {
    if (!resetSignal || !window.turnstile || !widgetIdRef.current) {
      return
    }

    onTokenChange("")
    window.turnstile.reset(widgetIdRef.current)
  }, [onTokenChange, resetSignal])

  useEffect(() => {
    return () => {
      if (window.turnstile && widgetIdRef.current) {
        window.turnstile.remove(widgetIdRef.current)
      }
    }
  }, [])

  return (
    <>
      <Script
        src={TURNSTILE_SCRIPT_SRC}
        strategy="afterInteractive"
        onLoad={() => setScriptReady(true)}
      />
      <div
        ref={containerRef}
        className={cn(
          "min-h-[68px] rounded-lg border border-slate-200 bg-slate-50 px-3 py-2",
          className
        )}
      />
    </>
  )
}
