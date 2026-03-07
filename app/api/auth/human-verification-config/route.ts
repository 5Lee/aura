import { NextResponse } from "next/server"

import { getHumanVerificationClientConfig } from "@/lib/auth-human-verification"

export async function GET() {
  return NextResponse.json({
    ...getHumanVerificationClientConfig(),
    registerCaptchaPath: "/api/auth/register-captcha",
    loginCaptchaPath: "/api/auth/login-captcha",
  })
}
