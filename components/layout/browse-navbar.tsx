"use client"

import Link from "next/link"
import type { Session } from "next-auth"
import { ArrowRight, Compass, LayoutDashboard } from "lucide-react"

import { MobileMenu } from "@/components/layout/mobile-nav-sheet"
import { ThemeToggle } from "@/components/theme/theme-toggle"
import { Button } from "@/components/ui/button"

interface BrowseNavbarProps {
  session: Session | null
}

export function BrowseNavbar({ session }: BrowseNavbarProps) {
  return (
    <nav className="sticky top-0 z-50 border-b border-border/60 bg-background/78 backdrop-blur-xl supports-[backdrop-filter]:bg-background/68">
      <div className="mx-auto flex w-full max-w-[1400px] items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <Link href="/" className="group inline-flex items-center gap-3 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,hsl(var(--primary)),hsl(var(--accent)))] text-sm font-semibold text-white shadow-primary transition-transform duration-200 group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:transform-none">
            AU
          </span>
          <div className="hidden sm:block">
            <p className="text-base font-semibold tracking-tight text-foreground">Aura</p>
            <p className="text-xs text-muted-foreground">Community browse</p>
          </div>
        </Link>

        <div className="hidden items-center gap-3 md:flex">
          <div className="rounded-full border border-border/70 bg-background/72 p-1 shadow-sm">
            <Link
              href="/browse"
              aria-current="page"
              className="inline-flex items-center gap-2 rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background"
            >
              <Compass aria-hidden="true" className="h-4 w-4" />
              浏览社区
            </Link>
          </div>

          <ThemeToggle />

          {session ? (
            <>
              <Link href="/dashboard">
                <Button size="sm" className="rounded-full px-4 shadow-primary">
                  仪表板
                </Button>
              </Link>
              <Link href="/prompts">
                <Button size="sm" variant="outline" className="rounded-full border-border/70 px-4">
                  我的提示词
                </Button>
              </Link>
            </>
          ) : (
            <>
              <Link href="/login">
                <Button size="sm" variant="ghost" className="rounded-full px-4 text-muted-foreground hover:text-foreground">
                  登录
                </Button>
              </Link>
              <Link href="/register">
                <Button size="sm" className="rounded-full px-4 shadow-primary">
                  注册
                </Button>
              </Link>
            </>
          )}
        </div>

        <div className="flex items-center gap-2 md:hidden">
          <ThemeToggle />
          <MobileMenu title="社区浏览导航">
            <Link
              href="/browse"
              className="flex min-h-11 items-center justify-between rounded-2xl border border-foreground bg-foreground px-4 py-3 text-sm font-medium text-background"
            >
              浏览公开提示词
              <Compass aria-hidden="true" className="h-4 w-4" />
            </Link>

            {session ? (
              <div className="space-y-2">
                <Link
                  href="/dashboard"
                  className="flex min-h-11 items-center justify-between rounded-2xl border border-border/70 bg-background/72 px-4 py-3 text-sm font-medium text-foreground transition-colors hover:bg-muted/70"
                >
                  仪表板
                  <LayoutDashboard aria-hidden="true" className="h-4 w-4" />
                </Link>
                <Link
                  href="/prompts"
                  className="flex min-h-11 items-center justify-between rounded-2xl border border-border/70 bg-background/72 px-4 py-3 text-sm font-medium text-foreground transition-colors hover:bg-muted/70"
                >
                  我的提示词
                  <ArrowRight aria-hidden="true" className="h-4 w-4" />
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                <Link href="/login" className="block">
                  <Button variant="outline" className="h-11 w-full rounded-full border-border/70">
                    登录
                  </Button>
                </Link>
                <Link href="/register" className="block">
                  <Button className="h-11 w-full rounded-full shadow-primary">注册</Button>
                </Link>
              </div>
            )}
          </MobileMenu>
        </div>
      </div>
    </nav>
  )
}
