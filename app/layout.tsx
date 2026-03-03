import type { Metadata } from "next"
import { AppProviders } from "@/components/providers/app-providers"
import "@/styles/globals.css"

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
    <html lang="zh-CN">
      <body className="font-sans antialiased">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  )
}
