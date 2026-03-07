"use client"

import { ChevronLeft, ShieldCheck } from "lucide-react"
import { usePathname, useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface MobileRouteMeta {
  title: string
  showBackButton: boolean
  showHeader: boolean
  backHref?: string
  kicker?: string
}

const HIDDEN_TOP_LEVEL_ROUTES = new Set([
  "/dashboard",
  "/prompts",
  "/collections",
  "/browse",
  "/support",
  "/billing",
  "/admin",
])

function resolveMobileRouteMeta(pathname: string): MobileRouteMeta {
  if (HIDDEN_TOP_LEVEL_ROUTES.has(pathname)) {
    return {
      title: "",
      showBackButton: false,
      showHeader: false,
    }
  }

  if (pathname.startsWith("/admin/")) {
    const section = pathname.replace(/^\/admin\//, "").split("/")[0]
    const sectionTitleMap: Record<string, string> = {
      branding: "品牌中心",
      sso: "SSO 身份",
      compliance: "合规审计",
      sla: "SLA 监控",
      support: "支持流程",
      ads: "广告策略",
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
      showHeader: true,
      backHref: "/admin",
      kicker: "Backoffice",
    }
  }

  if (pathname === "/prompts/new") {
    return {
      title: "新建提示词",
      showBackButton: true,
      showHeader: true,
      backHref: "/prompts",
      kicker: "Prompt editor",
    }
  }

  if (/^\/prompts\/[^/]+\/edit$/.test(pathname)) {
    return {
      title: "编辑提示词",
      showBackButton: true,
      showHeader: true,
      backHref: pathname.replace(/\/edit$/, ""),
      kicker: "Prompt editor",
    }
  }

  if (/^\/prompts\/[^/]+$/.test(pathname)) {
    return {
      title: "提示词详情",
      showBackButton: true,
      showHeader: true,
      backHref: "/prompts",
      kicker: "Prompt detail",
    }
  }

  return {
    title: "工作台",
    showBackButton: true,
    showHeader: true,
    backHref: "/dashboard",
    kicker: "Workspace",
  }
}

interface MobilePageHeaderProps {
  className?: string
}

export function MobilePageHeader({ className }: MobilePageHeaderProps) {
  const pathname = usePathname()
  const router = useRouter()
  const routeMeta = resolveMobileRouteMeta(pathname)

  if (!routeMeta.showHeader) {
    return null
  }

  const handleBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back()
      return
    }

    router.push(routeMeta.backHref || "/dashboard")
  }

  return (
    <div className={cn("mb-4 md:hidden", className)}>
      <div className="rounded-[1.5rem] border border-border/70 bg-background/82 p-1.5 shadow-card backdrop-blur-xl">
        <div className="flex items-center gap-2 rounded-[1.15rem] bg-[linear-gradient(135deg,hsl(var(--primary)/0.1),hsl(var(--accent)/0.08))] px-1.5 py-1.5">
          {routeMeta.showBackButton ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={handleBack}
              aria-label="返回上一页"
              className="h-10 w-10 shrink-0 rounded-full border border-border/60 bg-background/80"
            >
              <ChevronLeft aria-hidden="true" className="h-5 w-5" />
            </Button>
          ) : (
            <span aria-hidden="true" className="h-10 w-10 shrink-0" />
          )}

          <div className="min-w-0 flex-1 px-1">
            {routeMeta.kicker ? (
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                {routeMeta.kicker}
              </p>
            ) : null}
            <p className="line-clamp-1 text-sm font-semibold text-foreground">{routeMeta.title}</p>
          </div>

          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border/50 bg-background/72 text-muted-foreground">
            <ShieldCheck aria-hidden="true" className="h-4 w-4" />
          </span>
        </div>
      </div>
    </div>
  )
}
