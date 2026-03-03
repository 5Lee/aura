"use client"

import Link from "next/link"

import { MobileMenu } from "@/components/layout/mobile-nav-sheet"
import { ThemeToggle } from "@/components/theme/theme-toggle"

export function HomeHeader() {
  return (
    <header className="sticky top-0 z-50 border-b glass">
      <div className="container mx-auto flex items-center justify-between px-4 py-3">
        <Link href="/" className="text-2xl font-bold text-gradient-primary transition-opacity hover:opacity-80">
          Aura
        </Link>

        <nav className="hidden items-center gap-2 md:flex">
          <ThemeToggle />
          <Link
            href="/browse"
            className="rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            浏览
          </Link>
          <Link
            href="/login"
            className="rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            登录
          </Link>
          <Link
            href="/register"
            className="btn-press rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-primary transition-colors transition-shadow hover:bg-primary/90 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            注册
          </Link>
        </nav>

        <div className="flex items-center gap-2 md:hidden">
          <ThemeToggle />
          <MobileMenu title="Aura 导航">
            <Link
              href="/browse"
              className="flex min-h-11 items-center rounded-lg border border-border px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              浏览公开提示词
            </Link>
            <Link
              href="/login"
              className="flex min-h-11 items-center rounded-lg border border-border px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              登录
            </Link>
            <Link
              href="/register"
              className="flex min-h-11 items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-primary transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              注册并开始使用
            </Link>
          </MobileMenu>
        </div>
      </div>
    </header>
  )
}
