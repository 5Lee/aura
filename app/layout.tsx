import type { Metadata } from "next"
import { Inter, JetBrains_Mono } from "next/font/google"
import { AppProviders } from "@/components/providers/app-providers"
import "@/styles/globals.css"

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  preload: true,
  variable: "--font-inter",
  fallback: [
    "PingFang SC",
    "Hiragino Sans GB",
    "Microsoft YaHei",
    "Noto Sans CJK SC",
    "sans-serif",
  ],
})

const jetBrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  preload: true,
  variable: "--font-jetbrains-mono",
  fallback: ["SFMono-Regular", "Menlo", "Monaco", "Consolas", "monospace"],
})

export const metadata: Metadata = {
  title: "Aura - AI 提示词管理",
  description: "收集、管理和分享你的 AI 提示词",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN">
      <body
        className={`${inter.variable} ${jetBrainsMono.variable} font-sans antialiased`}
      >
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  )
}
