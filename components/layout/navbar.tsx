"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useSession, signOut } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { ThemeToggle } from "@/components/theme/theme-toggle"
import { MobileMenu } from "@/components/layout/mobile-nav-sheet"

const WORKSPACE_NAV_ITEMS = [
  { href: "/dashboard", label: "仪表板" },
  { href: "/prompts", label: "提示词" },
  { href: "/collections", label: "收藏夹" },
  { href: "/browse", label: "浏览" },
  { href: "/support", label: "支持" },
  { href: "/billing", label: "账单" },
]

const BACKOFFICE_PATH_PREFIXES = [
  "/admin",
  "/branding",
  "/sso",
  "/compliance",
  "/sla",
  "/ads",
  "/growth-lab",
  "/connectors",
  "/prompt-flow",
  "/governance",
  "/interoperability",
  "/ops-center",
  "/notification-orchestration",
  "/ops-analytics",
  "/playbook-market",
  "/reliability-gates",
  "/self-heal",
  "/release-orchestration",
  "/phase6-closure",
  "/partners",
  "/marketplace",
  "/developer-api",
]

function isActivePath(pathname: string, href: string) {
  if (href === "/dashboard") {
    return pathname === href
  }
  return pathname === href || pathname.startsWith(`${href}/`)
}

function isBackofficePath(pathname: string) {
  return BACKOFFICE_PATH_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
}

export function Navbar() {
  const pathname = usePathname()
  const { data: session, status } = useSession()
  const backofficeActive = isBackofficePath(pathname)

  return (
    <nav className="border-b glass sticky top-0 z-50">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between">
        <Link href="/" className="text-xl font-bold text-gradient-primary hover:opacity-80 transition-opacity">
          Aura
        </Link>

        <div className="hidden items-center gap-6 md:flex">
          <div className="flex items-center gap-1">
            {WORKSPACE_NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActivePath(pathname, item.href) ? "page" : undefined}
                className={cn(
                  "rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  isActivePath(pathname, item.href)
                    ? "bg-primary/10 text-primary dark:bg-primary/20"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                {item.label}
              </Link>
            ))}
            <span aria-hidden="true" className="mx-1 h-5 w-px bg-border" />
            <Link
              href="/admin"
              aria-current={backofficeActive ? "page" : undefined}
              className={cn(
                "rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                backofficeActive
                  ? "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              后台
            </Link>
          </div>

          <div className="flex items-center gap-3">
            <ThemeToggle />

            {status === "loading" ? (
              <div className="w-8 h-8 rounded-full bg-muted animate-pulse" />
            ) : session?.user ? (
              <>
                <div className="hidden sm:block text-sm text-muted-foreground">
                  {session.user.name || session.user.email}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => signOut({ callbackUrl: "/" })}
                  className="h-10 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/20"
                >
                  退出
                </Button>
              </>
            ) : (
              <Link href="/login">
                <Button size="sm">登录</Button>
              </Link>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 md:hidden">
          <ThemeToggle />
          <MobileMenu title="工作台导航">
            {status === "loading" ? (
              <div className="h-11 w-full rounded-lg bg-muted animate-pulse" />
            ) : session?.user ? (
              <div className="rounded-xl border border-border bg-card/80 p-3 shadow-card">
                <p className="text-sm font-medium text-foreground">{session.user.name || session.user.email}</p>
                <p className="mt-1 text-xs text-muted-foreground">已登录账号</p>
              </div>
            ) : null}

            <div className="space-y-2">
              <p className="px-1 text-xs font-medium text-muted-foreground">工作台</p>
              {WORKSPACE_NAV_ITEMS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex min-h-11 items-center rounded-lg border px-4 text-sm font-medium transition-colors touch-manipulation",
                    isActivePath(pathname, item.href)
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : "border-border text-foreground hover:bg-muted"
                  )}
                >
                  {item.label}
                </Link>
              ))}
            </div>

            <div className="space-y-2">
              <p className="px-1 text-xs font-medium text-muted-foreground">后台</p>
              <Link
                href="/admin"
                className={cn(
                  "flex min-h-11 items-center rounded-lg border px-4 text-sm font-medium transition-colors touch-manipulation",
                  backofficeActive
                    ? "border-amber-400/50 bg-amber-100/80 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300"
                    : "border-border text-foreground hover:bg-muted"
                )}
              >
                后台中心
              </Link>
            </div>

            {session?.user ? (
              <Button
                variant="outline"
                onClick={() => signOut({ callbackUrl: "/" })}
                className="w-full h-11 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/20"
              >
                退出登录
              </Button>
            ) : (
              <Link href="/login" className="block">
                <Button className="w-full h-11">登录</Button>
              </Link>
            )}
          </MobileMenu>
        </div>
      </div>
    </nav>
  )
}
