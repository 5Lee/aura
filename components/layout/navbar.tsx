"use client"

import Link from "next/link"
import type { Session } from "next-auth"
import { signOut } from "next-auth/react"
import { usePathname } from "next/navigation"
import { ArrowUpRight, LayoutDashboard, Sparkles } from "lucide-react"

import { MobileMenu } from "@/components/layout/mobile-nav-sheet"
import { ThemeToggle } from "@/components/theme/theme-toggle"
import { Button } from "@/components/ui/button"
import { WORKSPACE_NAV_ITEMS, isActivePath, isBackofficePath } from "@/lib/app-navigation"
import { cn } from "@/lib/utils"

interface NavbarProps {
  session: Session | null
}

export function Navbar({ session }: NavbarProps) {
  const pathname = usePathname()
  const backofficeActive = isBackofficePath(pathname)
  const userLabel = session?.user?.name || session?.user?.email || "Aura 用户"

  return (
    <nav className="sticky top-0 z-50 border-b border-border/60 bg-background/78 backdrop-blur-xl supports-[backdrop-filter]:bg-background/68">
      <div className="mx-auto flex w-full max-w-[1400px] items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <Link href="/" className="group inline-flex items-center gap-3 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,hsl(var(--primary)),hsl(var(--accent)))] text-sm font-semibold text-white shadow-primary transition-transform duration-200 group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:transform-none">
            AU
          </span>
          <div className="hidden min-w-0 sm:block">
            <p className="text-base font-semibold tracking-tight text-foreground">Aura</p>
            <p className="text-xs text-muted-foreground">Prompt workspace</p>
          </div>
        </Link>

        <div className="hidden min-w-0 flex-1 items-center justify-between gap-4 md:flex">
          <div className="flex min-w-0 items-center gap-1 rounded-full border border-border/70 bg-background/72 p-1 shadow-sm">
            {WORKSPACE_NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActivePath(pathname, item.href) ? "page" : undefined}
                className={cn(
                  "rounded-full px-3 py-2 text-sm font-medium transition-[background-color,color,box-shadow] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  isActivePath(pathname, item.href)
                    ? "bg-foreground text-background shadow-sm"
                    : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                )}
              >
                {item.label}
              </Link>
            ))}
          </div>

          <div className="flex shrink-0 items-center gap-2 lg:gap-3">
            <ThemeToggle />

            {session ? (
              <>
                <Link
                  href="/admin"
                  aria-current={backofficeActive ? "page" : undefined}
                  className={cn(
                    "hidden items-center gap-1.5 rounded-full border px-3 py-2 text-sm font-medium transition-colors lg:inline-flex",
                    backofficeActive
                      ? "border-amber-300/70 bg-amber-100/85 text-amber-700 dark:border-amber-400/30 dark:bg-amber-500/15 dark:text-amber-200"
                      : "border-border/70 bg-background/72 text-muted-foreground hover:border-border hover:text-foreground"
                  )}
                >
                  后台
                  <ArrowUpRight aria-hidden="true" className="h-3.5 w-3.5" />
                </Link>
                <div className="hidden rounded-full border border-border/70 bg-background/72 px-3 py-2 text-sm text-muted-foreground xl:block">
                  {userLabel}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => signOut({ callbackUrl: "/" })}
                  className="rounded-full px-4 hover:bg-destructive/10 hover:text-destructive"
                >
                  退出
                </Button>
              </>
            ) : (
              <Link href="/login">
                <Button size="sm" className="rounded-full px-4 shadow-primary">
                  登录
                </Button>
              </Link>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 md:hidden">
          <ThemeToggle />
          <MobileMenu title="前台导航">
            {session ? (
              <div className="rounded-[1.25rem] border border-border/70 bg-background/88 p-4 shadow-card backdrop-blur-sm">
                <div className="flex items-start gap-3">
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,hsl(var(--primary)),hsl(var(--accent)))] text-sm font-semibold text-white shadow-primary">
                    AU
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">{userLabel}</p>
                    <p className="mt-1 text-xs text-muted-foreground">前台工作台与个人提示词库</p>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="space-y-2">
              <p className="px-1 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Workspace</p>
              {WORKSPACE_NAV_ITEMS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex min-h-11 items-center justify-between rounded-2xl border px-4 py-3 text-sm font-medium transition-colors touch-manipulation",
                    isActivePath(pathname, item.href)
                      ? "border-foreground bg-foreground text-background"
                      : "border-border/70 bg-background/72 text-foreground hover:bg-muted/70"
                  )}
                >
                  {item.label}
                  {isActivePath(pathname, item.href) ? <LayoutDashboard aria-hidden="true" className="h-4 w-4" /> : null}
                </Link>
              ))}
            </div>

            {session ? (
              <div className="space-y-2 border-t border-border/60 pt-3">
                <p className="px-1 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Backoffice</p>
                <Link
                  href="/admin"
                  className={cn(
                    "flex min-h-11 items-center justify-between rounded-2xl border px-4 py-3 text-sm font-medium transition-colors touch-manipulation",
                    backofficeActive
                      ? "border-amber-300/70 bg-amber-100/85 text-amber-700 dark:border-amber-400/30 dark:bg-amber-500/15 dark:text-amber-200"
                      : "border-border/70 bg-background/72 text-foreground hover:bg-muted/70"
                  )}
                >
                  后台中心
                  <Sparkles aria-hidden="true" className="h-4 w-4" />
                </Link>
              </div>
            ) : null}

            {session ? (
              <Button
                variant="outline"
                onClick={() => signOut({ callbackUrl: "/" })}
                className="h-11 w-full rounded-full border-border/70"
              >
                退出登录
              </Button>
            ) : (
              <Link href="/login" className="block">
                <Button className="h-11 w-full rounded-full shadow-primary">登录</Button>
              </Link>
            )}
          </MobileMenu>
        </div>
      </div>
    </nav>
  )
}
