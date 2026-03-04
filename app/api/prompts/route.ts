import { PromptPublishStatus, PromptRole, PromptVersionSource } from "@prisma/client"
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"

import { authOptions } from "@/lib/auth"
import { invalidateAdvancedAnalyticsCache } from "@/lib/advanced-analytics"
import { prisma } from "@/lib/db"
import { recordPromptAuditLog } from "@/lib/prompt-audit-log"
import { sanitizeMultilineTextInput, sanitizeTextInput } from "@/lib/security"
import { validatePromptCreationQuota } from "@/lib/subscription-entitlements"
import {
  replacePromptTemplateVariablesWithClient,
  sanitizeTemplateVariables,
} from "@/lib/prompt-template-variable-utils"
import { createPromptVersionSnapshot } from "@/lib/prompt-versioning"
import { findOrCreateTagByNameWithClient, normalizeTagNames } from "@/lib/tag-utils"

const UPDATED_WITHIN_DAYS: Record<string, number> = {
  "24h": 1,
  "7d": 7,
  "30d": 30,
  "90d": 90,
}

function resolveUpdatedWithinDate(value: string | null) {
  if (!value) {
    return null
  }

  const days = UPDATED_WITHIN_DAYS[value]
  if (!days) {
    return null
  }

  return new Date(Date.now() - days * 24 * 60 * 60 * 1000)
}

function resolvePublishStatusFilter(value: string | null) {
  if (!value) {
    return null
  }

  const normalized = value.trim().toUpperCase()
  if (!Object.values(PromptPublishStatus).includes(normalized as PromptPublishStatus)) {
    return null
  }

  return normalized as PromptPublishStatus
}

function resolvePositiveInt(value: string | null, fallback: number, min: number, max: number) {
  const parsed = Number(value || "")
  if (!Number.isFinite(parsed)) {
    return fallback
  }

  const rounded = Math.floor(parsed)
  if (rounded < min) {
    return min
  }
  if (rounded > max) {
    return max
  }
  return rounded
}

// GET /api/prompts - Get prompts with multi-dimensional filtering
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    const { searchParams } = new URL(request.url)

    const category = searchParams.get("category")?.trim() || ""
    const tag = searchParams.get("tag")?.trim() || ""
    const authorId = searchParams.get("authorId")?.trim() || ""
    const status = searchParams.get("status")?.trim() || "all"
    const scope = searchParams.get("scope")?.trim() || "all"
    const search = (searchParams.get("q") || searchParams.get("search") || "").trim()
    const publishStatusFilter = resolvePublishStatusFilter(searchParams.get("publishStatus"))
    const updatedWithinDate = resolveUpdatedWithinDate(searchParams.get("updatedWithin"))
    const page = resolvePositiveInt(searchParams.get("page"), 1, 1, 10000)
    const pageSize = resolvePositiveInt(searchParams.get("pageSize"), 60, 20, 120)
    const skip = (page - 1) * pageSize

    const filters: Array<Record<string, unknown>> = []

    if (!session?.user) {
      filters.push({
        isPublic: true,
        publishStatus: PromptPublishStatus.PUBLISHED,
      })
    } else if (scope === "mine") {
      filters.push({
        OR: [
          { authorId: session.user.id },
          { members: { some: { userId: session.user.id } } },
        ],
      })
    } else if (scope === "shared") {
      filters.push({
        OR: [
          {
            isPublic: true,
            publishStatus: PromptPublishStatus.PUBLISHED,
            NOT: { authorId: session.user.id },
          },
          {
            members: {
              some: {
                userId: session.user.id,
              },
            },
          },
        ],
      })
    } else {
      filters.push({
        OR: [
          { authorId: session.user.id },
          { members: { some: { userId: session.user.id } } },
          {
            isPublic: true,
            publishStatus: PromptPublishStatus.PUBLISHED,
          },
        ],
      })
    }

    if (category) {
      filters.push({ categoryId: category })
    }

    if (tag) {
      filters.push({ tags: { some: { tag: { name: tag } } } })
    }

    if (authorId) {
      filters.push({ authorId })
    }

    if (status === "public") {
      filters.push({ isPublic: true })
    } else if (status === "private") {
      if (!session?.user) {
        filters.push({ authorId: "__no_match__" })
      } else {
        filters.push({
          isPublic: false,
          OR: [
            { authorId: session.user.id },
            { members: { some: { userId: session.user.id } } },
          ],
        })
      }
    }

    if (publishStatusFilter) {
      filters.push({ publishStatus: publishStatusFilter })
    }

    if (updatedWithinDate) {
      filters.push({ updatedAt: { gte: updatedWithinDate } })
    }

    if (search) {
      filters.push({
        OR: [
          { title: { contains: search } },
          { content: { contains: search } },
          { description: { contains: search } },
        ],
      })
    }

    const includeMeta = searchParams.get("meta") === "1"
    const where = filters.length > 0 ? { AND: filters } : undefined

    const [prompts, total] = await prisma.$transaction([
      prisma.prompt.findMany({
        where,
        include: {
          category: true,
          tags: {
            include: {
              tag: true,
            },
          },
          author: {
            select: { id: true, name: true, email: true },
          },
        },
        orderBy: { updatedAt: "desc" },
        take: pageSize,
        skip,
      }),
      prisma.prompt.count({
        where,
      }),
    ])

    const transformedPrompts = prompts.map((prompt) => ({
      ...prompt,
      tags: prompt.tags.map((promptTag) => promptTag.tag),
    }))

    if (!includeMeta) {
      return NextResponse.json(transformedPrompts)
    }

    const totalPages = Math.max(1, Math.ceil(total / pageSize))
    return NextResponse.json({
      data: transformedPrompts,
      meta: {
        page,
        pageSize,
        total,
        totalPages,
      },
    })
  } catch (error) {
    console.error("Error fetching prompts:", error)
    return NextResponse.json({ error: "获取提示词失败" }, { status: 500 })
  }
}

// POST /api/prompts - Create a new prompt
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 })
    }

    const {
      title,
      content,
      description,
      categoryId,
      isPublic,
      tags,
      templateVariables,
    } = await request.json()

    const nextTitle = sanitizeTextInput(title, 160)
    const nextContent = sanitizeMultilineTextInput(content, 50000)
    const nextCategoryId = sanitizeTextInput(categoryId, 120)
    const nextDescription =
      description === undefined || description === null
        ? null
        : sanitizeMultilineTextInput(description, 4000).trim() || null

    if (!nextTitle || !nextContent.trim() || !nextCategoryId) {
      return NextResponse.json({ error: "标题、内容和分类不能为空" }, { status: 400 })
    }

    const normalizedTags = normalizeTagNames(tags)
    const sanitizedTemplateVariables = sanitizeTemplateVariables(templateVariables)
    const nextIsPublic = Boolean(isPublic)
    const quotaCheck = await validatePromptCreationQuota(session.user.id, nextIsPublic)
    if (!quotaCheck.ok) {
      return NextResponse.json({ error: quotaCheck.error }, { status: 403 })
    }

    const createdPrompt = await prisma.$transaction(async (tx) => {
      const prompt = await tx.prompt.create({
        data: {
          title: nextTitle,
          content: nextContent,
          description: nextDescription,
          categoryId: nextCategoryId,
          isPublic: nextIsPublic,
          publishStatus: PromptPublishStatus.DRAFT,
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

      for (const tagName of normalizedTags) {
        const tag = await findOrCreateTagByNameWithClient(tx, tagName)
        if (!tag) {
          continue
        }

        await tx.promptTag.create({
          data: {
            promptId: prompt.id,
            tagId: tag.id,
          },
        })
      }

      if (sanitizedTemplateVariables.length > 0) {
        await replacePromptTemplateVariablesWithClient(tx, prompt.id, sanitizedTemplateVariables)
      }

      return prompt
    })

    const updatedPrompt = await prisma.prompt.findUnique({
      where: { id: createdPrompt.id },
      include: {
        category: true,
        tags: {
          include: {
            tag: true,
          },
        },
        templateVariables: {
          orderBy: { name: "asc" },
        },
      },
    })

    if (!updatedPrompt) {
      return NextResponse.json({ error: "创建提示词失败" }, { status: 500 })
    }

    const transformed = {
      ...updatedPrompt,
      tags: updatedPrompt.tags.map((promptTag) => promptTag.tag),
    }

    await createPromptVersionSnapshot({
      promptId: updatedPrompt.id,
      source: PromptVersionSource.CREATE,
      actorId: session.user.id,
      changeSummary: "Initial prompt version",
    })

    await recordPromptAuditLog({
      promptId: updatedPrompt.id,
      actorId: session.user.id,
      action: "prompt.create",
      metadata: {
        isPublic: updatedPrompt.isPublic,
        publishStatus: updatedPrompt.publishStatus,
        categoryId: updatedPrompt.categoryId,
        tagCount: transformed.tags.length,
        variableCount: updatedPrompt.templateVariables.length,
      },
    })

    invalidateAdvancedAnalyticsCache(session.user.id)

    return NextResponse.json(transformed, { status: 201 })
  } catch (error) {
    console.error("Error creating prompt:", error)
    return NextResponse.json({ error: "创建提示词失败" }, { status: 500 })
  }
}
