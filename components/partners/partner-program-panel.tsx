"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { InlineNotice } from "@/components/ui/inline-notice"
import { usePersistentInlineNotice } from "@/components/ui/use-persistent-inline-notice"

type TierRow = {
  id: string
  name: string
  level: string
  minQualifiedLeads: number
  revenueShareBasisPoints: number
  settlementCycleDays: number
  active: boolean
}

type LeadRow = {
  id: string
  tierId: string
  settlementId: string | null
  leadName: string
  company: string | null
  sourceChannel: string
  attributionCode: string
  status: string
  estimatedDealCents: number
  closedDealCents: number
  commissionBasisPoints: number
}

type SettlementRow = {
  id: string
  tierId: string
  status: string
  periodStart: string
  periodEnd: string
  leadCount: number
  qualifiedLeadCount: number
  wonLeadCount: number
  grossRevenueCents: number
  payoutAmountCents: number
  reconciledDeltaCents: number
  payoutReference: string | null
  processedAt: string | null
  createdAt: string
}

type Summary = {
  totalLeads: number
  qualifiedLeads: number
  wonLeads: number
  totalEstimatedRevenueCents: number
  totalClosedRevenueCents: number
  estimatedPayoutCents: number
  settlementPendingCents: number
}

type PartnerProgramPanelProps = {
  hasAccess: boolean
  planId: string
  tiers: TierRow[]
  leads: LeadRow[]
  settlements: SettlementRow[]
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

function toLocalDateTimeInputValue(date: Date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 16)
}

function toIsoDateTime(value: string) {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return value
  }
  return parsed.toISOString()
}

export function PartnerProgramPanel({
  hasAccess,
  planId,
  tiers,
  leads,
  settlements,
  summary,
}: PartnerProgramPanelProps) {
  const router = useRouter()
  const [pendingAction, setPendingAction] = useState<string | null>(null)
  const { notice, setNotice, persistNotice } = usePersistentInlineNotice("partner-program-panel")

  const activeTier = useMemo(() => tiers.find((item) => item.active) || tiers[0] || null, [tiers])
  const [selectedSettlementId, setSelectedSettlementId] = useState(settlements[0]?.id || "")

  const [tierForm, setTierForm] = useState({
    id: activeTier?.id || "",
    name: activeTier?.name || "注册伙伴",
    level: activeTier?.level || "REGISTERED",
    minQualifiedLeads: String(activeTier?.minQualifiedLeads || 3),
    revenueShareBasisPoints: String(activeTier?.revenueShareBasisPoints || 800),
    settlementCycleDays: String(activeTier?.settlementCycleDays || 30),
    active: activeTier?.active ?? true,
  })

  const [leadForm, setLeadForm] = useState({
    tierId: activeTier?.id || "",
    leadName: "",
    company: "",
    sourceChannel: "referral",
    attributionCode: "",
    status: "QUALIFIED",
    estimatedDealCents: "100000",
    closedDealCents: "0",
  })

  const [settlementCreateForm, setSettlementCreateForm] = useState({
    tierId: activeTier?.id || "",
    periodStart: toLocalDateTimeInputValue(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)),
    periodEnd: toLocalDateTimeInputValue(new Date(Date.now() + 60 * 60 * 1000)),
    actualPayoutCents: "",
    payoutReference: "",
  })

  const [settlementUpdateForm, setSettlementUpdateForm] = useState({
    status: "PROCESSING",
    actualPayoutCents: "",
    payoutReference: "",
    note: "",
  })

  async function runAction(actionKey: string, fn: () => Promise<unknown>, success: string) {
    setPendingAction(actionKey)
    setNotice(null)
    try {
      await fn()
      persistNotice({ tone: "success", message: success })
      router.refresh()
    } catch (error) {
      setNotice({
        tone: "error",
        message: error instanceof Error ? error.message : "请稍后重试",
      })
    } finally {
      setPendingAction(null)
    }
  }

  if (!hasAccess) {
    return (
      <div className="rounded-lg border border-border bg-muted/20 p-4 text-sm">
        <p className="font-medium">当前套餐：{planId.toUpperCase()}</p>
        <p className="mt-1 text-muted-foreground">合作伙伴分层与结算仅对 Pro / Team / Enterprise 套餐开放。</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {notice ? <InlineNotice tone={notice.tone} message={notice.message} /> : null}
      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded-lg border border-border bg-muted/20 p-4">
          <p className="text-xs text-muted-foreground">线索总量</p>
          <p className="mt-1 text-lg font-semibold">{summary.totalLeads}</p>
        </div>
        <div className="rounded-lg border border-border bg-muted/20 p-4">
          <p className="text-xs text-muted-foreground">赢单线索</p>
          <p className="mt-1 text-lg font-semibold">{summary.wonLeads}</p>
        </div>
        <div className="rounded-lg border border-border bg-muted/20 p-4">
          <p className="text-xs text-muted-foreground">关闭收入</p>
          <p className="mt-1 text-lg font-semibold">{formatCny(summary.totalClosedRevenueCents)}</p>
        </div>
        <div className="rounded-lg border border-border bg-muted/20 p-4">
          <p className="text-xs text-muted-foreground">待结算金额</p>
          <p className="mt-1 text-lg font-semibold">{formatCny(summary.settlementPendingCents)}</p>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="space-y-3 rounded-lg border border-border bg-background p-4">
          <p className="text-sm font-medium">建立合作伙伴等级与权益体系</p>
          <input
            value={tierForm.name}
            onChange={(event) => setTierForm((prev) => ({ ...prev, name: event.target.value }))}
            aria-label="等级名称"
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            placeholder="等级名称"
          />
          <div className="grid gap-2 sm:grid-cols-3">
            <select
              value={tierForm.level}
              onChange={(event) => setTierForm((prev) => ({ ...prev, level: event.target.value }))}
              aria-label="等级级别"
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="REGISTERED">REGISTERED</option>
              <option value="GROWTH">GROWTH</option>
              <option value="STRATEGIC">STRATEGIC</option>
              <option value="ELITE">ELITE</option>
            </select>
            <input
              value={tierForm.minQualifiedLeads}
              onChange={(event) => setTierForm((prev) => ({ ...prev, minQualifiedLeads: event.target.value }))}
              aria-label="最低合格线索"
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              placeholder="最低合格线索"
            />
            <input
              value={tierForm.revenueShareBasisPoints}
              onChange={(event) =>
                setTierForm((prev) => ({ ...prev, revenueShareBasisPoints: event.target.value }))
              }
              aria-label="分成比例 bps"
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              placeholder="分成比例 bps"
            />
          </div>
          <input
            value={tierForm.settlementCycleDays}
            onChange={(event) => setTierForm((prev) => ({ ...prev, settlementCycleDays: event.target.value }))}
            aria-label="结算周期(天)"
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            placeholder="结算周期(天)"
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={tierForm.active}
              onChange={(event) => setTierForm((prev) => ({ ...prev, active: event.target.checked }))}
            />
            <span>等级启用</span>
          </label>
          <Button
            disabled={pendingAction !== null}
            onClick={() =>
              runAction(
                "save-tier",
                () =>
                  requestJson("/api/partners/tiers", {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      id: tierForm.id,
                      name: tierForm.name,
                      level: tierForm.level,
                      minQualifiedLeads: Number(tierForm.minQualifiedLeads),
                      revenueShareBasisPoints: Number(tierForm.revenueShareBasisPoints),
                      settlementCycleDays: Number(tierForm.settlementCycleDays),
                      active: tierForm.active,
                    }),
                  }),
                "合作伙伴等级已保存"
              )
            }
          >
            {pendingAction === "save-tier" ? "保存中..." : "保存等级与权益"}
          </Button>
        </div>

        <div className="space-y-3 rounded-lg border border-border bg-background p-4">
          <p className="text-sm font-medium">线索归因与分成规则</p>
          <select
            value={leadForm.tierId}
            onChange={(event) => setLeadForm((prev) => ({ ...prev, tierId: event.target.value }))}
            aria-label="线索等级"
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">选择合作伙伴等级</option>
            {tiers.map((tier) => (
              <option key={tier.id} value={tier.id}>
                {tier.name} · {tier.level}
              </option>
            ))}
          </select>
          <input
            value={leadForm.leadName}
            onChange={(event) => setLeadForm((prev) => ({ ...prev, leadName: event.target.value }))}
            aria-label="线索名称"
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            placeholder="线索名称"
          />
          <div className="grid gap-2 sm:grid-cols-2">
            <input
              value={leadForm.company}
              onChange={(event) => setLeadForm((prev) => ({ ...prev, company: event.target.value }))}
              aria-label="公司名称"
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              placeholder="公司名称"
            />
            <input
              value={leadForm.sourceChannel}
              onChange={(event) => setLeadForm((prev) => ({ ...prev, sourceChannel: event.target.value }))}
              aria-label="来源渠道"
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              placeholder="来源渠道"
            />
          </div>
          <input
            value={leadForm.attributionCode}
            onChange={(event) => setLeadForm((prev) => ({ ...prev, attributionCode: event.target.value }))}
            aria-label="归因编码"
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            placeholder="归因编码"
          />
          <div className="grid gap-2 sm:grid-cols-3">
            <select
              value={leadForm.status}
              onChange={(event) => setLeadForm((prev) => ({ ...prev, status: event.target.value }))}
              aria-label="线索状态"
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="NEW">NEW</option>
              <option value="QUALIFIED">QUALIFIED</option>
              <option value="WON">WON</option>
              <option value="LOST">LOST</option>
              <option value="INVALID">INVALID</option>
            </select>
            <input
              value={leadForm.estimatedDealCents}
              onChange={(event) => setLeadForm((prev) => ({ ...prev, estimatedDealCents: event.target.value }))}
              aria-label="预计金额(分)"
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              placeholder="预计金额(分)"
            />
            <input
              value={leadForm.closedDealCents}
              onChange={(event) => setLeadForm((prev) => ({ ...prev, closedDealCents: event.target.value }))}
              aria-label="成交金额(分)"
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              placeholder="成交金额(分)"
            />
          </div>
          <Button
            disabled={pendingAction !== null || !leadForm.tierId}
            onClick={() =>
              runAction(
                "create-lead",
                () =>
                  requestJson("/api/partners/leads", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      tierId: leadForm.tierId,
                      leadName: leadForm.leadName,
                      company: leadForm.company,
                      sourceChannel: leadForm.sourceChannel,
                      attributionCode: leadForm.attributionCode,
                      status: leadForm.status,
                      estimatedDealCents: Number(leadForm.estimatedDealCents),
                      closedDealCents: Number(leadForm.closedDealCents),
                    }),
                  }),
                "合作线索已创建"
              )
            }
          >
            {pendingAction === "create-lead" ? "创建中..." : "录入线索归因"}
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-background p-4 space-y-3">
        <p className="text-sm font-medium">输出合作伙伴仪表板与结算管理</p>
        <div className="grid gap-2 md:grid-cols-3">
          <div className="rounded-md border border-border bg-muted/20 p-3">
            <p className="text-xs text-muted-foreground">合格线索</p>
            <p className="mt-1 text-base font-semibold">{summary.qualifiedLeads}</p>
          </div>
          <div className="rounded-md border border-border bg-muted/20 p-3">
            <p className="text-xs text-muted-foreground">预计分成</p>
            <p className="mt-1 text-base font-semibold">{formatCny(summary.estimatedPayoutCents)}</p>
          </div>
          <div className="rounded-md border border-border bg-muted/20 p-3">
            <p className="text-xs text-muted-foreground">线索池未结算</p>
            <p className="mt-1 text-base font-semibold">{leads.filter((item) => !item.settlementId).length}</p>
          </div>
        </div>

        <div className="grid gap-2 xl:grid-cols-2">
          <div className="space-y-2 rounded-md border border-border bg-muted/10 p-3">
            <p className="text-sm font-medium">创建结算批次</p>
            <select
              value={settlementCreateForm.tierId}
              onChange={(event) =>
                setSettlementCreateForm((prev) => ({ ...prev, tierId: event.target.value }))
              }
              aria-label="结算等级"
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">选择等级</option>
              {tiers.map((tier) => (
                <option key={tier.id} value={tier.id}>
                  {tier.name} · {tier.level}
                </option>
              ))}
            </select>
            <div className="grid gap-2 sm:grid-cols-2">
              <input
                type="datetime-local"
                value={settlementCreateForm.periodStart}
                onChange={(event) =>
                  setSettlementCreateForm((prev) => ({ ...prev, periodStart: event.target.value }))
                }
                aria-label="结算开始时间"
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              />
              <input
                type="datetime-local"
                value={settlementCreateForm.periodEnd}
                onChange={(event) =>
                  setSettlementCreateForm((prev) => ({ ...prev, periodEnd: event.target.value }))
                }
                aria-label="结算结束时间"
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              />
            </div>
            <input
              value={settlementCreateForm.actualPayoutCents}
              onChange={(event) =>
                setSettlementCreateForm((prev) => ({ ...prev, actualPayoutCents: event.target.value }))
              }
              aria-label="实际应付(分，可留空自动计算)"
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              placeholder="实际应付(分，可留空自动计算)"
            />
            <input
              value={settlementCreateForm.payoutReference}
              onChange={(event) =>
                setSettlementCreateForm((prev) => ({ ...prev, payoutReference: event.target.value }))
              }
              aria-label="结算付款流水号"
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              placeholder="结算付款流水号(可选)"
            />
            <Button
              disabled={pendingAction !== null || !settlementCreateForm.tierId}
              onClick={() =>
                runAction(
                  "create-settlement",
                  async () => {
                    const payload = (await requestJson("/api/partners/settlements", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        tierId: settlementCreateForm.tierId,
                        periodStart: toIsoDateTime(settlementCreateForm.periodStart),
                        periodEnd: toIsoDateTime(settlementCreateForm.periodEnd),
                        ...(settlementCreateForm.actualPayoutCents.trim()
                          ? { actualPayoutCents: Number(settlementCreateForm.actualPayoutCents) }
                          : {}),
                        payoutReference: settlementCreateForm.payoutReference,
                      }),
                    })) as { settlement?: SettlementRow }
                    if (!payload.settlement) {
                      return
                    }
                    setSelectedSettlementId(payload.settlement.id)
                    setSettlementUpdateForm((prev) => ({
                      ...prev,
                      payoutReference: payload.settlement?.payoutReference || prev.payoutReference,
                      actualPayoutCents: "",
                      note: "",
                    }))
                  },
                  "结算批次已创建"
                )
              }
            >
              {pendingAction === "create-settlement" ? "结算中..." : "执行合作结算"}
            </Button>
          </div>

          <div className="space-y-2 rounded-md border border-border bg-muted/10 p-3">
            <p className="text-sm font-medium">验证合作收益对账流程</p>
            <select
              value={selectedSettlementId}
              onChange={(event) => setSelectedSettlementId(event.target.value)}
              aria-label="选择结算批次"
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">选择结算批次</option>
              {settlements.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.id.slice(0, 8)} · {item.status} · {formatCny(item.payoutAmountCents)}
                </option>
              ))}
            </select>
            <div className="grid gap-2 sm:grid-cols-2">
              <select
                value={settlementUpdateForm.status}
                onChange={(event) =>
                  setSettlementUpdateForm((prev) => ({ ...prev, status: event.target.value }))
                }
                aria-label="更新结算状态"
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="PENDING">PENDING</option>
                <option value="PROCESSING">PROCESSING</option>
                <option value="PAID">PAID</option>
                <option value="DISPUTED">DISPUTED</option>
              </select>
              <input
                value={settlementUpdateForm.actualPayoutCents}
                onChange={(event) =>
                  setSettlementUpdateForm((prev) => ({ ...prev, actualPayoutCents: event.target.value }))
                }
                aria-label="实际支付(分)"
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                placeholder="实际支付(分)"
              />
            </div>
            <input
              value={settlementUpdateForm.payoutReference}
              onChange={(event) =>
                setSettlementUpdateForm((prev) => ({ ...prev, payoutReference: event.target.value }))
              }
              aria-label="付款流水号"
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              placeholder="付款流水号"
            />
            <textarea
              value={settlementUpdateForm.note}
              onChange={(event) => setSettlementUpdateForm((prev) => ({ ...prev, note: event.target.value }))}
              aria-label="对账说明"
              className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="对账说明"
            />
            <Button
              disabled={pendingAction !== null || !selectedSettlementId}
              onClick={() =>
                runAction(
                  "update-settlement",
                  () =>
                    requestJson(`/api/partners/settlements/${selectedSettlementId}`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        status: settlementUpdateForm.status,
                        ...(settlementUpdateForm.actualPayoutCents.trim()
                          ? { actualPayoutCents: Number(settlementUpdateForm.actualPayoutCents) }
                          : {}),
                        payoutReference: settlementUpdateForm.payoutReference,
                        note: settlementUpdateForm.note,
                      }),
                    }),
                  "对账结果已更新"
                )
              }
            >
              {pendingAction === "update-settlement" ? "更新中..." : "更新结算状态"}
            </Button>
          </div>
        </div>

        <div>
          <p className="text-sm font-medium">最近结算批次</p>
          {settlements.length === 0 ? (
            <p className="mt-1 text-sm text-muted-foreground">暂无合作伙伴结算批次。</p>
          ) : (
            <div className="mt-2 space-y-2 text-sm">
              {settlements.slice(0, 4).map((item) => (
                <div key={item.id} className="rounded-md border border-border bg-muted/10 px-3 py-2">
                  <p className="font-medium">
                    {item.id.slice(0, 8)} · {item.status}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    线索 {item.leadCount} 条 · 赢单 {item.wonLeadCount} 条 · 应付 {formatCny(item.payoutAmountCents)} ·
                    差异 {formatCny(item.reconciledDeltaCents)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
