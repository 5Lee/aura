"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Compass, Heart, LayoutDashboard, ReceiptText, ScrollText } from "lucide-react"

import { cn } from "@/lib/utils"

const navItems = [
  { href: "/dashboard", label: "仪表板", icon: LayoutDashboard },
  { href: "/prompts", label: "提示词", icon: ScrollText },
  { href: "/collections", label: "收藏", icon: Heart },
  { href: "/billing", label: "账单", icon: ReceiptText },
  { href: "/browse", label: "浏览", icon: Compass },
]

function isItemActive(pathname: string, href: string) {
  if (href === "/dashboard") {
    return pathname === href
  }

  return pathname === href || pathname.startsWith(`${href}/`)
}

export function MobileBottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border/70 bg-background/95 pb-[calc(env(safe-area-inset-bottom)+0.35rem)] pt-1 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:hidden">
      <div className="mx-auto grid w-full max-w-md grid-cols-5 px-2">
        {navItems.map((item) => {
          const active = isItemActive(pathname, item.href)
          const Icon = item.icon

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "touch-manipulation inline-flex min-h-11 flex-col items-center justify-center rounded-lg px-1 py-1 text-[11px] font-medium transition-colors",
                active
                  ? "bg-primary/12 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon aria-hidden="true" className="mb-0.5 h-4 w-4" />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
