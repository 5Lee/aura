const CONTROL_CHAR_PATTERN = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g
const BLOCKED_OBJECT_KEYS = new Set(["__proto__", "prototype", "constructor"])
const SAFE_VARIABLE_NAME_PATTERN = /^[a-zA-Z0-9_.-]{1,64}$/

interface SanitizeJsonOptions {
  maxDepth?: number
  maxKeysPerObject?: number
  maxArrayLength?: number
  maxStringLength?: number
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false
  }

  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

export function sanitizeTextInput(value: unknown, maxLength: number) {
  return String(value ?? "")
    .replace(CONTROL_CHAR_PATTERN, "")
    .trim()
    .slice(0, maxLength)
}

export function sanitizeMultilineTextInput(value: unknown, maxLength: number) {
  return String(value ?? "")
    .replace(CONTROL_CHAR_PATTERN, "")
    .slice(0, maxLength)
}

export function hasBlockedObjectPath(path: string) {
  return path
    .split(".")
    .map((segment) => segment.trim().toLowerCase())
    .some((segment) => BLOCKED_OBJECT_KEYS.has(segment))
}

export function isSafeTemplateVariableName(name: string) {
  return SAFE_VARIABLE_NAME_PATTERN.test(name) && !hasBlockedObjectPath(name)
}

export function sanitizeJsonValue(
  value: unknown,
  options: SanitizeJsonOptions = {},
  depth = 0
): unknown {
  const maxDepth = options.maxDepth ?? 8
  const maxKeysPerObject = options.maxKeysPerObject ?? 64
  const maxArrayLength = options.maxArrayLength ?? 200
  const maxStringLength = options.maxStringLength ?? 4000

  if (depth > maxDepth) {
    return undefined
  }

  if (value === null || typeof value === "boolean") {
    return value
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined
  }

  if (typeof value === "string") {
    return sanitizeMultilineTextInput(value, maxStringLength)
  }

  if (Array.isArray(value)) {
    if (value.length > maxArrayLength) {
      return undefined
    }

    const nextArray: unknown[] = []
    for (const item of value) {
      const sanitized = sanitizeJsonValue(item, options, depth + 1)
      if (sanitized === undefined) {
        return undefined
      }
      nextArray.push(sanitized)
    }

    return nextArray
  }

  if (!isPlainObject(value)) {
    return undefined
  }

  const entries = Object.entries(value)
  if (entries.length > maxKeysPerObject) {
    return undefined
  }

  const nextRecord: Record<string, unknown> = Object.create(null)
  for (const [rawKey, rawValue] of entries) {
    const key = sanitizeTextInput(rawKey, 120)
    if (!key || hasBlockedObjectPath(key)) {
      return undefined
    }

    const sanitized = sanitizeJsonValue(rawValue, options, depth + 1)
    if (sanitized === undefined) {
      return undefined
    }

    nextRecord[key] = sanitized
  }

  return nextRecord
}
