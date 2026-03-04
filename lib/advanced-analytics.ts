import { PromptPublishStatus, PromptVersionSource } from "@prisma/client"

import { prisma } from "@/lib/db"
import { getOrSetPerfCache, invalidatePerfCacheByTag } from "@/lib/perf-cache"

type WeeklyBucket = {
  weekStart: string
  evalRuns: number
  avgPassRate: number
  versionChanges: number
}

function startOfDay(date: Date) {
  const next = new Date(date)
  next.setHours(0, 0, 0, 0)
  return next
}

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function getWeekStart(date: Date) {
  const next = startOfDay(date)
  const day = next.getDay()
  const diff = day === 0 ? -6 : 1 - day
  next.setDate(next.getDate() + diff)
  return next
}

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10)
}

function toPercent(value: number, total: number) {
  if (total <= 0) {
    return 0
  }
  return Number(((value / total) * 100).toFixed(2))
}

function buildWeeklySkeleton(weeks: number) {
  const currentWeekStart = getWeekStart(new Date())
  const list: WeeklyBucket[] = []

  for (let index = weeks - 1; index >= 0; index -= 1) {
    const weekStart = addDays(currentWeekStart, -7 * index)
    list.push({
      weekStart: formatDate(weekStart),
      evalRuns: 0,
      avgPassRate: 0,
      versionChanges: 0,
    })
  }

  return list
}

function buildStreak(activeDateSet: Set<string>) {
  let streak = 0
  let cursor = startOfDay(new Date())

  while (activeDateSet.has(formatDate(cursor))) {
    streak += 1
    cursor = addDays(cursor, -1)
  }

  return streak
}

export async function getAdvancedAnalyticsDashboard(userId: string) {
  return getOrSetPerfCache(
    `advanced-analytics:${userId}`,
    async () => {
      const days30Start = addDays(startOfDay(new Date()), -29)
      const days7Start = addDays(startOfDay(new Date()), -6)
      const week8Start = addDays(getWeekStart(new Date()), -7 * 7)

      const [prompts, evalRuns, promptVersions, auditLogs] = await Promise.all([
        prisma.prompt.findMany({
          where: {
            authorId: userId,
          },
          select: {
            id: true,
            categoryId: true,
            isPublic: true,
            publishStatus: true,
            createdAt: true,
            updatedAt: true,
          },
        }),
        prisma.promptEvalRun.findMany({
          where: {
            prompt: {
              authorId: userId,
            },
            createdAt: {
              gte: week8Start,
            },
          },
          select: {
            promptId: true,
            passRate: true,
            createdAt: true,
          },
        }),
        prisma.promptVersion.findMany({
          where: {
            prompt: {
              authorId: userId,
            },
            createdAt: {
              gte: week8Start,
            },
          },
          select: {
            promptId: true,
            source: true,
            createdAt: true,
          },
        }),
        prisma.promptAuditLog.findMany({
          where: {
            actorId: userId,
            createdAt: {
              gte: days30Start,
            },
          },
          select: {
            action: true,
            createdAt: true,
          },
        }),
      ])

      const promptIds = prompts.map((item) => item.id)
      const [templatePromptIds, testCasePromptIds] =
        promptIds.length === 0
          ? [[], []]
          : await Promise.all([
              prisma.promptTemplateVariable.findMany({
                where: {
                  promptId: {
                    in: promptIds,
                  },
                },
                select: { promptId: true },
                distinct: ["promptId"],
              }),
              prisma.promptTestCase.findMany({
                where: {
                  promptId: {
                    in: promptIds,
                  },
                  enabled: true,
                },
                select: { promptId: true },
                distinct: ["promptId"],
              }),
            ])

      const promptTotal = prompts.length
      const withVariables = new Set(templatePromptIds.map((item) => item.promptId))
      const withTestCases = new Set(testCasePromptIds.map((item) => item.promptId))
      const withEvalRuns = new Set(evalRuns.map((item) => item.promptId))
      const publishedPrompts = prompts.filter(
        (item) => item.publishStatus === PromptPublishStatus.PUBLISHED && item.isPublic
      ).length

      const weeklySkeleton = buildWeeklySkeleton(8)
      const weeklyMap = new Map(
        weeklySkeleton.map((item) => [
          item.weekStart,
          {
            evalRuns: 0,
            passRateSum: 0,
            versionChanges: 0,
          },
        ])
      )

      for (const run of evalRuns) {
        const weekStart = formatDate(getWeekStart(run.createdAt))
        const current = weeklyMap.get(weekStart)
        if (!current) {
          continue
        }
        current.evalRuns += 1
        current.passRateSum += run.passRate
      }

      for (const version of promptVersions) {
        const weekStart = formatDate(getWeekStart(version.createdAt))
        const current = weeklyMap.get(weekStart)
        if (!current) {
          continue
        }
        current.versionChanges += 1
      }

      const versionQualityTrend = weeklySkeleton.map((item) => {
        const stats = weeklyMap.get(item.weekStart)
        if (!stats) {
          return item
        }

        return {
          weekStart: item.weekStart,
          evalRuns: stats.evalRuns,
          avgPassRate: stats.evalRuns === 0 ? 0 : Number((stats.passRateSum / stats.evalRuns).toFixed(2)),
          versionChanges: stats.versionChanges,
        }
      })

      const activeDates30 = new Set<string>()
      const activeDates7 = new Set<string>()

      for (const prompt of prompts) {
        if (prompt.createdAt >= days30Start) {
          const key = formatDate(prompt.createdAt)
          activeDates30.add(key)
          if (prompt.createdAt >= days7Start) {
            activeDates7.add(key)
          }
        }

        if (prompt.updatedAt >= days30Start) {
          const key = formatDate(prompt.updatedAt)
          activeDates30.add(key)
          if (prompt.updatedAt >= days7Start) {
            activeDates7.add(key)
          }
        }
      }

      for (const run of evalRuns) {
        if (run.createdAt >= days30Start) {
          const key = formatDate(run.createdAt)
          activeDates30.add(key)
          if (run.createdAt >= days7Start) {
            activeDates7.add(key)
          }
        }
      }

      for (const auditLog of auditLogs) {
        const key = formatDate(auditLog.createdAt)
        activeDates30.add(key)
        if (auditLog.createdAt >= days7Start) {
          activeDates7.add(key)
        }
      }

      const versionSourceMap = new Map<PromptVersionSource, number>([
        [PromptVersionSource.CREATE, 0],
        [PromptVersionSource.UPDATE, 0],
        [PromptVersionSource.ROLLBACK, 0],
        [PromptVersionSource.IMPORT, 0],
      ])

      for (const version of promptVersions) {
        versionSourceMap.set(version.source, (versionSourceMap.get(version.source) || 0) + 1)
      }

      const promptsByCategory = new Map<string, number>()
      for (const prompt of prompts) {
        promptsByCategory.set(prompt.categoryId, (promptsByCategory.get(prompt.categoryId) || 0) + 1)
      }

      return {
        generatedAt: new Date().toISOString(),
        conversionFunnel: {
          totalPrompts: promptTotal,
          templatedPrompts: withVariables.size,
          testedPrompts: withTestCases.size,
          evaluatedPrompts: withEvalRuns.size,
          publishedPrompts,
          ratios: {
            templateCoverage: toPercent(withVariables.size, promptTotal),
            testCoverage: toPercent(withTestCases.size, promptTotal),
            evaluationCoverage: toPercent(withEvalRuns.size, promptTotal),
            publishCoverage: toPercent(publishedPrompts, promptTotal),
          },
        },
        versionQualityTrend,
        versionSourceDistribution: Array.from(versionSourceMap.entries()).map(([source, count]) => ({
          source,
          count,
        })),
        retention: {
          activeDays7: activeDates7.size,
          activeDays30: activeDates30.size,
          retentionRate7: toPercent(activeDates7.size, 7),
          retentionRate30: toPercent(activeDates30.size, 30),
          currentStreak: buildStreak(activeDates30),
        },
        segmentation: {
          categoryCount: promptsByCategory.size,
          topCategories: Array.from(promptsByCategory.entries())
            .map(([categoryId, count]) => ({ categoryId, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5),
        },
      }
    },
    {
      ttlMs: 30000,
      tags: [`advanced-analytics:${userId}`],
    }
  )
}

export function invalidateAdvancedAnalyticsCache(userId: string | null | undefined) {
  if (!userId) {
    return
  }
  invalidatePerfCacheByTag(`advanced-analytics:${userId}`)
}
