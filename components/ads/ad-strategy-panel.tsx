"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toaster"

type RuleRow = {
  id: string
  name: string
  placementType: string
  audienceSegment: string
  biddingModel: string
  bidPriceCents: number
  dailyBudgetCapCents: number
  conversionTarget: number
  active: boolean
}

type CampaignRow = {
  id: string
  ruleId: string
  title: string
  advertiser: string
  status: string
  budgetCents: number
  spentCents: number
  impressions: number
  clicks: number
  conversions: number
  blockedBySafetyCount: number
  startAt: string
  endAt: string
  reviewNote: string | null
}

type Summary = {
  totalBudgetCents: number
  totalSpentCents: number
  totalImpressions: number
  totalClicks: number
  totalConversions: number
  totalUnsafeBlocks: number
  ctr: number
  conversionRate: number
  cpcCents: number
}

type AdStrategyPanelProps = {
  hasAccess: boolean
  planId: string
  rules: RuleRow[]
  campaigns: CampaignRow[]
  summary: Summary
}

async function requestJson(path: string, init?: RequestInit) {
  const response = await fetch(path, init)
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(String(payload?.error || "请求失败"))
  }
  return payload
}

function formatCny(cents: number) {
  return (cents / 100).toLocaleString("zh-CN", {
    style: "currency",
    currency: "CNY",
  })
}

export function AdStrategyPanel({ hasAccess, planId, rules, campaigns, summary }: AdStrategyPanelProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [pendingAction, setPendingAction] = useState<string | null>(null)

  const defaultRule = useMemo(() => rules.find((item) => item.active) || rules[0] || null, [rules])
  const [selectedRuleId, setSelectedRuleId] = useState(defaultRule?.id || "")
  const [selectedCampaignId, setSelectedCampaignId] = useState(campaigns[0]?.id || "")

  const [ruleForm, setRuleForm] = useState({
    id: defaultRule?.id || "",
    name: defaultRule?.name || "推荐位标准投放",
    placementType: defaultRule?.placementType || "home-recommendation",
    audienceSegment: defaultRule?.audienceSegment || "general",
    biddingModel: defaultRule?.biddingModel || "CPC",
    bidPriceCents: String(defaultRule?.bidPriceCents || 120),
    dailyBudgetCapCents: String(defaultRule?.dailyBudgetCapCents || 200000),
    conversionTarget: String(defaultRule?.conversionTarget || 1.2),
    active: defaultRule?.active ?? true,
  })

  const [campaignForm, setCampaignForm] = useState({
    ruleId: defaultRule?.id || "",
    title: "",
    advertiser: "",
    content: "",
    landingUrl: "",
    budgetCents: "100000",
    startAt: new Date().toISOString().slice(0, 16),
    endAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
  })

  const [reviewForm, setReviewForm] = useState({
    status: "APPROVED",
    reviewNote: "",
    impressions: "0",
    clicks: "0",
    conversions: "0",
    spendCents: "0",
    unsafeBlocks: "0",
  })

  async function runAction(actionKey: string, fn: () => Promise<unknown>, success: string) {
    setPendingAction(actionKey)
    try {
      await fn()
      toast({ type: "success", title: success })
      router.refresh()
    } catch (error) {
      toast({
        type: "error",
        title: "操作失败",
        description: error instanceof Error ? error.message : "请稍后重试",
      })
    } finally {
      setPendingAction(null)
    }
  }

  if (!hasAccess) {
    return (
      <div className="rounded-lg border border-border bg-muted/20 p-4 text-sm">
        <p className="font-medium">当前套餐：{planId.toUpperCase()}</p>
        <p className="mt-1 text-muted-foreground">
          广告与推荐位商业策略仅对 Pro / Team / Enterprise 套餐开放。
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded-lg border border-border bg-muted/20 p-4">
          <p className="text-xs text-muted-foreground">预算总额</p>
          <p className="mt-1 text-lg font-semibold">{formatCny(summary.totalBudgetCents)}</p>
        </div>
        <div className="rounded-lg border border-border bg-muted/20 p-4">
          <p className="text-xs text-muted-foreground">累计消耗</p>
          <p className="mt-1 text-lg font-semibold">{formatCny(summary.totalSpentCents)}</p>
        </div>
        <div className="rounded-lg border border-border bg-muted/20 p-4">
          <p className="text-xs text-muted-foreground">转化率</p>
          <p className="mt-1 text-lg font-semibold">{summary.conversionRate}%</p>
        </div>
        <div className="rounded-lg border border-border bg-muted/20 p-4">
          <p className="text-xs text-muted-foreground">内容安全拦截</p>
          <p className="mt-1 text-lg font-semibold">{summary.totalUnsafeBlocks}</p>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="space-y-3 rounded-lg border border-border bg-background p-4">
          <p className="text-sm font-medium">推荐位投放规则与审核流程</p>
          <input
            value={ruleForm.name}
            onChange={(event) => setRuleForm((prev) => ({ ...prev, name: event.target.value }))}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            placeholder="规则名称"
          />
          <div className="grid gap-2 sm:grid-cols-2">
            <input
              value={ruleForm.placementType}
              onChange={(event) => setRuleForm((prev) => ({ ...prev, placementType: event.target.value }))}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              placeholder="投放位"
            />
            <input
              value={ruleForm.audienceSegment}
              onChange={(event) => setRuleForm((prev) => ({ ...prev, audienceSegment: event.target.value }))}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              placeholder="人群分层"
            />
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <select
              value={ruleForm.biddingModel}
              onChange={(event) => setRuleForm((prev) => ({ ...prev, biddingModel: event.target.value }))}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="CPC">CPC</option>
              <option value="CPM">CPM</option>
            </select>
            <input
              value={ruleForm.bidPriceCents}
              onChange={(event) => setRuleForm((prev) => ({ ...prev, bidPriceCents: event.target.value }))}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              placeholder="单价(分)"
            />
            <input
              value={ruleForm.dailyBudgetCapCents}
              onChange={(event) => setRuleForm((prev) => ({ ...prev, dailyBudgetCapCents: event.target.value }))}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              placeholder="日预算上限(分)"
            />
          </div>
          <input
            value={ruleForm.conversionTarget}
            onChange={(event) => setRuleForm((prev) => ({ ...prev, conversionTarget: event.target.value }))}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            placeholder="转化目标(%)"
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={ruleForm.active}
              onChange={(event) => setRuleForm((prev) => ({ ...prev, active: event.target.checked }))}
            />
            <span>规则启用</span>
          </label>
          <Button
            disabled={pendingAction !== null}
            onClick={() =>
              runAction(
                "save-rule",
                () =>
                  requestJson("/api/ads/rules", {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      id: ruleForm.id,
                      name: ruleForm.name,
                      placementType: ruleForm.placementType,
                      audienceSegment: ruleForm.audienceSegment,
                      biddingModel: ruleForm.biddingModel,
                      bidPriceCents: Number(ruleForm.bidPriceCents),
                      dailyBudgetCapCents: Number(ruleForm.dailyBudgetCapCents),
                      conversionTarget: Number(ruleForm.conversionTarget),
                      active: ruleForm.active,
                    }),
                  }),
                "投放规则已保存"
              )
            }
          >
            {pendingAction === "save-rule" ? "保存中..." : "保存投放规则"}
          </Button>
        </div>

        <div className="space-y-3 rounded-lg border border-border bg-background p-4">
          <p className="text-sm font-medium">投放预算与时段控制</p>
          <select
            value={campaignForm.ruleId}
            onChange={(event) => setCampaignForm((prev) => ({ ...prev, ruleId: event.target.value }))}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">选择规则</option>
            {rules.map((rule) => (
              <option key={rule.id} value={rule.id}>
                {rule.name} · {rule.placementType}
              </option>
            ))}
          </select>
          <input
            value={campaignForm.title}
            onChange={(event) => setCampaignForm((prev) => ({ ...prev, title: event.target.value }))}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            placeholder="投放标题"
          />
          <input
            value={campaignForm.advertiser}
            onChange={(event) => setCampaignForm((prev) => ({ ...prev, advertiser: event.target.value }))}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            placeholder="投放方"
          />
          <textarea
            value={campaignForm.content}
            onChange={(event) => setCampaignForm((prev) => ({ ...prev, content: event.target.value }))}
            className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder="广告内容"
          />
          <div className="grid gap-2 sm:grid-cols-2">
            <input
              type="datetime-local"
              value={campaignForm.startAt}
              onChange={(event) => setCampaignForm((prev) => ({ ...prev, startAt: event.target.value }))}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            />
            <input
              type="datetime-local"
              value={campaignForm.endAt}
              onChange={(event) => setCampaignForm((prev) => ({ ...prev, endAt: event.target.value }))}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            />
          </div>
          <input
            value={campaignForm.budgetCents}
            onChange={(event) => setCampaignForm((prev) => ({ ...prev, budgetCents: event.target.value }))}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            placeholder="总预算(分)"
          />
          <Button
            disabled={pendingAction !== null || !campaignForm.ruleId}
            onClick={() =>
              runAction(
                "create-campaign",
                () =>
                  requestJson("/api/ads/campaigns", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      ruleId: campaignForm.ruleId,
                      title: campaignForm.title,
                      advertiser: campaignForm.advertiser,
                      content: campaignForm.content,
                      landingUrl: campaignForm.landingUrl,
                      startAt: campaignForm.startAt,
                      endAt: campaignForm.endAt,
                      budgetCents: Number(campaignForm.budgetCents),
                    }),
                  }),
                "投放已创建"
              )
            }
          >
            {pendingAction === "create-campaign" ? "创建中..." : "创建投放"}
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-background p-4 space-y-3">
        <p className="text-sm font-medium">广告数据统计与转化追踪</p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <select
            value={selectedCampaignId}
            onChange={(event) => setSelectedCampaignId(event.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">选择投放</option>
            {campaigns.map((item) => (
              <option key={item.id} value={item.id}>
                {item.title} · {item.status}
              </option>
            ))}
          </select>
          <select
            value={reviewForm.status}
            onChange={(event) => setReviewForm((prev) => ({ ...prev, status: event.target.value }))}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="IN_REVIEW">IN_REVIEW</option>
            <option value="APPROVED">APPROVED</option>
            <option value="REJECTED">REJECTED</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="PAUSED">PAUSED</option>
            <option value="COMPLETED">COMPLETED</option>
          </select>
          <input
            value={reviewForm.reviewNote}
            onChange={(event) => setReviewForm((prev) => ({ ...prev, reviewNote: event.target.value }))}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            placeholder="审核备注"
          />
        </div>

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <input
            value={reviewForm.impressions}
            onChange={(event) => setReviewForm((prev) => ({ ...prev, impressions: event.target.value }))}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            placeholder="曝光"
          />
          <input
            value={reviewForm.clicks}
            onChange={(event) => setReviewForm((prev) => ({ ...prev, clicks: event.target.value }))}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            placeholder="点击"
          />
          <input
            value={reviewForm.conversions}
            onChange={(event) => setReviewForm((prev) => ({ ...prev, conversions: event.target.value }))}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            placeholder="转化"
          />
          <input
            value={reviewForm.spendCents}
            onChange={(event) => setReviewForm((prev) => ({ ...prev, spendCents: event.target.value }))}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            placeholder="消耗(分)"
          />
          <input
            value={reviewForm.unsafeBlocks}
            onChange={(event) => setReviewForm((prev) => ({ ...prev, unsafeBlocks: event.target.value }))}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            placeholder="安全拦截"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            disabled={pendingAction !== null || !selectedCampaignId}
            onClick={() =>
              runAction(
                "review",
                () =>
                  requestJson(`/api/ads/campaigns/${selectedCampaignId}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      status: reviewForm.status,
                      reviewNote: reviewForm.reviewNote,
                    }),
                  }),
                "审核状态已更新"
              )
            }
          >
            {pendingAction === "review" ? "更新中..." : "提交审核状态"}
          </Button>
          <Button
            variant="outline"
            disabled={pendingAction !== null || !selectedCampaignId}
            onClick={() =>
              runAction(
                "metrics",
                () =>
                  requestJson(`/api/ads/campaigns/${selectedCampaignId}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      impressions: Number(reviewForm.impressions),
                      clicks: Number(reviewForm.clicks),
                      conversions: Number(reviewForm.conversions),
                      spendCents: Number(reviewForm.spendCents),
                      unsafeBlocks: Number(reviewForm.unsafeBlocks),
                    }),
                  }),
                "投放数据已更新"
              )
            }
          >
            {pendingAction === "metrics" ? "上报中..." : "上报投放数据"}
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-background p-4">
        <p className="text-sm font-medium">投放列表（预算、时段与安全兼容）</p>
        {campaigns.length === 0 ? (
          <p className="mt-2 text-xs text-muted-foreground">暂无投放。</p>
        ) : (
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="text-left text-muted-foreground">
                <tr>
                  <th className="border-b px-2 py-2 font-medium">投放</th>
                  <th className="border-b px-2 py-2 font-medium">状态</th>
                  <th className="border-b px-2 py-2 font-medium">预算/消耗</th>
                  <th className="border-b px-2 py-2 font-medium">曝光/点击/转化</th>
                  <th className="border-b px-2 py-2 font-medium">时段</th>
                  <th className="border-b px-2 py-2 font-medium">安全拦截</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((item) => (
                  <tr key={item.id}>
                    <td className="border-b px-2 py-2">
                      <p>{item.title}</p>
                      <p className="text-xs text-muted-foreground">{item.advertiser}</p>
                    </td>
                    <td className="border-b px-2 py-2">{item.status}</td>
                    <td className="border-b px-2 py-2">
                      {formatCny(item.spentCents)} / {formatCny(item.budgetCents)}
                    </td>
                    <td className="border-b px-2 py-2">
                      {item.impressions} / {item.clicks} / {item.conversions}
                    </td>
                    <td className="border-b px-2 py-2 text-xs text-muted-foreground">
                      {new Date(item.startAt).toLocaleString("zh-CN")} - {new Date(item.endAt).toLocaleString("zh-CN")}
                    </td>
                    <td className="border-b px-2 py-2">{item.blockedBySafetyCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
