"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toaster"

type ProfileRow = {
  id: string
  name: string
  platform: string
  mode: string
  fieldMapping: {
    externalId: string
    title: string
    content: string
    description: string
    tags: string
    updatedAt: string
  }
  conflictPolicy: string
  compatibilityMode: string
  updatedAt: string
}

type JobRow = {
  id: string
  profileId: string
  platform: string
  mode: string
  status: string
  appliedCount: number
  skippedCount: number
  conflictCount: number
  errorMessage: string
  previewSummary: Record<string, unknown>
  exportedPayload: unknown[]
  createdAt: string
  profile: {
    id: string
    name: string
    platform: string
    mode: string
  }
}

type InteroperabilityPanelProps = {
  hasAccess: boolean
  planId: string
  profiles: ProfileRow[]
  jobs: JobRow[]
}

async function requestJson(path: string, init?: RequestInit) {
  const response = await fetch(path, init)
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(String(payload?.error || "请求失败"))
  }
  return payload
}

function safeJsonParse<T>(value: string, fallback: T) {
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

function summaryValue(summary: Record<string, unknown>, key: string) {
  const record = summary.summary && typeof summary.summary === "object" && !Array.isArray(summary.summary)
    ? (summary.summary as Record<string, unknown>)
    : summary
  const value = Number(record[key])
  if (!Number.isFinite(value)) {
    return 0
  }

  return value
}

function buildProfileForm(profile: ProfileRow | null) {
  return {
    id: profile?.id || "",
    name: profile?.name || "",
    platform: profile?.platform || "LANGFUSE",
    mode: profile?.mode || "IMPORT",
    conflictPolicy: profile?.conflictPolicy || "skip",
    compatibilityMode: profile?.compatibilityMode || "strict",
    fieldMappingJson: JSON.stringify(
      profile?.fieldMapping || {
        externalId: "id",
        title: "title",
        content: "content",
        description: "description",
        tags: "tags",
        updatedAt: "updatedAt",
      },
      null,
      2
    ),
  }
}

export function InteroperabilityPanel({ hasAccess, planId, profiles, jobs }: InteroperabilityPanelProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [pendingAction, setPendingAction] = useState<string | null>(null)

  const defaultProfile = profiles[0] || null
  const [selectedProfileId, setSelectedProfileId] = useState(defaultProfile?.id || "")
  const selectedProfile = useMemo(
    () => profiles.find((item) => item.id === selectedProfileId) || null,
    [profiles, selectedProfileId]
  )
  const [profileForm, setProfileForm] = useState(() => buildProfileForm(selectedProfile))

  const [importRowsText, setImportRowsText] = useState(
    JSON.stringify(
      [
        {
          id: "ext-demo-1",
          title: "跨平台导入示例",
          content: "你是一个导入助手。",
          description: "来自外部平台的示例提示词",
          tags: ["interop", "demo"],
          updatedAt: new Date().toISOString(),
        },
      ],
      null,
      2
    )
  )
  const [selectedPreviewJobId, setSelectedPreviewJobId] = useState("")
  const [exportPromptIds, setExportPromptIds] = useState("")

  const previewJobs = useMemo(
    () => jobs.filter((item) => item.status === "PREVIEW"),
    [jobs]
  )

  useEffect(() => {
    setProfileForm(buildProfileForm(selectedProfile))
  }, [selectedProfile])

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
        <p className="mt-1 text-muted-foreground">跨平台导入导出仅对 Pro / Team / Enterprise 套餐开放。</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded-lg border border-border bg-muted/20 p-4">
          <p className="text-xs text-muted-foreground">适配配置</p>
          <p className="mt-1 text-lg font-semibold">{profiles.length}</p>
        </div>
        <div className="rounded-lg border border-border bg-muted/20 p-4">
          <p className="text-xs text-muted-foreground">导入预览任务</p>
          <p className="mt-1 text-lg font-semibold">{jobs.filter((item) => item.status === "PREVIEW").length}</p>
        </div>
        <div className="rounded-lg border border-border bg-muted/20 p-4">
          <p className="text-xs text-muted-foreground">导出任务</p>
          <p className="mt-1 text-lg font-semibold">{jobs.filter((item) => item.status === "EXPORTED").length}</p>
        </div>
        <div className="rounded-lg border border-border bg-muted/20 p-4">
          <p className="text-xs text-muted-foreground">失败任务</p>
          <p className="mt-1 text-lg font-semibold">{jobs.filter((item) => item.status === "FAILED").length}</p>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="space-y-3 rounded-lg border border-border bg-background p-4">
          <p className="text-sm font-medium">多源字段映射与冲突策略</p>
          <select
            aria-label="选择适配配置"
            value={selectedProfileId}
            onChange={(event) => setSelectedProfileId(event.target.value)}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">新建适配配置</option>
            {profiles.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} · {item.platform} · {item.mode}
              </option>
            ))}
          </select>
          <input
            aria-label="配置名称"
            value={profileForm.name}
            onChange={(event) => setProfileForm((prev) => ({ ...prev, name: event.target.value }))}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            placeholder="配置名称"
          />
          <div className="grid gap-2 sm:grid-cols-2">
            <select
              aria-label="目标平台"
              value={profileForm.platform}
              onChange={(event) => setProfileForm((prev) => ({ ...prev, platform: event.target.value }))}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="LANGFUSE">LANGFUSE</option>
              <option value="PROMPTFOO">PROMPTFOO</option>
              <option value="OPENWEBUI">OPENWEBUI</option>
            </select>
            <select
              aria-label="适配模式"
              value={profileForm.mode}
              onChange={(event) => setProfileForm((prev) => ({ ...prev, mode: event.target.value }))}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="IMPORT">IMPORT</option>
              <option value="EXPORT">EXPORT</option>
            </select>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <select
              aria-label="冲突策略"
              value={profileForm.conflictPolicy}
              onChange={(event) => setProfileForm((prev) => ({ ...prev, conflictPolicy: event.target.value }))}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="skip">skip</option>
              <option value="overwrite">overwrite</option>
              <option value="create-new">create-new</option>
            </select>
            <select
              aria-label="兼容模式"
              value={profileForm.compatibilityMode}
              onChange={(event) => setProfileForm((prev) => ({ ...prev, compatibilityMode: event.target.value }))}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="strict">strict</option>
              <option value="compatible">compatible</option>
            </select>
          </div>
          <textarea
            aria-label="字段映射"
            value={profileForm.fieldMappingJson}
            onChange={(event) => setProfileForm((prev) => ({ ...prev, fieldMappingJson: event.target.value }))}
            className="min-h-28 w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs"
            placeholder="字段映射 JSON"
          />
          <Button
            disabled={pendingAction !== null}
            onClick={() =>
              runAction(
                "save-profile",
                () =>
                  requestJson("/api/interoperability", {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      id: profileForm.id || undefined,
                      name: profileForm.name,
                      platform: profileForm.platform,
                      mode: profileForm.mode,
                      conflictPolicy: profileForm.conflictPolicy,
                      compatibilityMode: profileForm.compatibilityMode,
                      fieldMapping: safeJsonParse(profileForm.fieldMappingJson, {}),
                    }),
                  }),
                "跨平台映射配置已保存"
              )
            }
          >
            {pendingAction === "save-profile" ? "保存中..." : "保存适配配置"}
          </Button>
        </div>

        <div className="space-y-3 rounded-lg border border-border bg-background p-4">
          <p className="text-sm font-medium">批量导入预览与差异确认</p>
          <textarea
            aria-label="导入数据"
            value={importRowsText}
            onChange={(event) => setImportRowsText(event.target.value)}
            className="min-h-36 w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs"
            placeholder="外部平台导入数据 JSON 数组"
          />
          <Button
            disabled={pendingAction !== null || !profileForm.id}
            onClick={() =>
              runAction(
                "preview-import",
                () =>
                  requestJson("/api/interoperability", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      action: "preview-import",
                      profileId: profileForm.id,
                      rows: safeJsonParse(importRowsText, []),
                    }),
                  }),
                "导入预览已生成"
              )
            }
          >
            {pendingAction === "preview-import" ? "预览中..." : "生成导入预览"}
          </Button>

          <select
            aria-label="预览任务"
            value={selectedPreviewJobId}
            onChange={(event) => setSelectedPreviewJobId(event.target.value)}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">选择预览任务</option>
            {previewJobs.map((item) => (
              <option key={item.id} value={item.id}>
                {item.profile.name} · {new Date(item.createdAt).toLocaleString()}
              </option>
            ))}
          </select>
          <Button
            disabled={pendingAction !== null || !selectedPreviewJobId}
            onClick={() =>
              runAction(
                "apply-import",
                () =>
                  requestJson("/api/interoperability", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      action: "apply-import",
                      jobId: selectedPreviewJobId,
                    }),
                  }),
                "导入结果已应用"
              )
            }
          >
            {pendingAction === "apply-import" ? "应用中..." : "确认并执行导入"}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="space-y-3 rounded-lg border border-border bg-background p-4">
          <p className="text-sm font-medium">导出模板与兼容模式切换</p>
          <input
            aria-label="导出 Prompt IDs"
            value={exportPromptIds}
            onChange={(event) => setExportPromptIds(event.target.value)}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            placeholder="可选：Prompt IDs（逗号分隔）"
          />
          <Button
            disabled={pendingAction !== null || !profileForm.id}
            onClick={() =>
              runAction(
                "export-interoperability",
                () =>
                  requestJson("/api/interoperability", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      action: "export",
                      profileId: profileForm.id,
                      promptIds: exportPromptIds
                        .split(",")
                        .map((item) => item.trim())
                        .filter(Boolean),
                    }),
                  }),
                "跨平台导出已完成"
              )
            }
          >
            {pendingAction === "export-interoperability" ? "导出中..." : "执行导出"}
          </Button>
          <p className="text-xs text-muted-foreground">导出任务会记录 round-trip 校验结果，辅助确认字段完整性。</p>
        </div>

        <div className="space-y-3 rounded-lg border border-border bg-background p-4">
          <p className="text-sm font-medium">round-trip 导入导出一致性检查</p>
          <div className="space-y-2 text-sm">
            {jobs.slice(0, 8).map((item) => {
              const summary = item.previewSummary || {}
              const roundTrip =
                summary.roundTrip && typeof summary.roundTrip === "object" && !Array.isArray(summary.roundTrip)
                  ? (summary.roundTrip as Record<string, unknown>)
                  : null

              return (
                <div key={item.id} className="rounded-md border border-border bg-muted/10 px-3 py-2">
                  <p className="font-medium">
                    {item.profile.name} · {item.status}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    applied {item.appliedCount} · skipped {item.skippedCount} · conflicts {item.conflictCount}
                  </p>
                  {roundTrip ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      matched {summaryValue(roundTrip, "matched")} / {summaryValue(roundTrip, "previewCount")} ·
                      missingContent {summaryValue(roundTrip, "missingContent")} ·
                      lossless {String(roundTrip.lossless === true)}
                    </p>
                  ) : null}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
