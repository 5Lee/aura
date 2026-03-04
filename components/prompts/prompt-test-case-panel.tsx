"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Download, FlaskConical, Play, Plus, RefreshCw, Trash2, Upload } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useToast } from "@/components/ui/toaster"

type PromptAssertionType = "CONTAINS" | "EQUALS" | "REGEX" | "JSON_SCHEMA"

interface PromptTestCaseItem {
  id: string
  name: string
  description: string | null
  assertionType: PromptAssertionType
  expectedOutput: string
  inputVariables: unknown
  enabled: boolean
  updatedAt: string
}

interface PromptEvalResultItem {
  id: string
  passed: boolean
  latencyMs: number
  errorMessage: string | null
  testCase: {
    id: string
    name: string
    assertionType: PromptAssertionType
  }
}

interface PromptEvalRunItem {
  id: string
  mode: "MANUAL" | "SCHEDULED" | "CI"
  status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED"
  passRate: number
  totalCases: number
  failedCases: number
  averageLatencyMs: number
  createdAt: string
  results: PromptEvalResultItem[]
}

interface PromptTestCasePanelProps {
  promptId: string
  canManage: boolean
}

const ASSERTION_LABELS: Record<PromptAssertionType, string> = {
  CONTAINS: "contains",
  EQUALS: "equals",
  REGEX: "regex",
  JSON_SCHEMA: "json-schema",
}

function parseInputJson(text: string) {
  const trimmed = text.trim()
  if (!trimmed) {
    return {}
  }

  const parsed = JSON.parse(trimmed)
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("输入变量必须是 JSON 对象")
  }

  return parsed
}

export function PromptTestCasePanel({ promptId, canManage }: PromptTestCasePanelProps) {
  const { toast } = useToast()
  const importInputRef = useRef<HTMLInputElement | null>(null)

  const [testCases, setTestCases] = useState<PromptTestCaseItem[]>([])
  const [runs, setRuns] = useState<PromptEvalRunItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRunningEval, setIsRunningEval] = useState(false)
  const [isSavingCase, setIsSavingCase] = useState(false)
  const [newCase, setNewCase] = useState({
    name: "",
    assertionType: "CONTAINS" as PromptAssertionType,
    expectedOutput: "",
    inputVariablesText: "{}",
  })

  const refreshData = useCallback(async () => {
    if (!canManage) {
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    try {
      const [casesResponse, runsResponse] = await Promise.all([
        fetch(`/api/prompts/${promptId}/test-cases`),
        fetch(`/api/prompts/${promptId}/eval-runs?take=8`),
      ])

      const casesPayload = await casesResponse.json()
      const runsPayload = await runsResponse.json()

      if (!casesResponse.ok) {
        throw new Error(casesPayload?.error || "加载测试用例失败")
      }
      if (!runsResponse.ok) {
        throw new Error(runsPayload?.error || "加载评测报告失败")
      }

      setTestCases(casesPayload as PromptTestCaseItem[])
      setRuns(runsPayload as PromptEvalRunItem[])
    } catch (error) {
      toast({
        type: "error",
        title: "加载失败",
        description: error instanceof Error ? error.message : "请稍后重试",
      })
    } finally {
      setIsLoading(false)
    }
  }, [canManage, promptId, toast])

  useEffect(() => {
    void refreshData()
  }, [refreshData])

  const latestRun = runs[0]

  const handleCreateTestCase = async () => {
    if (!newCase.name.trim() || !newCase.expectedOutput.trim()) {
      toast({
        type: "info",
        title: "请完善用例信息",
        description: "名称和期望输出不能为空。",
      })
      return
    }

    let inputVariables: Record<string, unknown>
    try {
      inputVariables = parseInputJson(newCase.inputVariablesText)
    } catch (error) {
      toast({
        type: "error",
        title: "输入变量格式错误",
        description: error instanceof Error ? error.message : "请检查 JSON 格式",
      })
      return
    }

    setIsSavingCase(true)
    try {
      const response = await fetch(`/api/prompts/${promptId}/test-cases`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          testCase: {
            name: newCase.name.trim(),
            assertionType: newCase.assertionType,
            expectedOutput: newCase.expectedOutput,
            inputVariables,
            enabled: true,
          },
        }),
      })

      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload?.error || "保存测试用例失败")
      }

      setNewCase({
        name: "",
        assertionType: "CONTAINS",
        expectedOutput: "",
        inputVariablesText: "{}",
      })

      toast({
        type: "success",
        title: "测试用例已创建",
        description: "你可以立即执行回归评测。",
      })
      await refreshData()
    } catch (error) {
      toast({
        type: "error",
        title: "保存失败",
        description: error instanceof Error ? error.message : "请稍后重试",
      })
    } finally {
      setIsSavingCase(false)
    }
  }

  const handleDeleteCase = async (testCaseId: string) => {
    if (!confirm("确定删除该测试用例吗？")) {
      return
    }

    try {
      const response = await fetch(`/api/prompts/${promptId}/test-cases/${testCaseId}`, {
        method: "DELETE",
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(payload?.error || "删除测试用例失败")
      }

      toast({
        type: "success",
        title: "测试用例已删除",
      })
      await refreshData()
    } catch (error) {
      toast({
        type: "error",
        title: "删除失败",
        description: error instanceof Error ? error.message : "请稍后重试",
      })
    }
  }

  const handleRunEvaluation = async () => {
    setIsRunningEval(true)
    try {
      const response = await fetch(`/api/prompts/${promptId}/evaluate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mode: "manual",
          summary: "Manual regression run from prompt detail panel",
        }),
      })

      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload?.error || "执行回归评测失败")
      }

      toast({
        type: "success",
        title: "回归评测完成",
        description: `通过率 ${payload.passRate}%（失败 ${payload.failedCases} 条）`,
      })

      await refreshData()
    } catch (error) {
      toast({
        type: "error",
        title: "回归执行失败",
        description: error instanceof Error ? error.message : "请稍后重试",
      })
    } finally {
      setIsRunningEval(false)
    }
  }

  const handleExportCases = () => {
    window.open(`/api/prompts/${promptId}/test-cases?format=export`, "_blank", "noopener,noreferrer")
  }

  const handleImportCases = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    try {
      const text = await file.text()
      const parsed = JSON.parse(text)
      const testCasesRaw = Array.isArray(parsed) ? parsed : parsed?.testCases
      if (!Array.isArray(testCasesRaw)) {
        throw new Error("导入文件中缺少 testCases 数组")
      }

      const response = await fetch(`/api/prompts/${promptId}/test-cases`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          testCases: testCasesRaw,
          replaceAll: true,
        }),
      })

      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload?.error || "导入测试用例失败")
      }

      toast({
        type: "success",
        title: "测试用例导入成功",
        description: `共导入 ${payload.createdCount || 0} 条用例。`,
      })
      await refreshData()
    } catch (error) {
      toast({
        type: "error",
        title: "导入失败",
        description: error instanceof Error ? error.message : "请检查导入文件格式",
      })
    } finally {
      event.target.value = ""
    }
  }

  if (!canManage) {
    return null
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <FlaskConical className="h-4 w-4" aria-hidden="true" />
          提示词评测用例
        </CardTitle>
        <CardDescription>管理测试用例并执行回归评测，支持导入导出与历史留存。</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => void handleRunEvaluation()}
            disabled={isRunningEval || testCases.length === 0}
          >
            <Play className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
            {isRunningEval ? "执行中..." : "手动执行回归"}
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={handleExportCases}>
            <Download className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
            导出用例
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => importInputRef.current?.click()}
          >
            <Upload className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
            导入用例
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => void refreshData()}>
            <RefreshCw className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
            刷新
          </Button>
          <input
            ref={importInputRef}
            type="file"
            accept="application/json"
            className="hidden"
            aria-label="导入测试用例文件"
            onChange={(event) => void handleImportCases(event)}
          />
        </div>

        {latestRun ? (
          <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm">
            <p className="font-medium">
              最近一次评测：{new Date(latestRun.createdAt).toLocaleString("zh-CN")} · {latestRun.mode}
            </p>
            <p className="text-muted-foreground">
              通过率 {latestRun.passRate}% · 总用例 {latestRun.totalCases} · 失败 {latestRun.failedCases} · 平均耗时 {latestRun.averageLatencyMs}ms
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">暂无评测报告，创建测试用例后可执行回归。</p>
        )}

        <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-3">
          <p className="text-sm font-semibold">新增测试用例</p>

          <Input
            value={newCase.name}
            onChange={(event) => setNewCase((prev) => ({ ...prev, name: event.target.value }))}
            placeholder="用例名称，例如：输出包含主题字段"
            aria-label="测试用例名称"
            disabled={isSavingCase}
          />

          <div className="grid gap-2 sm:grid-cols-2">
            <select
              value={newCase.assertionType}
              onChange={(event) =>
                setNewCase((prev) => ({
                  ...prev,
                  assertionType: event.target.value as PromptAssertionType,
                }))
              }
              aria-label="断言类型"
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              disabled={isSavingCase}
            >
              <option value="CONTAINS">contains</option>
              <option value="EQUALS">equals</option>
              <option value="REGEX">regex</option>
              <option value="JSON_SCHEMA">json-schema</option>
            </select>
            <Button type="button" variant="outline" onClick={handleCreateTestCase} disabled={isSavingCase}>
              <Plus className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
              {isSavingCase ? "保存中..." : "保存用例"}
            </Button>
          </div>

          <textarea
            value={newCase.expectedOutput}
            onChange={(event) =>
              setNewCase((prev) => ({ ...prev, expectedOutput: event.target.value }))
            }
            placeholder="断言期望值：contains/equals 填文本，regex 填正则，json-schema 填 JSON Schema"
            className="min-h-[96px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            aria-label="断言期望值"
            disabled={isSavingCase}
          />

          <textarea
            value={newCase.inputVariablesText}
            onChange={(event) =>
              setNewCase((prev) => ({ ...prev, inputVariablesText: event.target.value }))
            }
            placeholder='输入变量 JSON，例如 {"team":"平台组"}'
            className="min-h-[96px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            aria-label="输入变量 JSON"
            disabled={isSavingCase}
          />
        </div>

        <div className="space-y-2">
          <p className="text-sm font-semibold">测试用例列表（{testCases.length}）</p>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">正在加载测试用例...</p>
          ) : testCases.length === 0 ? (
            <p className="text-sm text-muted-foreground">暂无测试用例，可通过新增或导入开始。</p>
          ) : (
            <div className="space-y-2">
              {testCases.map((item) => (
                <div key={item.id} className="rounded-md border border-border bg-background p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium">{item.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {ASSERTION_LABELS[item.assertionType]} · 最近更新 {new Date(item.updatedAt).toLocaleString("zh-CN")}
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      aria-label={`删除测试用例 ${item.name}`}
                      onClick={() => void handleDeleteCase(item.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {latestRun && latestRun.results.length > 0 ? (
          <div className="space-y-2 rounded-lg border border-border bg-muted/20 p-3">
            <p className="text-sm font-semibold">最近一次失败明细</p>
            {latestRun.results.filter((item) => !item.passed).length === 0 ? (
              <p className="text-sm text-green-600 dark:text-green-400">全部通过，无失败项。</p>
            ) : (
              <div className="space-y-2">
                {latestRun.results
                  .filter((item) => !item.passed)
                  .map((item) => (
                    <div key={item.id} className="rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-300">
                      <p className="font-medium">{item.testCase.name}</p>
                      <p>{item.errorMessage || "断言失败"}</p>
                    </div>
                  ))}
              </div>
            )}
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
