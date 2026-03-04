import { NextResponse } from "next/server"

import { sanitizeTextInput } from "@/lib/security"

function decodeState(value: string) {
  try {
    const raw = Buffer.from(value, "base64url").toString("utf8")
    const payload = JSON.parse(raw)
    if (!payload || typeof payload !== "object") {
      return null
    }
    return payload as Record<string, unknown>
  } catch (error) {
    return null
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const state = sanitizeTextInput(searchParams.get("state"), 1200)
  const payload = state ? decodeState(state) : null

  const callbackUrlRaw = payload?.callbackUrl
  const callbackUrl =
    typeof callbackUrlRaw === "string" && callbackUrlRaw.startsWith("/")
      ? callbackUrlRaw
      : "/dashboard"

  const loginUrl = new URL(`/login?sso=callback-not-implemented&callbackUrl=${encodeURIComponent(callbackUrl)}`, request.url)
  if (typeof payload?.tenant === "string" && payload.tenant.trim()) {
    loginUrl.searchParams.set("tenant", payload.tenant.trim())
  }

  return NextResponse.redirect(loginUrl)
}
