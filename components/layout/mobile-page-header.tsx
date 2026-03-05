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

  if (pathname === "/support") {
    return { title: "支持工单", showBackButton: false }
  }

  if (pathname === "/branding") {
    return { title: "品牌中心", showBackButton: false }
  }

  if (pathname === "/sla") {
    return { title: "SLA 监控", showBackButton: false }
  }

  if (pathname === "/sso") {
    return { title: "SSO 身份", showBackButton: false }
  }

  if (pathname === "/compliance") {
    return { title: "合规审计", showBackButton: false }
  }

  if (pathname === "/admin") {
    return { title: "后台中心", showBackButton: false }
  }

  if (pathname.startsWith("/admin/")) {
    const section = pathname.replace("/admin/", "").split("/")[0]
    const sectionTitleMap: Record<string, string> = {
      branding: "品牌中心",
      sso: "SSO 身份",
      compliance: "合规审计",
      sla: "SLA 监控",
      support: "支持流程",
      ads: "广告投放",
      "growth-lab": "增长实验",
      connectors: "连接器目录",
      "prompt-flow": "流程编排",
      governance: "治理审计",
      interoperability: "跨平台互通",
      "ops-center": "任务中心",
      "notification-orchestration": "通知编排",
      "ops-analytics": "运营漏斗",
      "playbook-market": "Playbook 市场",
      "reliability-gates": "质量闸门",
      "self-heal": "自愈修复",
      "release-orchestration": "发布编排",
      "phase6-closure": "Phase6 终验",
      partners: "伙伴结算",
      marketplace: "市场佣金",
      "developer-api": "API 策略",
      billing: "账单中心",
    }
    return {
      title: sectionTitleMap[section] || "后台中心",
      showBackButton: true,
      backHref: "/admin",
    }
  }

  if (pathname === "/marketplace") {
    return { title: "市场佣金", showBackButton: false }
  }

  if (pathname === "/ads") {
    return { title: "广告投放", showBackButton: false }
  }

  if (pathname === "/growth-lab") {
    return { title: "增长实验", showBackButton: false }
  }

  if (pathname === "/connectors") {
    return { title: "连接器目录", showBackButton: false }
  }

  if (pathname === "/prompt-flow") {
    return { title: "流程编排", showBackButton: false }
  }

  if (pathname === "/interoperability") {
    return { title: "跨平台互通", showBackButton: false }
  }

  if (pathname === "/governance") {
    return { title: "治理审计", showBackButton: false }
  }

  if (pathname === "/ops-center") {
    return { title: "任务中心", showBackButton: false }
  }

  if (pathname === "/notification-orchestration") {
    return { title: "通知编排", showBackButton: false }
  }

  if (pathname === "/ops-analytics") {
    return { title: "运营漏斗", showBackButton: false }
  }

  if (pathname === "/playbook-market") {
    return { title: "Playbook 市场", showBackButton: false }
  }

  if (pathname === "/reliability-gates") {
    return { title: "质量闸门", showBackButton: false }
  }

  if (pathname === "/self-heal") {
    return { title: "自愈修复", showBackButton: false }
  }

  if (pathname === "/release-orchestration") {
    return { title: "发布编排", showBackButton: false }
  }

  if (pathname === "/phase6-closure") {
    return { title: "Phase6 终验", showBackButton: false }
  }

  if (pathname === "/partners") {
    return { title: "伙伴结算", showBackButton: false }
  }

  if (pathname === "/developer-api") {
    return { title: "API 策略", showBackButton: false }
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
