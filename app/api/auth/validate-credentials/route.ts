import { NextResponse } from "next/server"

import { verifyUserCredentials } from "@/lib/auth-credentials"

const INVALID_CREDENTIALS_RESPONSE = {
  ok: false,
  error: "邮箱或密码错误",
}

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json()
    if (!email || !password) {
      return NextResponse.json(INVALID_CREDENTIALS_RESPONSE)
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
