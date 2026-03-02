import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"

// GET /api/prompts/[id] - Get a single prompt
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const prompt = await prisma.prompt.findUnique({
      where: { id: params.id },
      include: {
        category: true,
        tags: true,
        author: {
          select: { id: true, name: true, email: true },
        },
      },
    })

    if (!prompt) {
      return NextResponse.json(
        { error: "提示词不存在" },
        { status: 404 }
      )
    }

    // Increment view count
    await prisma.prompt.update({
      where: { id: params.id },
      data: { viewCount: { increment: 1 } },
    })

    return NextResponse.json(prompt)
  } catch (error) {
    console.error("Error fetching prompt:", error)
    return NextResponse.json(
      { error: "获取提示词失败" },
      { status: 500 }
    )
  }
}

// PATCH /api/prompts/[id] - Update a prompt
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json(
        { error: "请先登录" },
        { status: 401 }
      )
    }

    // Check ownership
    const prompt = await prisma.prompt.findUnique({
      where: { id: params.id },
    })

    if (!prompt) {
      return NextResponse.json(
        { error: "提示词不存在" },
        { status: 404 }
      )
    }

    if (prompt.authorId !== session.user.id) {
      return NextResponse.json(
        { error: "无权限修改此提示词" },
        { status: 403 }
      )
    }

    const { title, content, description, categoryId, isPublic, tags } = await request.json()

    // Handle tags
    const tagConnections = await Promise.all(
      (tags || []).map(async (tagName: string) => {
        const slug = tagName.toLowerCase().replace(/\s+/g, "-")
        const tag = await prisma.tag.upsert({
          where: { slug },
          update: {},
          create: { name: tagName, slug },
        })
        return { id: tag.id }
      })
    )

    const updated = await prisma.prompt.update({
      where: { id: params.id },
      data: {
        title: title ?? prompt.title,
        content: content ?? prompt.content,
        description: description ?? prompt.description,
        categoryId: categoryId ?? prompt.categoryId,
        isPublic: isPublic ?? prompt.isPublic,
        tags: {
          set: [], // Clear existing
          connect: tagConnections, // Connect new
        },
      },
      include: {
        category: true,
        tags: true,
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error("Error updating prompt:", error)
    return NextResponse.json(
      { error: "更新提示词失败" },
      { status: 500 }
    )
  }
}

// DELETE /api/prompts/[id] - Delete a prompt
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json(
        { error: "请先登录" },
        { status: 401 }
      )
    }

    // Check ownership
    const prompt = await prisma.prompt.findUnique({
      where: { id: params.id },
    })

    if (!prompt) {
      return NextResponse.json(
        { error: "提示词不存在" },
        { status: 404 }
      )
    }

    if (prompt.authorId !== session.user.id) {
      return NextResponse.json(
        { error: "无权限删除此提示词" },
        { status: 403 }
      )
    }

    await prisma.prompt.delete({
      where: { id: params.id },
    })

    return NextResponse.json({ message: "删除成功" })
  } catch (error) {
    console.error("Error deleting prompt:", error)
    return NextResponse.json(
      { error: "删除提示词失败" },
      { status: 500 }
    )
  }
}
