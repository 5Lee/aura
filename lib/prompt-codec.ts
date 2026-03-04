export interface PromptCodeTemplateVariable {
  name: string
  type?: string
  required?: boolean
  defaultValue?: string | null
  description?: string | null
  options?: string[]
  minLength?: number | null
  maxLength?: number | null
}

export interface PromptCodeTestCase {
  name: string
  assertionType: string
  expectedOutput: string
  inputVariables?: Record<string, unknown>
  enabled?: boolean
}

export interface PromptCodeItem {
  sourceExternalId?: string
  sourceUpdatedAt?: string
  title: string
  description?: string | null
  content: string
  categorySlug: string
  isPublic?: boolean
  publishStatus?: string
  tags?: string[]
  templateVariables?: PromptCodeTemplateVariable[]
  testCases?: PromptCodeTestCase[]
}

export interface PromptCodeFile {
  version: string
  prompts: PromptCodeItem[]
}

function escapeYamlString(value: string) {
  const escaped = value.replace(/"/g, '\\"').replace(/\n/g, "\\n")
  return `"${escaped}"`
}

function toYaml(value: unknown, indent = 0): string {
  const space = " ".repeat(indent)

  if (value === null || value === undefined) {
    return "null"
  }

  if (typeof value === "string") {
    return escapeYamlString(value)
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value)
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return "[]"
    }

    return value
      .map((item) => {
        if (
          item !== null &&
          typeof item === "object" &&
          !Array.isArray(item)
        ) {
          const objectLines = Object.entries(item as Record<string, unknown>)
            .map(([key, innerValue]) => {
              const serialized = toYaml(innerValue, indent + 4)
              if (
                innerValue !== null &&
                typeof innerValue === "object" &&
                serialized.includes("\n")
              ) {
                return `${" ".repeat(indent + 2)}${key}:\n${serialized
                  .split("\n")
                  .map((line) => `${" ".repeat(indent + 4)}${line}`)
                  .join("\n")}`
              }
              return `${" ".repeat(indent + 2)}${key}: ${serialized}`
            })
            .join("\n")

          return `${space}-\n${objectLines}`
        }

        return `${space}- ${toYaml(item, indent + 2)}`
      })
      .join("\n")
  }

  const object = value as Record<string, unknown>
  const entries = Object.entries(object)
  if (entries.length === 0) {
    return "{}"
  }

  return entries
    .map(([key, item]) => {
      const serialized = toYaml(item, indent + 2)
      if (item !== null && typeof item === "object" && serialized.includes("\n")) {
        return `${space}${key}:\n${serialized
          .split("\n")
          .map((line) => `${" ".repeat(indent + 2)}${line}`)
          .join("\n")}`
      }
      return `${space}${key}: ${serialized}`
    })
    .join("\n")
}

function parseYamlScalar(value: string): unknown {
  const trimmed = value.trim()
  if (!trimmed) {
    return ""
  }

  if (trimmed === "null") {
    return null
  }

  if (trimmed === "true") {
    return true
  }

  if (trimmed === "false") {
    return false
  }

  if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
    return Number(trimmed)
  }

  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    const body = trimmed.slice(1, -1)
    return body.replace(/\\n/g, "\n").replace(/\\"/g, '"')
  }

  return trimmed
}

function toPromptCodeItem(record: Record<string, unknown>): PromptCodeItem {
  const prompt: PromptCodeItem = {
    title: typeof record.title === "string" ? record.title : "",
    content: typeof record.content === "string" ? record.content : "",
    categorySlug: typeof record.categorySlug === "string" ? record.categorySlug : "",
  }

  if (typeof record.sourceExternalId === "string") {
    prompt.sourceExternalId = record.sourceExternalId
  }
  if (typeof record.sourceUpdatedAt === "string") {
    prompt.sourceUpdatedAt = record.sourceUpdatedAt
  }
  if (typeof record.description === "string" || record.description === null) {
    prompt.description = record.description
  }
  if (typeof record.isPublic === "boolean") {
    prompt.isPublic = record.isPublic
  }
  if (typeof record.publishStatus === "string") {
    prompt.publishStatus = record.publishStatus
  }
  if (Array.isArray(record.tags)) {
    prompt.tags = record.tags.filter((item): item is string => typeof item === "string")
  }
  if (Array.isArray(record.templateVariables)) {
    prompt.templateVariables = record.templateVariables as PromptCodeTemplateVariable[]
  }
  if (Array.isArray(record.testCases)) {
    prompt.testCases = record.testCases as PromptCodeTestCase[]
  }

  return prompt
}

function parseSimpleYaml(content: string): PromptCodeFile {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.replace(/\t/g, "  "))
    .filter((line) => line.trim() && !line.trim().startsWith("#"))

  if (lines.length === 0) {
    throw new Error("YAML 内容为空")
  }

  let version = "1.0.0"
  const prompts: PromptCodeItem[] = []
  let currentPrompt: Record<string, unknown> | null = null

  for (const rawLine of lines) {
    const line = rawLine.trim()

    if (line.startsWith("version:")) {
      version = String(parseYamlScalar(line.slice("version:".length)))
      continue
    }

    if (line === "prompts:" || line === "prompts: []") {
      continue
    }

    if (line === "-") {
      if (currentPrompt) {
        prompts.push(toPromptCodeItem(currentPrompt))
      }
      currentPrompt = {}
      continue
    }

    if (line.startsWith("- ")) {
      if (currentPrompt) {
        prompts.push(toPromptCodeItem(currentPrompt))
      }

      currentPrompt = {}
      const body = line.slice(2)
      const separator = body.indexOf(":")
      if (separator > 0) {
        const key = body.slice(0, separator).trim()
        const value = body.slice(separator + 1).trim()
        currentPrompt[key] = parseYamlScalar(value)
      }
      continue
    }

    if (!currentPrompt) {
      continue
    }

    const separator = line.indexOf(":")
    if (separator <= 0) {
      continue
    }

    const key = line.slice(0, separator).trim()
    const value = line.slice(separator + 1).trim()

    if (value.startsWith("[") || value.startsWith("{")) {
      try {
        currentPrompt[key] = JSON.parse(value)
        continue
      } catch {
        currentPrompt[key] = value
        continue
      }
    }

    currentPrompt[key] = parseYamlScalar(value)
  }

  if (currentPrompt) {
    prompts.push(toPromptCodeItem(currentPrompt))
  }

  return {
    version,
    prompts,
  }
}

export function serializePromptCodeFile(file: PromptCodeFile, format: "json" | "yaml") {
  if (format === "json") {
    return JSON.stringify(file, null, 2)
  }

  return toYaml(file)
}

export function parsePromptCodeFile(content: string, format: "json" | "yaml") {
  if (format === "json") {
    return JSON.parse(content) as PromptCodeFile
  }

  try {
    return JSON.parse(content) as PromptCodeFile
  } catch {
    return parseSimpleYaml(content)
  }
}
