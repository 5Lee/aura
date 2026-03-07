import { createHash, createHmac, timingSafeEqual } from "node:crypto"

import { extractRequestAuditContext } from "@/lib/compliance-audit"
import {
  clearDistributedRateLimitKeys,
  getDistributedRateLimitCounter,
  incrementDistributedRateLimitCounter,
  isDistributedRateLimitEnabled,
} from "@/lib/distributed-rate-limit"
import {
  createHumanVerificationCaptchaChallenge,
  getHumanVerificationCaptchaTokenFromRequest,
  HUMAN_VERIFICATION_TTL_SECONDS,
  LOGIN_CAPTCHA_COOKIE_NAME as HUMAN_VERIFICATION_LOGIN_CAPTCHA_COOKIE_NAME,
  validateHumanVerificationCaptchaToken,
} from "@/lib/auth-human-verification"
import { getRequestIpHash, type RequestLike } from "@/lib/auth-request-context"
import { prisma } from "@/lib/db"
import { sanitizeTextInput } from "@/lib/security"

export const LOGIN_CAPTCHA_COOKIE_NAME = HUMAN_VERIFICATION_LOGIN_CAPTCHA_COOKIE_NAME
export const LOGIN_CAPTCHA_TTL_SECONDS = HUMAN_VERIFICATION_TTL_SECONDS
export const LOGIN_PROOF_TTL_SECONDS = 2 * 60
export const LOGIN_CHALLENGE_WINDOW_SECONDS = 15 * 60
export const LOGIN_CHALLENGE_FAILURE_THRESHOLD = 2
export const LOGIN_RATE_LIMIT_MAX_FAILURES = 6
export const LOGIN_ATTEMPT_WINDOW_SECONDS = 60
export const LOGIN_ATTEMPT_MAX_REQUESTS = 8

const hashText = (value: string) => createHash("sha256").update(value).digest("hex")

const resolveLoginProofSecret = () =>
  process.env.LOGIN_GUARD_SECRET || process.env.NEXTAUTH_SECRET || "aura-dev-login-guard"

const signLoginProofPayload = (payload: string) =>
  createHmac("sha256", resolveLoginProofSecret()).update(payload).digest("base64url")

const timingSafeEqualText = (left: string, right: string) => {
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)

  if (leftBuffer.length !== rightBuffer.length) {
    return false
  }

  return timingSafeEqual(leftBuffer, rightBuffer)
}

function normalizeEmail(value: unknown) {
  return sanitizeTextInput(value, 160).toLowerCase()
}

function normalizeTenant(value: unknown) {
  return sanitizeTextInput(value, 120).toLowerCase()
}

function normalizePassword(value: unknown) {
  return typeof value === "string" ? value : ""
}

function buildLoginAttemptKey(ipHash: string) {
  return ipHash ? `auth:login:attempt:${ipHash}` : ""
}

function buildLoginFailureKey(ipHash: string) {
  return ipHash ? `auth:login:fail:${ipHash}` : ""
}

function buildProofCredentialDigest({
  email,
  password,
  tenant,
  ipHash,
}: {
  email: string
  password: string
  tenant: string
  ipHash: string
}) {
  return hashText(`login-proof:${email}:${password}:${tenant}:${ipHash}`)
}

export function createLoginCaptchaChallenge(now = Date.now()) {
  return createHumanVerificationCaptchaChallenge("login", now)
}

export function validateLoginCaptchaToken(token: string | null, answer: unknown, now = Date.now()) {
  return validateHumanVerificationCaptchaToken("login", token, answer, now)
}

export function getLoginCaptchaTokenFromRequest(request: Request) {
  return getHumanVerificationCaptchaTokenFromRequest(request, LOGIN_CAPTCHA_COOKIE_NAME)
}

export function createLoginProof({
  email,
  password,
  tenant,
  request,
  now = Date.now(),
}: {
  email: unknown
  password: unknown
  tenant?: unknown
  request: RequestLike
  now?: number
}) {
  const normalizedEmail = normalizeEmail(email)
  const normalizedPassword = normalizePassword(password)
  const normalizedTenant = normalizeTenant(tenant)
  const ipHash = getRequestIpHash(request)
  const expiresAt = now + LOGIN_PROOF_TTL_SECONDS * 1000
  const payload = Buffer.from(
    JSON.stringify({
      email: normalizedEmail,
      tenant: normalizedTenant,
      ipHash,
      expiresAt,
      credentialDigest: buildProofCredentialDigest({
        email: normalizedEmail,
        password: normalizedPassword,
        tenant: normalizedTenant,
        ipHash,
      }),
    }),
    "utf8"
  ).toString("base64url")

  return `${payload}.${signLoginProofPayload(payload)}`
}

export function validateLoginProof({
  token,
  email,
  password,
  tenant,
  request,
  now = Date.now(),
}: {
  token: unknown
  email: unknown
  password: unknown
  tenant?: unknown
  request: RequestLike
  now?: number
}) {
  const normalizedToken = sanitizeTextInput(token, 4096)
  if (!normalizedToken) {
    return false
  }

  const [payload, signature] = normalizedToken.split(".")
  if (!payload || !signature || !timingSafeEqualText(signLoginProofPayload(payload), signature)) {
    return false
  }

  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      email?: string
      tenant?: string
      ipHash?: string
      expiresAt?: number
      credentialDigest?: string
    }

    if (!parsed.email || !parsed.credentialDigest || !parsed.expiresAt) {
      return false
    }

    if (parsed.expiresAt <= now) {
      return false
    }

    const normalizedEmail = normalizeEmail(email)
    const normalizedPassword = normalizePassword(password)
    const normalizedTenant = normalizeTenant(tenant)
    const ipHash = getRequestIpHash(request)

    if (parsed.email !== normalizedEmail || (parsed.tenant || "") !== normalizedTenant) {
      return false
    }

    if ((parsed.ipHash || "") !== ipHash) {
      return false
    }

    return timingSafeEqualText(
      parsed.credentialDigest,
      buildProofCredentialDigest({
        email: normalizedEmail,
        password: normalizedPassword,
        tenant: normalizedTenant,
        ipHash,
      })
    )
  } catch {
    return false
  }
}

export async function consumeLoginAttempt(request: Request) {
  const context = extractRequestAuditContext(request)
  if (!context.ipHash) {
    return {
      limited: false,
      retryAfterSeconds: 0,
      attemptCount: 0,
      ipHash: "",
    }
  }

  if (isDistributedRateLimitEnabled()) {
    const attemptKey = buildLoginAttemptKey(context.ipHash)
    const distributedState = await incrementDistributedRateLimitCounter(
      attemptKey,
      LOGIN_ATTEMPT_WINDOW_SECONDS
    )

    if (distributedState.source === "upstash") {
      return {
        limited: distributedState.count > LOGIN_ATTEMPT_MAX_REQUESTS,
        retryAfterSeconds:
          distributedState.count > LOGIN_ATTEMPT_MAX_REQUESTS
            ? distributedState.retryAfterSeconds
            : 0,
        attemptCount: distributedState.count,
        ipHash: context.ipHash,
      }
    }
  }

  const windowStart = new Date(Date.now() - LOGIN_ATTEMPT_WINDOW_SECONDS * 1000)
  const recentAttempts = await prisma.promptAuditLog.findMany({
    where: {
      action: "auth.login",
      resource: "auth",
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
    take: LOGIN_ATTEMPT_MAX_REQUESTS,
  })

  const oldestAttempt = recentAttempts[recentAttempts.length - 1]
  const retryAfterMs = oldestAttempt
    ? oldestAttempt.createdAt.getTime() + LOGIN_ATTEMPT_WINDOW_SECONDS * 1000 - Date.now()
    : 0

  return {
    limited: recentAttempts.length >= LOGIN_ATTEMPT_MAX_REQUESTS && retryAfterMs > 0,
    retryAfterSeconds: retryAfterMs > 0 ? Math.ceil(retryAfterMs / 1000) : 0,
    attemptCount: recentAttempts.length,
    ipHash: context.ipHash,
  }
}

export async function getLoginGuardState(request: Request) {
  const context = extractRequestAuditContext(request)
  if (!context.ipHash) {
    return {
      failureCount: 0,
      challengeRequired: false,
      limited: false,
      retryAfterSeconds: 0,
      ipHash: "",
    }
  }

  if (isDistributedRateLimitEnabled()) {
    const failureKey = buildLoginFailureKey(context.ipHash)
    const distributedState = await getDistributedRateLimitCounter(failureKey)

    if (distributedState.source === "upstash") {
      return {
        failureCount: distributedState.count,
        challengeRequired: distributedState.count >= LOGIN_CHALLENGE_FAILURE_THRESHOLD,
        limited: distributedState.count >= LOGIN_RATE_LIMIT_MAX_FAILURES,
        retryAfterSeconds:
          distributedState.count >= LOGIN_RATE_LIMIT_MAX_FAILURES
            ? distributedState.retryAfterSeconds
            : 0,
        ipHash: context.ipHash,
      }
    }
  }

  const windowStart = new Date(Date.now() - LOGIN_CHALLENGE_WINDOW_SECONDS * 1000)
  const [latestSuccess, recentFailures] = await Promise.all([
    prisma.promptAuditLog.findFirst({
      where: {
        action: "auth.login",
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
    }),
    prisma.promptAuditLog.findMany({
      where: {
        action: "auth.login",
        resource: "auth",
        status: "failure",
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
      take: LOGIN_RATE_LIMIT_MAX_FAILURES,
    }),
  ])

  const filteredFailures = latestSuccess
    ? recentFailures.filter((item) => item.createdAt > latestSuccess.createdAt)
    : recentFailures

  const oldestFailure = filteredFailures[filteredFailures.length - 1]
  const retryAfterMs = oldestFailure
    ? oldestFailure.createdAt.getTime() + LOGIN_CHALLENGE_WINDOW_SECONDS * 1000 - Date.now()
    : 0

  return {
    failureCount: filteredFailures.length,
    challengeRequired: filteredFailures.length >= LOGIN_CHALLENGE_FAILURE_THRESHOLD,
    limited: filteredFailures.length >= LOGIN_RATE_LIMIT_MAX_FAILURES && retryAfterMs > 0,
    retryAfterSeconds: retryAfterMs > 0 ? Math.ceil(retryAfterMs / 1000) : 0,
    ipHash: context.ipHash,
  }
}

export async function recordLoginFailureState(request: Request) {
  const context = extractRequestAuditContext(request)
  if (!context.ipHash) {
    return {
      failureCount: 0,
      challengeRequired: false,
      limited: false,
      retryAfterSeconds: 0,
      ipHash: "",
    }
  }

  if (isDistributedRateLimitEnabled()) {
    const failureKey = buildLoginFailureKey(context.ipHash)
    const distributedState = await incrementDistributedRateLimitCounter(
      failureKey,
      LOGIN_CHALLENGE_WINDOW_SECONDS
    )

    if (distributedState.source === "upstash") {
      return {
        failureCount: distributedState.count,
        challengeRequired: distributedState.count >= LOGIN_CHALLENGE_FAILURE_THRESHOLD,
        limited: distributedState.count >= LOGIN_RATE_LIMIT_MAX_FAILURES,
        retryAfterSeconds:
          distributedState.count >= LOGIN_RATE_LIMIT_MAX_FAILURES
            ? distributedState.retryAfterSeconds
            : 0,
        ipHash: context.ipHash,
      }
    }
  }

  return getLoginGuardState(request)
}

export async function clearLoginFailureState(request: Request) {
  const context = extractRequestAuditContext(request)
  if (!context.ipHash || !isDistributedRateLimitEnabled()) {
    return false
  }

  const failureKey = buildLoginFailureKey(context.ipHash)
  return clearDistributedRateLimitKeys([failureKey])
}
