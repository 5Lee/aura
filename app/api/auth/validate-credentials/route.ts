import { NextResponse } from "next/server"

import {
  clearLoginFailureState,
  consumeLoginAttempt,
  createLoginProof,
  getLoginCaptchaTokenFromRequest,
  getLoginGuardState,
  LOGIN_CAPTCHA_COOKIE_NAME,
  recordLoginFailureState,
  validateLoginCaptchaToken,
} from "@/lib/auth-login-guard"
import {
  getHumanVerificationProvider,
  verifyTurnstileToken,
} from "@/lib/auth-human-verification"
import { verifyUserCredentials } from "@/lib/auth-credentials"
import { recordPromptAuditLog } from "@/lib/prompt-audit-log"
import { sanitizeTextInput } from "@/lib/security"
import { getCredentialGuardForEmail, getSsoRuntimePolicy } from "@/lib/sso-server"

const INVALID_CREDENTIALS_RESPONSE = {
  ok: false,
  error: "邮箱或密码错误",
  code: "invalid_credentials",
}

function clearLoginCaptchaCookie(response: NextResponse) {
  response.cookies.set(LOGIN_CAPTCHA_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/api/auth",
    maxAge: 0,
  })

  return response
}

export async function POST(request: Request) {
  try {
    const { email, password, tenant, captcha, turnstileToken } = await request.json()
    const verificationProvider = getHumanVerificationProvider()
    const normalizedEmail = sanitizeTextInput(email, 160).toLowerCase()
    const tenantDomain = sanitizeTextInput(tenant, 120).toLowerCase()

    if (!normalizedEmail || !password) {
      return NextResponse.json({
        ...INVALID_CREDENTIALS_RESPONSE,
        code: "invalid_input",
      })
    }

    const attemptState = await consumeLoginAttempt(request)
    if (attemptState.limited) {
      await recordPromptAuditLog({
        action: "auth.login",
        resource: "auth",
        status: "failure",
        request,
        metadata: {
          reason: "login_rate_limited",
          retryAfterSeconds: attemptState.retryAfterSeconds,
          verificationProvider,
        },
      })

      return clearLoginCaptchaCookie(
        NextResponse.json(
          {
            ok: false,
            error: `登录尝试过于频繁，请 ${attemptState.retryAfterSeconds} 秒后再试。`,
            code: "login_rate_limited",
            retryAfterSeconds: attemptState.retryAfterSeconds,
            challengeRequired: true,
            verificationProvider,
          },
          {
            status: 429,
            headers: {
              "Retry-After": String(attemptState.retryAfterSeconds),
            },
          }
        )
      )
    }

    if (tenantDomain) {
      const runtime = await getSsoRuntimePolicy({ tenantDomain })
      if (runtime.enabled && runtime.enforceSso && !runtime.allowLocalFallback) {
        return NextResponse.json({
          ok: false,
          error: "当前企业已启用强制 SSO，请使用企业单点登录。",
          code: "sso_required",
        })
      }
    }

    const guard = await getCredentialGuardForEmail(normalizedEmail)
    if (!guard.allowed) {
      return NextResponse.json({
        ok: false,
        error: guard.reason || "当前企业已启用强制 SSO，请使用企业单点登录。",
        code: "sso_required",
      })
    }

    const loginGuardState = await getLoginGuardState(request)
    if (loginGuardState.limited) {
      return clearLoginCaptchaCookie(
        NextResponse.json(
          {
            ok: false,
            error: `登录失败次数过多，请 ${loginGuardState.retryAfterSeconds} 秒后再试。`,
            code: "login_rate_limited",
            retryAfterSeconds: loginGuardState.retryAfterSeconds,
            challengeRequired: true,
            verificationProvider,
          },
          {
            status: 429,
            headers: {
              "Retry-After": String(loginGuardState.retryAfterSeconds),
            },
          }
        )
      )
    }

    if (loginGuardState.challengeRequired) {
      const humanCheck =
        verificationProvider === "turnstile"
          ? await verifyTurnstileToken({
              token: turnstileToken,
              request,
              action: "login",
            })
          : validateLoginCaptchaToken(getLoginCaptchaTokenFromRequest(request), captcha)

      if (!humanCheck.ok) {
        await recordPromptAuditLog({
          action: "auth.login",
          resource: "auth",
          status: "failure",
          request,
          metadata: {
            reason: humanCheck.code,
            verificationProvider,
          },
        })

        const failureState = await recordLoginFailureState(request)
        if (failureState.limited) {
          return clearLoginCaptchaCookie(
            NextResponse.json(
              {
                ok: false,
                error: `登录失败次数过多，请 ${failureState.retryAfterSeconds} 秒后再试。`,
                code: "login_rate_limited",
                retryAfterSeconds: failureState.retryAfterSeconds,
                challengeRequired: true,
                verificationProvider,
              },
              {
                status: 429,
                headers: {
                  "Retry-After": String(failureState.retryAfterSeconds),
                },
              }
            )
          )
        }

        return clearLoginCaptchaCookie(
          NextResponse.json(
            {
              ok: false,
              error: humanCheck.message,
              code: humanCheck.code,
              challengeRequired: true,
              verificationProvider,
            },
            { status: 400 }
          )
        )
      }
    }

    const user = await verifyUserCredentials(normalizedEmail, password)
    if (!user) {
      await recordPromptAuditLog({
        action: "auth.login",
        resource: "auth",
        status: "failure",
        request,
        metadata: {
          reason: "invalid_credentials",
          verificationProvider,
        },
      })

      const failureState = await recordLoginFailureState(request)
      if (failureState.limited) {
        return clearLoginCaptchaCookie(
          NextResponse.json(
            {
              ok: false,
              error: `登录失败次数过多，请 ${failureState.retryAfterSeconds} 秒后再试。`,
              code: "login_rate_limited",
              retryAfterSeconds: failureState.retryAfterSeconds,
              challengeRequired: true,
              verificationProvider,
            },
            {
              status: 429,
              headers: {
                "Retry-After": String(failureState.retryAfterSeconds),
              },
            }
          )
        )
      }

      return clearLoginCaptchaCookie(
        NextResponse.json({
          ...INVALID_CREDENTIALS_RESPONSE,
          challengeRequired: failureState.challengeRequired,
          verificationProvider,
        })
      )
    }

    await recordPromptAuditLog({
      action: "auth.login",
      resource: "auth",
      request,
      metadata: {
        verificationProvider,
        challengeRequired: loginGuardState.challengeRequired,
        guard: "adaptive_login_guard",
      },
    })

    await clearLoginFailureState(request)

    return clearLoginCaptchaCookie(
      NextResponse.json({
        ok: true,
        loginProof: createLoginProof({
          email: normalizedEmail,
          password,
          tenant: tenantDomain,
          request,
        }),
      })
    )
  } catch (error) {
    console.error("Credential validation failed:", error)
    return NextResponse.json(
      { ok: false, error: "登录校验失败，请稍后重试", code: "login_validation_failed" },
      { status: 500 }
    )
  }
}
