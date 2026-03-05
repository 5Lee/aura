"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { cn } from "@/lib/utils"

const ADMIN_NAV_ITEMS = [
  { href: "/admin", label: "总览" },
  { href: "/admin/branding", label: "品牌" },
  { href: "/admin/sso", label: "SSO" },
  { href: "/admin/compliance", label: "合规" },
  { href: "/admin/sla", label: "SLA" },
  { href: "/admin/support", label: "支持" },
  { href: "/admin/ads", label: "广告" },
  { href: "/admin/growth-lab", label: "增长" },
  { href: "/admin/connectors", label: "连接器" },
  { href: "/admin/prompt-flow", label: "流程" },
  { href: "/admin/interoperability", label: "互通" },
  { href: "/admin/partners", label: "伙伴" },
  { href: "/admin/marketplace", label: "市场" },
  { href: "/admin/developer-api", label: "API" },
  { href: "/admin/billing", label: "账单" },
]

function isActive(pathname: string, href: string) {
  if (href === "/admin") {
    return pathname === href
  }

  return pathname === href || pathname.startsWith(`${href}/`)
}

export function AdminSubnav() {
  const pathname = usePathname()

  return (
    <nav className="mb-5 rounded-xl border border-border/70 bg-card/70 p-3">
      <p className="mb-2 text-xs font-medium text-muted-foreground">后台导航</p>
      <div className="flex flex-wrap gap-2">
        {ADMIN_NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive(pathname, item.href) ? "page" : undefined}
            className={cn(
              "rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
              isActive(pathname, item.href)
                ? "border-amber-300/60 bg-amber-100/80 text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/20 dark:text-amber-300"
                : "border-border text-foreground hover:bg-muted"
            )}
          >
            {item.label}
          </Link>
        ))}
      </div>
    </nav>
  )
}
