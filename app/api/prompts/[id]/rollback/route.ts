import { PromptVersionSource } from "@prisma/client"
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"

import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { recordPromptAuditLog } from "@/lib/prompt-audit-log"
import { resolvePromptPermission } from "@/lib/prompt-permissions"
import { createPromptVersionSnapshot } from "@/lib/prompt-versioning"
import { findOrCreateTagByNameWithClient, normalizeTagNames } from "@/lib/tag-utils"

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 })
  }

  try {
    const prompt = await prisma.prompt.findUnique({
      where: { id: params.id },
      select: { id: true, authorId: true, isPublic: true, publishStatus: true },
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
      return NextResponse.json({ error: "无权限回滚此提示词" }, { status: 403 })
    }

    const { version, versionId, reason, confirmHighRisk } = await request.json()
    const versionWhere =
      typeof versionId === "string" && versionId
        ? { id: versionId, promptId: params.id }
        : { promptId_version: { promptId: params.id, version: Number(version) } }

    const targetVersion = await prisma.promptVersion.findUnique({
      where: versionWhere,
    })
    if (!targetVersion) {
      return NextResponse.json({ error: "目标版本不存在" }, { status: 404 })
    }

    const latestVersion = await prisma.promptVersion.findFirst({
      where: { promptId: params.id },
      orderBy: { version: "desc" },
      select: { version: true },
    })
    const rollbackDistance = Math.max(0, (latestVersion?.version ?? targetVersion.version) - targetVersion.version)
    const isHighRiskRollback = rollbackDistance >= 3
    if (isHighRiskRollback && confirmHighRisk !== true) {
      return NextResponse.json(
        { error: "高风险回滚需要二次确认" },
        { status: 400 }
      )
    }

    const tags = normalizeTagNames(Array.isArray(targetVersion.tags) ? targetVersion.tags : [])

    await prisma.$transaction(async (tx) => {
      await tx.prompt.update({
        where: { id: params.id },
        data: {
          title: targetVersion.title,
          content: targetVersion.content,
          description: targetVersion.description,
          categoryId: targetVersion.categoryId,
          isPublic: targetVersion.isPublic,
        },
      })

      await tx.promptTag.deleteMany({
        where: { promptId: params.id },
      })

      for (const tagName of tags) {
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
    })

    await createPromptVersionSnapshot({
      promptId: params.id,
      source: PromptVersionSource.ROLLBACK,
      actorId: session.user.id,
      changeSummary: reason || `Rollback to version ${targetVersion.version}`,
    })

    await recordPromptAuditLog({
      promptId: params.id,
      actorId: session.user.id,
      action: "prompt.rollback",
      metadata: {
        toVersion: targetVersion.version,
        highRiskRollback: isHighRiskRollback,
        reason: reason || null,
      },
    })

    const updatedPrompt = await prisma.prompt.findUnique({
      where: { id: params.id },
      include: {
        category: true,
        tags: {
          include: {
            tag: true,
          },
        },
      },
    })

    return NextResponse.json({
      ...updatedPrompt,
      tags: updatedPrompt?.tags.map((item) => item.tag) || [],
    })
  } catch (error) {
    console.error("Prompt rollback failed:", error)
    await recordPromptAuditLog({
      promptId: params.id,
      actorId: session.user.id,
      action: "prompt.rollback",
      status: "failure",
      metadata: { error: String(error) },
    })
    return NextResponse.json({ error: "回滚提示词失败" }, { status: 500 })
  }
}
