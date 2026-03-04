"use client"

import { useState } from "react"
import { Code2, Download, Upload } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toaster"

interface PromptCodePanelProps {
  promptId: string
  canManage: boolean
}

export function PromptCodePanel({ promptId, canManage }: PromptCodePanelProps) {
  const { toast } = useToast()
  const [importContent, setImportContent] = useState("")
  const [importFormat, setImportFormat] = useState<"json" | "yaml">("json")
  const [importMode, setImportMode] = useState<"skip" | "overwrite" | "create-new">("skip")
  const [isImporting, setIsImporting] = useState(false)

  if (!canManage) {
    return null
  }

  const handleExport = (format: "json" | "yaml") => {
    window.open(`/api/prompts/code?ids=${encodeURIComponent(promptId)}&format=${format}`, "_blank", "noopener,noreferrer")
  }

  const handleImport = async () => {
    if (!importContent.trim()) {
      toast({
        type: "info",
        title: "请先粘贴导入内容",
      })
      return
    }

    setIsImporting(true)
    try {
      const response = await fetch("/api/prompts/code", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          content: importContent,
          format: importFormat,
          mode: importMode,
        }),
      })
      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload?.error || "导入失败")
      }

      toast({
        type: "success",
        title: "Prompt-as-Code 导入完成",
        description: `创建 ${payload.summary?.created || 0}，更新 ${payload.summary?.updated || 0}，冲突 ${payload.summary?.conflicts?.length || 0}`,
      })

      setImportContent("")
    } catch (error) {
      toast({
        type: "error",
        title: "导入失败",
        description: error instanceof Error ? error.message : "请检查导入内容格式",
      })
    } finally {
      setIsImporting(false)
    }
  }

  return (
    <div className="space-y-4 rounded-xl border border-border/70 bg-card p-4 shadow-card">
      <div>
        <p className="inline-flex items-center gap-2 text-sm font-medium">
          <Code2 className="h-4 w-4" aria-hidden="true" />
          Prompt-as-Code（YAML/JSON）
        </p>
        <p className="text-xs text-muted-foreground">支持单条导出、批量导入、冲突检测与覆盖策略。</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={() => handleExport("json")}>
          <Download className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
          导出 JSON
        </Button>
        <Button type="button" variant="outline" onClick={() => handleExport("yaml")}>
          <Download className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
          导出 YAML
        </Button>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <select
          value={importFormat}
          onChange={(event) => setImportFormat(event.target.value as "json" | "yaml")}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="json">导入 JSON</option>
          <option value="yaml">导入 YAML</option>
        </select>

        <select
          value={importMode}
          onChange={(event) => setImportMode(event.target.value as "skip" | "overwrite" | "create-new")}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="skip">冲突时跳过</option>
          <option value="overwrite">冲突时覆盖</option>
          <option value="create-new">冲突时新建</option>
        </select>

        <Button type="button" variant="secondary" onClick={() => void handleImport()} disabled={isImporting}>
          <Upload className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
          {isImporting ? "导入中..." : "执行导入"}
        </Button>
      </div>

      <textarea
        value={importContent}
        onChange={(event) => setImportContent(event.target.value)}
        placeholder="粘贴 Prompt-as-Code 内容"
        className="min-h-[160px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
      />
    </div>
  )
}
