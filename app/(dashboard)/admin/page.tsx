import Link from "next/link"
import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { authOptions } from "@/lib/auth"

const BACKOFFICE_SECTIONS = [
  {
    title: "品牌与身份",
    description: "管理品牌资产、企业身份与合规基线。",
    items: [
      { href: "/admin/branding", label: "品牌中心", summary: "品牌配置、主题与预览发布" },
      { href: "/admin/sso", label: "SSO 身份", summary: "企业登录、目录同步与角色映射" },
      { href: "/admin/compliance", label: "合规审计", summary: "审计链路、留存策略与异常处理" },
    ],
  },
  {
    title: "稳定性与运维",
    description: "持续监控服务质量，处理支持与故障演练。",
    items: [
      { href: "/admin/sla", label: "SLA 监控", summary: "可用性、错误率、延迟与告警演练" },
      { href: "/admin/support", label: "支持流程", summary: "支持工单、升级策略与复盘流程" },
    ],
  },
  {
    title: "增长与商业化",
    description: "围绕变现、增长、渠道伙伴进行运营决策。",
    items: [
      { href: "/admin/ads", label: "广告策略", summary: "推荐位、广告位与投放实验" },
      { href: "/admin/growth-lab", label: "增长实验", summary: "实验编排、归因分析与告警熔断" },
      { href: "/admin/partners", label: "伙伴计划", summary: "伙伴分层、线索归因与结算对账" },
      { href: "/admin/marketplace", label: "应用市场", summary: "佣金规则、台账与结算批次" },
      { href: "/admin/billing", label: "账单中心", summary: "订阅管理、发票与计费事件" },
      { href: "/admin/developer-api", label: "API 商业化", summary: "API 配额、超额包与定价策略" },
    ],
  },
  {
    title: "生态与自动化",
    description: "建设跨平台能力，打通外部连接和流程。",
    items: [
      { href: "/admin/connectors", label: "连接器目录", summary: "第三方模型与工具连接管理" },
      { href: "/admin/prompt-flow", label: "流程编排", summary: "Prompt Flow 编排与运行追踪" },
      { href: "/admin/governance", label: "审计治理", summary: "连接器与工作流敏感操作治理" },
      { href: "/admin/interoperability", label: "跨平台互通", summary: "模板转换、能力映射与导出" },
    ],
  },
  {
    title: "运营自动化与交付",
    description: "把运营动作、可靠性门禁和发布编排统一闭环。",
    items: [
      { href: "/admin/ops-center", label: "任务中心", summary: "运营任务模板、调度执行与历史追踪" },
      { href: "/admin/notification-orchestration", label: "通知编排", summary: "多通道触达、静默窗口与频控去重" },
      { href: "/admin/ops-analytics", label: "运营漏斗", summary: "激活留存漏斗、cohort 与实验联动" },
      { href: "/admin/playbook-market", label: "Playbook 市场", summary: "运营剧本模板、评分与一键应用" },
      { href: "/admin/reliability-gates", label: "质量闸门", summary: "功能/性能/安全门禁与发布阻断" },
      { href: "/admin/self-heal", label: "自愈修复", summary: "回归资产沉淀、缺陷模式与自动建议" },
      { href: "/admin/release-orchestration", label: "发布编排", summary: "灰度演练、流量开关与回滚评估" },
      { href: "/admin/phase6-closure", label: "Phase6 终验", summary: "终验交付、基线冻结与下一阶段路线图" },
    ],
  },
] as const

export default async function AdminPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    redirect("/login")
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-3">
            <CardTitle>后台中心</CardTitle>
            <Badge variant="secondary">运营 / 运维 / 商业化</Badge>
          </div>
          <CardDescription>
            这里集中管理网站后台能力。普通工作台导航只保留核心使用入口，后台功能统一从此进入。
          </CardDescription>
        </CardHeader>
      </Card>

      {BACKOFFICE_SECTIONS.map((section) => (
        <Card key={section.title}>
          <CardHeader>
            <CardTitle className="text-lg">{section.title}</CardTitle>
            <CardDescription>{section.description}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {section.items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  prefetch={false}
                  className="rounded-lg border border-border bg-card/70 p-4 transition-colors hover:bg-muted/40"
                >
                  <p className="text-sm font-semibold text-foreground">{item.label}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{item.summary}</p>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
