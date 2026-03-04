import { prisma } from "@/lib/db"

const ALLOWED_VARIABLE_TYPES = new Set(["string", "number", "boolean", "json"])
type PromptTemplateVariableType = "string" | "number" | "boolean" | "json"

export interface PromptTemplateVariablePayload {
  name: string
  type?: string
  required?: boolean
  defaultValue?: string
  description?: string
  options?: string[]
  minLength?: number
  maxLength?: number
}

export interface SanitizedPromptTemplateVariable {
  name: string
  type: PromptTemplateVariableType
  required: boolean
  defaultValue: string | null
  description: string | null
  options: string[] | undefined
  minLength: number | null
  maxLength: number | null
}

function normalizeInteger(value: unknown) {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    return null
  }

  return value
}

function normalizeOptions(value: unknown) {
  if (!Array.isArray(value)) {
    return undefined
  }

  const seen = new Set<string>()
  const options: string[] = []

  for (const item of value) {
    const option = typeof item === "string" ? item.trim() : ""
    if (!option) {
      continue
    }

    if (seen.has(option)) {
      continue
    }

    seen.add(option)
    options.push(option)
  }

  return options.length > 0 ? options : undefined
}

export function sanitizeTemplateVariables(input: unknown): SanitizedPromptTemplateVariable[] {
  if (!Array.isArray(input)) {
    return []
  }

  const seen = new Set<string>()

  return input
    .map((item) => {
      const payload = (item || {}) as PromptTemplateVariablePayload
      const name = typeof payload.name === "string" ? payload.name.trim() : ""
      const key = name.toLowerCase()

      if (!name || seen.has(key)) {
        return null
      }

      seen.add(key)

      const rawType = typeof payload.type === "string" ? payload.type.trim().toLowerCase() : "string"
      const type = (ALLOWED_VARIABLE_TYPES.has(rawType) ? rawType : "string") as PromptTemplateVariableType
      const minLength = normalizeInteger(payload.minLength)
      let maxLength = normalizeInteger(payload.maxLength)

      if (minLength !== null && maxLength !== null && maxLength < minLength) {
        maxLength = minLength
      }

      return {
        name,
        type,
        required: Boolean(payload.required),
        defaultValue:
          payload.defaultValue === undefined || payload.defaultValue === null
            ? null
            : String(payload.defaultValue),
        description:
          payload.description === undefined || payload.description === null
            ? null
            : String(payload.description),
        options: normalizeOptions(payload.options),
        minLength,
        maxLength,
      }
    })
    .filter((item): item is SanitizedPromptTemplateVariable => item !== null)
}

type TemplateVariableClient = Pick<typeof prisma, "promptTemplateVariable">

export async function replacePromptTemplateVariablesWithClient(
  client: TemplateVariableClient,
  promptId: string,
  variables: SanitizedPromptTemplateVariable[]
) {
  await client.promptTemplateVariable.deleteMany({
    where: { promptId },
  })

  for (const variable of variables) {
    await client.promptTemplateVariable.create({
      data: {
        promptId,
        ...variable,
      },
    })
  }
}
