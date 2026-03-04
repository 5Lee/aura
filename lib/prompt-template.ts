import {
  isSafeTemplateVariableName,
  sanitizeMultilineTextInput,
} from "@/lib/security"

type TemplateVariableType = "string" | "number" | "boolean" | "json"

export interface PromptTemplateVariableDefinition {
  name: string
  type?: TemplateVariableType
  required?: boolean
  defaultValue?: string
  minLength?: number
  maxLength?: number
  options?: string[]
}

export interface PromptTemplateValidationResult {
  ok: boolean
  errors: string[]
  normalizedInput: Record<string, string>
}

const VARIABLE_PATTERN = /{{\s*([a-zA-Z0-9_.-]+)\s*}}/g

export function extractTemplateVariables(template: string) {
  const variables = new Set<string>()
  let match: RegExpExecArray | null

  while ((match = VARIABLE_PATTERN.exec(template)) !== null) {
    variables.add(match[1])
  }

  return Array.from(variables)
}

export function validateTemplateInput(
  definitions: PromptTemplateVariableDefinition[],
  input: Record<string, unknown>
): PromptTemplateValidationResult {
  const errors: string[] = []
  const normalizedInput: Record<string, string> = Object.create(null) as Record<string, string>

  for (const definition of definitions) {
    const key = definition.name
    if (!isSafeTemplateVariableName(key)) {
      errors.push(`变量 ${key} 命名不安全`)
      continue
    }

    const hasOwnValue = Object.prototype.hasOwnProperty.call(input, key)
    const rawValue = hasOwnValue ? input[key] : undefined
    const value =
      rawValue === undefined || rawValue === null ? definition.defaultValue ?? "" : String(rawValue)
    const safeValue = sanitizeMultilineTextInput(value, 4000)
    const type = definition.type || "string"

    if (definition.required && !String(safeValue).trim()) {
      errors.push(`变量 ${key} 不能为空`)
      continue
    }

    if (type === "number" && String(safeValue).trim() && Number.isNaN(Number(safeValue))) {
      errors.push(`变量 ${key} 必须为数字`)
    }

    if (type === "boolean" && String(safeValue).trim()) {
      const normalized = String(safeValue).toLowerCase()
      if (!["true", "false", "1", "0"].includes(normalized)) {
        errors.push(`变量 ${key} 必须为布尔值`)
      }
    }

    if (type === "json" && String(safeValue).trim()) {
      try {
        JSON.parse(String(safeValue))
      } catch {
        errors.push(`变量 ${key} 必须为有效 JSON`)
      }
    }

    if (definition.minLength !== undefined && String(safeValue).length < definition.minLength) {
      errors.push(`变量 ${key} 长度不能小于 ${definition.minLength}`)
    }

    if (definition.maxLength !== undefined && String(safeValue).length > definition.maxLength) {
      errors.push(`变量 ${key} 长度不能大于 ${definition.maxLength}`)
    }

    if (definition.options && definition.options.length > 0 && String(safeValue).trim()) {
      if (!definition.options.includes(String(safeValue))) {
        errors.push(`变量 ${key} 不在允许选项中`)
      }
    }

    normalizedInput[key] = String(safeValue)
  }

  return {
    ok: errors.length === 0,
    errors,
    normalizedInput,
  }
}

export function renderPromptTemplate(template: string, input: Record<string, string>) {
  const missingVariables: string[] = []
  const rendered = template.replace(VARIABLE_PATTERN, (_fullMatch, variableName: string) => {
    if (!isSafeTemplateVariableName(variableName)) {
      missingVariables.push(variableName)
      return ""
    }

    const hasOwnValue = Object.prototype.hasOwnProperty.call(input, variableName)
    const value = hasOwnValue ? input[variableName] : undefined
    if (value === undefined || value === null) {
      missingVariables.push(variableName)
      return ""
    }
    return String(value)
  })

  if (missingVariables.length > 0) {
    return {
      ok: false,
      rendered,
      error: `缺少变量: ${missingVariables.join(", ")}`,
      missingVariables,
    }
  }

  return {
    ok: true,
    rendered,
    missingVariables: [],
  }
}
