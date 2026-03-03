"use client"

import * as React from "react"
import { ToastProvider } from "@/components/ui/toaster"

declare global {
  interface Window {
    __AURA_AXE_READY__?: boolean
  }
}

const AXE_INTEGRATION_DELAY = 1000

export function AppProviders({ children }: { children: React.ReactNode }) {
  React.useEffect(() => {
    if (process.env.NODE_ENV === "production" || typeof window === "undefined") {
      return
    }

    if (window.__AURA_AXE_READY__) {
      return
    }

    window.__AURA_AXE_READY__ = true

    const loadAxe = async () => {
      try {
        const [{ default: axe }, ReactDOMClient] = await Promise.all([
          import("@axe-core/react"),
          import("react-dom/client"),
        ])

        await axe(React, ReactDOMClient, AXE_INTEGRATION_DELAY)
      } catch (error) {
        console.error("[a11y] failed to start axe runtime checks", error)
      }
    }

    void loadAxe()
  }, [])

  return <ToastProvider>{children}</ToastProvider>
}
