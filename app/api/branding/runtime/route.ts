import { BrandConfigStatus } from "@prisma/client"
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"

import { authOptions } from "@/lib/auth"
import { DEFAULT_BRAND_CONFIG, extractBrandConfig } from "@/lib/branding"
import { prisma } from "@/lib/db"

export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  const { searchParams } = new URL(request.url)
  const tenantDomain = searchParams.get("tenant")?.trim().toLowerCase() || ""

  try {
    if (session?.user?.id && !tenantDomain) {
      const profile = await prisma.brandProfile.findUnique({
        where: { userId: session.user.id },
      })

      if (!profile) {
        return NextResponse.json({
          config: DEFAULT_BRAND_CONFIG,
          source: "default",
          tenantMatched: false,
        })
      }

      const runtimeConfig =
        profile.status === BrandConfigStatus.PUBLISHED && profile.publishedConfig
          ? extractBrandConfig(profile.publishedConfig)
          : extractBrandConfig(profile.draftConfig)

      return NextResponse.json({
        config: runtimeConfig,
        source: profile.status === BrandConfigStatus.PUBLISHED ? "published" : "draft",
        tenantMatched: false,
      })
    }

    if (tenantDomain) {
      const publishedProfiles = await prisma.brandProfile.findMany({
        where: {
          status: BrandConfigStatus.PUBLISHED,
        },
        select: {
          userId: true,
          publishedConfig: true,
        },
      })

      for (const profile of publishedProfiles) {
        if (!profile.publishedConfig) {
          continue
        }
        const config = extractBrandConfig(profile.publishedConfig)
        if (config.domain && config.domain === tenantDomain) {
          return NextResponse.json({
            config,
            source: "published",
            tenantMatched: true,
            userId: profile.userId,
          })
        }
      }
    }

    return NextResponse.json({
      config: DEFAULT_BRAND_CONFIG,
      source: "default",
      tenantMatched: false,
    })
  } catch (error) {
    console.error("Fetch branding runtime failed:", error)
    return NextResponse.json({ error: "获取品牌配置失败" }, { status: 500 })
  }
}
