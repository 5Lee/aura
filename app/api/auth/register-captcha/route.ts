import { NextResponse } from "next/server"

import {
  createRegistrationCaptchaChallenge,
  REGISTRATION_CAPTCHA_COOKIE_NAME,
  REGISTRATION_CAPTCHA_TTL_SECONDS,
} from "@/lib/auth-registration-guard"

export async function GET() {
  const challenge = createRegistrationCaptchaChallenge()
  const response = new NextResponse(challenge.svg, {
    status: 200,
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      Pragma: "no-cache",
      Expires: "0",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; img-src data:; sandbox",
    },
  })

  response.cookies.set(REGISTRATION_CAPTCHA_COOKIE_NAME, challenge.token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/api/auth",
    maxAge: REGISTRATION_CAPTCHA_TTL_SECONDS,
  })

  return response
}
