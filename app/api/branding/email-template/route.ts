import { BrandConfigStatus } from "@prisma/client"
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"

import { authOptions } from "@/lib/auth"
import { extractBrandConfig, renderBrandedEmailTemplate } from "@/lib/branding"
import { prisma } from "@/lib/db"
import { sanitizeMultilineTextInput, sanitizeTextInput } from "@/lib/security"

async function getEffectiveConfig(userId: string) {
  const profile = await prisma.brandProfile.findUnique({
    where: { userId },
  })

  if (!profile) {
    return null
  }

  if (profile.status === BrandConfigStatus.PUBLISHED && profile.publishedConfig) {
    return extractBrandConfig(profile.publishedConfig)
  }

  return extractBrandConfig(profile.draftConfig)
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 })
  }

  const config = await getEffectiveConfig(session.user.id)
  if (!config) {
    return NextResponse.json({ error: "请先配置品牌信息" }, { status: 400 })
  }

  const html = renderBrandedEmailTemplate({
    config,
    subject: "Aura 提醒：新的提示词评测结果已生成",
    message: "你好，\n你关注的提示词评测已完成，请尽快查看失败用例并处理。",
    ctaLabel: "查看评测报告",
    ctaUrl: "https://aura.local/dashboard",
  })

  return NextResponse.json({ html, config })
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 })
  }

  try {
    const config = await getEffectiveConfig(session.user.id)
    if (!config) {
      return NextResponse.json({ error: "请先配置品牌信息" }, { status: 400 })
    }

    const body = await request.json().catch(() => ({}))
    const subject = sanitizeTextInput(body.subject, 160) || "Aura 消息通知"
    const message = sanitizeMultilineTextInput(body.message, 2000) || "请查看最新通知。"
    const ctaLabel = sanitizeTextInput(body.ctaLabel, 40) || "查看详情"
    const ctaUrl = sanitizeTextInput(body.ctaUrl, 500) || "https://aura.local/dashboard"

    const html = renderBrandedEmailTemplate({
      config,
      subject,
      message,
      ctaLabel,
      ctaUrl,
    })

    return NextResponse.json({ html, config })
  } catch (error) {
    console.error("Render branded email failed:", error)
    return NextResponse.json({ error: "生成邮件模板失败" }, { status: 500 })
  }
}
