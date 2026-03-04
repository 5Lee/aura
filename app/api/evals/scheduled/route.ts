import { PromptEvalRunMode } from "@prisma/client"
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"

import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { executePromptEvalRun } from "@/lib/prompt-evals"

function isScheduleTokenValid(request: Request) {
  const expectedToken = process.env.AURA_SCHEDULE_TOKEN
  if (!expectedToken) {
    return false
  }

  const headerToken = request.headers.get("x-aura-schedule-token")
  return headerToken === expectedToken
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  const hasScheduleToken = isScheduleTokenValid(request)

  if (!session?.user && !hasScheduleToken) {
    return NextResponse.json({ error: "无权限执行计划评测" }, { status: 401 })
  }

  try {
    const body = await request.json().catch(() => ({}))

    let promptIds: string[] = []
    if (Array.isArray(body.promptIds) && body.promptIds.length > 0) {
      promptIds = body.promptIds.map((id: unknown) => String(id)).filter(Boolean)
    }

    if (promptIds.length === 0) {
      const promptRows = await prisma.promptTestCase.findMany({
        where: {
          enabled: true,
        },
        select: {
          promptId: true,
        },
        distinct: ["promptId"],
      })
      promptIds = promptRows.map((item) => item.promptId)
    }

    const results = []
    for (const promptId of promptIds) {
      try {
        const run = await executePromptEvalRun({
          promptId,
          mode: PromptEvalRunMode.SCHEDULED,
          triggeredById: session?.user?.id,
          summary: "Scheduled prompt regression",
        })
        results.push({
          promptId,
          runId: run.id,
          passRate: run.passRate,
          failedCases: run.failedCases,
        })
      } catch (error) {
        results.push({
          promptId,
          error: String(error),
        })
      }
    }

    return NextResponse.json({
      totalPrompts: promptIds.length,
      results,
    })
  } catch (error) {
    console.error("Scheduled eval failed:", error)
    return NextResponse.json({ error: "计划评测执行失败" }, { status: 500 })
  }
}
