import type { Metadata } from "next"

import { AppProviders } from "@/components/providers/app-providers"
import "@/styles/globals.css"

const themeScript = `
  (function () {
    try {
      var storedTheme = window.localStorage.getItem("theme")
      var systemPrefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches
      var initialTheme = storedTheme || (systemPrefersDark ? "dark" : "light")
      document.documentElement.classList.toggle("dark", initialTheme === "dark")
      document.documentElement.dataset.theme = initialTheme
    } catch (error) {
      document.documentElement.classList.toggle("dark", false)
      document.documentElement.dataset.theme = "light"
    }
  })()
`

export const metadata: Metadata = {
  title: "Aura - AI 提示词管理",
  description: "收集、管理和分享你的 AI 提示词",
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  )
}
