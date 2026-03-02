"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useSession, signOut } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { ThemeToggle } from "@/components/theme/theme-toggle"

export function Navbar() {
  const pathname = usePathname()
  const { data: session, status } = useSession()

  const navItems = [
    { href: "/dashboard", label: "仪表板" },
    { href: "/prompts", label: "提示词" },
    { href: "/collections", label: "收藏夹" },
  ]

  return (
    <nav className="border-b glass sticky top-0 z-50">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between">
        <Link href="/" className="text-xl font-bold text-gradient-primary hover:opacity-80 transition-opacity">
          Aura
        </Link>

        <div className="flex items-center gap-6">
          {/* Navigation Links */}
          <div className="hidden md:flex items-center gap-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "px-3 py-2 text-sm font-medium rounded-lg transition-all",
                  pathname === item.href
                    ? "bg-primary/10 text-primary dark:bg-primary/20"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                {item.label}
              </Link>
            ))}
          </div>

          {/* Right Side Actions */}
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
                  className="hover:bg-destructive/10 hover:text-destructive hover:border-destructive/20"
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
      </nav>
    </nav>
  )
}