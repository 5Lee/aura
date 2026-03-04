import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"

import { BrandCustomizationPanel } from "@/components/branding/brand-customization-panel"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { authOptions } from "@/lib/auth"
import { extractBrandConfig } from "@/lib/branding"
import { prisma } from "@/lib/db"

export default async function BrandingPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    redirect("/login")
  }

  const profile = await prisma.brandProfile.findUnique({
    where: { userId: session.user.id },
  })

  const draftConfig = extractBrandConfig(profile?.draftConfig)
  const publishedConfig = profile?.publishedConfig ? extractBrandConfig(profile.publishedConfig) : null

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-3">
            <CardTitle>品牌定制中心</CardTitle>
            <Badge variant="secondary">Week18-003</Badge>
            <Badge>{profile?.status || "DRAFT"}</Badge>
          </div>
          <CardDescription>
            配置品牌 Logo、主题色、租户域名、登录页文案与邮件签名；支持草稿保存与发布生效。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <BrandCustomizationPanel
            draftConfig={draftConfig}
            publishedConfig={publishedConfig}
            status={profile?.status || "DRAFT"}
            publishedAt={profile?.publishedAt?.toISOString() ?? null}
          />
        </CardContent>
      </Card>
    </div>
  )
}
