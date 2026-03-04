import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"

import { authOptions } from "@/lib/auth"
import { getSsoRuntimePolicy } from "@/lib/sso-server"
import { sanitizeTextInput } from "@/lib/security"

export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  const { searchParams } = new URL(request.url)
  const tenantDomain = sanitizeTextInput(searchParams.get("tenant"), 120).toLowerCase()

  try {
    const runtime = await getSsoRuntimePolicy({
      userId: session?.user?.id,
      tenantDomain,
    })

    if (!runtime.provider) {
      return NextResponse.json({
        enabled: false,
        enforceSso: false,
        allowLocalFallback: true,
        tenantMatched: runtime.tenantMatched,
      })
    }

    return NextResponse.json({
      enabled: true,
      enforceSso: runtime.enforceSso,
      allowLocalFallback: runtime.allowLocalFallback,
      tenantMatched: runtime.tenantMatched,
      provider: {
        id: runtime.provider.id,
        type: runtime.provider.type,
        name: runtime.provider.name,
      },
    })
  } catch (error) {
    console.error("Get SSO runtime failed:", error)
    return NextResponse.json({ error: "获取 SSO 运行配置失败" }, { status: 500 })
  }
}
