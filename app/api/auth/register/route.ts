import { NextResponse } from "next/server"
import * as bcrypt from "bcryptjs"

import { prisma } from "@/lib/db"
import {
  claimRegistrationRateLimitSlot,
  getRegistrationCaptchaTokenFromRequest,
  REGISTRATION_CAPTCHA_COOKIE_NAME,
  releaseRegistrationRateLimitSlot,
  validateRegistrationCaptchaToken,
} from "@/lib/auth-registration-guard"
import {
  getHumanVerificationProvider,
  verifyTurnstileToken,
} from "@/lib/auth-human-verification"
import { recordPromptAuditLog } from "@/lib/prompt-audit-log"
import { sanitizeTextInput } from "@/lib/security"
import { getSsoRuntimePolicy } from "@/lib/sso-server"

function clearRegistrationCaptchaCookie(response: NextResponse) {
  response.cookies.set(REGISTRATION_CAPTCHA_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/api/auth",
    maxAge: 0,
  })

  return response
}

export async function POST(request: Request) {
  let registrationRateLimitSlotKey = ""

  try {
    const { name, email, password, tenant, captcha, turnstileToken } = await request.json()
    const normalizedEmail = sanitizeTextInput(email, 160).toLowerCase()
    const tenantDomain = sanitizeTextInput(tenant, 120).toLowerCase()
    const verificationProvider = getHumanVerificationProvider()

    if (!normalizedEmail || !password) {
      return NextResponse.json(
        { error: "邮箱和密码不能为空" },
        { status: 400 }
      )
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "密码长度至少为6位" },
        { status: 400 }
      )
    }

    if (tenantDomain) {
      const runtime = await getSsoRuntimePolicy({ tenantDomain })
      if (runtime.enabled && runtime.enforceSso && !runtime.allowLocalFallback) {
        return NextResponse.json(
          { error: "当前企业已启用强制 SSO，请使用企业单点登录完成注册。" },
          { status: 403 }
        )
      }
    }

    const humanCheck =
      verificationProvider === "turnstile"
        ? await verifyTurnstileToken({
            token: turnstileToken,
            request,
            action: "register",
          })
        : validateRegistrationCaptchaToken(getRegistrationCaptchaTokenFromRequest(request), captcha)

    if (!humanCheck.ok) {
      await recordPromptAuditLog({
        action: "auth.register",
        resource: "auth",
        status: "failure",
        request,
        metadata: {
          provider: verificationProvider,
          reason: humanCheck.code,
        },
      })

      return clearRegistrationCaptchaCookie(
        NextResponse.json(
          { error: humanCheck.message, code: humanCheck.code },
          { status: 400 }
        )
      )
    }

    const rateLimitState = await claimRegistrationRateLimitSlot(request)
    if (rateLimitState.limited) {
      await recordPromptAuditLog({
        action: "auth.register",
        resource: "auth",
        status: "failure",
        request,
        metadata: {
          provider: verificationProvider,
          reason: "register_rate_limited",
          retryAfterSeconds: rateLimitState.retryAfterSeconds,
          rateLimitSource: rateLimitState.source,
        },
      })

      return clearRegistrationCaptchaCookie(
        NextResponse.json(
          {
            error: `同一 IP 1 分钟内只能注册一次，请 ${rateLimitState.retryAfterSeconds} 秒后再试。`,
            code: "register_rate_limited",
            retryAfterSeconds: rateLimitState.retryAfterSeconds,
          },
          {
            status: 429,
            headers: {
              "Retry-After": String(rateLimitState.retryAfterSeconds),
            },
          }
        )
      )
    }

    registrationRateLimitSlotKey = rateLimitState.slotKey

    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    })

    if (existingUser) {
      if (registrationRateLimitSlotKey) {
        await releaseRegistrationRateLimitSlot(registrationRateLimitSlotKey)
        registrationRateLimitSlotKey = ""
      }

      await recordPromptAuditLog({
        action: "auth.register",
        resource: "auth",
        status: "failure",
        request,
        metadata: {
          provider: verificationProvider,
          reason: "email_exists",
        },
      })

      return clearRegistrationCaptchaCookie(
        NextResponse.json(
          { error: "该邮箱已被注册", code: "email_exists" },
          { status: 400 }
        )
      )
    }

    const hashedPassword = await bcrypt.hash(password, 10)
    const user = await prisma.user.create({
      data: {
        name: sanitizeTextInput(name, 80) || null,
        email: normalizedEmail,
        password: hashedPassword,
      },
    })

    await recordPromptAuditLog({
      action: "auth.register",
      resource: "auth",
      request,
      metadata: {
        tenantDomain: tenantDomain || null,
        guard: "human_verification_and_ip_rate_limit",
        verificationProvider,
        rateLimitSource: rateLimitState.source,
      },
    })

    return clearRegistrationCaptchaCookie(
      NextResponse.json(
        { message: "注册成功", userId: user.id },
        { status: 201 }
      )
    )
  } catch (error) {
    if (registrationRateLimitSlotKey) {
      await releaseRegistrationRateLimitSlot(registrationRateLimitSlotKey)
    }

    console.error("Registration error:", error)
    return NextResponse.json(
      { error: "注册失败，请重试" },
      { status: 500 }
    )
  }
}
