import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"

import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { resolvePromptPermission } from "@/lib/prompt-permissions"
import { listPromptVersions } from "@/lib/prompt-versioning"

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 })
    }

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
    if (!permission.canReview) {
      return NextResponse.json({ error: "无权限查看版本历史" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const takeParam = Number(searchParams.get("take") || 20)
    const take = Number.isFinite(takeParam) && takeParam > 0 ? Math.min(takeParam, 100) : 20

    const versions = await listPromptVersions(params.id, take)
    return NextResponse.json(versions)
  } catch (error) {
    console.error("List prompt versions failed:", error)
    return NextResponse.json({ error: "获取版本历史失败" }, { status: 500 })
  }
}
