import { PromptVersionSource } from "@prisma/client"
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

// GET /api/prompts/[id] - Get a single prompt
export async function GET(request: Request, { params }: { params: { id: string } }) {
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
        author: {
          select: { id: true, name: true, email: true },
        },
      },
    })

    if (!prompt) {
      return NextResponse.json({ error: "提示词不存在" }, { status: 404 })
    }

    const isOwner = session?.user?.id === prompt.authorId
    if (!prompt.isPublic && !isOwner) {
      if (!session?.user) {
        return NextResponse.json({ error: "请先登录" }, { status: 401 })
      }

      return NextResponse.json({ error: "无权限查看此提示词" }, { status: 403 })
    }

    await prisma.prompt.update({
      where: { id: params.id },
      data: { viewCount: { increment: 1 } },
    })

    const transformed = {
      ...prompt,
      tags: prompt.tags.map((promptTag) => promptTag.tag),
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

    if (prompt.authorId !== session.user.id) {
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

    const nextTitle = title === undefined ? prompt.title : String(title).trim()
    const nextContent = content === undefined ? prompt.content : String(content).trim()

    if (!nextTitle || !nextContent) {
      return NextResponse.json({ error: "标题和内容不能为空" }, { status: 400 })
    }

    const normalizedTags = tags === undefined ? null : normalizeTagNames(tags)
    const sanitizedTemplateVariables =
      templateVariables === undefined ? null : sanitizeTemplateVariables(templateVariables)

    await prisma.$transaction(async (tx) => {
      await tx.prompt.update({
        where: { id: params.id },
        data: {
          title: nextTitle,
          content: nextContent,
          description:
            description === undefined ? prompt.description : String(description).trim() || null,
          categoryId: categoryId ?? prompt.categoryId,
          isPublic: isPublic === undefined ? prompt.isPublic : Boolean(isPublic),
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
        tagCount: transformed.tags.length,
        variableCount: transformed.templateVariables.length,
      },
    })

    return NextResponse.json(transformed)
  } catch (error) {
    console.error("Error updating prompt:", error)
    return NextResponse.json({ error: "更新提示词失败" }, { status: 500 })
  }
}

// DELETE /api/prompts/[id] - Delete a prompt
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
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

    if (prompt.authorId !== session.user.id) {
      return NextResponse.json({ error: "无权限删除此提示词" }, { status: 403 })
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

    return NextResponse.json({ message: "删除成功" })
  } catch (error) {
    console.error("Error deleting prompt:", error)
    return NextResponse.json({ error: "删除提示词失败" }, { status: 500 })
  }
}
