"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { SupportTicketPriority, SupportTicketStatus, SupportTicketTier } from "@prisma/client"

import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toaster"

type TicketRow = {
  id: string
  ticketNo: string
  title: string
  category: string
  status: SupportTicketStatus
  priority: SupportTicketPriority
  tier: SupportTicketTier
  responseDueAt: string | null
  createdAt: string
}

type SupportPolicy = {
  tier: SupportTicketTier
  slaHours: number
  maxPriority: SupportTicketPriority
  label: string
}

type SupportTicketPanelProps = {
  policy: SupportPolicy
  tickets: TicketRow[]
}

async function requestJson(path: string, init: RequestInit) {
  const response = await fetch(path, init)
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(String(payload?.error || "请求失败"))
  }
  return payload
}

export function SupportTicketPanel({ policy, tickets }: SupportTicketPanelProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [category, setCategory] = useState("general")
  const [priority, setPriority] = useState<SupportTicketPriority>(SupportTicketPriority.NORMAL)
  const [pendingAction, setPendingAction] = useState<string | null>(null)

  const availablePriorities = useMemo(() => {
    if (policy.maxPriority === SupportTicketPriority.NORMAL) {
      return [SupportTicketPriority.LOW, SupportTicketPriority.NORMAL]
    }
    if (policy.maxPriority === SupportTicketPriority.HIGH) {
      return [SupportTicketPriority.LOW, SupportTicketPriority.NORMAL, SupportTicketPriority.HIGH]
    }
    return [
      SupportTicketPriority.LOW,
      SupportTicketPriority.NORMAL,
      SupportTicketPriority.HIGH,
      SupportTicketPriority.URGENT,
    ]
  }, [policy.maxPriority])

  async function runAction(actionKey: string, fn: () => Promise<unknown>, success: string) {
    setPendingAction(actionKey)
    try {
      await fn()
      toast({ title: success, type: "success" })
      router.refresh()
    } catch (error) {
      toast({
        title: "操作失败",
        description: error instanceof Error ? error.message : "请稍后重试",
        type: "error",
      })
    } finally {
      setPendingAction(null)
    }
  }

  async function createTicket() {
    await runAction(
      "create-ticket",
      () =>
        requestJson("/api/support/tickets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title,
            description,
            category,
            priority,
          }),
        }),
      "工单已创建"
    )
    setTitle("")
    setDescription("")
    setCategory("general")
    setPriority(SupportTicketPriority.NORMAL)
  }

  function quickUpdate(ticketId: string, nextStatus: SupportTicketStatus) {
    return runAction(
      `ticket-${ticketId}-${nextStatus}`,
      () =>
        requestJson(`/api/support/tickets/${ticketId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: nextStatus }),
        }),
      "工单状态已更新"
    )
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-muted/20 p-4">
        <p className="text-sm font-medium">当前支持等级：{policy.label}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          SLA 响应目标 {policy.slaHours} 小时，最高可提交优先级 {policy.maxPriority}。
        </p>
      </div>

      <div className="grid gap-3">
        <input
          aria-label="工单标题"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          placeholder="工单标题（例如：发布流阻塞）"
        />
        <textarea
          aria-label="工单描述"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          placeholder="请描述问题现象、复现步骤、期望结果"
        />
        <div className="grid gap-2 sm:grid-cols-3">
          <select
            aria-label="工单分类"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="general">通用问题</option>
            <option value="billing">账单与订阅</option>
            <option value="quality">评测与质量</option>
            <option value="permission">权限与访问</option>
          </select>

          <select
            aria-label="工单优先级"
            value={priority}
            onChange={(event) => setPriority(event.target.value as SupportTicketPriority)}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            {availablePriorities.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>

          <Button
            disabled={pendingAction !== null || !title.trim() || !description.trim()}
            onClick={createTicket}
          >
            {pendingAction === "create-ticket" ? "提交中..." : "提交工单"}
          </Button>
        </div>
      </div>

      {tickets.length === 0 ? (
        <p className="text-sm text-muted-foreground">暂无支持工单。</p>
      ) : (
        <div className="space-y-3">
          {tickets.map((ticket) => (
            <div key={ticket.id} className="rounded-lg border border-border bg-background p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold">{ticket.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {ticket.ticketNo} · {ticket.category} · {ticket.priority} · {ticket.tier}
                  </p>
                </div>
                <span className="rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground">
                  {ticket.status}
                </span>
              </div>

              <p className="mt-2 text-xs text-muted-foreground">
                创建于 {new Date(ticket.createdAt).toLocaleString("zh-CN")} · 响应截止{" "}
                {ticket.responseDueAt ? new Date(ticket.responseDueAt).toLocaleString("zh-CN") : "-"}
              </p>

              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pendingAction !== null}
                  onClick={() => quickUpdate(ticket.id, SupportTicketStatus.IN_PROGRESS)}
                >
                  标记处理中
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pendingAction !== null}
                  onClick={() => quickUpdate(ticket.id, SupportTicketStatus.WAITING_USER)}
                >
                  标记待我回复
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pendingAction !== null}
                  onClick={() => quickUpdate(ticket.id, SupportTicketStatus.RESOLVED)}
                >
                  标记已解决
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pendingAction !== null}
                  onClick={() => quickUpdate(ticket.id, SupportTicketStatus.CLOSED)}
                >
                  关闭工单
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
