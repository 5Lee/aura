import { PromptPublishStatus, PromptVersionSource } from "@prisma/client"
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"

import { authOptions } from "@/lib/auth"
import { invalidateAdvancedAnalyticsCache } from "@/lib/advanced-analytics"
import { prisma } from "@/lib/db"
import { recordPromptAuditLog } from "@/lib/prompt-audit-log"
import {
  resolvePromptPermission,
} from "@/lib/prompt-permissions"
import { sanitizeMultilineTextInput, sanitizeTextInput } from "@/lib/security"
import { validatePrivateVisibilityTransition } from "@/lib/subscription-entitlements"
import {
  replacePromptTemplateVariablesWithClient,
  sanitizeTemplateVariables,
} from "@/lib/prompt-template-variable-utils"
import { createPromptVersionSnapshot } from "@/lib/prompt-versioning"
import { findOrCreateTagByNameWithClient, normalizeTagNames } from "@/lib/tag-utils"

// GET /api/prompts/[id] - Get a single prompt
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    const prompt = await prisma.prompt.findUnique({
      where: { id: params.id },
      include: {
        category: true,
        tags: {
          include: {
            tag: true,
          },
        },
        templateVariables: {
          orderBy: {
            name: "asc",
          },
        },
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
          orderBy: {
            createdAt: "asc",
          },
        },
        author: {
          select: { id: true, name: true, email: true },
        },
      },
    })

    if (!prompt) {
      return NextResponse.json({ error: "提示词不存在" }, { status: 404 })
    }

    const permission = await resolvePromptPermission(
      {
        promptId: prompt.id,
        isPublic: prompt.isPublic,
        publishStatus: prompt.publishStatus,
        authorId: prompt.authorId,
      },
      session?.user?.id
    )
    const isOwner = session?.user?.id === prompt.authorId

    if (!prompt.isPublic && !isOwner) {
      if (!session?.user) {
        return NextResponse.json({ error: "请先登录" }, { status: 401 })
      }

      if (!permission.canView) {
        return NextResponse.json({ error: "无权限查看此提示词" }, { status: 403 })
      }
    }

    if (!permission.canView && !isOwner) {
      if (!session?.user) {
        return NextResponse.json({ error: "请先登录" }, { status: 401 })
      }

      return NextResponse.json({ error: "无权限查看此提示词" }, { status: 403 })
    }

    await prisma.prompt.update({
      where: { id: params.id },
      data: { viewCount: { increment: 1 } },
    })

    const canSeeMembers = permission.isOwner || Boolean(permission.role)
    const canSeeUserEmail = permission.isOwner || permission.canManageMembers
    const transformed = {
      ...prompt,
      tags: prompt.tags.map((promptTag) => promptTag.tag),
      members: canSeeMembers
        ? prompt.members.map((member) => ({
            id: member.id,
            role: member.role,
            userId: member.userId,
            createdAt: member.createdAt,
            updatedAt: member.updatedAt,
            user: {
              id: member.user.id,
              name: member.user.name,
              email: canSeeUserEmail ? member.user.email : null,
            },
          }))
        : [],
      author: prompt.author
        ? {
            id: prompt.author.id,
            name: prompt.author.name,
            email: canSeeUserEmail ? prompt.author.email : null,
          }
        : null,
      permission,
    }

    return NextResponse.json(transformed)
  } catch (error) {
    console.error("Error fetching prompt:", error)
    return NextResponse.json({ error: "获取提示词失败" }, { status: 500 })
  }
}

// PATCH /api/prompts/[id] - Update a prompt
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 })
    }

    const prompt = await prisma.prompt.findUnique({
      where: { id: params.id },
    })

    if (!prompt) {
      return NextResponse.json({ error: "提示词不存在" }, { status: 404 })
    }

    const permission = await resolvePromptPermission(
      {
        promptId: prompt.id,
        isPublic: prompt.isPublic,
        publishStatus: prompt.publishStatus,
        authorId: prompt.authorId,
      },
      session.user.id
    )

    if (!permission.canEdit) {
      return NextResponse.json({ error: "无权限修改此提示词" }, { status: 403 })
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

    const nextTitle =
      title === undefined ? prompt.title : sanitizeTextInput(title, 160)
    const nextContent =
      content === undefined
        ? prompt.content
        : sanitizeMultilineTextInput(content, 50000)

    if (!nextTitle || !nextContent.trim()) {
      return NextResponse.json({ error: "标题和内容不能为空" }, { status: 400 })
    }

    const nextDescription =
      description === undefined
        ? prompt.description
        : sanitizeMultilineTextInput(description, 4000).trim() || null
    const nextCategoryId =
      categoryId === undefined || categoryId === null
        ? prompt.categoryId
        : sanitizeTextInput(categoryId, 120) || prompt.categoryId

    const normalizedTags = tags === undefined ? null : normalizeTagNames(tags)
    const sanitizedTemplateVariables =
      templateVariables === undefined ? null : sanitizeTemplateVariables(templateVariables)

    const nextIsPublic = isPublic === undefined ? prompt.isPublic : Boolean(isPublic)
    const shouldDemoteFromPublished = prompt.publishStatus === PromptPublishStatus.PUBLISHED && !nextIsPublic
    const nextPublishStatus = shouldDemoteFromPublished
      ? PromptPublishStatus.IN_REVIEW
      : prompt.publishStatus
    const privateLimitCheck = await validatePrivateVisibilityTransition(
      session.user.id,
      prompt.isPublic,
      nextIsPublic
    )
    if (!privateLimitCheck.ok) {
      return NextResponse.json({ error: privateLimitCheck.error }, { status: 403 })
    }

    await prisma.$transaction(async (tx) => {
      await tx.prompt.update({
        where: { id: params.id },
        data: {
          title: nextTitle,
          content: nextContent,
          description: nextDescription,
          categoryId: nextCategoryId,
          isPublic: nextIsPublic,
          publishStatus: nextPublishStatus,
          publishedAt:
            nextPublishStatus === PromptPublishStatus.PUBLISHED ? prompt.publishedAt || new Date() : null,
        },
      })

      if (normalizedTags !== null) {
        await tx.promptTag.deleteMany({
          where: { promptId: params.id },
        })

        for (const tagName of normalizedTags) {
          const tag = await findOrCreateTagByNameWithClient(tx, tagName)
          if (!tag) {
            continue
          }

          await tx.promptTag.create({
            data: {
              promptId: params.id,
              tagId: tag.id,
            },
          })
        }
      }

      if (sanitizedTemplateVariables !== null) {
        await replacePromptTemplateVariablesWithClient(tx, params.id, sanitizedTemplateVariables)
      }
    })

    const final = await prisma.prompt.findUnique({
      where: { id: params.id },
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

    if (!final) {
      return NextResponse.json({ error: "更新提示词失败" }, { status: 500 })
    }

    const transformed = {
      ...final,
      tags: final.tags.map((promptTag) => promptTag.tag),
    }

    await createPromptVersionSnapshot({
      promptId: params.id,
      source: PromptVersionSource.UPDATE,
      actorId: session.user.id,
      changeSummary: "Prompt updated via PATCH",
    })

    await recordPromptAuditLog({
      promptId: params.id,
      actorId: session.user.id,
      action: "prompt.update",
      metadata: {
        categoryId: transformed.categoryId,
        isPublic: transformed.isPublic,
        publishStatus: transformed.publishStatus,
        tagCount: transformed.tags.length,
        variableCount: transformed.templateVariables.length,
      },
    })

    invalidateAdvancedAnalyticsCache(session.user.id)

    return NextResponse.json(transformed)
  } catch (error) {
    console.error("Error updating prompt:", error)
    return NextResponse.json({ error: "更新提示词失败" }, { status: 500 })
  }
}

// DELETE /api/prompts/[id] - Delete a prompt
export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 })
    }

    const prompt = await prisma.prompt.findUnique({
      where: { id: params.id },
    })

    if (!prompt) {
      return NextResponse.json({ error: "提示词不存在" }, { status: 404 })
    }

    const permission = await resolvePromptPermission(
      {
        promptId: prompt.id,
        isPublic: prompt.isPublic,
        publishStatus: prompt.publishStatus,
        authorId: prompt.authorId,
      },
      session.user.id
    )

    if (!permission.isOwner) {
      return NextResponse.json({ error: "仅 Owner 可删除提示词" }, { status: 403 })
    }

    await prisma.prompt.delete({
      where: { id: params.id },
    })

    await recordPromptAuditLog({
      promptId: params.id,
      actorId: session.user.id,
      action: "prompt.delete",
      metadata: {
        title: prompt.title,
        categoryId: prompt.categoryId,
      },
    })

    invalidateAdvancedAnalyticsCache(session.user.id)

    return NextResponse.json({ message: "删除成功" })
  } catch (error) {
    console.error("Error deleting prompt:", error)
    return NextResponse.json({ error: "删除提示词失败" }, { status: 500 })
  }
}
