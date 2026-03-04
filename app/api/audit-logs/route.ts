import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"

import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const promptId = searchParams.get("promptId")
    const actorId = searchParams.get("actorId")
    const takeParam = Number(searchParams.get("take") || 50)
    const take = Number.isFinite(takeParam) && takeParam > 0 ? Math.min(takeParam, 200) : 50

    const where: {
      OR?: Array<{ actorId?: string; prompt?: { authorId: string } }>
      promptId?: string
      actorId?: string
    } = {}

    where.OR = [{ actorId: session.user.id }, { prompt: { authorId: session.user.id } }]

    if (promptId) {
      where.promptId = promptId
    }

    if (actorId) {
      where.actorId = actorId
    }

    const logs = await prisma.promptAuditLog.findMany({
      where,
      include: {
        actor: {
          select: { id: true, name: true, email: true },
        },
        prompt: {
          select: { id: true, title: true, authorId: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take,
    })

    return NextResponse.json(logs)
  } catch (error) {
    console.error("Fetch audit logs failed:", error)
    return NextResponse.json({ error: "获取审计日志失败" }, { status: 500 })
  }
}
