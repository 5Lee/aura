"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toaster"

type ExperimentRow = {
  id: string
  name: string
  hypothesis: string
  segmentKey: string
  status: string
  baselineMetric: number
  targetMetric: number
  liftTargetPercent: number
  startAt: string
  endAt: string
}

type SnapshotRow = {
  id: string
  experimentId: string
  metricType: string
  exposures: number
  conversions: number
  retainedUsers: number
  revenueCents: number
  conversionRate: number
  liftPercent: number
  windowStart: string
  windowEnd: string
}

type SegmentRow = {
  id: string
  name: string
  key: string
  status: string
  version: number
  matchMode: string
  estimatedUsers: number
}

type AudienceRow = {
  id: string
  experimentId: string
  segmentId: string
  rolloutPercent: number
  excludedSegmentKeys: string[]
  status: string
  segment: {
    id: string
    name: string
    key: string
    estimatedUsers: number
    status: string
  }
}

type Summary = {
  totalExposures: number
  totalConversions: number
  totalRetainedUsers: number
  totalRevenueCents: number
  conversionRate: number
  liftPercent: number
  targetGap: number
}

type GrowthExperimentPanelProps = {
  hasAccess: boolean
  planId: string
  experiments: ExperimentRow[]
  snapshots: SnapshotRow[]
  segments: SegmentRow[]
  audiences: AudienceRow[]
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

export function GrowthExperimentPanel({
  hasAccess,
  planId,
  experiments,
  snapshots,
  segments,
  audiences,
  summary,
}: GrowthExperimentPanelProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [pendingAction, setPendingAction] = useState<string | null>(null)

  const defaultExperiment = useMemo(() => experiments[0] || null, [experiments])
  const defaultSegment = useMemo(() => segments.find((item) => item.status === "ACTIVE") || segments[0] || null, [segments])

  const [selectedExperimentId, setSelectedExperimentId] = useState(defaultExperiment?.id || "")
  const [selectedAudienceExperimentId, setSelectedAudienceExperimentId] = useState(defaultExperiment?.id || "")

  const [experimentForm, setExperimentForm] = useState({
    name: "",
    hypothesis: "",
    segmentKey: "",
    baselineMetric: "0",
    targetMetric: "0",
    liftTargetPercent: "20",
    startAt: toLocalDateTimeInputValue(new Date()),
    endAt: toLocalDateTimeInputValue(new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)),
    startNow: true,
  })

  const [segmentForm, setSegmentForm] = useState({
    id: defaultSegment?.id || "",
    name: defaultSegment?.name || "",
    key: defaultSegment?.key || "",
    status: defaultSegment?.status || "ACTIVE",
    matchMode: defaultSegment?.matchMode || "ALL",
    estimatedUsers: String(defaultSegment?.estimatedUsers || 0),
    description: "",
    ruleField: "signupDays",
    ruleOperator: "lte",
    ruleValue: "7",
  })

  const [audienceForm, setAudienceForm] = useState({
    segmentId: defaultSegment?.id || "",
    rolloutPercent: "100",
    excludedSegmentKeys: "",
  })

  const [updateForm, setUpdateForm] = useState({
    status: "RUNNING",
    metricType: "CONVERSION",
    exposures: "0",
    conversions: "0",
    retainedUsers: "0",
    revenueCents: "0",
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
        <p className="mt-1 text-muted-foreground">增长实验中心仅对 Pro / Team / Enterprise 套餐开放。</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded-lg border border-border bg-muted/20 p-4">
          <p className="text-xs text-muted-foreground">累计曝光</p>
          <p className="mt-1 text-lg font-semibold">{summary.totalExposures}</p>
        </div>
        <div className="rounded-lg border border-border bg-muted/20 p-4">
          <p className="text-xs text-muted-foreground">累计转化</p>
          <p className="mt-1 text-lg font-semibold">{summary.totalConversions}</p>
        </div>
        <div className="rounded-lg border border-border bg-muted/20 p-4">
          <p className="text-xs text-muted-foreground">整体转化率</p>
          <p className="mt-1 text-lg font-semibold">{summary.conversionRate}%</p>
        </div>
        <div className="rounded-lg border border-border bg-muted/20 p-4">
          <p className="text-xs text-muted-foreground">实验收入</p>
          <p className="mt-1 text-lg font-semibold">{formatCny(summary.totalRevenueCents)}</p>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="space-y-3 rounded-lg border border-border bg-background p-4">
          <p className="text-sm font-medium">实验定义与目标配置</p>
          <input
            aria-label="实验名称"
            value={experimentForm.name}
            onChange={(event) => setExperimentForm((prev) => ({ ...prev, name: event.target.value }))}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            placeholder="实验名称"
          />
          <textarea
            aria-label="实验假设"
            value={experimentForm.hypothesis}
            onChange={(event) => setExperimentForm((prev) => ({ ...prev, hypothesis: event.target.value }))}
            className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder="实验假设"
          />
          <input
            aria-label="受众分群"
            value={experimentForm.segmentKey}
            onChange={(event) => setExperimentForm((prev) => ({ ...prev, segmentKey: event.target.value }))}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            placeholder="受众分群"
          />
          <div className="grid gap-2 sm:grid-cols-3">
            <input
              aria-label="基线指标"
              value={experimentForm.baselineMetric}
              onChange={(event) =>
                setExperimentForm((prev) => ({ ...prev, baselineMetric: event.target.value }))
              }
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              placeholder="基线指标"
            />
            <input
              aria-label="目标指标"
              value={experimentForm.targetMetric}
              onChange={(event) =>
                setExperimentForm((prev) => ({ ...prev, targetMetric: event.target.value }))
              }
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              placeholder="目标指标"
            />
            <input
              aria-label="提升目标(%)"
              value={experimentForm.liftTargetPercent}
              onChange={(event) =>
                setExperimentForm((prev) => ({ ...prev, liftTargetPercent: event.target.value }))
              }
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              placeholder="提升目标(%)"
            />
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <input
              aria-label="开始时间"
              type="datetime-local"
              value={experimentForm.startAt}
              onChange={(event) => setExperimentForm((prev) => ({ ...prev, startAt: event.target.value }))}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            />
            <input
              aria-label="结束时间"
              type="datetime-local"
              value={experimentForm.endAt}
              onChange={(event) => setExperimentForm((prev) => ({ ...prev, endAt: event.target.value }))}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={experimentForm.startNow}
              onChange={(event) => setExperimentForm((prev) => ({ ...prev, startNow: event.target.checked }))}
            />
            <span>创建后立即运行</span>
          </label>
          <Button
            disabled={pendingAction !== null}
            onClick={() =>
              runAction(
                "create-experiment",
                () =>
                  requestJson("/api/growth-lab/experiments", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      name: experimentForm.name,
                      hypothesis: experimentForm.hypothesis,
                      segmentKey: experimentForm.segmentKey,
                      baselineMetric: Number(experimentForm.baselineMetric),
                      targetMetric: Number(experimentForm.targetMetric),
                      liftTargetPercent: Number(experimentForm.liftTargetPercent),
                      startAt: toIsoDateTime(experimentForm.startAt),
                      endAt: toIsoDateTime(experimentForm.endAt),
                      startNow: experimentForm.startNow,
                    }),
                  }),
                "增长实验已创建"
              )
            }
          >
            {pendingAction === "create-experiment" ? "创建中..." : "创建增长实验"}
          </Button>
        </div>

        <div className="space-y-3 rounded-lg border border-border bg-background p-4">
          <p className="text-sm font-medium">指标采集与状态流转</p>
          <select
            aria-label="选择实验"
            value={selectedExperimentId}
            onChange={(event) => setSelectedExperimentId(event.target.value)}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">选择实验</option>
            {experiments.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} · {item.status}
              </option>
            ))}
          </select>
          <select
            aria-label="实验状态"
            value={updateForm.status}
            onChange={(event) => setUpdateForm((prev) => ({ ...prev, status: event.target.value }))}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="RUNNING">RUNNING</option>
            <option value="PAUSED">PAUSED</option>
            <option value="COMPLETED">COMPLETED</option>
            <option value="ARCHIVED">ARCHIVED</option>
          </select>
          <div className="grid gap-2 sm:grid-cols-2">
            <select
              aria-label="指标类型"
              value={updateForm.metricType}
              onChange={(event) => setUpdateForm((prev) => ({ ...prev, metricType: event.target.value }))}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="CONVERSION">CONVERSION</option>
              <option value="EXPOSURE">EXPOSURE</option>
              <option value="CTR">CTR</option>
              <option value="RETENTION">RETENTION</option>
              <option value="REVENUE">REVENUE</option>
            </select>
            <input
              aria-label="曝光数"
              value={updateForm.exposures}
              onChange={(event) => setUpdateForm((prev) => ({ ...prev, exposures: event.target.value }))}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              placeholder="曝光数"
            />
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <input
              aria-label="转化数"
              value={updateForm.conversions}
              onChange={(event) => setUpdateForm((prev) => ({ ...prev, conversions: event.target.value }))}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              placeholder="转化数"
            />
            <input
              aria-label="留存用户"
              value={updateForm.retainedUsers}
              onChange={(event) => setUpdateForm((prev) => ({ ...prev, retainedUsers: event.target.value }))}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              placeholder="留存用户"
            />
            <input
              aria-label="收入(分)"
              value={updateForm.revenueCents}
              onChange={(event) => setUpdateForm((prev) => ({ ...prev, revenueCents: event.target.value }))}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              placeholder="收入(分)"
            />
          </div>
          <Button
            disabled={pendingAction !== null || !selectedExperimentId}
            onClick={() =>
              runAction(
                "update-experiment",
                () =>
                  requestJson(`/api/growth-lab/experiments/${selectedExperimentId}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      status: updateForm.status,
                      metricType: updateForm.metricType,
                      exposures: Number(updateForm.exposures),
                      conversions: Number(updateForm.conversions),
                      retainedUsers: Number(updateForm.retainedUsers),
                      revenueCents: Number(updateForm.revenueCents),
                    }),
                  }),
                "实验状态与指标已更新"
              )
            }
          >
            {pendingAction === "update-experiment" ? "更新中..." : "提交实验指标"}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="space-y-3 rounded-lg border border-border bg-background p-4">
          <p className="text-sm font-medium">用户分群管理</p>
          <input
            aria-label="分群名称"
            value={segmentForm.name}
            onChange={(event) => setSegmentForm((prev) => ({ ...prev, name: event.target.value }))}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            placeholder="分群名称"
          />
          <div className="grid gap-2 sm:grid-cols-2">
            <input
              aria-label="分群Key"
              value={segmentForm.key}
              onChange={(event) => setSegmentForm((prev) => ({ ...prev, key: event.target.value }))}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              placeholder="分群Key"
            />
            <input
              aria-label="预估用户数"
              value={segmentForm.estimatedUsers}
              onChange={(event) => setSegmentForm((prev) => ({ ...prev, estimatedUsers: event.target.value }))}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              placeholder="预估用户数"
            />
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <select
              aria-label="分群状态"
              value={segmentForm.status}
              onChange={(event) => setSegmentForm((prev) => ({ ...prev, status: event.target.value }))}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="DRAFT">DRAFT</option>
              <option value="ACTIVE">ACTIVE</option>
              <option value="ARCHIVED">ARCHIVED</option>
            </select>
            <select
              aria-label="匹配模式"
              value={segmentForm.matchMode}
              onChange={(event) => setSegmentForm((prev) => ({ ...prev, matchMode: event.target.value }))}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="ALL">ALL</option>
              <option value="ANY">ANY</option>
            </select>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <input
              aria-label="规则字段"
              value={segmentForm.ruleField}
              onChange={(event) => setSegmentForm((prev) => ({ ...prev, ruleField: event.target.value }))}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              placeholder="规则字段"
            />
            <input
              aria-label="规则操作符"
              value={segmentForm.ruleOperator}
              onChange={(event) => setSegmentForm((prev) => ({ ...prev, ruleOperator: event.target.value }))}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              placeholder="规则操作符"
            />
            <input
              aria-label="规则值"
              value={segmentForm.ruleValue}
              onChange={(event) => setSegmentForm((prev) => ({ ...prev, ruleValue: event.target.value }))}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              placeholder="规则值"
            />
          </div>
          <textarea
            aria-label="分群说明"
            value={segmentForm.description}
            onChange={(event) => setSegmentForm((prev) => ({ ...prev, description: event.target.value }))}
            className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder="分群说明"
          />
          <Button
            disabled={pendingAction !== null}
            onClick={() =>
              runAction(
                "save-segment",
                () =>
                  requestJson("/api/growth-lab/segments", {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      id: segmentForm.id || undefined,
                      name: segmentForm.name,
                      key: segmentForm.key,
                      status: segmentForm.status,
                      matchMode: segmentForm.matchMode,
                      estimatedUsers: Number(segmentForm.estimatedUsers),
                      description: segmentForm.description,
                      ruleConfig: {
                        logic: segmentForm.matchMode,
                        rules: [
                          {
                            field: segmentForm.ruleField,
                            operator: segmentForm.ruleOperator,
                            value: segmentForm.ruleValue,
                          },
                        ],
                      },
                    }),
                  }),
                "用户分群已保存"
              )
            }
          >
            {pendingAction === "save-segment" ? "保存中..." : "保存分群规则"}
          </Button>
        </div>

        <div className="space-y-3 rounded-lg border border-border bg-background p-4">
          <p className="text-sm font-medium">用户分群与实验受众编排</p>
          <select
            aria-label="编排实验"
            value={selectedAudienceExperimentId}
            onChange={(event) => setSelectedAudienceExperimentId(event.target.value)}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">选择实验</option>
            {experiments.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} · {item.status}
              </option>
            ))}
          </select>
          <select
            aria-label="受众分群"
            value={audienceForm.segmentId}
            onChange={(event) => setAudienceForm((prev) => ({ ...prev, segmentId: event.target.value }))}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">选择用户分群</option>
            {segments.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} · {item.key} · v{item.version}
              </option>
            ))}
          </select>
          <div className="grid gap-2 sm:grid-cols-2">
            <input
              aria-label="灰度流量比例"
              value={audienceForm.rolloutPercent}
              onChange={(event) => setAudienceForm((prev) => ({ ...prev, rolloutPercent: event.target.value }))}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              placeholder="灰度流量比例(1-100)"
            />
            <input
              aria-label="排除分群"
              value={audienceForm.excludedSegmentKeys}
              onChange={(event) =>
                setAudienceForm((prev) => ({ ...prev, excludedSegmentKeys: event.target.value }))
              }
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              placeholder="排除分群Key(逗号分隔)"
            />
          </div>
          <Button
            disabled={pendingAction !== null || !selectedAudienceExperimentId || !audienceForm.segmentId}
            onClick={() =>
              runAction(
                "orchestrate-audience",
                () =>
                  requestJson(`/api/growth-lab/experiments/${selectedAudienceExperimentId}/audience`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      segmentId: audienceForm.segmentId,
                      rolloutPercent: Number(audienceForm.rolloutPercent),
                      excludedSegmentKeys: audienceForm.excludedSegmentKeys
                        .split(",")
                        .map((item) => item.trim())
                        .filter(Boolean),
                    }),
                  }),
                "实验受众编排已更新"
              )
            }
          >
            {pendingAction === "orchestrate-audience" ? "编排中..." : "保存受众编排"}
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-background p-4 space-y-3">
        <p className="text-sm font-medium">实验进展总览</p>
        {experiments.length === 0 ? (
          <p className="text-sm text-muted-foreground">暂无增长实验。</p>
        ) : (
          <div className="space-y-2 text-sm">
            {experiments.slice(0, 5).map((item) => {
              const snapshotCount = snapshots.filter((snapshot) => snapshot.experimentId === item.id).length
              const audience = audiences.find((current) => current.experimentId === item.id)
              return (
                <div key={item.id} className="rounded-md border border-border bg-muted/10 px-3 py-2">
                  <p className="font-medium">
                    {item.name} · {item.status}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    分群 {item.segmentKey} · 基线 {item.baselineMetric}% · 目标 {item.targetMetric}% ·
                    指标快照 {snapshotCount} 条
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    受众编排 {audience ? `${audience.segment.key} / ${audience.rolloutPercent}%` : "未配置"}
                  </p>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
