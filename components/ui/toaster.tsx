"use client"

import { AlertCircle, CheckCircle2, Info } from "lucide-react"
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"

import { cn } from "@/lib/utils"

export type ToastType = "success" | "error" | "info"

export interface ToastInput {
  title: string
  description?: string
  type?: ToastType
  duration?: number
}

interface ToastRecord extends Required<Pick<ToastInput, "title" | "type" | "duration">> {
  id: number
  description?: string
}

interface ToastContextValue {
  toast: (input: ToastInput) => number
  dismissToast: (id: number) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export const DEFAULT_TOAST_DURATION = 3000

const TOAST_STYLES: Record<ToastType, string> = {
  success: "border-success/30 bg-success text-success-foreground",
  error: "border-destructive/40 bg-destructive text-destructive-foreground",
  info: "border-info/35 bg-info text-info-foreground",
}

const TOAST_ICONS: Record<ToastType, typeof CheckCircle2> = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastRecord[]>([])
  const nextIdRef = useRef(1)
  const timersRef = useRef(new Map<number, ReturnType<typeof setTimeout>>())

  const dismissToast = useCallback((id: number) => {
    const timer = timersRef.current.get(id)
    if (timer) {
      clearTimeout(timer)
      timersRef.current.delete(id)
    }

    setToasts((prev) => prev.filter((toast) => toast.id !== id))
  }, [])

  const toast = useCallback(
    (input: ToastInput) => {
      const id = nextIdRef.current
      nextIdRef.current += 1

      const record: ToastRecord = {
        id,
        title: input.title,
        description: input.description,
        type: input.type ?? "info",
        duration: input.duration ?? DEFAULT_TOAST_DURATION,
      }

      setToasts((prev) => [...prev.slice(-2), record])

      const timer = setTimeout(() => dismissToast(id), record.duration)
      timersRef.current.set(id, timer)

      return id
    },
    [dismissToast]
  )

  useEffect(() => {
    return () => {
      for (const timer of timersRef.current.values()) {
        clearTimeout(timer)
      }
      timersRef.current.clear()
    }
  }, [])

  const value = useMemo(
    () => ({
      toast,
      dismissToast,
    }),
    [dismissToast, toast]
  )

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="pointer-events-none fixed right-4 top-4 z-[700] flex w-[min(26rem,calc(100vw-2rem))] flex-col gap-3"
      >
        {toasts.map((item) => {
          const Icon = TOAST_ICONS[item.type]

          return (
            <div
              key={item.id}
              role={item.type === "error" ? "alert" : "status"}
              className={cn(
                "pointer-events-auto animate-slide-up rounded-xl border px-4 py-3 shadow-lg transition-[opacity,transform] duration-200 ease-out motion-reduce:animate-none",
                TOAST_STYLES[item.type]
              )}
            >
              <div className="flex items-start gap-3">
                <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{item.title}</p>
                  {item.description ? (
                    <p className="mt-1 text-sm opacity-90">{item.description}</p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => dismissToast(item.id)}
                  className="rounded px-1.5 py-0.5 text-xs opacity-90 transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
                >
                  关闭
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)

  if (!context) {
    throw new Error("useToast must be used within ToastProvider")
  }

  return context
}
