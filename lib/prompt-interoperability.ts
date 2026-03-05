import { PromptInteropMode, PromptInteropPlatform } from "@prisma/client"

import { sanitizeMultilineTextInput, sanitizeTextInput } from "@/lib/security"

type PromptInteropProfilePreset = {
  name: string
  platform: PromptInteropPlatform
  mode: PromptInteropMode
  fieldMapping: {
    externalId: string
    title: string
    content: string
    description: string
    tags: string
    updatedAt: string
  }
  conflictPolicy: string
  compatibilityMode: string
}

type PromptDraft = {
  externalId: string
  title: string
  content: string
  description: string
  tags: string[]
  updatedAt: string
}

export const DEFAULT_PROMPT_INTEROP_PROFILES: PromptInteropProfilePreset[] = [
  {
    name: "Langfuse 导入适配",
    platform: PromptInteropPlatform.LANGFUSE,
    mode: PromptInteropMode.IMPORT,
    fieldMapping: {
      externalId: "id",
      title: "name",
      content: "prompt",
      description: "description",
      tags: "tags",
      updatedAt: "updatedAt",
    },
    conflictPolicy: "skip",
    compatibilityMode: "strict",
  },
  {
    name: "Promptfoo 导出适配",
    platform: PromptInteropPlatform.PROMPTFOO,
    mode: PromptInteropMode.EXPORT,
    fieldMapping: {
      externalId: "id",
      title: "name",
      content: "prompt",
      description: "description",
      tags: "tags",
      updatedAt: "updatedAt",
    },
    conflictPolicy: "overwrite",
    compatibilityMode: "compatible",
  },
  {
    name: "OpenWebUI 双向适配",
    platform: PromptInteropPlatform.OPENWEBUI,
    mode: PromptInteropMode.IMPORT,
    fieldMapping: {
      externalId: "id",
      title: "title",
      content: "content",
      description: "description",
      tags: "tags",
      updatedAt: "updatedAt",
    },
    conflictPolicy: "create-new",
    compatibilityMode: "strict",
  },
]

function normalizeRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {} as Record<string, unknown>
  }

  return value as Record<string, unknown>
}

function normalizeArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as unknown[]
  }

  return value
}

function getByPath(source: unknown, path: string) {
  const safePath = sanitizeTextInput(path, 120)
  if (!safePath) {
    return undefined
  }

  const segments = safePath.split(".").map((item) => item.trim()).filter(Boolean)
  let current: unknown = source

  for (const segment of segments) {
    if (!current || typeof current !== "object" || Array.isArray(current)) {
      return undefined
    }

    current = (current as Record<string, unknown>)[segment]
  }

  return current
}

function normalizeTags(value: unknown) {
  if (Array.isArray(value)) {
    return value
      .map((item) => sanitizeTextInput(item, 60))
      .filter(Boolean)
      .slice(0, 20)
  }

  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => sanitizeTextInput(item, 60))
      .filter(Boolean)
      .slice(0, 20)
  }

  return [] as string[]
}

function normalizeMode(value: unknown) {
  const normalized = sanitizeTextInput(value, 20).toUpperCase()
  if (normalized === PromptInteropMode.EXPORT) {
    return PromptInteropMode.EXPORT
  }
  if (normalized === PromptInteropMode.IMPORT) {
    return PromptInteropMode.IMPORT
  }

  return PromptInteropMode.IMPORT
}

export function normalizeInteropPlatform(value: unknown) {
  const normalized = sanitizeTextInput(value, 20).toUpperCase()
  if (normalized === PromptInteropPlatform.PROMPTFOO) {
    return PromptInteropPlatform.PROMPTFOO
  }
  if (normalized === PromptInteropPlatform.OPENWEBUI) {
    return PromptInteropPlatform.OPENWEBUI
  }
  if (normalized === PromptInteropPlatform.LANGFUSE) {
    return PromptInteropPlatform.LANGFUSE
  }

  return PromptInteropPlatform.OPENWEBUI
}

function normalizeConflictPolicy(value: unknown) {
  const normalized = sanitizeTextInput(value, 20).toLowerCase()
  if (normalized === "overwrite") {
    return "overwrite"
  }
  if (normalized === "create-new") {
    return "create-new"
  }
  if (normalized === "skip") {
    return "skip"
  }

  return "skip"
}

function normalizeCompatibilityMode(value: unknown) {
  const normalized = sanitizeTextInput(value, 20).toLowerCase()
  if (normalized === "compatible") {
    return "compatible"
  }
  if (normalized === "strict") {
    return "strict"
  }

  return "strict"
}

export function sanitizeInteropProfileInput(input: unknown, fallback = DEFAULT_PROMPT_INTEROP_PROFILES[0]) {
  const source = normalizeRecord(input)
  const fieldMapping = normalizeRecord(source.fieldMapping)

  return {
    id: sanitizeTextInput(source.id, 80),
    name: sanitizeTextInput(source.name, 120) || fallback.name,
    platform: normalizeInteropPlatform(source.platform || fallback.platform),
    mode: normalizeMode(source.mode || fallback.mode),
    fieldMapping: {
      externalId: sanitizeTextInput(fieldMapping.externalId, 80) || fallback.fieldMapping.externalId,
      title: sanitizeTextInput(fieldMapping.title, 80) || fallback.fieldMapping.title,
      content: sanitizeTextInput(fieldMapping.content, 80) || fallback.fieldMapping.content,
      description: sanitizeTextInput(fieldMapping.description, 80) || fallback.fieldMapping.description,
      tags: sanitizeTextInput(fieldMapping.tags, 80) || fallback.fieldMapping.tags,
      updatedAt: sanitizeTextInput(fieldMapping.updatedAt, 80) || fallback.fieldMapping.updatedAt,
    },
    conflictPolicy: normalizeConflictPolicy(source.conflictPolicy || fallback.conflictPolicy),
    compatibilityMode: normalizeCompatibilityMode(source.compatibilityMode || fallback.compatibilityMode),
  }
}

export function buildInteropProfileSeed(userId: string) {
  return DEFAULT_PROMPT_INTEROP_PROFILES.map((item) => ({
    userId,
    name: item.name,
    platform: item.platform,
    mode: item.mode,
    fieldMapping: item.fieldMapping,
    conflictPolicy: item.conflictPolicy,
    compatibilityMode: item.compatibilityMode,
  }))
}

function toPromptDraft(row: unknown, mapping: Record<string, string>): PromptDraft {
  const source = normalizeRecord(row)
  const externalId = sanitizeTextInput(getByPath(source, mapping.externalId), 120)
  const title = sanitizeTextInput(getByPath(source, mapping.title), 160)
  const content = sanitizeMultilineTextInput(getByPath(source, mapping.content), 50000)
  const description = sanitizeMultilineTextInput(getByPath(source, mapping.description), 4000).trim()
  const tags = normalizeTags(getByPath(source, mapping.tags))
  const updatedAt = sanitizeTextInput(getByPath(source, mapping.updatedAt), 60)

  return {
    externalId,
    title,
    content,
    description,
    tags,
    updatedAt,
  }
}

export function buildInteropImportPreview({
  rows,
  mapping,
  conflictPolicy,
  existingByExternalId,
  existingByTitle,
}: {
  rows: unknown[]
  mapping: Record<string, string>
  conflictPolicy: string
  existingByExternalId: Set<string>
  existingByTitle: Set<string>
}) {
  const entries = normalizeArray(rows)

  const items = entries.map((item, index) => {
    const draft = toPromptDraft(item, mapping)
    const conflictReason = !draft.title || !draft.content.trim() ? "missing-required" : ""

    let action = "create"
    if (conflictReason) {
      action = "skip"
    } else if (draft.externalId && existingByExternalId.has(draft.externalId)) {
      action = conflictPolicy === "overwrite" ? "update" : conflictPolicy === "create-new" ? "duplicate" : "skip"
    } else if (existingByTitle.has(draft.title)) {
      action = conflictPolicy === "overwrite" ? "update" : conflictPolicy === "create-new" ? "duplicate" : "skip"
    }

    return {
      index,
      draft,
      action,
      conflictReason,
    }
  })

  const created = items.filter((item) => item.action === "create" || item.action === "duplicate").length
  const updated = items.filter((item) => item.action === "update").length
  const skipped = items.filter((item) => item.action === "skip").length
  const conflicts = items.filter((item) => item.conflictReason || item.action === "skip").length

  return {
    items,
    summary: {
      total: items.length,
      created,
      updated,
      skipped,
      conflicts,
    },
  }
}

export function buildInteropExportPayload({
  prompts,
  platform,
  compatibilityMode,
}: {
  prompts: Array<{
    id: string
    title: string
    content: string
    description: string | null
    sourceExternalId: string | null
    updatedAt: Date
    tags: string[]
    categorySlug: string
    isPublic: boolean
    publishStatus: string
    templateVariables: Array<Record<string, unknown>>
    testCases: Array<Record<string, unknown>>
  }>
  platform: PromptInteropPlatform
  compatibilityMode: string
}) {
  const strict = compatibilityMode === "strict"

  return prompts.map((prompt) => {
    if (platform === PromptInteropPlatform.LANGFUSE) {
      return {
        id: prompt.sourceExternalId || prompt.id,
        name: prompt.title,
        prompt: prompt.content,
        description: prompt.description || "",
        tags: prompt.tags,
        updatedAt: prompt.updatedAt.toISOString(),
        metadata: strict
          ? {
              categorySlug: prompt.categorySlug,
              isPublic: prompt.isPublic,
              publishStatus: prompt.publishStatus,
              templateVariables: prompt.templateVariables,
              testCases: prompt.testCases,
            }
          : {
              categorySlug: prompt.categorySlug,
            },
      }
    }

    if (platform === PromptInteropPlatform.PROMPTFOO) {
      return {
        id: prompt.sourceExternalId || prompt.id,
        name: prompt.title,
        prompt: prompt.content,
        description: prompt.description || "",
        tags: prompt.tags,
        vars: strict ? prompt.templateVariables : [],
        tests: strict ? prompt.testCases : [],
        updatedAt: prompt.updatedAt.toISOString(),
      }
    }

    return {
      id: prompt.sourceExternalId || prompt.id,
      title: prompt.title,
      content: prompt.content,
      description: prompt.description || "",
      tags: prompt.tags,
      updatedAt: prompt.updatedAt.toISOString(),
      meta: strict
        ? {
            categorySlug: prompt.categorySlug,
            publishStatus: prompt.publishStatus,
            isPublic: prompt.isPublic,
            templateVariables: prompt.templateVariables,
            testCases: prompt.testCases,
          }
        : {
            categorySlug: prompt.categorySlug,
          },
    }
  })
}

export function buildInteropRoundTripCheck({
  previewItems,
  exportedPayload,
  mapping,
}: {
  previewItems: Array<{ draft: PromptDraft }>
  exportedPayload: unknown[]
  mapping: Record<string, string>
}) {
  const exportedDrafts = normalizeArray(exportedPayload).map((item) => toPromptDraft(item, mapping))

  let matched = 0
  let missingContent = 0
  let missingDescription = 0

  for (const preview of previewItems) {
    const candidate = exportedDrafts.find((item) => item.title === preview.draft.title)
    if (!candidate) {
      continue
    }

    matched += 1
    if (!candidate.content.trim()) {
      missingContent += 1
    }
    if (!candidate.description.trim()) {
      missingDescription += 1
    }
  }

  return {
    previewCount: previewItems.length,
    exportedCount: exportedDrafts.length,
    matched,
    missingContent,
    missingDescription,
    lossless: matched === previewItems.length && missingContent === 0,
  }
}
