"use client"

import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"

function resolveTheme() {
  if (typeof document === "undefined") {
    return "light" as const
  }

  return document.documentElement.classList.contains("dark") ? "dark" : "light"
}

function applyTheme(nextTheme: "light" | "dark") {
  const root = document.documentElement
  root.classList.toggle("dark", nextTheme === "dark")
  root.dataset.theme = nextTheme
  localStorage.setItem("theme", nextTheme)
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">("light")
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const initialTheme = resolveTheme()
    setTheme(initialTheme)
    setMounted(true)
  }, [])

  const toggleTheme = () => {
    const nextTheme = theme === "light" ? "dark" : "light"
    setTheme(nextTheme)
    applyTheme(nextTheme)
  }

  if (!mounted) {
    return (
      <Button variant="ghost" size="icon" className="h-11 w-11 rounded-full sm:h-10 sm:w-10" aria-label="切换主题">
        <span className="h-5 w-5 rounded-full bg-muted/70" />
      </Button>
    )
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      className="h-11 w-11 rounded-full border border-border/70 bg-background/60 sm:h-10 sm:w-10"
      aria-label={theme === "light" ? "切换到深色模式" : "切换到浅色模式"}
    >
      {theme === "light" ? (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
          />
        </svg>
      ) : (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
          />
        </svg>
      )}
    </Button>
  )
}
