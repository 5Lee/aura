import {
  type PromptAssertionType,
  PromptEvalRunMode,
  PromptEvalRunStatus,
  type Prisma,
} from "@prisma/client"

import { prisma } from "@/lib/db"
import { renderPromptTemplate, validateTemplateInput } from "@/lib/prompt-template"

interface EvaluatePromptAssertionResult {
  passed: boolean
  errorMessage?: string
  details?: Prisma.InputJsonValue
}

interface ExecutePromptEvalRunOptions {
  promptId: string
  mode?: PromptEvalRunMode
  triggeredById?: string
  summary?: string
}

function normalizeRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {}
  }

  return value as Record<string, unknown>
}

function isTypeMatch(value: unknown, expectedType: string) {
  if (expectedType === "array") {
    return Array.isArray(value)
  }

  if (expectedType === "null") {
    return value === null
  }

  if (expectedType === "number") {
    return typeof value === "number" && Number.isFinite(value)
  }

  if (expectedType === "object") {
    return value !== null && typeof value === "object" && !Array.isArray(value)
  }

  return typeof value === expectedType
}

function evaluateJsonSchema(expectedSchema: string, actualOutput: string): EvaluatePromptAssertionResult {
  let schema: Record<string, unknown>
  let parsedOutput: unknown

  try {
    schema = JSON.parse(expectedSchema) as Record<string, unknown>
  } catch {
    return {
      passed: false,
      errorMessage: "JSON Schema 断言配置无效，expectedOutput 需为 JSON 对象字符串",
    }
  }

  try {
    parsedOutput = JSON.parse(actualOutput)
  } catch {
    return {
      passed: false,
      errorMessage: "实际输出不是有效 JSON，无法执行 JSON Schema 断言",
    }
  }

  if (!parsedOutput || typeof parsedOutput !== "object" || Array.isArray(parsedOutput)) {
    return {
      passed: false,
      errorMessage: "实际输出必须是 JSON 对象",
    }
  }

  const payload = parsedOutput as Record<string, unknown>
  const required = Array.isArray(schema.required)
    ? schema.required.filter((item): item is string => typeof item === "string")
    : []

  for (const field of required) {
    if (!(field in payload)) {
      return {
        passed: false,
        errorMessage: `JSON Schema 断言失败：缺少必填字段 ${field}`,
        details: {
          missingField: field,
        },
      }
    }
  }

  const properties =
    schema.properties && typeof schema.properties === "object" && !Array.isArray(schema.properties)
      ? (schema.properties as Record<string, unknown>)
      : {}

  for (const [field, config] of Object.entries(properties)) {
    if (!(field in payload)) {
      continue
    }

    if (!config || typeof config !== "object" || Array.isArray(config)) {
      continue
    }

    const type =
      typeof (config as Record<string, unknown>).type === "string"
        ? String((config as Record<string, unknown>).type)
        : ""

    if (!type) {
      continue
    }

    if (!isTypeMatch(payload[field], type)) {
      return {
        passed: false,
        errorMessage: `JSON Schema 断言失败：字段 ${field} 期望 ${type}`,
        details: {
          field,
          expectedType: type,
          actualType: Array.isArray(payload[field]) ? "array" : typeof payload[field],
        },
      }
    }
  }

  return { passed: true }
}

export function evaluatePromptAssertion(
  assertionType: PromptAssertionType,
  expectedOutput: string,
  actualOutput: string
): EvaluatePromptAssertionResult {
  switch (assertionType) {
    case "CONTAINS": {
      const passed = actualOutput.includes(expectedOutput)
      return {
        passed,
        errorMessage: passed ? undefined : "断言失败：输出未包含期望内容",
      }
    }
    case "EQUALS": {
      const passed = actualOutput.trim() === expectedOutput.trim()
      return {
        passed,
        errorMessage: passed ? undefined : "断言失败：输出与期望不一致",
      }
    }
    case "REGEX": {
      try {
        const pattern = new RegExp(expectedOutput, "u")
        const passed = pattern.test(actualOutput)
        return {
          passed,
          errorMessage: passed ? undefined : "断言失败：输出未匹配正则表达式",
        }
      } catch {
        return {
          passed: false,
          errorMessage: "断言失败：无效的正则表达式",
        }
      }
    }
    case "JSON_SCHEMA":
      return evaluateJsonSchema(expectedOutput, actualOutput)
    default:
      return {
        passed: false,
        errorMessage: "断言失败：不支持的断言类型",
      }
  }
}

export async function executePromptEvalRun({
  promptId,
  mode = PromptEvalRunMode.MANUAL,
  triggeredById,
  summary,
}: ExecutePromptEvalRunOptions) {
  const prompt = await prisma.prompt.findUnique({
    where: { id: promptId },
    include: {
      templateVariables: {
        orderBy: { name: "asc" },
      },
      testCases: {
        where: { enabled: true },
        orderBy: { createdAt: "asc" },
      },
      versions: {
        orderBy: { version: "desc" },
        take: 1,
      },
    },
  })

  if (!prompt) {
    throw new Error("提示词不存在")
  }

  const run = await prisma.promptEvalRun.create({
    data: {
      promptId,
      promptVersionId: prompt.versions[0]?.id,
      mode,
      status: PromptEvalRunStatus.RUNNING,
      triggeredById: triggeredById || null,
      summary: summary || null,
      startedAt: new Date(),
    },
  })

  const results: Array<{
    id: string
    testCaseId: string
    testCaseName: string
    passed: boolean
    latencyMs: number
    renderedOutput: string | null
    errorMessage: string | null
    details: Prisma.JsonValue | null
  }> = []

  for (const testCase of prompt.testCases) {
    const startedAt = Date.now()

    let passed = false
    let renderedOutput: string | null = null
    let errorMessage: string | null = null
    let details: Prisma.InputJsonValue | undefined

    const input = normalizeRecord(testCase.inputVariables)
    const validation = validateTemplateInput(
      prompt.templateVariables.map((item) => ({
        name: item.name,
        type: item.type as "string" | "number" | "boolean" | "json",
        required: item.required,
        defaultValue: item.defaultValue || undefined,
        minLength: item.minLength || undefined,
        maxLength: item.maxLength || undefined,
      })),
      input
    )

    if (!validation.ok) {
      passed = false
      errorMessage = validation.errors.join("；") || "变量校验失败"
      details = {
        stage: "validation",
        errors: validation.errors,
      } as Prisma.InputJsonValue
    } else {
      const rendered = renderPromptTemplate(prompt.content, validation.normalizedInput)
      renderedOutput = rendered.rendered

      if (!rendered.ok) {
        passed = false
        errorMessage = rendered.error || "模板渲染失败"
        details = {
          stage: "render",
          missingVariables: rendered.missingVariables,
        } as Prisma.InputJsonValue
      } else {
        const assertion = evaluatePromptAssertion(
          testCase.assertionType,
          testCase.expectedOutput,
          rendered.rendered
        )

        passed = assertion.passed
        errorMessage = assertion.errorMessage || null
        details = assertion.details
      }
    }

    const latencyMs = Date.now() - startedAt

    const result = await prisma.promptEvalResult.create({
      data: {
        runId: run.id,
        testCaseId: testCase.id,
        passed,
        latencyMs,
        renderedOutput,
        errorMessage,
        details,
      },
    })

    results.push({
      id: result.id,
      testCaseId: testCase.id,
      testCaseName: testCase.name,
      passed,
      latencyMs,
      renderedOutput,
      errorMessage,
      details: (details as Prisma.JsonValue | undefined) || null,
    })
  }

  const totalCases = results.length
  const passedCases = results.filter((item) => item.passed).length
  const failedCases = totalCases - passedCases
  const passRate = totalCases === 0 ? 100 : Number(((passedCases / totalCases) * 100).toFixed(2))
  const averageLatencyMs =
    totalCases === 0
      ? 0
      : Math.round(results.reduce((sum, item) => sum + item.latencyMs, 0) / totalCases)

  const status = PromptEvalRunStatus.COMPLETED
  const finishedAt = new Date()

  const updatedRun = await prisma.promptEvalRun.update({
    where: { id: run.id },
    data: {
      status,
      totalCases,
      passedCases,
      failedCases,
      passRate,
      averageLatencyMs,
      finishedAt,
    },
    include: {
      results: {
        include: {
          testCase: {
            select: {
              id: true,
              name: true,
              assertionType: true,
            },
          },
        },
        orderBy: {
          createdAt: "asc",
        },
      },
    },
  })

  return updatedRun
}

export async function getPromptQualityDashboard(userId: string) {
  const recentRuns = await prisma.promptEvalRun.findMany({
    where: {
      prompt: {
        authorId: userId,
      },
    },
    include: {
      prompt: {
        select: {
          id: true,
          title: true,
          category: {
            select: {
              id: true,
              name: true,
            },
          },
          author: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 120,
  })

  const failedResults = await prisma.promptEvalResult.findMany({
    where: {
      passed: false,
      run: {
        prompt: {
          authorId: userId,
        },
      },
    },
    include: {
      testCase: {
        select: {
          assertionType: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 500,
  })

  const rollbackLogs = await prisma.promptAuditLog.findMany({
    where: {
      action: "prompt.rollback",
      prompt: {
        authorId: userId,
      },
    },
    select: {
      promptId: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: 300,
  })

  const totalRuns = recentRuns.length
  const averagePassRate =
    totalRuns === 0
      ? 0
      : Number(
          (
            recentRuns.reduce((sum, run) => sum + (Number.isFinite(run.passRate) ? run.passRate : 0), 0) /
            totalRuns
          ).toFixed(2)
        )

  const trendMap = new Map<string, { date: string; runs: number; passRate: number }>()
  for (const run of recentRuns) {
    const date = run.createdAt.toISOString().slice(0, 10)
    const existing = trendMap.get(date) || { date, runs: 0, passRate: 0 }
    existing.runs += 1
    existing.passRate += Number.isFinite(run.passRate) ? run.passRate : 0
    trendMap.set(date, existing)
  }

  const trend = Array.from(trendMap.values())
    .map((item) => ({
      date: item.date,
      runs: item.runs,
      passRate: item.runs === 0 ? 0 : Number((item.passRate / item.runs).toFixed(2)),
    }))
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .slice(-14)

  const failureTypeMap = new Map<string, number>()
  for (const result of failedResults) {
    const key = result.testCase.assertionType
    failureTypeMap.set(key, (failureTypeMap.get(key) || 0) + 1)
  }

  const rollbackFrequencyMap = new Map<string, number>()
  for (const log of rollbackLogs) {
    if (!log.promptId) {
      continue
    }

    rollbackFrequencyMap.set(log.promptId, (rollbackFrequencyMap.get(log.promptId) || 0) + 1)
  }

  const latestRunByPrompt = new Map<string, (typeof recentRuns)[number]>()
  for (const run of recentRuns) {
    if (!latestRunByPrompt.has(run.promptId)) {
      latestRunByPrompt.set(run.promptId, run)
    }
  }

  const highRiskPrompts = Array.from(latestRunByPrompt.values())
    .filter((run) => run.passRate < 80 || (rollbackFrequencyMap.get(run.promptId) || 0) >= 2)
    .slice(0, 8)
    .map((run) => ({
      promptId: run.promptId,
      title: run.prompt.title,
      passRate: run.passRate,
      failedCases: run.failedCases,
      rollbackCount: rollbackFrequencyMap.get(run.promptId) || 0,
      lastEvaluatedAt: run.createdAt,
    }))

  const categoryStatsMap = new Map<string, { categoryId: string; category: string; count: number; passRate: number }>()
  for (const run of recentRuns) {
    const categoryId = run.prompt.category.id
    const categoryName = run.prompt.category.name
    const existing =
      categoryStatsMap.get(categoryId) || {
        categoryId,
        category: categoryName,
        count: 0,
        passRate: 0,
      }

    existing.count += 1
    existing.passRate += run.passRate
    categoryStatsMap.set(categoryId, existing)
  }

  const categoryComparison = Array.from(categoryStatsMap.values())
    .map((item) => ({
      ...item,
      passRate: item.count === 0 ? 0 : Number((item.passRate / item.count).toFixed(2)),
    }))
    .sort((a, b) => b.passRate - a.passRate)

  const authorLabel = recentRuns[0]?.prompt.author?.name || recentRuns[0]?.prompt.author?.email || "当前用户"
  const authorComparison = [
    {
      authorId: userId,
      author: authorLabel,
      runCount: totalRuns,
      averagePassRate,
    },
  ]

  const projectComparison = [
    {
      project: "Aura Prompt Library",
      runCount: totalRuns,
      averagePassRate,
      rollbackCount: rollbackLogs.length,
    },
  ]

  return {
    overview: {
      totalRuns,
      averagePassRate,
      failedAssertions: failedResults.length,
      rollbackCount: rollbackLogs.length,
    },
    trend,
    failureTypeDistribution: Array.from(failureTypeMap.entries()).map(([type, count]) => ({
      type,
      count,
    })),
    highRiskPrompts,
    categoryComparison,
    authorComparison,
    projectComparison,
    recentRuns: recentRuns.slice(0, 10).map((run) => ({
      id: run.id,
      promptId: run.promptId,
      promptTitle: run.prompt.title,
      mode: run.mode,
      passRate: run.passRate,
      totalCases: run.totalCases,
      failedCases: run.failedCases,
      createdAt: run.createdAt,
    })),
  }
}
