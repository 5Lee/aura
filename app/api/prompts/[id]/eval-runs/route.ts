import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"

import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"

async function ensurePromptOwner(promptId: string, userId: string) {
  const prompt = await prisma.prompt.findUnique({
    where: { id: promptId },
    select: { id: true, authorId: true },
  })

  if (!prompt) {
    return { ok: false, status: 404, error: "提示词不存在" } as const
  }

  if (prompt.authorId !== userId) {
    return { ok: false, status: 403, error: "无权限查看评测报告" } as const
  }

  return { ok: true } as const
}

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 })
  }

  const ownership = await ensurePromptOwner(params.id, session.user.id)
  if (!ownership.ok) {
    return NextResponse.json({ error: ownership.error }, { status: ownership.status })
  }

  const { searchParams } = new URL(request.url)
  const takeParam = Number(searchParams.get("take") || 20)
  const take = Number.isFinite(takeParam) && takeParam > 0 ? Math.min(takeParam, 100) : 20

  const runs = await prisma.promptEvalRun.findMany({
    where: { promptId: params.id },
    include: {
      results: {
        include: {
          testCase: {
            select: {
              id: true,
              name: true,
              assertionType: true,
            },
          },
        },
        orderBy: { createdAt: "asc" },
      },
      promptVersion: {
        select: {
          id: true,
          version: true,
          source: true,
          createdAt: true,
        },
      },
      triggeredBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take,
  })

  return NextResponse.json(runs)
}
