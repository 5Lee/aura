import { PromptVersionSource } from "@prisma/client"
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { recordPromptAuditLog } from "@/lib/prompt-audit-log"
import { createPromptVersionSnapshot } from "@/lib/prompt-versioning"
import { findOrCreateTagByName, normalizeTagNames } from "@/lib/tag-utils"

// GET /api/prompts - Get prompts (user's own or public)
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    const { searchParams } = new URL(request.url)
    const category = searchParams.get("category")
    const search = searchParams.get("search")

    const where: any = {}

    // If not logged in, only show public prompts
    if (!session?.user) {
      where.isPublic = true
    } else {
      // If logged in, show own prompts OR public prompts
      where.OR = [
        { authorId: session.user.id },
        { isPublic: true },
      ]
    }

    if (category) {
      where.categoryId = category
    }

    if (search) {
      where.OR = [
        { title: { contains: search } },
        { content: { contains: search } },
        { description: { contains: search } },
      ]
    }

    const prompts = await prisma.prompt.findMany({
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
    })

    // Transform tags to match expected format
    const transformedPrompts = prompts.map(prompt => ({
      ...prompt,
      tags: prompt.tags.map(pt => pt.tag),
    }))

    return NextResponse.json(transformedPrompts)
  } catch (error) {
    console.error("Error fetching prompts:", error)
    return NextResponse.json(
      { error: "获取提示词失败" },
      { status: 500 }
    )
  }
}

// POST /api/prompts - Create a new prompt
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json(
        { error: "请先登录" },
        { status: 401 }
      )
    }

    const { title, content, description, categoryId, isPublic, tags } = await request.json()

    // Validate
    if (!title || !content || !categoryId) {
      return NextResponse.json(
        { error: "标题、内容和分类不能为空" },
        { status: 400 }
      )
    }

    // Create the prompt first
    const prompt = await prisma.prompt.create({
      data: {
        title,
        content,
        description: description || null,
        categoryId,
        isPublic: isPublic || false,
        authorId: session.user.id,
      },
      include: {
        category: true,
        tags: {
          include: {
            tag: true,
          },
        },
      },
    })

    // Handle tags - connect or create
    const normalizedTags = normalizeTagNames(tags)
    if (normalizedTags.length > 0) {
      for (const tagName of normalizedTags) {
        const tag = await findOrCreateTagByName(tagName)
        if (!tag) {
          continue
        }

        // Create PromptTag relation
        await prisma.promptTag.create({
          data: {
            promptId: prompt.id,
            tagId: tag.id,
          },
        })
      }
    }

    // Fetch the updated prompt with tags
    const updatedPrompt = await prisma.prompt.findUnique({
      where: { id: prompt.id },
      include: {
        category: true,
        tags: {
          include: {
            tag: true,
          },
        },
      },
    })

    // Transform response
    const transformed = {
      ...updatedPrompt!,
      tags: updatedPrompt!.tags.map(pt => pt.tag),
    }

    await createPromptVersionSnapshot({
      promptId: updatedPrompt!.id,
      source: PromptVersionSource.CREATE,
      actorId: session.user.id,
      changeSummary: "Initial prompt version",
    })

    await recordPromptAuditLog({
      promptId: updatedPrompt!.id,
      actorId: session.user.id,
      action: "prompt.create",
      metadata: {
        isPublic: updatedPrompt!.isPublic,
        categoryId: updatedPrompt!.categoryId,
        tagCount: transformed.tags.length,
      },
    })

    return NextResponse.json(transformed, { status: 201 })
  } catch (error) {
    console.error("Error creating prompt:", error)
    return NextResponse.json(
      { error: "创建提示词失败" },
      { status: 500 }
    )
  }
}
