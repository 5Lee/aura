import { PromptAssertionType, type Prisma } from "@prisma/client"

import {
  sanitizeJsonValue,
  sanitizeMultilineTextInput,
  sanitizeTextInput,
} from "@/lib/security"

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

  const sanitized = sanitizeJsonValue(value, {
    maxDepth: 8,
    maxKeysPerObject: 64,
    maxArrayLength: 100,
    maxStringLength: 2000,
  })
  if (!sanitized || typeof sanitized !== "object" || Array.isArray(sanitized)) {
    return undefined
  }

  return sanitized as Prisma.InputJsonValue
}

export function sanitizePromptTestCases(input: unknown): SanitizedPromptTestCase[] {
  if (!Array.isArray(input)) {
    return []
  }

  const seen = new Set<string>()

  return input
    .map((item) => {
      const payload = (item || {}) as PromptTestCasePayload
      const name = typeof payload.name === "string" ? sanitizeTextInput(payload.name, 120) : ""
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
          : sanitizeMultilineTextInput(payload.expectedOutput, 20000)
      if (!expectedOutput.trim()) {
        return null
      }

      const normalizedInputVariables = normalizeInputVariables(payload.inputVariables)
      if (
        payload.inputVariables !== undefined &&
        payload.inputVariables !== null &&
        normalizedInputVariables === undefined
      ) {
        return null
      }

      return {
        name,
        description:
          payload.description === undefined || payload.description === null
            ? null
            : sanitizeMultilineTextInput(payload.description, 2000),
        assertionType: normalizeAssertionType(payload.assertionType),
        expectedOutput,
        inputVariables: normalizedInputVariables,
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
