"use client"

import {
  createContext,
  type MouseEvent,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react"
import { LayoutGrid, LoaderCircle, Workflow } from "lucide-react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

import { PromptCardSkeleton } from "@/components/prompts/prompt-card-skeleton"
import { Button, type ButtonProps } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface PromptQueryTransitionContextValue {
  isPending: boolean
  pendingHref: string | null
  pendingLabel: string
  navigate: (href: string, pendingLabel?: string) => void
  isTargetPending: (href: string) => boolean
}

interface PromptQueryTransitionProviderProps {
  children: ReactNode
  viewSignature: string
}

interface PromptQueryButtonProps extends Omit<ButtonProps, "onClick"> {
  href: string
  pendingLabel?: string
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void
}

interface PromptQueryStatusProps {
  idleText?: string
  pendingText?: string
  className?: string
}

const PromptQueryTransitionContext = createContext<PromptQueryTransitionContextValue | null>(null)
const PROMPT_QUERY_LOADING_STEPS = [
  "同步工作区范围与统计",
  "准备筛选和批量工具",
  "渲染提示词卡片与结果概览",
] as const
const DEFAULT_PENDING_LABEL = "正在同步提示词列表与当前工作区视图。"
const shimmer =
  "animate-shimmer bg-[length:200%_100%] bg-gradient-to-r from-muted/70 via-muted/40 to-muted/70"

function normalizePromptQueryHref(href: string) {
  if (typeof window === "undefined") {
    return href
  }

  const url = new URL(href, window.location.origin)
  return `${url.pathname}${url.search}`
}

export function PromptQueryTransitionProvider({ children, viewSignature }: PromptQueryTransitionProviderProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [pendingHref, setPendingHref] = useState<string | null>(null)
  const [pendingLabel, setPendingLabel] = useState(DEFAULT_PENDING_LABEL)
  const [isPending, startTransition] = useTransition()

  const currentHref = useMemo(() => {
    const query = searchParams.toString()
    return `${pathname}${query ? `?${query}` : ""}`
  }, [pathname, searchParams])
  const resolvedViewSignature = useMemo(() => normalizePromptQueryHref(viewSignature), [viewSignature])

  useEffect(() => {
    if (!pendingHref) {
      return
    }

    if (pendingHref === resolvedViewSignature) {
      setPendingHref(null)
      setPendingLabel(DEFAULT_PENDING_LABEL)
    }
  }, [pendingHref, resolvedViewSignature])

  const navigate = useCallback(
    (href: string, nextPendingLabel = DEFAULT_PENDING_LABEL) => {
      const normalizedHref = normalizePromptQueryHref(href)

      if (normalizedHref === currentHref) {
        return
      }

      setPendingHref(normalizedHref)
      setPendingLabel(nextPendingLabel)
      startTransition(() => {
        router.push(normalizedHref)
      })
    },
    [currentHref, router]
  )

  const isNavigationPending = isPending || pendingHref !== null

  const value = useMemo<PromptQueryTransitionContextValue>(
    () => ({
      isPending: isNavigationPending,
      pendingHref,
      pendingLabel,
      navigate,
      isTargetPending: (href: string) => normalizePromptQueryHref(href) === pendingHref,
    }),
    [isNavigationPending, navigate, pendingHref, pendingLabel]
  )

  return (
    <PromptQueryTransitionContext.Provider value={value}>
      <div className="relative">
        {children}
        {isNavigationPending ? (
          <div className="pointer-events-none absolute inset-0 z-30 rounded-[2rem] bg-background/76 backdrop-blur-sm">
            <div className="sticky top-4 space-y-4 p-4 sm:p-5">
              <div className="surface-panel-strong space-y-5 border border-border/70 px-4 py-4 shadow-card sm:px-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-2">
                    <p className="eyebrow-label">Workspace sync</p>
                    <div className="flex items-start gap-3">
                      <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-border/70 bg-background/84 text-primary shadow-sm">
                        <LoaderCircle aria-hidden="true" className="h-5 w-5 animate-spin motion-reduce:animate-none" />
                      </span>
                      <div className="space-y-1">
                        <p className="text-base font-semibold text-foreground">正在刷新提示词工作区</p>
                        <p className="max-w-2xl text-sm text-muted-foreground">{pendingLabel}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/80 px-3 py-2">
                      <Workflow aria-hidden="true" className="h-3.5 w-3.5" />
                      重新整理分页、筛选与列表上下文
                    </span>
                    <span className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/80 px-3 py-2">
                      <LayoutGrid aria-hidden="true" className="h-3.5 w-3.5" />
                      保留当前工作区的视觉结构与滚动节奏
                    </span>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  {PROMPT_QUERY_LOADING_STEPS.map((label) => (
                    <div key={label} className="rounded-[1.25rem] border border-border/70 bg-background/82 px-4 py-3 shadow-sm">
                      <div className="flex items-center gap-3">
                        <div className={cn("h-2.5 w-2.5 rounded-full", shimmer)} />
                        <p className="text-sm text-muted-foreground">{label}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                {Array.from({ length: 4 }).map((_, index) => (
                  <PromptCardSkeleton key={index} className="border-border/60 bg-card/88 shadow-card" />
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </PromptQueryTransitionContext.Provider>
  )
}

export function usePromptQueryTransition() {
  return useContext(PromptQueryTransitionContext)
}

export function PromptQueryButton({
  href,
  pendingLabel,
  children,
  loading,
  onClick,
  type,
  ...props
}: PromptQueryButtonProps) {
  const transition = usePromptQueryTransition()
  const isTargetPending = transition?.isTargetPending(href) ?? false

  return (
    <Button
      {...props}
      type={type ?? "button"}
      loading={loading || isTargetPending}
      onClick={(event) => {
        onClick?.(event)
        if (event.defaultPrevented) {
          return
        }

        if (transition) {
          transition.navigate(href, pendingLabel)
          return
        }

        if (typeof window !== "undefined") {
          window.location.assign(href)
        }
      }}
    >
      {children}
    </Button>
  )
}

export function PromptQueryStatus({ idleText, pendingText, className }: PromptQueryStatusProps) {
  const transition = usePromptQueryTransition()

  if (!transition?.isPending) {
    return idleText ? <span className={className}>{idleText}</span> : null
  }

  return <span className={className}>{pendingText || transition.pendingLabel}</span>
}
