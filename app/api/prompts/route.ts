import { PromptPublishStatus, PromptRole, PromptVersionSource } from "@prisma/client"
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"

import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { recordPromptAuditLog } from "@/lib/prompt-audit-log"
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

    const takeParam = Number(searchParams.get("take") || 0)
    const take = Number.isFinite(takeParam) && takeParam > 0 ? Math.min(takeParam, 200) : undefined

    const prompts = await prisma.prompt.findMany({
      where: filters.length > 0 ? { AND: filters } : undefined,
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
      take,
    })

    const transformedPrompts = prompts.map((prompt) => ({
      ...prompt,
      tags: prompt.tags.map((promptTag) => promptTag.tag),
    }))

    return NextResponse.json(transformedPrompts)
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

    if (!title || !content || !categoryId) {
      return NextResponse.json({ error: "标题、内容和分类不能为空" }, { status: 400 })
    }

    const normalizedTags = normalizeTagNames(tags)
    const sanitizedTemplateVariables = sanitizeTemplateVariables(templateVariables)

    const createdPrompt = await prisma.$transaction(async (tx) => {
      const prompt = await tx.prompt.create({
        data: {
          title: String(title).trim(),
          content: String(content).trim(),
          description: description ? String(description).trim() : null,
          categoryId,
          isPublic: Boolean(isPublic),
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

    return NextResponse.json(transformed, { status: 201 })
  } catch (error) {
    console.error("Error creating prompt:", error)
    return NextResponse.json({ error: "创建提示词失败" }, { status: 500 })
  }
}
