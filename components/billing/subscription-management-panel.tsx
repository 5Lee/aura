"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import type { BillingCycle, SubscriptionStatus } from "@prisma/client"

import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toaster"
import { isSubscriptionPlanId, type SubscriptionPlanId } from "@/lib/subscription-plans"

type SubscriptionManagementPanelProps = {
  currentPlanId: string
  currentCycle: BillingCycle
  currentStatus: SubscriptionStatus | null
  hasSubscription: boolean
  cancelAtPeriodEnd: boolean
}

async function requestJson(path: string, init: RequestInit) {
  const response = await fetch(path, init)
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(String(payload?.error || "请求失败"))
  }
  return payload
}

export function SubscriptionManagementPanel({
  currentPlanId,
  currentCycle,
  currentStatus,
  hasSubscription,
  cancelAtPeriodEnd,
}: SubscriptionManagementPanelProps) {
  const router = useRouter()
  const { toast } = useToast()
  const initialPlan = isSubscriptionPlanId(currentPlanId)
    ? currentPlanId
    : "free"
  const [planId, setPlanId] = useState<SubscriptionPlanId>(initialPlan)
  const [cycle, setCycle] = useState<BillingCycle>(currentCycle)
  const [pendingAction, setPendingAction] = useState<string | null>(null)

  const canCancel = useMemo(() => {
    return Boolean(hasSubscription && (currentStatus === "ACTIVE" || currentStatus === "TRIALING" || currentStatus === "PAST_DUE"))
  }, [currentStatus, hasSubscription])
  const canResume = useMemo(() => {
    return Boolean(hasSubscription && (cancelAtPeriodEnd || currentStatus === "CANCELED" || currentStatus === "EXPIRED"))
  }, [cancelAtPeriodEnd, currentStatus, hasSubscription])

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

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1.5">
          <span className="text-sm text-muted-foreground">目标套餐</span>
          <select
            value={planId}
            onChange={(event) => setPlanId(event.target.value as SubscriptionPlanId)}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="free">Free</option>
            <option value="pro">Pro</option>
            <option value="team">Team</option>
            <option value="enterprise">Enterprise</option>
          </select>
        </label>

        <label className="space-y-1.5">
          <span className="text-sm text-muted-foreground">计费周期</span>
          <select
            value={cycle}
            onChange={(event) => setCycle(event.target.value as BillingCycle)}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="MONTHLY">月付</option>
            <option value="YEARLY">年付</option>
          </select>
        </label>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Button
          disabled={pendingAction !== null}
          onClick={() =>
            runAction(
              "change-plan",
              () =>
                requestJson("/api/subscription/change-plan", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ planId, cycle }),
                }),
              "套餐切换成功"
            )
          }
        >
          {pendingAction === "change-plan" ? "切换中..." : "切换套餐"}
        </Button>

        <Button
          variant="outline"
          disabled={pendingAction !== null || !hasSubscription}
          onClick={() =>
            runAction(
              "renew",
              () =>
                requestJson("/api/subscription/renew", {
                  method: "POST",
                }),
              "续费处理成功"
            )
          }
        >
          {pendingAction === "renew" ? "续费中..." : "立即续费"}
        </Button>

        <Button
          variant="outline"
          disabled={pendingAction !== null || !canCancel}
          onClick={() =>
            runAction(
              "cancel",
              () =>
                requestJson("/api/subscription/cancel", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ atPeriodEnd: true }),
                }),
              "已设置到期取消"
            )
          }
        >
          {pendingAction === "cancel" ? "处理中..." : "取消订阅"}
        </Button>

        <Button
          variant="outline"
          disabled={pendingAction !== null || !canResume}
          onClick={() =>
            runAction(
              "resume",
              () =>
                requestJson("/api/subscription/resume", {
                  method: "POST",
                }),
              "订阅已恢复"
            )
          }
        >
          {pendingAction === "resume" ? "恢复中..." : "恢复订阅"}
        </Button>
      </div>
    </div>
  )
}
