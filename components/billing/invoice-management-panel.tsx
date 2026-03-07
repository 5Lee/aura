"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { InlineNotice } from "@/components/ui/inline-notice"
import { usePersistentInlineNotice } from "@/components/ui/use-persistent-inline-notice"

type InvoiceProfileState = {
  title: string
  taxNumber: string
  billingEmail: string
  address: string
  phone: string
  bankName: string
  bankAccount: string
}

type InvoiceRow = {
  id: string
  invoiceNo: string
  type: string
  status: string
  totalCents: number
  refundedCents: number
  amountDueCents: number
  issuedAt: string
}

type InvoiceManagementPanelProps = {
  initialProfile: InvoiceProfileState
  invoices: InvoiceRow[]
}

function toCurrency(cents: number) {
  return `¥${(cents / 100).toFixed(2)}`
}

async function requestJson(path: string, init: RequestInit) {
  const response = await fetch(path, init)
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(String(payload?.error || "请求失败"))
  }
  return payload
}

export function InvoiceManagementPanel({ initialProfile, invoices }: InvoiceManagementPanelProps) {
  const router = useRouter()
  const [profile, setProfile] = useState(initialProfile)
  const [pendingAction, setPendingAction] = useState<string | null>(null)
  const { notice, setNotice, persistNotice } = usePersistentInlineNotice("invoice-management-panel")

  const canIssueInvoice = useMemo(() => {
    return profile.title.trim().length > 0 && profile.taxNumber.trim().length > 0
  }, [profile.taxNumber, profile.title])

  function updateField(key: keyof InvoiceProfileState, value: string) {
    setNotice(null)
    setProfile((prev) => ({
      ...prev,
      [key]: value,
    }))
  }

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

  return (
    <div className="space-y-4">
      {notice ? <InlineNotice tone={notice.tone} message={notice.message} /> : null}
      <div className="grid gap-3 md:grid-cols-2">
        <label className="space-y-1.5">
          <span className="text-sm text-muted-foreground">发票抬头</span>
          <input
            value={profile.title}
            onChange={(event) => updateField("title", event.target.value)}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            placeholder="请输入公司/个人抬头"
          />
        </label>
        <label className="space-y-1.5">
          <span className="text-sm text-muted-foreground">税号</span>
          <input
            value={profile.taxNumber}
            onChange={(event) => updateField("taxNumber", event.target.value)}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            placeholder="请输入纳税人识别号"
          />
        </label>
        <label className="space-y-1.5">
          <span className="text-sm text-muted-foreground">开票邮箱</span>
          <input
            value={profile.billingEmail}
            onChange={(event) => updateField("billingEmail", event.target.value)}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            placeholder="example@company.com"
          />
        </label>
        <label className="space-y-1.5">
          <span className="text-sm text-muted-foreground">联系电话</span>
          <input
            value={profile.phone}
            onChange={(event) => updateField("phone", event.target.value)}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            placeholder="010-12345678"
          />
        </label>
        <label className="space-y-1.5 md:col-span-2">
          <span className="text-sm text-muted-foreground">地址</span>
          <input
            value={profile.address}
            onChange={(event) => updateField("address", event.target.value)}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            placeholder="发票地址"
          />
        </label>
        <label className="space-y-1.5">
          <span className="text-sm text-muted-foreground">开户行</span>
          <input
            value={profile.bankName}
            onChange={(event) => updateField("bankName", event.target.value)}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            placeholder="开户银行"
          />
        </label>
        <label className="space-y-1.5">
          <span className="text-sm text-muted-foreground">银行账号</span>
          <input
            value={profile.bankAccount}
            onChange={(event) => updateField("bankAccount", event.target.value)}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            placeholder="银行账号"
          />
        </label>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <Button
          disabled={pendingAction !== null}
          onClick={() =>
            runAction(
              "save-profile",
              () =>
                requestJson("/api/billing/invoice-profile", {
                  method: "PUT",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(profile),
                }),
              "发票信息保存成功"
            )
          }
        >
          {pendingAction === "save-profile" ? "保存中..." : "保存发票信息"}
        </Button>

        <Button
          variant="outline"
          disabled={pendingAction !== null || !canIssueInvoice}
          onClick={() =>
            runAction(
              "issue-invoice",
              () =>
                requestJson("/api/billing/invoices", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({}),
                }),
              "发票已开具"
            )
          }
        >
          {pendingAction === "issue-invoice" ? "开具中..." : "开具本期发票"}
        </Button>

        <Button asChild variant="outline">
          <a href="/api/billing/invoices?format=csv">导出发票 CSV</a>
        </Button>
      </div>

      {invoices.length === 0 ? (
        <p className="text-sm text-muted-foreground">暂无发票记录。</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="text-left text-muted-foreground">
              <tr>
                <th className="border-b px-2 py-2 font-medium">发票编号</th>
                <th className="border-b px-2 py-2 font-medium">类型</th>
                <th className="border-b px-2 py-2 font-medium">状态</th>
                <th className="border-b px-2 py-2 font-medium">总额</th>
                <th className="border-b px-2 py-2 font-medium">已冲销</th>
                <th className="border-b px-2 py-2 font-medium">应收</th>
                <th className="border-b px-2 py-2 font-medium">日期</th>
                <th className="border-b px-2 py-2 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((invoice) => {
                const refundable = Math.max(0, invoice.totalCents - invoice.refundedCents)
                return (
                  <tr key={invoice.id}>
                    <td className="border-b px-2 py-2 text-xs text-muted-foreground">{invoice.invoiceNo}</td>
                    <td className="border-b px-2 py-2">{invoice.type}</td>
                    <td className="border-b px-2 py-2">{invoice.status}</td>
                    <td className="border-b px-2 py-2">{toCurrency(invoice.totalCents)}</td>
                    <td className="border-b px-2 py-2">{toCurrency(invoice.refundedCents)}</td>
                    <td className="border-b px-2 py-2">{toCurrency(invoice.amountDueCents)}</td>
                    <td className="border-b px-2 py-2 text-muted-foreground">
                      {new Date(invoice.issuedAt).toLocaleDateString("zh-CN")}
                    </td>
                    <td className="border-b px-2 py-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={pendingAction !== null || refundable <= 0}
                        onClick={() =>
                          runAction(
                            `refund-${invoice.id}`,
                            () =>
                              requestJson(`/api/billing/invoices/${invoice.id}/refund`, {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ refundCents: refundable }),
                              }),
                            "发票冲销完成"
                          )
                        }
                      >
                        {pendingAction === `refund-${invoice.id}` ? "处理中..." : "全额冲销"}
                      </Button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
