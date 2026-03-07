import { prisma } from "@/lib/db"
import {
  buildCaptchaSvg,
  normalizeCaptchaInput,
} from "@/lib/auth-captcha"
import {
  claimDistributedRateLimitSlot,
  clearDistributedRateLimitKeys,
  isDistributedRateLimitEnabled,
} from "@/lib/distributed-rate-limit"
import {
  createHumanVerificationCaptchaChallenge,
  getHumanVerificationCaptchaTokenFromRequest,
  HUMAN_VERIFICATION_TTL_SECONDS,
  REGISTER_CAPTCHA_COOKIE_NAME,
  validateHumanVerificationCaptchaToken,
} from "@/lib/auth-human-verification"
import { extractRequestAuditContext } from "@/lib/compliance-audit"

export const REGISTRATION_CAPTCHA_COOKIE_NAME = REGISTER_CAPTCHA_COOKIE_NAME
export const REGISTRATION_CAPTCHA_TTL_SECONDS = HUMAN_VERIFICATION_TTL_SECONDS
export const REGISTRATION_RATE_LIMIT_WINDOW_SECONDS = 60
export const REGISTRATION_RATE_LIMIT_MAX_SUCCESS = 1

function buildRegistrationRateLimitKey(request: Request) {
  const context = extractRequestAuditContext(request)
  if (!context.ipHash) {
    return ""
  }

  return `auth:register:ip:${context.ipHash}`
}

export function buildRegistrationCaptchaSvg(code: string) {
  return buildCaptchaSvg(code, "注册验证码")
}

export function createRegistrationCaptchaChallenge(now = Date.now()) {
  return createHumanVerificationCaptchaChallenge("register", now)
}

export function validateRegistrationCaptchaToken(
  token: string | null,
  answer: unknown,
  now = Date.now()
) {
  return validateHumanVerificationCaptchaToken("register", token, answer, now)
}

export function getRegistrationCaptchaTokenFromRequest(request: Request) {
  return getHumanVerificationCaptchaTokenFromRequest(request, REGISTRATION_CAPTCHA_COOKIE_NAME)
}

export async function getRegistrationRateLimitState(request: Request) {
  const context = extractRequestAuditContext(request)
  if (!context.ipHash) {
    return {
      limited: false,
      retryAfterSeconds: 0,
      ipHash: "",
    }
  }

  const windowStart = new Date(Date.now() - REGISTRATION_RATE_LIMIT_WINDOW_SECONDS * 1000)
  const recentSuccess = await prisma.promptAuditLog.findFirst({
    where: {
      action: "auth.register",
      resource: "auth",
      status: "success",
      ipHash: context.ipHash,
      createdAt: {
        gte: windowStart,
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    select: {
      createdAt: true,
    },
  })

  if (!recentSuccess) {
    return {
      limited: false,
      retryAfterSeconds: 0,
      ipHash: context.ipHash,
    }
  }

  const retryAfterMs =
    recentSuccess.createdAt.getTime() + REGISTRATION_RATE_LIMIT_WINDOW_SECONDS * 1000 - Date.now()

  return {
    limited: retryAfterMs > 0,
    retryAfterSeconds: retryAfterMs > 0 ? Math.ceil(retryAfterMs / 1000) : 0,
    ipHash: context.ipHash,
  }
}

export async function claimRegistrationRateLimitSlot(request: Request) {
  if (!isDistributedRateLimitEnabled()) {
    const fallbackState = await getRegistrationRateLimitState(request)
    return {
      ...fallbackState,
      slotKey: "",
      source: "local" as const,
    }
  }

  const slotKey = buildRegistrationRateLimitKey(request)
  if (!slotKey) {
    return {
      limited: false,
      retryAfterSeconds: 0,
      ipHash: "",
      slotKey: "",
      source: "upstash" as const,
    }
  }

  const claimResult = await claimDistributedRateLimitSlot(
    slotKey,
    REGISTRATION_RATE_LIMIT_WINDOW_SECONDS
  )

  if (claimResult.source === "fallback") {
    const fallbackState = await getRegistrationRateLimitState(request)
    return {
      ...fallbackState,
      slotKey: "",
      source: "local" as const,
    }
  }

  const context = extractRequestAuditContext(request)
  return {
    limited: !claimResult.acquired,
    retryAfterSeconds: claimResult.retryAfterSeconds,
    ipHash: context.ipHash,
    slotKey: claimResult.acquired ? slotKey : "",
    source: "upstash" as const,
  }
}

export async function releaseRegistrationRateLimitSlot(slotKey: string) {
  if (!slotKey) {
    return
  }

  await clearDistributedRateLimitKeys([slotKey])
}

export { normalizeCaptchaInput }
