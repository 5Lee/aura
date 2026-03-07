import { randomUUID } from "node:crypto"

import {
  createCaptchaChallenge,
  parseCookieValue,
  validateCaptchaChallenge,
  AUTH_CAPTCHA_TTL_SECONDS,
} from "@/lib/auth-captcha"
import { getRequestIpAddress, type RequestLike } from "@/lib/auth-request-context"
import { sanitizeTextInput } from "@/lib/security"

export type HumanVerificationProvider = "captcha" | "turnstile"
export type HumanVerificationScope = "register" | "login"

export const REGISTER_CAPTCHA_COOKIE_NAME = "aura_register_captcha"
export const LOGIN_CAPTCHA_COOKIE_NAME = "aura_login_captcha"
export const HUMAN_VERIFICATION_TTL_SECONDS = AUTH_CAPTCHA_TTL_SECONDS

const TURNSTILE_VERIFY_ENDPOINT = "https://challenges.cloudflare.com/turnstile/v0/siteverify"

function resolveTurnstileConfig() {
  const siteKey = sanitizeTextInput(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY, 200)
  const secretKey = sanitizeTextInput(process.env.TURNSTILE_SECRET_KEY, 200)

  if (!siteKey || !secretKey) {
    return null
  }

  return {
    siteKey,
    secretKey,
  }
}

export function getHumanVerificationProvider(): HumanVerificationProvider {
  return resolveTurnstileConfig() ? "turnstile" : "captcha"
}

export function getHumanVerificationClientConfig() {
  const provider = getHumanVerificationProvider()
  const turnstileConfig = resolveTurnstileConfig()

  return {
    provider,
    turnstileSiteKey: turnstileConfig?.siteKey || null,
  }
}

function resolveCaptchaScope(scope: HumanVerificationScope) {
  return `auth:${scope}`
}

function resolveCaptchaLabel(scope: HumanVerificationScope) {
  return scope === "register" ? "注册验证码" : "登录验证码"
}

export function createHumanVerificationCaptchaChallenge(scope: HumanVerificationScope, now = Date.now()) {
  return createCaptchaChallenge({
    scope: resolveCaptchaScope(scope),
    label: resolveCaptchaLabel(scope),
    now,
  })
}

export function validateHumanVerificationCaptchaToken(
  scope: HumanVerificationScope,
  token: string | null,
  answer: unknown,
  now = Date.now()
) {
  return validateCaptchaChallenge({
    scope: resolveCaptchaScope(scope),
    token,
    answer,
    now,
  })
}

export function getHumanVerificationCaptchaTokenFromRequest(
  request: Request,
  cookieName: string
) {
  return parseCookieValue(request.headers.get("cookie"), cookieName)
}

export async function verifyTurnstileToken({
  token,
  request,
  action,
}: {
  token: unknown
  request: RequestLike
  action?: string
}) {
  const turnstileConfig = resolveTurnstileConfig()
  if (!turnstileConfig) {
    return {
      ok: false,
      code: "turnstile_unavailable",
      message: "当前未启用第三方人机验证，请稍后重试。",
    }
  }

  const normalizedToken = sanitizeTextInput(token, 4096)
  if (!normalizedToken) {
    return {
      ok: false,
      code: "turnstile_required",
      message: "请完成人机验证。",
    }
  }

  try {
    const formData = new URLSearchParams()
    formData.set("secret", turnstileConfig.secretKey)
    formData.set("response", normalizedToken)
    formData.set("idempotency_key", randomUUID())

    const ipAddress = getRequestIpAddress(request)
    if (ipAddress) {
      formData.set("remoteip", ipAddress)
    }

    const response = await fetch(TURNSTILE_VERIFY_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData.toString(),
      cache: "no-store",
    })

    if (!response.ok) {
      return {
        ok: false,
        code: "turnstile_invalid",
        message: "人机验证失败，请重试。",
      }
    }

    const payload = (await response.json()) as {
      success?: boolean
      action?: string
      [key: string]: unknown
    }

    if (!payload?.success) {
      return {
        ok: false,
        code: "turnstile_invalid",
        message: "人机验证失败，请重试。",
      }
    }

    if (action && typeof payload.action === "string" && payload.action && payload.action !== action) {
      return {
        ok: false,
        code: "turnstile_invalid",
        message: "人机验证失败，请重试。",
      }
    }

    return {
      ok: true,
    }
  } catch {
    return {
      ok: false,
      code: "turnstile_invalid",
      message: "人机验证失败，请重试。",
    }
  }
}
