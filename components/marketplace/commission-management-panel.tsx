"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toaster"

type RuleRow = {
  id: string
  name: string
  category: string
  creatorRateBasisPoints: number
  platformRateBasisPoints: number
  settlementCycleDays: number
  minimumPayoutCents: number
  currency: string
  active: boolean
}

type LedgerRow = {
  id: string
  status: string
  grossAmountCents: number
  creatorCommissionCents: number
  platformCommissionCents: number
  settlementPeriodStart: string
  settlementPeriodEnd: string
  sourceInvoice: {
    id: string
    invoiceNo: string
    status: string
  } | null
}

type SettlementRow = {
  id: string
  status: "PENDING" | "PROCESSING" | "PAID" | "FAILED"
  currency: string
  periodStart: string
  periodEnd: string
  ledgerCount: number
  grossAmountCents: number
  payoutAmountCents: number
  payoutReference: string | null
  summary: string | null
  processedAt: string | null
  createdAt: string
}

type Summary = {
  grossAmountCents: number
  creatorCommissionCents: number
  platformCommissionCents: number
  payoutAmountCents: number
}

type CommissionManagementPanelProps = {
  hasAccess: boolean
  planId: string
  rules: RuleRow[]
  ledgers: LedgerRow[]
  settlements: SettlementRow[]
  pendingSummary: Summary
}

async function requestJson(path: string, init?: RequestInit) {
  const response = await fetch(path, init)
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(String(payload?.error || "请求失败"))
  }
  return payload
}

const dateTimeFormatter = new Intl.DateTimeFormat("zh-CN", {
  timeZone: "Asia/Shanghai",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
})

const dateFormatter = new Intl.DateTimeFormat("zh-CN", {
  timeZone: "Asia/Shanghai",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
})

function formatCny(valueCents: number) {
  return (valueCents / 100).toLocaleString("zh-CN", {
    style: "currency",
    currency: "CNY",
  })
}

function formatDateTime(value: string) {
  return dateTimeFormatter.format(new Date(value))
}

function formatDate(value: string) {
  return dateFormatter.format(new Date(value))
}

export function CommissionManagementPanel({
  hasAccess,
  planId,
  rules,
  ledgers,
  settlements,
  pendingSummary,
}: CommissionManagementPanelProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [pendingAction, setPendingAction] = useState<string | null>(null)

  const activeRule = useMemo(() => rules.find((item) => item.active) || rules[0] || null, [rules])
  const [ruleForm, setRuleForm] = useState({
    id: activeRule?.id || "",
    name: activeRule?.name || "标准提示词模板分成",
    category: activeRule?.category || "prompt-template",
    creatorRateBasisPoints: String(activeRule?.creatorRateBasisPoints || 7000),
    platformRateBasisPoints: String(activeRule?.platformRateBasisPoints || 3000),
    settlementCycleDays: String(activeRule?.settlementCycleDays || 30),
    minimumPayoutCents: String(activeRule?.minimumPayoutCents || 10000),
    active: activeRule?.active ?? true,
  })

  const [settlementSummary, setSettlementSummary] = useState("")
  const [selectedSettlementId, setSelectedSettlementId] = useState(settlements[0]?.id || "")
  const [selectedSettlementStatus, setSelectedSettlementStatus] = useState(
    settlements[0]?.status || "PAID"
  )

  function selectSettlement(settlementId: string) {
    setSelectedSettlementId(settlementId)
    const settlement = settlements.find((item) => item.id === settlementId)
    setSelectedSettlementStatus(settlement?.status || "PAID")
    setSettlementSummary(settlement?.summary || "")
  }

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
          应用市场佣金体系仅对 Pro / Team / Enterprise 套餐开放。
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded-lg border border-border bg-muted/20 p-4">
          <p className="text-xs text-muted-foreground">待结算流水金额</p>
          <p className="mt-1 text-lg font-semibold">{formatCny(pendingSummary.grossAmountCents)}</p>
        </div>
        <div className="rounded-lg border border-border bg-muted/20 p-4">
          <p className="text-xs text-muted-foreground">创作者佣金</p>
          <p className="mt-1 text-lg font-semibold">{formatCny(pendingSummary.creatorCommissionCents)}</p>
        </div>
        <div className="rounded-lg border border-border bg-muted/20 p-4">
          <p className="text-xs text-muted-foreground">平台佣金</p>
          <p className="mt-1 text-lg font-semibold">{formatCny(pendingSummary.platformCommissionCents)}</p>
        </div>
        <div className="rounded-lg border border-border bg-muted/20 p-4">
          <p className="text-xs text-muted-foreground">预计结算金额</p>
          <p className="mt-1 text-lg font-semibold">{formatCny(pendingSummary.payoutAmountCents)}</p>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="space-y-3 rounded-lg border border-border bg-background p-4">
          <p className="text-sm font-medium">市场分成规则与结算周期</p>
          <input
            value={ruleForm.name}
            onChange={(event) => setRuleForm((prev) => ({ ...prev, name: event.target.value }))}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            placeholder="规则名称"
            aria-label="规则名称"
          />
          <input
            value={ruleForm.category}
            onChange={(event) => setRuleForm((prev) => ({ ...prev, category: event.target.value }))}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            placeholder="分类"
            aria-label="分类"
          />
          <div className="grid gap-2 sm:grid-cols-2">
            <input
              value={ruleForm.creatorRateBasisPoints}
              onChange={(event) =>
                setRuleForm((prev) => ({ ...prev, creatorRateBasisPoints: event.target.value }))
              }
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              placeholder="创作者分成 bps"
              aria-label="创作者分成 bps"
            />
            <input
              value={ruleForm.platformRateBasisPoints}
              onChange={(event) =>
                setRuleForm((prev) => ({ ...prev, platformRateBasisPoints: event.target.value }))
              }
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              placeholder="平台分成 bps"
              aria-label="平台分成 bps"
            />
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <input
              value={ruleForm.settlementCycleDays}
              onChange={(event) =>
                setRuleForm((prev) => ({ ...prev, settlementCycleDays: event.target.value }))
              }
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              placeholder="结算周期（天）"
              aria-label="结算周期（天）"
            />
            <input
              value={ruleForm.minimumPayoutCents}
              onChange={(event) =>
                setRuleForm((prev) => ({ ...prev, minimumPayoutCents: event.target.value }))
              }
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              placeholder="最小结算金额（分）"
              aria-label="最小结算金额（分）"
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={ruleForm.active}
              onChange={(event) => setRuleForm((prev) => ({ ...prev, active: event.target.checked }))}
            />
            <span>规则生效</span>
          </label>
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={pendingAction !== null}
              onClick={() =>
                runAction(
                  "save-rule",
                  () =>
                    requestJson("/api/marketplace/commission/rules", {
                      method: "PUT",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        id: ruleForm.id,
                        name: ruleForm.name,
                        category: ruleForm.category,
                        creatorRateBasisPoints: Number(ruleForm.creatorRateBasisPoints),
                        platformRateBasisPoints: Number(ruleForm.platformRateBasisPoints),
                        settlementCycleDays: Number(ruleForm.settlementCycleDays),
                        minimumPayoutCents: Number(ruleForm.minimumPayoutCents),
                        active: ruleForm.active,
                      }),
                    }),
                  "佣金规则已更新"
                )
              }
            >
              {pendingAction === "save-rule" ? "保存中..." : "保存佣金规则"}
            </Button>
            <Button
              variant="outline"
              disabled={pendingAction !== null}
              onClick={() =>
                runAction(
                  "sync-ledger",
                  () =>
                    requestJson("/api/marketplace/commission/ledger", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ ruleId: ruleForm.id }),
                    }),
                  "佣金台账已同步"
                )
              }
            >
              {pendingAction === "sync-ledger" ? "同步中..." : "同步创作者收益台账"}
            </Button>
          </div>
        </div>

        <div className="space-y-3 rounded-lg border border-border bg-background p-4">
          <p className="text-sm font-medium">佣金结算状态追踪</p>
          <textarea
            value={settlementSummary}
            onChange={(event) => setSettlementSummary(event.target.value)}
            className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder="结算说明"
            aria-label="结算说明"
          />
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={pendingAction !== null}
              onClick={() =>
                runAction(
                  "create-settlement",
                  async () => {
                    const payload = (await requestJson("/api/marketplace/commission/settlements", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ summary: settlementSummary }),
                    })) as { settlement?: SettlementRow }
                    if (!payload.settlement) {
                      return
                    }
                    selectSettlement(payload.settlement.id)
                  },
                  "结算批次已创建"
                )
              }
            >
              {pendingAction === "create-settlement" ? "结算中..." : "执行结算"}
            </Button>
            <select
              value={selectedSettlementId}
              onChange={(event) => selectSettlement(event.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              aria-label="选择结算批次"
            >
              <option value="">选择结算批次</option>
              {settlements.map((item) => (
                <option key={item.id} value={item.id}>
                  {formatDateTime(item.createdAt)} · {item.status}
                </option>
              ))}
            </select>
            <select
              value={selectedSettlementStatus}
              onChange={(event) => setSelectedSettlementStatus(event.target.value as SettlementRow["status"])}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              aria-label="结算状态"
            >
              <option value="PENDING">PENDING</option>
              <option value="PROCESSING">PROCESSING</option>
              <option value="PAID">PAID</option>
              <option value="FAILED">FAILED</option>
            </select>
            <Button
              variant="outline"
              disabled={pendingAction !== null || !selectedSettlementId}
              onClick={() =>
                runAction(
                  "update-settlement",
                  () =>
                    requestJson(`/api/marketplace/commission/settlements/${selectedSettlementId}`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        status: selectedSettlementStatus,
                        summary: settlementSummary,
                      }),
                    }),
                  "结算状态已更新"
                )
              }
            >
              {pendingAction === "update-settlement" ? "更新中..." : "更新结算状态"}
            </Button>
          </div>

          <div className="rounded-md border border-border p-3 text-xs">
            <p className="font-medium">最近结算批次</p>
            {settlements.length === 0 ? (
              <p className="mt-1 text-muted-foreground">暂无结算批次。</p>
            ) : (
              <div className="mt-2 space-y-2">
                {settlements.slice(0, 6).map((item) => (
                  <div key={item.id} className="rounded border border-border px-2 py-1">
                    <p>
                      [{item.status}] {formatDate(item.periodStart)} - {formatDate(item.periodEnd)}
                    </p>
                    <p className="text-muted-foreground">
                      流水 {item.ledgerCount} 条 · 结算 {formatCny(item.payoutAmountCents)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-background p-4">
        <p className="text-sm font-medium">创作者收益统计与账单</p>
        {ledgers.length === 0 ? (
          <p className="mt-2 text-xs text-muted-foreground">暂无佣金台账，请先同步收益数据。</p>
        ) : (
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="text-left text-muted-foreground">
                <tr>
                  <th className="border-b px-2 py-2 font-medium">状态</th>
                  <th className="border-b px-2 py-2 font-medium">账单</th>
                  <th className="border-b px-2 py-2 font-medium">流水金额</th>
                  <th className="border-b px-2 py-2 font-medium">创作者佣金</th>
                  <th className="border-b px-2 py-2 font-medium">平台佣金</th>
                  <th className="border-b px-2 py-2 font-medium">结算周期</th>
                </tr>
              </thead>
              <tbody>
                {ledgers.slice(0, 20).map((item) => (
                  <tr key={item.id}>
                    <td className="border-b px-2 py-2">{item.status}</td>
                    <td className="border-b px-2 py-2 text-xs text-muted-foreground">
                      {item.sourceInvoice?.invoiceNo || "-"}
                    </td>
                    <td className="border-b px-2 py-2">{formatCny(item.grossAmountCents)}</td>
                    <td className="border-b px-2 py-2">{formatCny(item.creatorCommissionCents)}</td>
                    <td className="border-b px-2 py-2">{formatCny(item.platformCommissionCents)}</td>
                    <td className="border-b px-2 py-2 text-xs text-muted-foreground">
                      {formatDate(item.settlementPeriodStart)} - {formatDate(item.settlementPeriodEnd)}
                    </td>
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
