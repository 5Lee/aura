"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toaster"

type RunbookConfig = {
  triageChecklist: string[]
  escalationWorkflow: string[]
  responseWorkflow: string[]
  contactMatrix: Array<{
    role: string
    team: string
    channel: string
    owner: string
  }>
  postmortemTemplate: {
    timeline: string[]
    impactAssessment: string[]
    rootCause: string[]
    actionItems: string[]
  }
}

type RunbookPayload = {
  id: string | null
  config: RunbookConfig
}

type EscalationPolicyRow = {
  id: string
  level: string
  fromTier: string
  fromPriority: string
  targetTier: string
  targetPriority: string
  targetTeam: string
  targetRole: string | null
  responseSlaHours: number
  resolutionSlaHours: number
  workflowSteps: string[]
  active: boolean
}

type EscalationEventRow = {
  id: string
  ticketId: string
  status: string
  level: string
  targetTeam: string
  reason: string
  createdAt: string
  ticket: {
    id: string
    ticketNo: string
    title: string
    status: string
  }
}

type PostmortemRow = {
  id: string
  ticketId: string
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED"
  severity: string
  summary: string
  impact: string | null
  rootCause: string | null
  timeline: unknown
  actionItems: unknown
  publishedAt: string | null
  createdAt: string
  updatedAt: string
  ticket: {
    id: string
    ticketNo: string
    title: string
    status: string
  }
}

type TicketOption = {
  id: string
  ticketNo: string
  title: string
  status: string
  priority: string
  tier: string
}

type CollaborationStats = {
  score: number
  handoffCount: number
  resolvedHandoffRate: number
  postmortemPublishRate: number
}

type EnterpriseSupportProcessPanelProps = {
  hasAccess: boolean
  planId: string
  runbook: RunbookPayload
  policies: EscalationPolicyRow[]
  events: EscalationEventRow[]
  postmortems: PostmortemRow[]
  tickets: TicketOption[]
  collaboration: CollaborationStats
}

async function requestJson(path: string, init?: RequestInit) {
  const response = await fetch(path, init)
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(String(payload?.error || "请求失败"))
  }
  return payload
}

function toLineText(value: string[]) {
  return value.join("\n")
}

function toJsonText(value: unknown) {
  return JSON.stringify(value, null, 2)
}

function splitLines(value: string) {
  return value
    .split(/\n+/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function toObject(value: string, fallback: unknown) {
  try {
    const parsed = JSON.parse(value)
    if (parsed && typeof parsed === "object") {
      return parsed
    }
    return fallback
  } catch {
    return fallback
  }
}

function toJsonArrayText(value: unknown) {
  return JSON.stringify(Array.isArray(value) ? value : [], null, 2)
}

function resolveOpenTickets(tickets: TicketOption[]) {
  return tickets.filter((ticket) => ticket.status !== "CLOSED")
}

export function EnterpriseSupportProcessPanel({
  hasAccess,
  planId,
  runbook,
  policies,
  events,
  postmortems,
  tickets,
  collaboration,
}: EnterpriseSupportProcessPanelProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [pendingAction, setPendingAction] = useState<string | null>(null)

  const openTickets = useMemo(() => resolveOpenTickets(tickets), [tickets])
  const [selectedTicketId, setSelectedTicketId] = useState(openTickets[0]?.id || "")
  const [escalationLevel, setEscalationLevel] = useState("L2")
  const [escalationReason, setEscalationReason] = useState("")

  const [runbookForm, setRunbookForm] = useState(() => ({
    triageChecklist: toLineText(runbook.config.triageChecklist),
    escalationWorkflow: toLineText(runbook.config.escalationWorkflow),
    responseWorkflow: toLineText(runbook.config.responseWorkflow),
    contactMatrix: toJsonText(runbook.config.contactMatrix),
    postmortemTemplate: toJsonText(runbook.config.postmortemTemplate),
  }))

  useEffect(() => {
    setRunbookForm({
      triageChecklist: toLineText(runbook.config.triageChecklist),
      escalationWorkflow: toLineText(runbook.config.escalationWorkflow),
      responseWorkflow: toLineText(runbook.config.responseWorkflow),
      contactMatrix: toJsonText(runbook.config.contactMatrix),
      postmortemTemplate: toJsonText(runbook.config.postmortemTemplate),
    })
  }, [runbook])

  useEffect(() => {
    if (!selectedTicketId && openTickets.length > 0) {
      setSelectedTicketId(openTickets[0].id)
    }
  }, [openTickets, selectedTicketId])

  const [postmortemTicketId, setPostmortemTicketId] = useState(openTickets[0]?.id || "")
  const [postmortemSummary, setPostmortemSummary] = useState("")
  const [postmortemDraftId, setPostmortemDraftId] = useState(postmortems[0]?.id || "")
  const selectedPostmortem = useMemo(
    () => postmortems.find((item) => item.id === postmortemDraftId) || null,
    [postmortemDraftId, postmortems]
  )

  const [draftForm, setDraftForm] = useState(() => ({
    summary: selectedPostmortem?.summary || "",
    impact: selectedPostmortem?.impact || "",
    rootCause: selectedPostmortem?.rootCause || "",
    severity: selectedPostmortem?.severity || "NORMAL",
    timeline: toJsonArrayText(selectedPostmortem?.timeline),
    actionItems: toJsonArrayText(selectedPostmortem?.actionItems),
  }))

  useEffect(() => {
    if (!postmortemDraftId && postmortems.length > 0) {
      setPostmortemDraftId(postmortems[0].id)
      return
    }

    setDraftForm({
      summary: selectedPostmortem?.summary || "",
      impact: selectedPostmortem?.impact || "",
      rootCause: selectedPostmortem?.rootCause || "",
      severity: selectedPostmortem?.severity || "NORMAL",
      timeline: toJsonArrayText(selectedPostmortem?.timeline),
      actionItems: toJsonArrayText(selectedPostmortem?.actionItems),
    })
  }, [postmortemDraftId, postmortems, selectedPostmortem])

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
          企业支持流程标准化仅对 Team / Enterprise 套餐开放。
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded-lg border border-border bg-muted/20 p-4">
          <p className="text-xs text-muted-foreground">跨团队协作效率</p>
          <p className="mt-1 text-lg font-semibold">{collaboration.score}</p>
        </div>
        <div className="rounded-lg border border-border bg-muted/20 p-4">
          <p className="text-xs text-muted-foreground">升级交接次数</p>
          <p className="mt-1 text-lg font-semibold">{collaboration.handoffCount}</p>
        </div>
        <div className="rounded-lg border border-border bg-muted/20 p-4">
          <p className="text-xs text-muted-foreground">交接闭环率</p>
          <p className="mt-1 text-lg font-semibold">{collaboration.resolvedHandoffRate}%</p>
        </div>
        <div className="rounded-lg border border-border bg-muted/20 p-4">
          <p className="text-xs text-muted-foreground">复盘发布率</p>
          <p className="mt-1 text-lg font-semibold">{collaboration.postmortemPublishRate}%</p>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="space-y-3 rounded-lg border border-border bg-background p-4">
          <p className="text-sm font-medium">故障响应 Runbook</p>
          <textarea
            value={runbookForm.triageChecklist}
            onChange={(event) =>
              setRunbookForm((prev) => ({ ...prev, triageChecklist: event.target.value }))
            }
            className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder="分诊检查清单（每行一条）"
          />
          <textarea
            value={runbookForm.escalationWorkflow}
            onChange={(event) =>
              setRunbookForm((prev) => ({ ...prev, escalationWorkflow: event.target.value }))
            }
            className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder="升级流程（每行一条）"
          />
          <textarea
            value={runbookForm.responseWorkflow}
            onChange={(event) =>
              setRunbookForm((prev) => ({ ...prev, responseWorkflow: event.target.value }))
            }
            className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder="响应流程（每行一条）"
          />
          <textarea
            value={runbookForm.contactMatrix}
            onChange={(event) =>
              setRunbookForm((prev) => ({ ...prev, contactMatrix: event.target.value }))
            }
            className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder="联系矩阵 JSON"
          />
          <textarea
            value={runbookForm.postmortemTemplate}
            onChange={(event) =>
              setRunbookForm((prev) => ({ ...prev, postmortemTemplate: event.target.value }))
            }
            className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder="复盘模板 JSON"
          />
          <Button
            disabled={pendingAction !== null}
            onClick={() =>
              runAction(
                "save-runbook",
                () =>
                  requestJson("/api/support/process/runbook", {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      triageChecklist: splitLines(runbookForm.triageChecklist),
                      escalationWorkflow: splitLines(runbookForm.escalationWorkflow),
                      responseWorkflow: splitLines(runbookForm.responseWorkflow),
                      contactMatrix: toObject(runbookForm.contactMatrix, runbook.config.contactMatrix),
                      postmortemTemplate: toObject(
                        runbookForm.postmortemTemplate,
                        runbook.config.postmortemTemplate
                      ),
                    }),
                  }),
                "Runbook 已保存"
              )
            }
          >
            {pendingAction === "save-runbook" ? "保存中..." : "保存 Runbook"}
          </Button>
        </div>

        <div className="space-y-3 rounded-lg border border-border bg-background p-4">
          <p className="text-sm font-medium">升级路径与协作编排</p>
          <select
            value={selectedTicketId}
            onChange={(event) => setSelectedTicketId(event.target.value)}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">选择工单</option>
            {openTickets.map((ticket) => (
              <option key={ticket.id} value={ticket.id}>
                {ticket.ticketNo} · {ticket.title}
              </option>
            ))}
          </select>
          <select
            value={escalationLevel}
            onChange={(event) => setEscalationLevel(event.target.value)}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="L1">L1</option>
            <option value="L2">L2</option>
            <option value="L3">L3</option>
            <option value="EXECUTIVE">EXECUTIVE</option>
          </select>
          <textarea
            value={escalationReason}
            onChange={(event) => setEscalationReason(event.target.value)}
            className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder="升级原因与交接说明"
          />
          <Button
            disabled={pendingAction !== null || !selectedTicketId || !escalationReason.trim()}
            onClick={() =>
              runAction(
                "create-escalation",
                () =>
                  requestJson("/api/support/process/escalations", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      ticketId: selectedTicketId,
                      level: escalationLevel,
                      reason: escalationReason,
                    }),
                  }),
                "升级事件已创建"
              )
            }
          >
            {pendingAction === "create-escalation" ? "升级中..." : "发起升级"}
          </Button>

          <div className="rounded-md border border-border p-3 text-xs">
            <p className="font-medium">升级策略（最近）</p>
            {policies.length === 0 ? (
              <p className="mt-1 text-muted-foreground">暂无升级策略。</p>
            ) : (
              <div className="mt-2 space-y-2">
                {policies.slice(0, 4).map((policy) => (
                  <div key={policy.id} className="rounded border border-border px-2 py-1">
                    <p>
                      {policy.level} · {policy.fromTier}/{policy.fromPriority} → {policy.targetTier}/
                      {policy.targetPriority}
                    </p>
                    <p className="text-muted-foreground">{policy.targetTeam}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-md border border-border p-3 text-xs">
            <p className="font-medium">升级事件（最近）</p>
            {events.length === 0 ? (
              <p className="mt-1 text-muted-foreground">暂无升级事件。</p>
            ) : (
              <div className="mt-2 space-y-2">
                {events.slice(0, 5).map((event) => (
                  <div key={event.id} className="rounded border border-border px-2 py-1">
                    <p>
                      [{event.status}] {event.ticket.ticketNo} · {event.level}
                    </p>
                    <p className="text-muted-foreground">{event.targetTeam}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-3 rounded-lg border border-border bg-background p-4">
        <p className="text-sm font-medium">问题复盘模板与发布</p>
        <div className="grid gap-3 md:grid-cols-[1fr_auto]">
          <select
            value={postmortemTicketId}
            onChange={(event) => setPostmortemTicketId(event.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">选择工单创建复盘</option>
            {openTickets.map((ticket) => (
              <option key={ticket.id} value={ticket.id}>
                {ticket.ticketNo} · {ticket.title}
              </option>
            ))}
          </select>
          <Button
            disabled={pendingAction !== null || !postmortemTicketId}
            onClick={() =>
              runAction(
                "create-postmortem",
                () =>
                  requestJson("/api/support/process/postmortems", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      ticketId: postmortemTicketId,
                      summary: postmortemSummary,
                    }),
                  }),
                "复盘草稿已创建"
              )
            }
          >
            {pendingAction === "create-postmortem" ? "创建中..." : "创建复盘草稿"}
          </Button>
        </div>
        <input
          value={postmortemSummary}
          onChange={(event) => setPostmortemSummary(event.target.value)}
          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          placeholder="可选：复盘摘要"
        />

        <select
          value={postmortemDraftId}
          onChange={(event) => setPostmortemDraftId(event.target.value)}
          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">选择复盘草稿</option>
          {postmortems.map((postmortem) => (
            <option key={postmortem.id} value={postmortem.id}>
              {postmortem.ticket.ticketNo} · {postmortem.status} · {postmortem.summary.slice(0, 32)}
            </option>
          ))}
        </select>

        {selectedPostmortem ? (
          <div className="space-y-2 rounded-md border border-border p-3 text-sm">
            <input
              value={draftForm.summary}
              onChange={(event) => setDraftForm((prev) => ({ ...prev, summary: event.target.value }))}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              placeholder="复盘摘要"
            />
            <textarea
              value={draftForm.impact}
              onChange={(event) => setDraftForm((prev) => ({ ...prev, impact: event.target.value }))}
              className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="影响评估"
            />
            <textarea
              value={draftForm.rootCause}
              onChange={(event) => setDraftForm((prev) => ({ ...prev, rootCause: event.target.value }))}
              className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="根因分析"
            />
            <select
              value={draftForm.severity}
              onChange={(event) => setDraftForm((prev) => ({ ...prev, severity: event.target.value }))}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="LOW">LOW</option>
              <option value="NORMAL">NORMAL</option>
              <option value="HIGH">HIGH</option>
              <option value="URGENT">URGENT</option>
            </select>
            <textarea
              value={draftForm.timeline}
              onChange={(event) => setDraftForm((prev) => ({ ...prev, timeline: event.target.value }))}
              className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="时间线 JSON"
            />
            <textarea
              value={draftForm.actionItems}
              onChange={(event) => setDraftForm((prev) => ({ ...prev, actionItems: event.target.value }))}
              className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="行动项 JSON"
            />
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={pendingAction !== null}
                onClick={() =>
                  runAction(
                    "save-postmortem",
                    () =>
                      requestJson(`/api/support/process/postmortems/${selectedPostmortem.id}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          summary: draftForm.summary,
                          impact: draftForm.impact,
                          rootCause: draftForm.rootCause,
                          severity: draftForm.severity,
                          timeline: toObject(draftForm.timeline, []),
                          actionItems: toObject(draftForm.actionItems, []),
                        }),
                      }),
                    "复盘草稿已更新"
                  )
                }
              >
                {pendingAction === "save-postmortem" ? "保存中..." : "保存复盘草稿"}
              </Button>
              <Button
                variant="outline"
                disabled={pendingAction !== null || selectedPostmortem.status === "PUBLISHED"}
                onClick={() =>
                  runAction(
                    "publish-postmortem",
                    () =>
                      requestJson(`/api/support/process/postmortems/${selectedPostmortem.id}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ status: "PUBLISHED" }),
                      }),
                    "复盘已发布"
                  )
                }
              >
                {pendingAction === "publish-postmortem" ? "发布中..." : "发布复盘"}
              </Button>
              <Button
                variant="outline"
                disabled={pendingAction !== null || selectedPostmortem.status === "ARCHIVED"}
                onClick={() =>
                  runAction(
                    "archive-postmortem",
                    () =>
                      requestJson(`/api/support/process/postmortems/${selectedPostmortem.id}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ status: "ARCHIVED" }),
                      }),
                    "复盘已归档"
                  )
                }
              >
                {pendingAction === "archive-postmortem" ? "归档中..." : "归档复盘"}
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">暂无复盘记录。</p>
        )}
      </div>
    </div>
  )
}
