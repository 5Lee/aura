import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"

// GET /api/favorites - Get user's favorites
export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json(
        { error: "请先登录" },
        { status: 401 }
      )
    }

    const favorites = await prisma.favorite.findMany({
      where: { userId: session.user.id },
      include: {
        prompt: {
          include: {
            category: true,
            author: {
              select: { id: true, name: true, email: true },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json(favorites)
  } catch (error) {
    console.error("Error fetching favorites:", error)
    return NextResponse.json(
      { error: "获取收藏失败" },
      { status: 500 }
    )
  }
}

// POST /api/favorites - Add to favorites
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json(
        { error: "请先登录" },
        { status: 401 }
      )
    }

    const { promptId } = await request.json()

    if (!promptId) {
      return NextResponse.json(
        { error: "缺少提示词 ID" },
        { status: 400 }
      )
    }

    // Check if prompt exists
    const prompt = await prisma.prompt.findUnique({
      where: { id: promptId },
    })

    if (!prompt) {
      return NextResponse.json(
        { error: "提示词不存在" },
        { status: 404 }
      )
    }

    // Check if already favorited
    const existing = await prisma.favorite.findUnique({
      where: {
        userId_promptId: {
          userId: session.user.id,
          promptId,
        },
      },
    })

    if (existing) {
      return NextResponse.json(
        { error: "已收藏" },
        { status: 400 }
      )
    }

    // Create favorite
    const favorite = await prisma.favorite.create({
      data: {
        userId: session.user.id,
        promptId,
      },
    })

    // Update favorite count
    await prisma.prompt.update({
      where: { id: promptId },
      data: { favoriteCount: { increment: 1 } },
    })

    return NextResponse.json(favorite, { status: 201 })
  } catch (error) {
    console.error("Error creating favorite:", error)
    return NextResponse.json(
      { error: "收藏失败" },
      { status: 500 }
    )
  }
}

// DELETE /api/favorites - Remove from favorites
export async function DELETE(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json(
        { error: "请先登录" },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const promptId = searchParams.get("promptId")

    if (!promptId) {
      return NextResponse.json(
        { error: "缺少提示词 ID" },
        { status: 400 }
      )
    }

    // Find and delete favorite
    const favorite = await prisma.favorite.findUnique({
      where: {
        userId_promptId: {
          userId: session.user.id,
          promptId,
        },
      },
    })

    if (!favorite) {
      return NextResponse.json(
        { error: "未收藏该提示词" },
        { status: 404 }
      )
    }

    await prisma.favorite.delete({
      where: { id: favorite.id },
    })

    // Update favorite count
    await prisma.prompt.update({
      where: { id: promptId },
      data: { favoriteCount: { decrement: 1 } },
    })

    return NextResponse.json({ message: "取消收藏成功" })
  } catch (error) {
    console.error("Error deleting favorite:", error)
    return NextResponse.json(
      { error: "取消收藏失败" },
      { status: 500 }
    )
  }
}
