"use client"

import { useCallback, useEffect, useState } from "react"
import { GitBranch, SendToBack } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/components/ui/toaster"

interface PromptWorkflowPayload {
  id: string
  title: string
  isPublic: boolean
  publishStatus: "DRAFT" | "IN_REVIEW" | "PUBLISHED" | "ARCHIVED"
  transitions: Array<"DRAFT" | "IN_REVIEW" | "PUBLISHED" | "ARCHIVED">
  history: Array<{
    id: string
    from: "DRAFT" | "IN_REVIEW" | "PUBLISHED" | "ARCHIVED" | null
    to: "DRAFT" | "IN_REVIEW" | "PUBLISHED" | "ARCHIVED" | null
    note: string | null
    createdAt: string
    actor: {
      id: string
      name: string | null
      email: string | null
    } | null
  }>
  updatedAt: string
}

interface PromptWorkflowPanelProps {
  promptId: string
  canManage: boolean
}

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "草稿",
  IN_REVIEW: "待审核",
  PUBLISHED: "已发布",
  ARCHIVED: "已归档",
}

export function PromptWorkflowPanel({ promptId, canManage }: PromptWorkflowPanelProps) {
  const { toast } = useToast()
  const [payload, setPayload] = useState<PromptWorkflowPayload | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadingStatus, setLoadingStatus] = useState<string | null>(null)

  const fetchWorkflow = useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/prompts/${promptId}/workflow`)
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data?.error || "加载发布状态失败")
      }

      setPayload(data as PromptWorkflowPayload)
    } catch (error) {
      toast({
        type: "error",
        title: "加载发布状态失败",
        description: error instanceof Error ? error.message : "请稍后重试",
      })
    } finally {
      setIsLoading(false)
    }
  }, [promptId, toast])

  useEffect(() => {
    void fetchWorkflow()
  }, [fetchWorkflow])

  const handleTransition = async (status: PromptWorkflowPayload["publishStatus"]) => {
    if (!canManage) {
      return
    }

    setLoadingStatus(status)
    try {
      const response = await fetch(`/api/prompts/${promptId}/workflow`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status,
          note: `Transition to ${status}`,
        }),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data?.error || "状态流转失败")
      }

      toast({
        type: "success",
        title: "状态已更新",
        description: `当前状态：${STATUS_LABELS[data.publishStatus] || data.publishStatus}`,
      })

      await fetchWorkflow()
    } catch (error) {
      toast({
        type: "error",
        title: "状态流转失败",
        description: error instanceof Error ? error.message : "请稍后重试",
      })
    } finally {
      setLoadingStatus(null)
    }
  }

  if (!canManage) {
    return null
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <GitBranch className="h-4 w-4" aria-hidden="true" />
          发布状态机
        </CardTitle>
        <CardDescription>草稿 / 审核 / 发布 / 归档的状态流转控制。</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">正在加载发布状态...</p>
        ) : payload ? (
          <>
            <div className="rounded-md border border-border bg-muted/30 p-3 text-sm">
              <p>当前状态：{STATUS_LABELS[payload.publishStatus] || payload.publishStatus}</p>
              <p className="text-muted-foreground">最后更新时间：{new Date(payload.updatedAt).toLocaleString("zh-CN")}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {payload.transitions.map((status) => (
                <Button
                  key={status}
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={loadingStatus !== null}
                  onClick={() => void handleTransition(status)}
                >
                  <SendToBack className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                  {loadingStatus === status ? "流转中..." : `流转到${STATUS_LABELS[status] || status}`}
                </Button>
              ))}
            </div>
            {payload.history.length > 0 ? (
              <div className="rounded-md border border-border bg-muted/20 p-3">
                <p className="mb-2 text-xs font-medium text-muted-foreground">状态流转历史</p>
                <div className="space-y-2">
                  {payload.history.map((item) => (
                    <div key={item.id} className="text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">
                        {STATUS_LABELS[item.from || ""] || item.from || "未知"} →{" "}
                        {STATUS_LABELS[item.to || ""] || item.to || "未知"}
                      </span>
                      <span>{` · ${new Date(item.createdAt).toLocaleString("zh-CN")}`}</span>
                      <span>{` · ${item.actor?.name || item.actor?.email || "系统"}`}</span>
                      {item.note ? <span>{` · ${item.note}`}</span> : null}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">暂无发布状态数据</p>
        )}
      </CardContent>
    </Card>
  )
}
