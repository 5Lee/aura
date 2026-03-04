"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { AlertTriangle, History, RefreshCcw } from "lucide-react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/components/ui/toaster"

type PromptVersionSource = "CREATE" | "UPDATE" | "ROLLBACK" | "IMPORT"

interface PromptVersionItem {
  id: string
  promptId: string
  version: number
  source: PromptVersionSource
  changeSummary: string | null
  title: string
  content: string
  description: string | null
  categoryId: string
  isPublic: boolean
  tags: unknown
  createdAt: string
}

interface PromptVersionPanelProps {
  promptId: string
  canManage: boolean
}

const SOURCE_LABELS: Record<PromptVersionSource, string> = {
  CREATE: "创建",
  UPDATE: "更新",
  ROLLBACK: "回滚",
  IMPORT: "导入",
}

function toTagList(raw: unknown) {
  if (!Array.isArray(raw)) {
    return []
  }

  return raw
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean)
}

export function PromptVersionPanel({ promptId, canManage }: PromptVersionPanelProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [versions, setVersions] = useState<PromptVersionItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [sourceFilter, setSourceFilter] = useState<PromptVersionSource | "ALL">("ALL")
  const [baseVersionId, setBaseVersionId] = useState("")
  const [targetVersionId, setTargetVersionId] = useState("")
  const [rollbackLoadingVersionId, setRollbackLoadingVersionId] = useState<string | null>(null)
  const [panelError, setPanelError] = useState("")

  const fetchVersions = useCallback(async () => {
    setIsLoading(true)
    setPanelError("")
    try {
      const response = await fetch(`/api/prompts/${promptId}/versions?take=30`)
      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload?.error || "获取版本历史失败")
      }

      const items = payload as PromptVersionItem[]
      setVersions(items)
      if (items.length > 0) {
        setTargetVersionId(items[0].id)
        setBaseVersionId(items[1]?.id ?? items[0].id)
      } else {
        setTargetVersionId("")
        setBaseVersionId("")
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "请稍后重试。"
      setPanelError(message)
      toast({
        type: "error",
        title: "加载版本历史失败",
        description: message,
      })
    } finally {
      setIsLoading(false)
    }
  }, [promptId, toast])

  useEffect(() => {
    if (!canManage) {
      setIsLoading(false)
      return
    }

    void fetchVersions()
  }, [canManage, fetchVersions])

  const visibleVersions = useMemo(() => {
    if (sourceFilter === "ALL") {
      return versions
    }
    return versions.filter((version) => version.source === sourceFilter)
  }, [sourceFilter, versions])

  const baseVersion = versions.find((item) => item.id === baseVersionId) ?? null
  const targetVersion = versions.find((item) => item.id === targetVersionId) ?? null

  const changedFields = useMemo(() => {
    if (!baseVersion || !targetVersion) {
      return []
    }

    const fields: string[] = []
    if (baseVersion.title !== targetVersion.title) fields.push("标题")
    if ((baseVersion.description || "") !== (targetVersion.description || "")) fields.push("描述")
    if (baseVersion.content !== targetVersion.content) fields.push("内容")
    if (baseVersion.categoryId !== targetVersion.categoryId) fields.push("分类")
    if (baseVersion.isPublic !== targetVersion.isPublic) fields.push("可见性")

    const baseTags = toTagList(baseVersion.tags).sort().join(",")
    const targetTags = toTagList(targetVersion.tags).sort().join(",")
    if (baseTags !== targetTags) fields.push("标签")

    return fields
  }, [baseVersion, targetVersion])

  const handleRollback = async (version: PromptVersionItem) => {
    if (!canManage) {
      return
    }

    if (!confirm(`确定回滚到版本 v${version.version} 吗？系统会保留当前版本快照。`)) {
      return
    }

    const latestVersion = versions[0]?.version ?? version.version
    const rollbackDistance = Math.max(0, latestVersion - version.version)
    const isHighRiskRollback = rollbackDistance >= 3

    if (
      isHighRiskRollback &&
      !confirm(
        `这是高风险回滚：将从 v${latestVersion} 回滚到 v${version.version}。确定继续吗？`
      )
    ) {
      return
    }

    setRollbackLoadingVersionId(version.id)
    setPanelError("")
    try {
      const response = await fetch(`/api/prompts/${promptId}/rollback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          versionId: version.id,
          reason: `Rollback to v${version.version}`,
          confirmHighRisk: isHighRiskRollback,
        }),
      })
      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload?.error || "回滚失败")
      }

      toast({
        type: "success",
        title: "回滚成功",
        description: `已回滚到版本 v${version.version}，并生成新版本快照。`,
      })
      router.refresh()
      await fetchVersions()
    } catch (error) {
      const message = error instanceof Error ? error.message : "请稍后重试。"
      setPanelError(message)
      toast({
        type: "error",
        title: "回滚失败",
        description: message,
      })
    } finally {
      setRollbackLoadingVersionId(null)
    }
  }

  if (!canManage) {
    return null
  }

  return (
    <Card>
      <CardHeader className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <History className="h-4 w-4" aria-hidden="true" />
              版本历史
            </CardTitle>
            <CardDescription>
              浏览历史版本、查看差异并执行安全回滚。
            </CardDescription>
          </div>
          <select
            aria-label="版本来源筛选"
            value={sourceFilter}
            onChange={(event) => setSourceFilter(event.target.value as PromptVersionSource | "ALL")}
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          >
            <option value="ALL">全部来源</option>
            <option value="CREATE">创建</option>
            <option value="UPDATE">更新</option>
            <option value="ROLLBACK">回滚</option>
            <option value="IMPORT">导入</option>
          </select>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {panelError ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900/70 dark:bg-amber-900/20 dark:text-amber-300">
            <p>{panelError}</p>
            <Button type="button" size="sm" variant="outline" className="mt-2 h-7" onClick={() => void fetchVersions()}>
              重试加载
            </Button>
          </div>
        ) : null}
        {isLoading ? (
          <p className="text-sm text-muted-foreground">正在加载版本历史...</p>
        ) : visibleVersions.length === 0 ? (
          <p className="text-sm text-muted-foreground">暂无版本记录</p>
        ) : (
          <div className="space-y-3">
            {visibleVersions.map((version) => (
              <div
                key={version.id}
                className="rounded-lg border border-border bg-card/60 p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">
                      v{version.version} · {SOURCE_LABELS[version.source]}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(version.createdAt).toLocaleString("zh-CN")}
                    </p>
                    {version.changeSummary ? (
                      <p className="mt-1 text-sm text-muted-foreground">{version.changeSummary}</p>
                    ) : null}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleRollback(version)}
                    disabled={rollbackLoadingVersionId === version.id || version.id === versions[0]?.id}
                    className="h-8"
                  >
                    <RefreshCcw className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                    {rollbackLoadingVersionId === version.id
                      ? "回滚中..."
                      : version.id === versions[0]?.id
                        ? "当前版本"
                        : "回滚到此版本"}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {targetVersion && versions.length > 0 && versions[0].version - targetVersion.version >= 3 ? (
          <div className="rounded-md border border-amber-300/60 bg-amber-50/80 p-2 text-xs text-amber-700 dark:border-amber-800/50 dark:bg-amber-950/40 dark:text-amber-200">
            <p className="inline-flex items-center gap-1">
              <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
              当前选中的版本为高风险回滚目标，执行时会触发二次确认。
            </p>
          </div>
        ) : null}

        {versions.length >= 2 ? (
          <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-3">
            <p className="text-sm font-medium">版本差异对比</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <select
                aria-label="基准版本"
                value={baseVersionId}
                onChange={(event) => setBaseVersionId(event.target.value)}
                className="h-9 rounded-md border border-input bg-background px-2 text-sm"
              >
                {versions.map((version) => (
                  <option key={version.id} value={version.id}>
                    v{version.version} · {SOURCE_LABELS[version.source]}
                  </option>
                ))}
              </select>
              <select
                aria-label="目标版本"
                value={targetVersionId}
                onChange={(event) => setTargetVersionId(event.target.value)}
                className="h-9 rounded-md border border-input bg-background px-2 text-sm"
              >
                {versions.map((version) => (
                  <option key={version.id} value={version.id}>
                    v{version.version} · {SOURCE_LABELS[version.source]}
                  </option>
                ))}
              </select>
            </div>
            <div className="text-sm text-muted-foreground">
              变更字段：{changedFields.length > 0 ? changedFields.join("、") : "无差异"}
            </div>
            <div className="grid gap-3 lg:grid-cols-2">
              <div className="space-y-1 rounded-md border border-border bg-background p-3">
                <p className="text-xs font-medium text-muted-foreground">
                  基准版本 {baseVersion ? `v${baseVersion.version}` : "-"}
                </p>
                <p className="line-clamp-1 text-sm font-medium">{baseVersion?.title || "-"}</p>
                <p className="line-clamp-4 whitespace-pre-wrap text-xs text-muted-foreground">
                  {baseVersion?.content || "-"}
                </p>
              </div>
              <div className="space-y-1 rounded-md border border-border bg-background p-3">
                <p className="text-xs font-medium text-muted-foreground">
                  目标版本 {targetVersion ? `v${targetVersion.version}` : "-"}
                </p>
                <p className="line-clamp-1 text-sm font-medium">{targetVersion?.title || "-"}</p>
                <p className="line-clamp-4 whitespace-pre-wrap text-xs text-muted-foreground">
                  {targetVersion?.content || "-"}
                </p>
              </div>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
