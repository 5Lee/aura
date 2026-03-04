import { BrandConfigStatus } from "@prisma/client"
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"

import { authOptions } from "@/lib/auth"
import { extractBrandConfig, mergeBrandConfig } from "@/lib/branding"
import { prisma } from "@/lib/db"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 })
  }

  const profile = await prisma.brandProfile.findUnique({
    where: { userId: session.user.id },
  })

  const draftConfig = extractBrandConfig(profile?.draftConfig)
  const publishedConfig = profile?.publishedConfig ? extractBrandConfig(profile.publishedConfig) : null
  const effectiveConfig =
    profile?.status === BrandConfigStatus.PUBLISHED && publishedConfig
      ? publishedConfig
      : draftConfig

  return NextResponse.json({
    profile: profile
      ? {
          ...profile,
          draftConfig,
          publishedConfig,
        }
      : null,
    draftConfig,
    publishedConfig,
    effectiveConfig,
  })
}

export async function PUT(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 })
  }

  try {
    const body = await request.json().catch(() => ({}))
    const existing = await prisma.brandProfile.findUnique({
      where: { userId: session.user.id },
    })

    const currentDraft = extractBrandConfig(existing?.draftConfig)
    const nextDraft = mergeBrandConfig(currentDraft, body)

    const updated = await prisma.brandProfile.upsert({
      where: { userId: session.user.id },
      create: {
        userId: session.user.id,
        status: BrandConfigStatus.DRAFT,
        draftConfig: nextDraft,
      },
      update: {
        draftConfig: nextDraft,
      },
    })

    const publishedConfig = updated.publishedConfig
      ? extractBrandConfig(updated.publishedConfig)
      : null

    return NextResponse.json({
      profile: {
        ...updated,
        draftConfig: nextDraft,
        publishedConfig,
      },
    })
  } catch (error) {
    console.error("Save branding draft failed:", error)
    return NextResponse.json({ error: "保存品牌草稿失败" }, { status: 500 })
  }
}
