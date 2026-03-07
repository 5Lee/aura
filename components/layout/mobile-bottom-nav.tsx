"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Compass, Heart, LayoutDashboard, ReceiptText, ScrollText } from "lucide-react"

import { isActivePath, isBackofficePath } from "@/lib/app-navigation"
import { cn } from "@/lib/utils"

const navItems = [
  { href: "/dashboard", label: "仪表板", icon: LayoutDashboard },
  { href: "/prompts", label: "提示词", icon: ScrollText },
  { href: "/collections", label: "收藏", icon: Heart },
  { href: "/billing", label: "账单", icon: ReceiptText },
  { href: "/browse", label: "浏览", icon: Compass },
]

export function MobileBottomNav() {
  const pathname = usePathname()

  if (isBackofficePath(pathname)) {
    return null
  }

  return (
    <nav className="pointer-events-none fixed inset-x-0 bottom-3 z-40 px-3 md:hidden">
      <div className="pointer-events-auto mx-auto grid w-full max-w-md grid-cols-5 gap-1 rounded-[1.6rem] border border-border/70 bg-background/88 p-2 shadow-[0_18px_60px_-24px_rgba(15,23,42,0.45)] backdrop-blur-xl supports-[backdrop-filter]:bg-background/72">
        {navItems.map((item) => {
          const active = isActivePath(pathname, item.href)
          const Icon = item.icon

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "inline-flex min-h-12 flex-col items-center justify-center rounded-2xl px-1 py-1 text-[11px] font-medium transition-[transform,background-color,color] duration-200",
                active
                  ? "bg-foreground text-background shadow-sm"
                  : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
              )}
            >
              <Icon aria-hidden="true" className="mb-1 h-4 w-4" />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
