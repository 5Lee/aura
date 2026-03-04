import { NextResponse } from "next/server"

import { verifyUserCredentials } from "@/lib/auth-credentials"
import { getCredentialGuardForEmail, getSsoRuntimePolicy } from "@/lib/sso-server"
import { sanitizeTextInput } from "@/lib/security"

const INVALID_CREDENTIALS_RESPONSE = {
  ok: false,
  error: "邮箱或密码错误",
}

export async function POST(request: Request) {
  try {
    const { email, password, tenant } = await request.json()
    if (!email || !password) {
      return NextResponse.json(INVALID_CREDENTIALS_RESPONSE)
    }

    const tenantDomain = sanitizeTextInput(tenant, 120).toLowerCase()
    if (tenantDomain) {
      const runtime = await getSsoRuntimePolicy({ tenantDomain })
      if (runtime.enabled && runtime.enforceSso && !runtime.allowLocalFallback) {
        return NextResponse.json({
          ok: false,
          error: "当前企业已启用强制 SSO，请使用企业单点登录。",
        })
      }
    }

    const guard = await getCredentialGuardForEmail(email)
    if (!guard.allowed) {
      return NextResponse.json({
        ok: false,
        error: guard.reason || "当前企业已启用强制 SSO，请使用企业单点登录。",
      })
    }

    const user = await verifyUserCredentials(email, password)
    if (!user) {
      return NextResponse.json(INVALID_CREDENTIALS_RESPONSE)
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("Credential validation failed:", error)
    return NextResponse.json(
      { ok: false, error: "登录校验失败，请稍后重试" },
      { status: 500 }
    )
  }
}
