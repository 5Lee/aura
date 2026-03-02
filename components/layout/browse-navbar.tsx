"use client"

import Link from "next/link"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Session } from "next-auth"
import { ThemeToggle } from "@/components/theme/theme-toggle"

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

        <div className="flex items-center gap-4">
          <Link
            href="/browse"
            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors rounded-lg px-3 py-2 hover:bg-muted"
          >
            浏览
          </Link>

          <ThemeToggle />

          {session ? (
            <>
              <Link href="/dashboard">
                <Button size="sm" className="shadow-primary hover:shadow-lg">
                  仪表板
                </Button>
              </Link>
              <Link href="/prompts">
                <Button size="sm" variant="outline">
                  我的提示词
                </Button>
              </Link>
            </>
          ) : (
            <>
              <Link href="/login">
                <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-foreground">
                  登录
                </Button>
              </Link>
              <Link href="/register">
                <Button size="sm" className="shadow-primary hover:shadow-lg">
                  注册
                </Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  )
}