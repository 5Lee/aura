import { NextResponse } from "next/server"

import { prisma } from "@/lib/db"
import { buildSsoAuthorizeUrl } from "@/lib/sso"
import { findTenantOwnerUserId, getActiveSsoProviderForUser } from "@/lib/sso-server"
import { sanitizeTextInput } from "@/lib/security"

function encodeState(payload: Record<string, unknown>) {
  const raw = JSON.stringify(payload)
  return Buffer.from(raw, "utf8").toString("base64url")
}

function resolveSafeCallback(value: string | null) {
  const callback = sanitizeTextInput(value, 200)
  if (!callback || !callback.startsWith("/")) {
    return "/dashboard"
  }
  return callback
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const providerId = sanitizeTextInput(searchParams.get("providerId"), 64)
    const tenantDomain = sanitizeTextInput(searchParams.get("tenant"), 120).toLowerCase()
    const callbackUrl = resolveSafeCallback(searchParams.get("callbackUrl"))

    let provider = null
    if (providerId) {
      provider = await prisma.ssoProvider.findUnique({
        where: {
          id: providerId,
        },
      })
    } else if (tenantDomain) {
      const ownerId = await findTenantOwnerUserId(tenantDomain)
      if (ownerId) {
        provider = await getActiveSsoProviderForUser(ownerId)
      }
    }

    if (!provider || provider.status !== "ACTIVE") {
      const fallback = new URL(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`, request.url)
      if (tenantDomain) {
        fallback.searchParams.set("tenant", tenantDomain)
      }
      fallback.searchParams.set("sso", "unavailable")
      return NextResponse.redirect(fallback)
    }

    const state = encodeState({
      callbackUrl,
      providerId: provider.id,
      tenant: tenantDomain,
      ts: Date.now(),
    })

    const authorizeUrl = buildSsoAuthorizeUrl({
      provider: {
        type: provider.type,
        issuerUrl: provider.issuerUrl,
        ssoUrl: provider.ssoUrl,
        clientId: provider.clientId,
      },
      callbackUrl: new URL("/api/sso/callback", request.url).toString(),
      state,
    })

    return NextResponse.redirect(authorizeUrl)
  } catch (error) {
    console.error("Start SSO login failed:", error)
    return NextResponse.json({ error: "SSO 登录跳转失败" }, { status: 500 })
  }
}
