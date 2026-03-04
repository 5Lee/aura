import { PromptPublishStatus, PromptRole, type Prisma } from "@prisma/client"
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"

import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { recordPromptAuditLog } from "@/lib/prompt-audit-log"
import { resolvePromptPermission } from "@/lib/prompt-permissions"
import { sanitizePromptTestCases } from "@/lib/prompt-test-case-utils"
import {
  parsePromptCodeFile,
  serializePromptCodeFile,
  type PromptCodeItem,
  type PromptCodeTemplateVariable,
} from "@/lib/prompt-codec"
import { sanitizeTemplateVariables } from "@/lib/prompt-template-variable-utils"
import { findOrCreateTagByNameWithClient, normalizeTagNames } from "@/lib/tag-utils"

function resolveFormat(input: string | null) {
  return input?.toLowerCase() === "yaml" ? "yaml" : "json"
}

function normalizePromptIds(input: string | null) {
  if (!input) {
    return []
  }

  const seen = new Set<string>()
  const ids: string[] = []
  for (const item of input.split(",")) {
    const id = item.trim()
    if (!id || seen.has(id)) {
      continue
    }

    seen.add(id)
    ids.push(id)
  }

  return ids
}

function normalizePublishStatus(input: unknown) {
  const value = typeof input === "string" ? input.trim().toUpperCase() : "DRAFT"
  if (!Object.values(PromptPublishStatus).includes(value as PromptPublishStatus)) {
    return PromptPublishStatus.DRAFT
  }

  return value as PromptPublishStatus
}

function resolveImportPublishState(
  requestedStatus: PromptPublishStatus,
  isPublic: boolean,
  publishedAtFallback?: Date | null
) {
  const publishStatus =
    !isPublic && requestedStatus === PromptPublishStatus.PUBLISHED
      ? PromptPublishStatus.IN_REVIEW
      : requestedStatus

  const publishedAt =
    publishStatus === PromptPublishStatus.PUBLISHED
      ? publishedAtFallback || new Date()
      : null

  return {
    publishStatus,
    publishedAt,
  }
}

function normalizeTemplateVariables(input: PromptCodeTemplateVariable[] | undefined) {
  return sanitizeTemplateVariables(
    Array.isArray(input)
      ? input.map((item) => ({
          name: item.name,
          type: item.type,
          required: item.required,
          defaultValue: item.defaultValue || undefined,
          description: item.description || undefined,
          options: item.options,
          minLength: item.minLength === null ? undefined : item.minLength,
          maxLength: item.maxLength === null ? undefined : item.maxLength,
        }))
      : []
  )
}

async function applyPromptTagsWithClient(
  tx: Prisma.TransactionClient,
  promptId: string,
  tags: string[]
) {
  await tx.promptTag.deleteMany({
    where: { promptId },
  })

  for (const tagName of tags) {
    const tag = await findOrCreateTagByNameWithClient(tx, tagName)
    if (!tag) {
      continue
    }

    await tx.promptTag.create({
      data: {
        promptId,
        tagId: tag.id,
      },
    })
  }
}

async function applyPromptTemplateVariablesWithClient(
  tx: Prisma.TransactionClient,
  promptId: string,
  variables: ReturnType<typeof sanitizeTemplateVariables>
) {
  await tx.promptTemplateVariable.deleteMany({
    where: { promptId },
  })

  for (const variable of variables) {
    await tx.promptTemplateVariable.create({
      data: {
        promptId,
        ...variable,
      },
    })
  }
}

async function applyPromptTestCasesWithClient(
  tx: Prisma.TransactionClient,
  promptId: string,
  testCases: ReturnType<typeof sanitizePromptTestCases>
) {
  await tx.promptTestCase.deleteMany({
    where: { promptId },
  })

  for (const testCase of testCases) {
    await tx.promptTestCase.create({
      data: {
        promptId,
        ...testCase,
      },
    })
  }
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const format = resolveFormat(searchParams.get("format"))
  const promptIds = normalizePromptIds(searchParams.get("ids"))

  const where =
    promptIds.length > 0
      ? {
          id: {
            in: promptIds,
          },
        }
      : {
          OR: [
            { authorId: session.user.id },
            { members: { some: { userId: session.user.id } } },
          ],
        }

  const prompts = await prisma.prompt.findMany({
    where,
    include: {
      category: {
        select: {
          slug: true,
          name: true,
        },
      },
      tags: {
        include: {
          tag: true,
        },
      },
      templateVariables: {
        orderBy: { name: "asc" },
      },
      testCases: {
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: { updatedAt: "desc" },
    take: promptIds.length > 0 ? undefined : 200,
  })

  const permittedPrompts: PromptCodeItem[] = []
  for (const prompt of prompts) {
    const permission = await resolvePromptPermission(
      {
        promptId: prompt.id,
        isPublic: prompt.isPublic,
        publishStatus: prompt.publishStatus,
        authorId: prompt.authorId,
      },
      session.user.id
    )

    if (!permission.canView) {
      continue
    }

    permittedPrompts.push({
      sourceExternalId: prompt.sourceExternalId || prompt.id,
      sourceUpdatedAt: prompt.updatedAt.toISOString(),
      title: prompt.title,
      description: prompt.description,
      content: prompt.content,
      categorySlug: prompt.category.slug,
      isPublic: prompt.isPublic,
      publishStatus: prompt.publishStatus,
      tags: prompt.tags.map((item) => item.tag.name),
      templateVariables: prompt.templateVariables.map((item) => ({
        name: item.name,
        type: item.type,
        required: item.required,
        defaultValue: item.defaultValue,
        description: item.description,
        options: Array.isArray(item.options)
          ? item.options.filter((option): option is string => typeof option === "string")
          : [],
        minLength: item.minLength,
        maxLength: item.maxLength,
      })),
      testCases: prompt.testCases.map((item) => ({
        name: item.name,
        assertionType: item.assertionType,
        expectedOutput: item.expectedOutput,
        inputVariables:
          item.inputVariables && typeof item.inputVariables === "object" && !Array.isArray(item.inputVariables)
            ? (item.inputVariables as Record<string, unknown>)
            : undefined,
        enabled: item.enabled,
      })),
    })
  }

  const payload = {
    version: "1.0.0",
    prompts: permittedPrompts,
  }

  const encoded = serializePromptCodeFile(payload, format)
  const filename = `aura-prompts-export-${new Date().toISOString().slice(0, 10)}.${
    format === "yaml" ? "yml" : "json"
  }`

  await recordPromptAuditLog({
    actorId: session.user.id,
    action: "prompt.code.export",
    metadata: {
      format,
      promptCount: permittedPrompts.length,
      requestedIds: promptIds.length,
    },
  })

  return new NextResponse(encoded, {
    status: 200,
    headers: {
      "Content-Type": format === "yaml" ? "text/yaml; charset=utf-8" : "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename=\"${filename}\"`,
    },
  })
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 })
  }

  try {
    const { content, format, mode } = await request.json()

    if (typeof content !== "string" || !content.trim()) {
      return NextResponse.json({ error: "导入内容不能为空" }, { status: 400 })
    }

    const normalizedFormat = resolveFormat(typeof format === "string" ? format : null)
    const normalizedMode = typeof mode === "string" ? mode.trim().toLowerCase() : "skip"

    if (!["skip", "overwrite", "create-new"].includes(normalizedMode)) {
      return NextResponse.json({ error: "导入模式无效" }, { status: 400 })
    }

    let parsed: { prompts: PromptCodeItem[] }
    try {
      parsed = parsePromptCodeFile(content, normalizedFormat) as { prompts: PromptCodeItem[] }
    } catch (error) {
      return NextResponse.json(
        {
          error:
            error instanceof Error && error.message
              ? `导入内容解析失败: ${error.message}`
              : "导入内容解析失败",
        },
        { status: 400 }
      )
    }

    if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.prompts)) {
      return NextResponse.json({ error: "导入文件结构不合法" }, { status: 400 })
    }

    const seenExternalIds = new Set<string>()
    const summary = {
      created: 0,
      updated: 0,
      skipped: 0,
      conflicts: [] as Array<{ index: number; reason: string }>,
    }

    for (let index = 0; index < parsed.prompts.length; index += 1) {
      const row = parsed.prompts[index] as PromptCodeItem
      const title = String(row.title || "").trim()
      const contentText = String(row.content || "").trim()
      const categorySlug = String(row.categorySlug || "").trim()
      const sourceExternalId = String(row.sourceExternalId || "").trim()

      if (!title || !contentText || !categorySlug) {
        summary.conflicts.push({ index, reason: "缺少必填字段（title/content/categorySlug）" })
        continue
      }

      if (sourceExternalId) {
        if (seenExternalIds.has(sourceExternalId)) {
          summary.conflicts.push({ index, reason: `重复 sourceExternalId: ${sourceExternalId}` })
          continue
        }
        seenExternalIds.add(sourceExternalId)
      }

      const category = await prisma.category.findUnique({
        where: { slug: categorySlug },
        select: { id: true },
      })

      if (!category) {
        summary.conflicts.push({ index, reason: `分类不存在: ${categorySlug}` })
        continue
      }

      const existingPrompt = sourceExternalId
        ? await prisma.prompt.findUnique({
            where: {
              sourceExternalId,
            },
          })
        : null

      if (existingPrompt && normalizedMode !== "create-new") {
        const permission = await resolvePromptPermission(
          {
            promptId: existingPrompt.id,
            isPublic: existingPrompt.isPublic,
            publishStatus: existingPrompt.publishStatus,
            authorId: existingPrompt.authorId,
          },
          session.user.id
        )

        if (!permission.canEdit) {
          summary.conflicts.push({ index, reason: `无权限覆盖提示词: ${existingPrompt.id}` })
          continue
        }

        const sourceUpdatedAt = row.sourceUpdatedAt ? new Date(row.sourceUpdatedAt) : null
        if (
          sourceUpdatedAt &&
          Number.isFinite(sourceUpdatedAt.getTime()) &&
          existingPrompt.updatedAt.getTime() > sourceUpdatedAt.getTime() &&
          normalizedMode === "skip"
        ) {
          summary.conflicts.push({
            index,
            reason: `版本冲突: 目标提示词已在 ${existingPrompt.updatedAt.toISOString()} 更新`,
          })
          continue
        }

        if (normalizedMode === "skip") {
          summary.skipped += 1
          continue
        }
      }

      const tags = normalizeTagNames(row.tags)
      const templateVariables = normalizeTemplateVariables(row.templateVariables)
      const testCases = sanitizePromptTestCases(row.testCases || [])

      if (existingPrompt && normalizedMode === "overwrite") {
        const nextIsPublic =
          row.isPublic === undefined ? existingPrompt.isPublic : Boolean(row.isPublic)
        const requestedStatus =
          row.publishStatus === undefined
            ? existingPrompt.publishStatus
            : normalizePublishStatus(row.publishStatus)
        const publishState = resolveImportPublishState(
          requestedStatus,
          nextIsPublic,
          existingPrompt.publishedAt
        )

        await prisma.$transaction(async (tx) => {
          await tx.prompt.update({
            where: { id: existingPrompt.id },
            data: {
              title,
              content: contentText,
              description: row.description ? String(row.description) : null,
              categoryId: category.id,
              isPublic: nextIsPublic,
              publishStatus: publishState.publishStatus,
              publishedAt: publishState.publishedAt,
            },
          })

          await applyPromptTagsWithClient(tx, existingPrompt.id, tags)
          await applyPromptTemplateVariablesWithClient(tx, existingPrompt.id, templateVariables)
          await applyPromptTestCasesWithClient(tx, existingPrompt.id, testCases)
        })
        summary.updated += 1
        continue
      }

      const nextIsPublic = row.isPublic === undefined ? false : Boolean(row.isPublic)
      const requestedStatus =
        row.publishStatus === undefined
          ? PromptPublishStatus.DRAFT
          : normalizePublishStatus(row.publishStatus)
      const publishState = resolveImportPublishState(requestedStatus, nextIsPublic)

      await prisma.$transaction(async (tx) => {
        const prompt = await tx.prompt.create({
          data: {
            title,
            content: contentText,
            description: row.description ? String(row.description) : null,
            categoryId: category.id,
            isPublic: nextIsPublic,
            publishStatus: publishState.publishStatus,
            publishedAt: publishState.publishedAt,
            sourceExternalId:
              existingPrompt && normalizedMode === "create-new"
                ? undefined
                : sourceExternalId || undefined,
            authorId: session.user.id,
          },
        })

        await tx.promptMember.create({
          data: {
            promptId: prompt.id,
            userId: session.user.id,
            role: PromptRole.OWNER,
            invitedById: session.user.id,
          },
        })

        await applyPromptTagsWithClient(tx, prompt.id, tags)
        await applyPromptTemplateVariablesWithClient(tx, prompt.id, templateVariables)
        await applyPromptTestCasesWithClient(tx, prompt.id, testCases)
      })

      summary.created += 1
    }

    await recordPromptAuditLog({
      actorId: session.user.id,
      action: "prompt.code.import",
      metadata: {
        format: normalizedFormat,
        mode: normalizedMode,
        created: summary.created,
        updated: summary.updated,
        skipped: summary.skipped,
        conflictCount: summary.conflicts.length,
      },
    })

    return NextResponse.json({
      message: "导入完成",
      summary,
    })
  } catch (error) {
    console.error("Prompt code import failed:", error)
    return NextResponse.json({ error: "导入 Prompt-as-Code 失败" }, { status: 500 })
  }
}
