import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"

import { authOptions } from "@/lib/auth"
import { getPromptQualityDashboard } from "@/lib/prompt-evals"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 })
  }

  try {
    const dashboard = await getPromptQualityDashboard(session.user.id)
    return NextResponse.json(dashboard)
  } catch (error) {
    console.error("Fetch eval dashboard failed:", error)
    return NextResponse.json({ error: "获取评测看板失败" }, { status: 500 })
  }
}
