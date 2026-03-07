import { createHash, createHmac, randomInt, randomUUID, timingSafeEqual } from "node:crypto"

import { sanitizeTextInput } from "@/lib/security"

const CAPTCHA_CHARSET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
const CAPTCHA_LENGTH = 5
const CAPTCHA_WIDTH = 180
const CAPTCHA_HEIGHT = 64
const CAPTCHA_PADDING = 22

export const AUTH_CAPTCHA_TTL_SECONDS = 5 * 60

const hashText = (value: string) => createHash("sha256").update(value).digest("hex")

const resolveCaptchaSecret = () =>
  process.env.AUTH_CAPTCHA_SECRET ||
  process.env.REGISTRATION_GUARD_SECRET ||
  process.env.NEXTAUTH_SECRET ||
  "aura-dev-auth-captcha"

const signCaptchaPayload = (payload: string) =>
  createHmac("sha256", resolveCaptchaSecret()).update(payload).digest("base64url")

const randomFromCharset = (length: number) =>
  Array.from({ length }, () => CAPTCHA_CHARSET[randomInt(0, CAPTCHA_CHARSET.length)]).join("")

const timingSafeEqualText = (left: string, right: string) => {
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)

  if (leftBuffer.length !== rightBuffer.length) {
    return false
  }

  return timingSafeEqual(leftBuffer, rightBuffer)
}

export const normalizeCaptchaInput = (value: unknown) =>
  sanitizeTextInput(value, 16)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")

const buildCaptchaAnswerHash = (scope: string, nonce: string, answer: string) =>
  hashText(`auth-captcha:${scope}:${nonce}:${normalizeCaptchaInput(answer)}`)

export function parseCookieValue(cookieHeader: string | null, name: string) {
  if (!cookieHeader) {
    return null
  }

  const prefix = `${name}=`
  for (const entry of cookieHeader.split(";")) {
    const trimmed = entry.trim()
    if (trimmed.startsWith(prefix)) {
      return trimmed.slice(prefix.length)
    }
  }

  return null
}

export function buildCaptchaSvg(code: string, label = "图形验证码") {
  const normalizedCode = normalizeCaptchaInput(code)
  const backgroundSeed = randomInt(1000, 9999)
  const lineMarkup = Array.from({ length: 6 }, (_, index) => {
    const x1 = randomInt(0, CAPTCHA_WIDTH)
    const y1 = randomInt(0, CAPTCHA_HEIGHT)
    const x2 = randomInt(0, CAPTCHA_WIDTH)
    const y2 = randomInt(0, CAPTCHA_HEIGHT)
    const opacity = (0.18 + index * 0.08).toFixed(2)
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="rgba(71,85,105,${opacity})" stroke-width="1.4" />`
  }).join("")

  const dotMarkup = Array.from({ length: 14 }, () => {
    const cx = randomInt(8, CAPTCHA_WIDTH - 8)
    const cy = randomInt(8, CAPTCHA_HEIGHT - 8)
    const radius = randomInt(1, 3)
    const opacity = (0.12 + randomInt(0, 12) / 100).toFixed(2)
    return `<circle cx="${cx}" cy="${cy}" r="${radius}" fill="rgba(30,41,59,${opacity})" />`
  }).join("")

  const characterGap = (CAPTCHA_WIDTH - CAPTCHA_PADDING * 2) / normalizedCode.length
  const textMarkup = normalizedCode
    .split("")
    .map((char, index) => {
      const x = CAPTCHA_PADDING + index * characterGap + randomInt(-3, 4)
      const y = 38 + randomInt(-6, 7)
      const rotate = randomInt(-18, 19)
      const hue = 210 + randomInt(-18, 22)
      return `<text x="${x}" y="${y}" font-family="'Courier New', monospace" font-size="30" font-weight="700" fill="hsl(${hue} 70% 28%)" transform="rotate(${rotate} ${x} ${y})">${char}</text>`
    })
    .join("")

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${CAPTCHA_WIDTH}" height="${CAPTCHA_HEIGHT}" viewBox="0 0 ${CAPTCHA_WIDTH} ${CAPTCHA_HEIGHT}" role="img" aria-label="${label}">`,
    "<defs>",
    `<linearGradient id="captcha-bg-${backgroundSeed}" x1="0%" y1="0%" x2="100%" y2="100%">`,
    '<stop offset="0%" stop-color="#f8fafc" />',
    '<stop offset="100%" stop-color="#dbeafe" />',
    "</linearGradient>",
    "</defs>",
    `<rect width="${CAPTCHA_WIDTH}" height="${CAPTCHA_HEIGHT}" rx="14" fill="url(#captcha-bg-${backgroundSeed})" />`,
    '<rect x="1" y="1" width="178" height="62" rx="13" fill="none" stroke="rgba(148,163,184,0.55)" />',
    lineMarkup,
    dotMarkup,
    textMarkup,
    "</svg>",
  ].join("")
}

export function createCaptchaChallenge({
  scope,
  label,
  now = Date.now(),
}: {
  scope: string
  label: string
  now?: number
}) {
  const code = randomFromCharset(CAPTCHA_LENGTH)
  const nonce = randomUUID()
  const expiresAt = now + AUTH_CAPTCHA_TTL_SECONDS * 1000
  const payload = Buffer.from(
    JSON.stringify({
      scope,
      nonce,
      expiresAt,
      answerHash: buildCaptchaAnswerHash(scope, nonce, code),
    }),
    "utf8"
  ).toString("base64url")
  const signature = signCaptchaPayload(payload)

  return {
    code,
    token: `${payload}.${signature}`,
    expiresAt,
    svg: buildCaptchaSvg(code, label),
  }
}

export function validateCaptchaChallenge({
  scope,
  token,
  answer,
  now = Date.now(),
}: {
  scope: string
  token: string | null
  answer: unknown
  now?: number
}) {
  const normalizedAnswer = normalizeCaptchaInput(answer)
  if (!normalizedAnswer) {
    return {
      ok: false,
      code: "captcha_required",
      message: "请输入验证码。",
    }
  }

  if (!token) {
    return {
      ok: false,
      code: "captcha_missing",
      message: "验证码已失效，请刷新后重试。",
    }
  }

  const [payload, signature] = token.split(".")
  if (!payload || !signature || !timingSafeEqualText(signCaptchaPayload(payload), signature)) {
    return {
      ok: false,
      code: "captcha_invalid",
      message: "验证码错误，请刷新后重试。",
    }
  }

  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      scope?: string
      nonce?: string
      expiresAt?: number
      answerHash?: string
    }

    if (!parsed.scope || !parsed.nonce || !parsed.answerHash || !parsed.expiresAt) {
      return {
        ok: false,
        code: "captcha_invalid",
        message: "验证码错误，请刷新后重试。",
      }
    }

    if (parsed.scope !== scope) {
      return {
        ok: false,
        code: "captcha_invalid",
        message: "验证码错误，请刷新后重试。",
      }
    }

    if (parsed.expiresAt <= now) {
      return {
        ok: false,
        code: "captcha_expired",
        message: "验证码已过期，请刷新后重试。",
      }
    }

    const expectedAnswerHash = buildCaptchaAnswerHash(scope, parsed.nonce, normalizedAnswer)
    if (!timingSafeEqualText(expectedAnswerHash, parsed.answerHash)) {
      return {
        ok: false,
        code: "captcha_invalid",
        message: "验证码错误，请刷新后重试。",
      }
    }

    return {
      ok: true,
    }
  } catch {
    return {
      ok: false,
      code: "captcha_invalid",
      message: "验证码错误，请刷新后重试。",
    }
  }
}
