"use client"

import { useEffect, useId, useRef, useState, type ReactNode } from "react"
import { usePathname } from "next/navigation"
import { Menu, X } from "lucide-react"

import { cn } from "@/lib/utils"

export const MOBILE_MENU_FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "textarea:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",")

export function getFocusableElements(container: HTMLElement | null) {
  if (!container) {
    return []
  }

  return Array.from(container.querySelectorAll<HTMLElement>(MOBILE_MENU_FOCUSABLE_SELECTOR)).filter(
    (element) => !element.hasAttribute("disabled") && element.getAttribute("aria-hidden") !== "true"
  )
}

export function trapFocusWithinPanel(event: KeyboardEvent, panel: HTMLElement | null) {
  if (event.key !== "Tab") {
    return
  }

  const focusableElements = getFocusableElements(panel)
  if (focusableElements.length === 0) {
    event.preventDefault()
    panel?.focus()
    return
  }

  const firstElement = focusableElements[0]
  const lastElement = focusableElements[focusableElements.length - 1]
  const activeElement = document.activeElement as HTMLElement | null
  const isInsidePanel = Boolean(panel && activeElement && panel.contains(activeElement))

  if (event.shiftKey) {
    if (!isInsidePanel || activeElement === firstElement) {
      event.preventDefault()
      lastElement.focus()
    }
    return
  }

  if (!isInsidePanel || activeElement === lastElement) {
    event.preventDefault()
    firstElement.focus()
  }
}

interface MobileMenuProps {
  title: string
  openLabel?: string
  closeLabel?: string
  className?: string
  children: ReactNode
}

export function MobileMenu({
  title,
  openLabel = "打开导航菜单",
  closeLabel = "关闭导航菜单",
  className,
  children,
}: MobileMenuProps) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const panelId = useId()
  const triggerButtonRef = useRef<HTMLButtonElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const wasOpenRef = useRef(false)

  useEffect(() => {
    setOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!open) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault()
        setOpen(false)
        return
      }

      trapFocusWithinPanel(event, panelRef.current)
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    document.addEventListener("keydown", handleKeyDown)
    const focusFrame = window.requestAnimationFrame(() => {
      const firstFocusable = getFocusableElements(panelRef.current)[0] ?? panelRef.current
      ;(closeButtonRef.current ?? firstFocusable)?.focus()
    })

    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener("keydown", handleKeyDown)
      window.cancelAnimationFrame(focusFrame)
    }
  }, [open])

  useEffect(() => {
    if (wasOpenRef.current && !open) {
      triggerButtonRef.current?.focus()
    }

    wasOpenRef.current = open
  }, [open])

  return (
    <div className={cn("md:hidden", className)}>
      <button
        ref={triggerButtonRef}
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-border bg-background/80 text-foreground shadow-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        aria-label={openLabel}
        aria-expanded={open}
        aria-controls={panelId}
      >
        <Menu aria-hidden="true" className="h-5 w-5" />
      </button>

      {open && (
        <div className="fixed inset-0 z-[var(--z-modal)] md:hidden" role="dialog" aria-modal="true" aria-labelledby={`${panelId}-title`}>
          <button
            type="button"
            className="absolute inset-0 bg-foreground/35 backdrop-blur-[1px]"
            onClick={() => setOpen(false)}
            aria-hidden="true"
            tabIndex={-1}
          />

          <div
            id={panelId}
            ref={panelRef}
            tabIndex={-1}
            className="absolute inset-y-0 right-0 w-[min(22rem,88vw)] border-l border-border bg-background/95 px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-[calc(env(safe-area-inset-top)+1rem)] shadow-2xl backdrop-blur animate-fade-in overscroll-contain"
          >
            <div className="flex h-full flex-col space-y-4">
              <div className="flex items-center justify-between">
                <p id={`${panelId}-title`} className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  {title}
                </p>
                <button
                  ref={closeButtonRef}
                  type="button"
                  onClick={() => setOpen(false)}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-border bg-background text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  aria-label={closeLabel}
                >
                  <X aria-hidden="true" className="h-5 w-5" />
                </button>
              </div>

              <div className="flex-1 space-y-2 overflow-y-auto pb-2">{children}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export const MobileNavSheet = MobileMenu
