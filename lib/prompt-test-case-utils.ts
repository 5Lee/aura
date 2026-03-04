import { PromptAssertionType, type Prisma } from "@prisma/client"

export interface PromptTestCasePayload {
  name: string
  description?: string
  assertionType?: PromptAssertionType | string
  expectedOutput?: string
  inputVariables?: Record<string, unknown>
  enabled?: boolean
}

export interface SanitizedPromptTestCase {
  name: string
  description: string | null
  assertionType: PromptAssertionType
  expectedOutput: string
  inputVariables: Prisma.InputJsonValue | undefined
  enabled: boolean
}

const ALLOWED_ASSERTION_TYPES = new Set<PromptAssertionType>([
  PromptAssertionType.CONTAINS,
  PromptAssertionType.EQUALS,
  PromptAssertionType.REGEX,
  PromptAssertionType.JSON_SCHEMA,
])

function normalizeAssertionType(value: PromptAssertionType | string | undefined) {
  const normalized = typeof value === "string" ? value.trim().toUpperCase() : "CONTAINS"
  if (ALLOWED_ASSERTION_TYPES.has(normalized as PromptAssertionType)) {
    return normalized as PromptAssertionType
  }

  return PromptAssertionType.CONTAINS
}

function normalizeInputVariables(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined
  }

  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue
}

export function sanitizePromptTestCases(input: unknown): SanitizedPromptTestCase[] {
  if (!Array.isArray(input)) {
    return []
  }

  const seen = new Set<string>()

  return input
    .map((item) => {
      const payload = (item || {}) as PromptTestCasePayload
      const name = typeof payload.name === "string" ? payload.name.trim() : ""
      if (!name) {
        return null
      }

      const key = name.toLowerCase()
      if (seen.has(key)) {
        return null
      }
      seen.add(key)

      const expectedOutput =
        payload.expectedOutput === undefined || payload.expectedOutput === null
          ? ""
          : String(payload.expectedOutput)
      if (!expectedOutput.trim()) {
        return null
      }

      return {
        name,
        description:
          payload.description === undefined || payload.description === null
            ? null
            : String(payload.description),
        assertionType: normalizeAssertionType(payload.assertionType),
        expectedOutput,
        inputVariables: normalizeInputVariables(payload.inputVariables),
        enabled: payload.enabled === undefined ? true : Boolean(payload.enabled),
      }
    })
    .filter((item): item is SanitizedPromptTestCase => item !== null)
}

export function serializePromptTestCaseExport(promptId: string, testCases: SanitizedPromptTestCase[]) {
  return {
    version: "1.0.0",
    promptId,
    exportedAt: new Date().toISOString(),
    testCases,
  }
}
