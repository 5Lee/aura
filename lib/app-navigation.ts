export const WORKSPACE_NAV_ITEMS = [
  { href: "/dashboard", label: "仪表板" },
  { href: "/prompts", label: "提示词" },
  { href: "/collections", label: "收藏夹" },
  { href: "/browse", label: "浏览" },
  { href: "/support", label: "支持" },
  { href: "/billing", label: "账单" },
] as const

export const BACKOFFICE_PATH_PREFIXES = [
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
] as const

export function isActivePath(pathname: string, href: string) {
  if (href === "/dashboard") {
    return pathname === href
  }

  return pathname === href || pathname.startsWith(`${href}/`)
}

export function isBackofficePath(pathname: string) {
  return BACKOFFICE_PATH_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
}
