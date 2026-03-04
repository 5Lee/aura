import { PromptPublishStatus } from "@prisma/client"
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"

import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { recordPromptAuditLog } from "@/lib/prompt-audit-log"
import { resolvePromptPermission } from "@/lib/prompt-permissions"
import { findOrCreateTagByNameWithClient, normalizeTagNames } from "@/lib/tag-utils"

interface BatchPayload {
  promptIds?: string[]
  action?: string
  tags?: string[]
  mode?: "replace" | "add" | "remove"
  isPublic?: boolean
}

function normalizePromptIds(input: unknown) {
  if (!Array.isArray(input)) {
    return []
  }

  const seen = new Set<string>()
  const ids: string[] = []

  for (const value of input) {
    const id = typeof value === "string" ? value.trim() : ""
    if (!id || seen.has(id)) {
      continue
    }

    seen.add(id)
    ids.push(id)
  }

  return ids
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 })
  }

  try {
    const payload = (await request.json()) as BatchPayload
    const promptIds = normalizePromptIds(payload.promptIds)
    if (promptIds.length === 0) {
      return NextResponse.json({ error: "请至少选择一个提示词" }, { status: 400 })
    }

    const action = String(payload.action || "").trim()
    if (!action) {
      return NextResponse.json({ error: "缺少批量操作类型" }, { status: 400 })
    }

    const prompts = await prisma.prompt.findMany({
      where: {
        id: {
          in: promptIds,
        },
      },
      include: {
        tags: {
          include: {
            tag: true,
          },
        },
      },
    })

    const promptMap = new Map(prompts.map((item) => [item.id, item]))
    const unauthorized: string[] = []
    const missing: string[] = []
    const editablePromptIds: string[] = []

    for (const promptId of promptIds) {
      const prompt = promptMap.get(promptId)
      if (!prompt) {
        missing.push(promptId)
        continue
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
        unauthorized.push(promptId)
        continue
      }

      editablePromptIds.push(promptId)
    }

    if (editablePromptIds.length === 0) {
      return NextResponse.json(
        {
          error: "无可操作提示词",
          unauthorized,
          missing,
        },
        { status: 403 }
      )
    }

    if (action === "set-visibility") {
      if (typeof payload.isPublic !== "boolean") {
        return NextResponse.json({ error: "缺少可见性目标值" }, { status: 400 })
      }

      if (payload.isPublic) {
        await prisma.prompt.updateMany({
          where: {
            id: {
              in: editablePromptIds,
            },
          },
          data: {
            isPublic: true,
          },
        })
      } else {
        await prisma.prompt.updateMany({
          where: {
            id: {
              in: editablePromptIds,
            },
          },
          data: {
            isPublic: false,
            publishStatus: PromptPublishStatus.IN_REVIEW,
            publishedAt: null,
          },
        })
      }
    } else if (action === "archive" || action === "restore") {
      const nextStatus =
        action === "archive" ? PromptPublishStatus.ARCHIVED : PromptPublishStatus.DRAFT

      await prisma.prompt.updateMany({
        where: {
          id: {
            in: editablePromptIds,
          },
        },
        data: {
          publishStatus: nextStatus,
          publishedAt: null,
        },
      })
    } else if (action === "update-tags") {
      const mode = payload.mode || "replace"
      const normalizedTags = normalizeTagNames(payload.tags)

      await prisma.$transaction(async (tx) => {
        for (const promptId of editablePromptIds) {
          const prompt = promptMap.get(promptId)
          if (!prompt) {
            continue
          }

          const currentTagNames = prompt.tags.map((item) => item.tag.name)
          let nextTagNames = currentTagNames

          if (mode === "replace") {
            nextTagNames = normalizedTags
          } else if (mode === "add") {
            nextTagNames = normalizeTagNames([...currentTagNames, ...normalizedTags])
          } else {
            const removeSet = new Set(normalizedTags.map((tag) => tag.toLowerCase()))
            nextTagNames = currentTagNames.filter((tag) => !removeSet.has(tag.toLowerCase()))
          }

          await tx.promptTag.deleteMany({
            where: {
              promptId,
            },
          })

          for (const tagName of nextTagNames) {
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
      })
    } else {
      return NextResponse.json({ error: "不支持的批量操作类型" }, { status: 400 })
    }

    await recordPromptAuditLog({
      actorId: session.user.id,
      action: "prompt.batch.update",
      metadata: {
        action,
        editableCount: editablePromptIds.length,
        unauthorizedCount: unauthorized.length,
        missingCount: missing.length,
      },
    })

    return NextResponse.json({
      message: "批量操作完成",
      action,
      successIds: editablePromptIds,
      unauthorized,
      missing,
    })
  } catch (error) {
    console.error("Batch prompt operation failed:", error)
    return NextResponse.json({ error: "批量操作失败" }, { status: 500 })
  }
}
