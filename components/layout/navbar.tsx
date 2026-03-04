"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useSession, signOut } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { ThemeToggle } from "@/components/theme/theme-toggle"
import { MobileMenu } from "@/components/layout/mobile-nav-sheet"

export function Navbar() {
  const pathname = usePathname()
  const { data: session, status } = useSession()

  const navItems = [
    { href: "/dashboard", label: "仪表板" },
    { href: "/prompts", label: "提示词" },
    { href: "/collections", label: "收藏夹" },
    { href: "/branding", label: "品牌" },
    { href: "/sso", label: "SSO" },
    { href: "/compliance", label: "合规" },
    { href: "/support", label: "支持" },
    { href: "/sla", label: "SLA" },
    { href: "/marketplace", label: "市场" },
    { href: "/developer-api", label: "API" },
    { href: "/billing", label: "账单" },
    { href: "/pricing", label: "定价" },
  ]

  return (
    <nav className="border-b glass sticky top-0 z-50">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between">
        <Link href="/" className="text-xl font-bold text-gradient-primary hover:opacity-80 transition-opacity">
          Aura
        </Link>

        <div className="hidden items-center gap-6 md:flex">
          <div className="flex items-center gap-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={pathname === item.href ? "page" : undefined}
                className={cn(
                  "rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  pathname === item.href
                    ? "bg-primary/10 text-primary dark:bg-primary/20"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                {item.label}
              </Link>
            ))}
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
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex min-h-11 items-center rounded-lg border px-4 text-sm font-medium transition-colors touch-manipulation",
                    pathname === item.href
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : "border-border text-foreground hover:bg-muted"
                  )}
                >
                  {item.label}
                </Link>
              ))}
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
