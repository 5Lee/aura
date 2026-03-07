import { createCookieHeader, resolveE2EUrl, updateCookieJar } from "./playwright-helpers.js"

export const liveBaseURL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000"

const liveRunEnabled = ["1", "true", "yes"].includes(
  String(process.env.AURA_E2E_LIVE || "").toLowerCase()
)

const withCookieHeader = (cookieJar, headers = {}) => {
  const cookie = createCookieHeader(cookieJar)

  return cookie
    ? {
        ...headers,
        cookie,
      }
    : { ...headers }
}

export const ensureLiveAppReady = async (label) => {
  if (!liveRunEnabled) {
    console.log(`[${label}] skipped; set AURA_E2E_LIVE=1 to run against a live app`)
    return false
  }

  const reachable = await fetch(resolveE2EUrl("/", liveBaseURL), {
    redirect: "manual",
  }).then((response) => response.ok).catch(() => false)

  if (!reachable) {
    throw new Error(`Live app is not reachable at ${liveBaseURL}`)
  }

  return true
}

export const requestText = async (pathname, cookieJar, init = {}) => {
  const response = await fetch(resolveE2EUrl(pathname, liveBaseURL), {
    redirect: init.redirect ?? "manual",
    ...init,
    headers: withCookieHeader(cookieJar, init.headers),
  })

  updateCookieJar(cookieJar, response.headers)

  return {
    response,
    text: await response.text(),
  }
}

export const requestJson = async (pathname, cookieJar, init = {}) => {
  const { response, text } = await requestText(pathname, cookieJar, init)

  return {
    response,
    text,
    payload: text ? JSON.parse(text) : null,
  }
}

export const requestCaptchaChallenge = async (pathname, cookieJar) => {
  const challenge = await requestText(pathname, cookieJar)
  const code = Array.from(challenge.text.matchAll(/<text\b[^>]*>([^<]+)<\/text>/g))
    .map((match) => match[1] || "")
    .join("")
    .trim()

  return {
    ...challenge,
    code,
  }
}

export const loginWithCredentials = async (cookieJar, email, password, options = {}) => {
  const tenant = String(options.tenant || "")
  const captcha = String(options.captcha || "")
  const turnstileToken = String(options.turnstileToken || "")

  const precheck = await requestJson("/api/auth/validate-credentials", cookieJar, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      email,
      password,
      tenant,
      captcha,
      turnstileToken,
    }),
  })

  if (!precheck.payload?.ok || !precheck.payload?.loginProof) {
    return precheck
  }

  const csrf = await requestJson("/api/auth/csrf", cookieJar)
  const csrfToken = csrf.payload?.csrfToken

  if (!csrfToken) {
    throw new Error("Missing CSRF token for credentials login")
  }

  return requestJson("/api/auth/callback/credentials?json=true", cookieJar, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      csrfToken,
      email,
      password,
      tenant,
      loginProof: precheck.payload.loginProof,
      callbackUrl: resolveE2EUrl("/", liveBaseURL),
      json: "true",
      redirect: "false",
    }),
  })
}

export const logoutWithSession = async (cookieJar) => {
  const csrf = await requestJson("/api/auth/csrf", cookieJar)
  const csrfToken = csrf.payload?.csrfToken

  if (!csrfToken) {
    throw new Error("Missing CSRF token for sign-out")
  }

  return requestJson(
    `/api/auth/signout?callbackUrl=${encodeURIComponent(resolveE2EUrl("/", liveBaseURL))}`,
    cookieJar,
    {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        csrfToken,
        callbackUrl: resolveE2EUrl("/", liveBaseURL),
        json: "true",
      }),
    }
  )
}

export const createSummaryHtml = (title, details) => {
  const items = details.map((detail) => `<li>${detail}</li>`).join("")
  return `<!DOCTYPE html><html><body><h1>${title}</h1><ul>${items}</ul></body></html>`
}

export const normalizeHtmlText = (value) =>
  value.replace(/<!-- -->/g, "").replace(/\s+/g, " ").trim()

export const cleanupLiveTestUser = async (prisma, userEmail) => {
  await prisma.prompt.deleteMany({
    where: {
      author: {
        email: userEmail,
      },
    },
  })

  await prisma.user.deleteMany({
    where: {
      email: userEmail,
    },
  })
}
