import { randomUUID } from "node:crypto"

const assertionHandlers = {
  CONTAINS: (actual, expected) => actual.includes(expected),
  EQUALS: (actual, expected) => actual === expected,
  REGEX: (actual, expected) => new RegExp(expected, "u").test(actual),
}

export const createPromptEvalsFixture = () => {
  const prompts = new Map()

  return {
    createPrompt(content) {
      const id = randomUUID()
      prompts.set(id, {
        id,
        content,
        testCases: [],
        runs: [],
      })
      return id
    },

    importTestCases(promptId, testCases, replaceAll = true) {
      const prompt = prompts.get(promptId)
      if (!prompt) {
        throw new Error("prompt not found")
      }

      const normalized = testCases
        .map((item) => ({
          id: randomUUID(),
          name: String(item.name || "").trim(),
          assertionType: String(item.assertionType || "CONTAINS").toUpperCase(),
          expectedOutput: String(item.expectedOutput || ""),
          inputVariables: item.inputVariables || {},
        }))
        .filter((item) => item.name && item.expectedOutput)

      prompt.testCases = replaceAll ? normalized : [...prompt.testCases, ...normalized]
      return normalized.length
    },

    run(promptId, mode = "MANUAL") {
      const prompt = prompts.get(promptId)
      if (!prompt) {
        throw new Error("prompt not found")
      }

      const results = prompt.testCases.map((testCase) => {
        const output = prompt.content.replace(/{{\s*topic\s*}}/g, String(testCase.inputVariables.topic || ""))

        let passed = false
        if (testCase.assertionType === "JSON_SCHEMA") {
          passed = output.trim().startsWith("{") && output.trim().endsWith("}")
        } else {
          const handler = assertionHandlers[testCase.assertionType]
          passed = handler ? handler(output, testCase.expectedOutput) : false
        }

        return {
          id: randomUUID(),
          testCaseId: testCase.id,
          passed,
          output,
        }
      })

      const total = results.length
      const passed = results.filter((item) => item.passed).length
      const failed = total - passed
      const run = {
        id: randomUUID(),
        mode,
        totalCases: total,
        failedCases: failed,
        passRate: total === 0 ? 100 : Number(((passed / total) * 100).toFixed(2)),
        results,
      }

      prompt.runs.unshift(run)
      return run
    },

    getRuns(promptId) {
      const prompt = prompts.get(promptId)
      if (!prompt) {
        throw new Error("prompt not found")
      }

      return prompt.runs
    },
  }
}
