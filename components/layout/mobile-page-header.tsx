"use client"

import { ChevronLeft } from "lucide-react"
import { usePathname, useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface MobileRouteMeta {
  title: string
  showBackButton: boolean
  backHref?: string
}

export function resolveMobileRouteMeta(pathname: string): MobileRouteMeta {
  if (pathname === "/dashboard") {
    return { title: "仪表板", showBackButton: false }
  }

  if (pathname === "/prompts") {
    return { title: "我的提示词", showBackButton: false }
  }

  if (pathname === "/collections") {
    return { title: "我的收藏", showBackButton: false }
  }

  if (pathname === "/prompts/new") {
    return { title: "新建提示词", showBackButton: true, backHref: "/prompts" }
  }

  if (/^\/prompts\/[^/]+\/edit$/.test(pathname)) {
    const promptPath = pathname.replace(/\/edit$/, "")
    return { title: "编辑提示词", showBackButton: true, backHref: promptPath }
  }

  if (/^\/prompts\/[^/]+$/.test(pathname)) {
    return { title: "提示词详情", showBackButton: true, backHref: "/prompts" }
  }

  return { title: "工作台", showBackButton: true, backHref: "/dashboard" }
}

interface MobilePageHeaderProps {
  className?: string
}

export function MobilePageHeader({ className }: MobilePageHeaderProps) {
  const pathname = usePathname()
  const router = useRouter()
  const routeMeta = resolveMobileRouteMeta(pathname)

  const handleBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back()
      return
    }

    router.push(routeMeta.backHref || "/dashboard")
  }

  return (
    <div className={cn("mb-4 md:hidden", className)}>
      <div className="flex min-h-11 items-center gap-2 rounded-xl border border-border/80 bg-card/90 p-1 shadow-sm backdrop-blur-sm">
        {routeMeta.showBackButton ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleBack}
            aria-label="返回上一页"
            className="h-9 w-9 shrink-0 rounded-lg"
          >
            <ChevronLeft aria-hidden="true" className="h-5 w-5" />
          </Button>
        ) : (
          <span aria-hidden="true" className="h-9 w-9 shrink-0" />
        )}

        <p className="line-clamp-1 flex-1 pr-2 text-center text-sm font-semibold text-foreground">
          {routeMeta.title}
        </p>

        <span aria-hidden="true" className="h-9 w-9 shrink-0" />
      </div>
    </div>
  )
}
