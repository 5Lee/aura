import { BrandConfigStatus } from "@prisma/client"
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"

import { authOptions } from "@/lib/auth"
import { extractBrandConfig } from "@/lib/branding"
import { prisma } from "@/lib/db"

export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 })
  }

  try {
    const profile = await prisma.brandProfile.findUnique({
      where: { userId: session.user.id },
    })

    if (!profile?.draftConfig) {
      return NextResponse.json({ error: "请先保存品牌草稿" }, { status: 400 })
    }

    const draftConfig = extractBrandConfig(profile.draftConfig)
    if (draftConfig.domain) {
      const others = await prisma.brandProfile.findMany({
        where: {
          status: BrandConfigStatus.PUBLISHED,
          NOT: { userId: session.user.id },
        },
        select: {
          userId: true,
          publishedConfig: true,
        },
      })

      const hasConflict = others.some((item) => {
        if (!item.publishedConfig) {
          return false
        }
        const config = extractBrandConfig(item.publishedConfig)
        return config.domain === draftConfig.domain
      })

      if (hasConflict) {
        return NextResponse.json(
          { error: "该品牌域名已被其他租户占用，请更换后重试" },
          { status: 409 }
        )
      }
    }

    const now = new Date()
    const updated = await prisma.brandProfile.update({
      where: { id: profile.id },
      data: {
        status: BrandConfigStatus.PUBLISHED,
        publishedConfig: draftConfig,
        publishedAt: now,
      },
    })

    return NextResponse.json({
      profile: {
        ...updated,
        draftConfig,
        publishedConfig: draftConfig,
      },
      published: true,
    })
  } catch (error) {
    console.error("Publish branding failed:", error)
    return NextResponse.json({ error: "发布品牌配置失败" }, { status: 500 })
  }
}
