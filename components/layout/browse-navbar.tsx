"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Session } from "next-auth"
import { ThemeToggle } from "@/components/theme/theme-toggle"
import { MobileMenu } from "@/components/layout/mobile-nav-sheet"

interface BrowseNavbarProps {
  session: Session | null
}

export function BrowseNavbar({ session }: BrowseNavbarProps) {
  return (
    <nav className="border-b glass sticky top-0 z-50">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between">
        <Link href="/" className="text-xl font-bold text-gradient-primary hover:opacity-80 transition-opacity">
          Aura
        </Link>

        <div className="hidden items-center gap-4 md:flex">
          <Link
            href="/browse"
            aria-current="page"
            className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            浏览
          </Link>

          <ThemeToggle />

          {session ? (
            <>
              <Link href="/dashboard">
                <Button size="sm" className="h-10 shadow-primary hover:shadow-lg">
                  仪表板
                </Button>
              </Link>
              <Link href="/prompts">
                <Button size="sm" variant="outline" className="h-10">
                  我的提示词
                </Button>
              </Link>
            </>
          ) : (
            <>
              <Link href="/login">
                <Button size="sm" variant="ghost" className="h-10 text-muted-foreground hover:text-foreground">
                  登录
                </Button>
              </Link>
              <Link href="/register">
                <Button size="sm" className="h-10 shadow-primary hover:shadow-lg">
                  注册
                </Button>
              </Link>
            </>
          )}
        </div>

        <div className="flex items-center gap-2 md:hidden">
          <ThemeToggle />
          <MobileMenu title="浏览页导航">
            <Link
              href="/browse"
              className="flex min-h-11 items-center rounded-lg border border-primary/30 bg-primary/10 px-4 text-sm font-medium text-primary"
            >
              浏览公开提示词
            </Link>

            {session ? (
              <div className="space-y-2">
                <Link
                  href="/dashboard"
                  className="flex min-h-11 items-center rounded-lg border border-border px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  仪表板
                </Link>
                <Link
                  href="/prompts"
                  className="flex min-h-11 items-center rounded-lg border border-border px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  我的提示词
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                <Link href="/login" className="block">
                  <Button variant="outline" className="h-11 w-full">
                    登录
                  </Button>
                </Link>
                <Link href="/register" className="block">
                  <Button className="h-11 w-full shadow-primary hover:shadow-lg">
                    注册
                  </Button>
                </Link>
              </div>
            )}
          </MobileMenu>
        </div>
      </div>
    </nav>
  )
}
