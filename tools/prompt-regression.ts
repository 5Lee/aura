import { PromptEvalRunMode } from "@prisma/client"

import { prisma } from "../lib/db"
import { executePromptEvalRun } from "../lib/prompt-evals"

interface PromptRegressionArgs {
  mode: PromptEvalRunMode
  promptId: string | null
  allowEmpty: boolean
}

function parseArgs(argv: string[]): PromptRegressionArgs {
  const args = new Map<string, string | boolean>()

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index]
    if (!current.startsWith("--")) {
      continue
    }

    const key = current.replace(/^--/, "")
    const next = argv[index + 1]
    if (!next || next.startsWith("--")) {
      args.set(key, true)
      continue
    }

    args.set(key, next)
    index += 1
  }

  const modeValue = String(args.get("mode") || "ci").toLowerCase()
  const mode =
    modeValue === "manual"
      ? PromptEvalRunMode.MANUAL
      : modeValue === "scheduled"
        ? PromptEvalRunMode.SCHEDULED
        : PromptEvalRunMode.CI

  const promptIdRaw = args.get("prompt")
  const promptId = typeof promptIdRaw === "string" && promptIdRaw !== "all" ? promptIdRaw : null

  return {
    mode,
    promptId,
    allowEmpty: Boolean(args.get("allow-empty")),
  }
}

async function resolvePromptIds(promptId: string | null) {
  if (promptId) {
    return [promptId]
  }

  const rows = await prisma.promptTestCase.findMany({
    where: { enabled: true },
    select: { promptId: true },
    distinct: ["promptId"],
  })

  return rows.map((row) => row.promptId)
}

async function main() {
  const args = parseArgs(process.argv.slice(2))

  if (!process.env.DATABASE_URL) {
    console.log("[prompt-regression] skip: DATABASE_URL is not set")
    return
  }

  const promptIds = await resolvePromptIds(args.promptId)
  if (promptIds.length === 0) {
    const message = "[prompt-regression] no enabled prompt test cases found"
    if (args.allowEmpty) {
      console.log(`${message}, exiting 0 due to --allow-empty`)
      return
    }

    throw new Error(`${message}; provide --allow-empty to treat as pass`)
  }

  let failedPromptRuns = 0
  let totalFailedCases = 0

  console.log(
    `[prompt-regression] start: prompts=${promptIds.length}, mode=${args.mode.toLowerCase()}`
  )

  for (const promptId of promptIds) {
    try {
      const run = await executePromptEvalRun({
        promptId,
        mode: args.mode,
        summary: `prompt-regression ${args.mode.toLowerCase()}`,
      })

      totalFailedCases += run.failedCases
      if (run.failedCases > 0) {
        failedPromptRuns += 1
      }

      console.log(
        `[prompt-regression] prompt=${promptId} run=${run.id} passRate=${run.passRate}% total=${run.totalCases} failed=${run.failedCases}`
      )

      if (run.failedCases > 0) {
        for (const result of run.results) {
          if (result.passed) {
            continue
          }

          console.log(
            `[prompt-regression][FAIL] prompt=${promptId} case=${result.testCase.name} assertion=${result.testCase.assertionType} reason=${result.errorMessage || "assertion failed"}`
          )
        }
      }
    } catch (error) {
      failedPromptRuns += 1
      console.log(
        `[prompt-regression][ERROR] prompt=${promptId} message=${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  console.log(
    `[prompt-regression] finished: prompts=${promptIds.length}, failedPromptRuns=${failedPromptRuns}, failedCases=${totalFailedCases}`
  )

  if (failedPromptRuns > 0 || totalFailedCases > 0) {
    process.exitCode = 1
  }
}

main()
  .catch((error) => {
    console.error(`[prompt-regression] fatal: ${error instanceof Error ? error.message : String(error)}`)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
