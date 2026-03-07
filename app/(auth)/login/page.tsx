"use client"

import { useEffect, useRef, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { signIn } from "next-auth/react"
import { useRouter, useSearchParams } from "next/navigation"

import { AuthExperiencePanel } from "@/components/auth/auth-experience-panel"
import { AuthFormNotice } from "@/components/auth/auth-form-notice"
import { CaptchaPreviewButton } from "@/components/auth/captcha-preview-button"
import { PasswordField } from "@/components/auth/password-field"
import { TurnstileWidget } from "@/components/auth/turnstile-widget"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useToast } from "@/components/ui/toaster"
import { DEFAULT_BRAND_CONFIG, type BrandConfig } from "@/lib/branding"
import { cn } from "@/lib/utils"

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const CHALLENGE_ERROR_CODES = new Set([
  "captcha_required",
  "captcha_missing",
  "captcha_invalid",
  "captcha_expired",
  "turnstile_required",
  "turnstile_invalid",
  "turnstile_unavailable",
])
const LOGIN_CAPTCHA_LENGTH = 5

type SsoRuntimeState = {
  enabled: boolean
  enforceSso: boolean
  allowLocalFallback: boolean
  provider: {
    id: string
    type: string
    name: string
  } | null
}

type HumanVerificationRuntime = {
  provider: "captcha" | "turnstile"
  turnstileSiteKey: string | null
  loginCaptchaPath: string
}

const DEFAULT_HUMAN_VERIFICATION: HumanVerificationRuntime = {
  provider: "captcha",
  turnstileSiteKey: null,
  loginCaptchaPath: "/api/auth/login-captcha",
}

type FormNotice = {
  tone: "error" | "warning" | "info"
  message: string
}

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const hasShownRegisteredNotice = useRef(false)
  const captchaInputRef = useRef<HTMLInputElement | null>(null)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [captcha, setCaptcha] = useState("")
  const [captchaVersion, setCaptchaVersion] = useState(0)
  const [challengeFeedback, setChallengeFeedback] = useState("")
  const [requiresChallenge, setRequiresChallenge] = useState(false)
  const [turnstileToken, setTurnstileToken] = useState("")
  const [turnstileResetCount, setTurnstileResetCount] = useState(0)
  const [humanVerification, setHumanVerification] = useState<HumanVerificationRuntime>(
    DEFAULT_HUMAN_VERIFICATION
  )
  const [touched, setTouched] = useState({ email: false, password: false, challenge: false })
  const [hasSubmitted, setHasSubmitted] = useState(false)
  const [notice, setNotice] = useState<FormNotice | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [brandConfig, setBrandConfig] = useState<BrandConfig>(DEFAULT_BRAND_CONFIG)
  const [ssoRuntime, setSsoRuntime] = useState<SsoRuntimeState>({
    enabled: false,
    enforceSso: false,
    allowLocalFallback: true,
    provider: null,
  })
  const [showRegisteredBanner, setShowRegisteredBanner] = useState(
    searchParams.get("registered") === "true"
  )
  const callbackUrl = searchParams.get("callbackUrl")
  const tenant = searchParams.get("tenant")?.trim() || ""
  const safeCallbackUrl = callbackUrl?.startsWith("/") ? callbackUrl : "/dashboard"

  const isTurnstileVerification =
    humanVerification.provider === "turnstile" && Boolean(humanVerification.turnstileSiteKey)
  const normalizedEmail = email.trim()
  const normalizedCaptcha = captcha.trim().toUpperCase()
  const emailError = !email.trim()
    ? "请输入邮箱地址"
    : !EMAIL_REGEX.test(normalizedEmail)
      ? "请输入有效的邮箱地址"
      : ""
  const passwordError = !password
    ? "请输入密码"
    : password.length < 6
      ? "密码长度至少为6位"
      : ""
  const challengeError = !requiresChallenge
    ? ""
    : isTurnstileVerification
      ? !turnstileToken
        ? "请完成人机验证"
        : ""
      : !normalizedCaptcha
        ? "请输入图形验证码"
        : ""

  const shouldShowEmailError = (touched.email || hasSubmitted) && Boolean(emailError)
  const shouldShowPasswordError = (touched.password || hasSubmitted) && Boolean(passwordError)
  const shouldShowChallengeError =
    Boolean(challengeFeedback) || ((touched.challenge || hasSubmitted) && Boolean(challengeError))

  useEffect(() => {
    if (searchParams.get("registered") !== "true" || hasShownRegisteredNotice.current) {
      return
    }

    setShowRegisteredBanner(true)
    hasShownRegisteredNotice.current = true
    const nextParams = new URLSearchParams(searchParams.toString())
    nextParams.delete("registered")
    const nextUrl = nextParams.size > 0 ? `/login?${nextParams.toString()}` : "/login"
    router.replace(nextUrl)
  }, [router, searchParams])

  useEffect(() => {
    const loadBranding = async () => {
      try {
        const query = tenant ? `?tenant=${encodeURIComponent(tenant)}` : ""
        const response = await fetch(`/api/branding/runtime${query}`)
        if (!response.ok) {
          return
        }
        const payload = await response.json()
        if (payload?.config) {
          setBrandConfig({
            ...DEFAULT_BRAND_CONFIG,
            ...payload.config,
          })
        }
      } catch (loadError) {
        console.error("Load branding runtime failed:", loadError)
      }
    }

    void loadBranding()
  }, [tenant])

  useEffect(() => {
    const loadSsoRuntime = async () => {
      try {
        const query = tenant ? `?tenant=${encodeURIComponent(tenant)}` : ""
        const response = await fetch(`/api/sso/runtime${query}`)
        if (!response.ok) {
          return
        }
        const payload = await response.json()
        setSsoRuntime({
          enabled: Boolean(payload?.enabled),
          enforceSso: Boolean(payload?.enforceSso),
          allowLocalFallback:
            typeof payload?.allowLocalFallback === "boolean"
              ? payload.allowLocalFallback
              : true,
          provider: payload?.provider || null,
        })
      } catch (loadError) {
        console.error("Load sso runtime failed:", loadError)
      }
    }

    void loadSsoRuntime()
  }, [tenant])

  useEffect(() => {
    const loadHumanVerification = async () => {
      try {
        const response = await fetch("/api/auth/human-verification-config")
        if (!response.ok) {
          return
        }
        const payload = (await response.json()) as Partial<HumanVerificationRuntime>
        setHumanVerification({
          provider: payload.provider === "turnstile" ? "turnstile" : "captcha",
          turnstileSiteKey: payload.turnstileSiteKey || null,
          loginCaptchaPath: payload.loginCaptchaPath || "/api/auth/login-captcha",
        })
      } catch (loadError) {
        console.error("Load human verification config failed:", loadError)
      }
    }

    void loadHumanVerification()
  }, [])

  useEffect(() => {
    if (!requiresChallenge || isTurnstileVerification || captchaVersion === 0) {
      return
    }

    captchaInputRef.current?.focus()
  }, [captchaVersion, isTurnstileVerification, requiresChallenge])

  const clearSubmitErrors = () => {
    setNotice(null)
    setChallengeFeedback("")
  }

  const refreshChallenge = (clearInput = true) => {
    setChallengeFeedback("")

    if (isTurnstileVerification) {
      if (clearInput) {
        setTurnstileToken("")
      }
      setTurnstileResetCount((currentValue) => currentValue + 1)
      return
    }

    setCaptchaVersion((currentValue) => currentValue + 1)
    if (clearInput) {
      setCaptcha("")
    }
  }

  const handleChallengeRefresh = () => {
    clearSubmitErrors()
    refreshChallenge()
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    clearSubmitErrors()
    setHasSubmitted(true)
    setTouched({
      email: true,
      password: true,
      challenge: requiresChallenge,
    })

    if (ssoRuntime.enabled && ssoRuntime.enforceSso && !ssoRuntime.allowLocalFallback) {
      const message = "当前企业已启用强制 SSO，请使用企业单点登录。"
      setNotice({ tone: "info", message })
      return
    }

    if (emailError || passwordError || challengeError) {
      return
    }

    setIsLoading(true)

    try {
      const precheckResponse = await fetch("/api/auth/validate-credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: normalizedEmail,
          password,
          tenant,
          captcha: normalizedCaptcha,
          turnstileToken,
        }),
      })

      const precheckResult = await precheckResponse.json()
      if (!precheckResult.ok) {
        const nextError = precheckResult.error || "登录失败，请重试"
        const nextRequiresChallenge = Boolean(precheckResult.challengeRequired)

        if (nextRequiresChallenge) {
          setRequiresChallenge(true)
          refreshChallenge()
        }

        if (CHALLENGE_ERROR_CODES.has(precheckResult.code)) {
          setChallengeFeedback(nextError)
        } else {
          setNotice({
            tone: precheckResult.code === "login_rate_limited" ? "warning" : "error",
            message: nextError,
          })
        }

        return
      }

      if (!precheckResult.loginProof) {
        setNotice({ tone: "error", message: "登录校验失败，请重试" })
        return
      }

      const result = await signIn("credentials", {
        email: normalizedEmail,
        password,
        tenant,
        loginProof: precheckResult.loginProof,
        redirect: false,
      })

      if (result?.error) {
        const nextError = result.error.includes("校验") ? result.error : "邮箱或密码错误"
        setNotice({ tone: "error", message: nextError })
        return
      }

      toast({
        type: "success",
        title: "登录成功",
        description: "欢迎回来，正在进入控制台。",
      })
      router.push(safeCallbackUrl)
      router.refresh()
    } catch (submitError) {
      setNotice({ tone: "error", message: "网络异常，请稍后再试。" })
    } finally {
      setIsLoading(false)
    }
  }

  const experienceStats = [
    { label: "验证模式", value: isTurnstileVerification ? "Turnstile" : "内置文字验证码" },
    { label: "登录入口", value: ssoRuntime.enabled ? "SSO + 本地账号" : "本地账号" },
    { label: "当前状态", value: requiresChallenge ? "安全核验中" : "平稳登录" },
  ]
  const experienceItems = [
    {
      title: "先顺滑，再逐步加固",
      description: "连续输错多次后将启用人机验证，正常用户先走最短路径，异常请求再进入核验。",
    },
    {
      title: "风险流量会被收束",
      description: "同一 IP 的异常登录请求会被临时限制，减少脚本撞库和高频尝试对页面的打扰。",
    },
    {
      title: "登录后直达目标页面",
      description: safeCallbackUrl === "/dashboard" ? "登录成功后直接进入控制台。" : `登录成功后回到 ${safeCallbackUrl}。`,
    },
  ]

  return (
    <div
      className="relative min-h-screen overflow-hidden px-4 py-6 sm:px-6 sm:py-8"
      style={{
        background: `linear-gradient(135deg, ${brandConfig.primaryColor}18, #f8fafc, ${brandConfig.secondaryColor}18)`,
      }}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-80"
        style={{
          background: `radial-gradient(circle at top left, ${brandConfig.primaryColor}16, transparent 38%), radial-gradient(circle at bottom right, ${brandConfig.secondaryColor}14, transparent 34%)`,
        }}
      />
      <div className="relative mx-auto grid w-full max-w-6xl gap-6 lg:grid-cols-[minmax(0,1.05fr)_460px] lg:items-center">
        <AuthExperiencePanel
          brandConfig={brandConfig}
          eyebrow="Secure sign-in"
          title="把风控藏在顺滑体验里，而不是把用户挡在门外。"
          description="登录流程优先保障真实用户的直达路径，当风险升高时再切换到验证码与频控，交互反馈更清楚、切换也更自然。"
          stats={experienceStats}
          items={experienceItems}
          footer={tenant ? `当前租户：${tenant}` : "支持品牌定制、企业 SSO 与本地账号并行"}
        />

        <Card className="w-full border-white/60 bg-white/92 shadow-[0_24px_80px_rgba(15,23,42,0.14)] backdrop-blur xl:justify-self-end">
          <CardHeader className="space-y-5 pb-3">
            <div className="flex flex-col items-center gap-3 text-center">
              {brandConfig.logoUrl ? (
                <Image
                  src={brandConfig.logoUrl}
                  alt={`${brandConfig.brandName} logo`}
                  width={160}
                  height={40}
                  unoptimized
                  className="h-10 w-auto rounded-md object-contain"
                />
              ) : null}
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">
                  {brandConfig.brandName}
                </p>
                <CardTitle className="text-center text-2xl font-semibold text-slate-950">欢迎回来</CardTitle>
                <CardDescription className="text-center text-sm leading-6">
                  {brandConfig.loginSubtitle}
                </CardDescription>
              </div>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700">
                {isTurnstileVerification ? "第三方验证待命" : "内置文字验证码"}
              </span>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700">
                {ssoRuntime.enabled ? "支持企业 SSO" : "本地账号登录"}
              </span>
              <span
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium",
                  requiresChallenge
                    ? "border-amber-200 bg-amber-50 text-amber-800"
                    : "border-emerald-200 bg-emerald-50 text-emerald-800"
                )}
              >
                {requiresChallenge ? "安全验证已开启" : "异常时自动触发验证"}
              </span>
            </div>
          </CardHeader>
          <form onSubmit={handleSubmit} noValidate className="w-full">
            <CardContent className="space-y-4">
              {showRegisteredBanner ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/90 px-4 py-3 text-sm text-emerald-800" aria-live="polite">
                  注册已完成，请使用新账号登录 Aura。
                </div>
              ) : null}
              {ssoRuntime.enabled ? (
                <div className="rounded-2xl border border-blue-200 bg-blue-50/80 p-4 text-sm text-blue-800">
                  <p className="font-medium">企业单点登录已启用：{ssoRuntime.provider?.name || "SSO"}</p>
                  <p className="mt-1 text-xs leading-5 text-blue-700">
                    {ssoRuntime.enforceSso && !ssoRuntime.allowLocalFallback
                      ? "当前租户强制 SSO 登录，密码登录已禁用。"
                      : "你可以使用企业 SSO 登录，也可继续使用本地账号。"}
                  </p>
                  <Button asChild variant="outline" size="sm" className="mt-3 rounded-full bg-white/80">
                    <a
                      href={`/api/sso/login?${new URLSearchParams({
                        ...(tenant ? { tenant } : {}),
                        callbackUrl: safeCallbackUrl,
                      }).toString()}`}
                    >
                      使用企业 SSO 登录
                    </a>
                  </Button>
                </div>
              ) : null}
              {notice ? <AuthFormNotice tone={notice.tone} message={notice.message} /> : null}
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium text-slate-800">
                  邮箱
                </label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value)
                    setTouched((previousState) => ({ ...previousState, email: true }))
                    setShowRegisteredBanner(false)
                    clearSubmitErrors()
                  }}
                  onBlur={() => setTouched((previousState) => ({ ...previousState, email: true }))}
                  className={cn(
                    "rounded-xl border-slate-200 bg-white/90",
                    shouldShowEmailError && "border-red-500 focus-visible:ring-red-500"
                  )}
                  aria-invalid={shouldShowEmailError}
                  aria-describedby={shouldShowEmailError ? "login-email-error" : undefined}
                  autoComplete="email"
                  disabled={isLoading}
                />
                {shouldShowEmailError ? (
                  <p id="login-email-error" className="text-sm text-red-600 dark:text-red-400">
                    {emailError}
                  </p>
                ) : null}
              </div>
              <div className="space-y-2">
                <label htmlFor="password" className="text-sm font-medium text-slate-800">
                  密码
                </label>
                <PasswordField
                  id="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value)
                    setTouched((previousState) => ({ ...previousState, password: true }))
                    setShowRegisteredBanner(false)
                    clearSubmitErrors()
                  }}
                  onBlur={() => setTouched((previousState) => ({ ...previousState, password: true }))}
                  className={cn(
                    "rounded-xl border-slate-200 bg-white/90",
                    shouldShowPasswordError && "border-red-500 focus-visible:ring-red-500"
                  )}
                  aria-invalid={shouldShowPasswordError}
                  aria-describedby={shouldShowPasswordError ? "login-password-error" : undefined}
                  autoComplete="current-password"
                  disabled={isLoading}
                />
                {shouldShowPasswordError ? (
                  <p id="login-password-error" className="text-sm text-red-600 dark:text-red-400">
                    {passwordError}
                  </p>
                ) : null}
              </div>
              {requiresChallenge ? (
                <div className="space-y-3 rounded-[22px] border border-amber-200 bg-[linear-gradient(180deg,rgba(255,251,235,0.96),rgba(255,255,255,0.92))] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">
                        安全验证已开启
                      </p>
                      <p className="mt-1 text-sm leading-6 text-slate-700">
                        检测到风险后，当前登录会补充一次人机核验，完成后再继续提交。
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="rounded-full px-3 text-xs text-amber-700 hover:bg-amber-100 hover:text-amber-800"
                      onClick={handleChallengeRefresh}
                      disabled={isLoading}
                    >
                      {isTurnstileVerification ? "重置验证" : "刷新验证码"}
                    </Button>
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="login-captcha" className="text-sm font-medium text-slate-800">
                      {isTurnstileVerification ? "人机验证" : "图形验证码"}
                    </label>
                    {isTurnstileVerification ? (
                      <TurnstileWidget
                        siteKey={humanVerification.turnstileSiteKey || ""}
                        action="login"
                        resetSignal={turnstileResetCount}
                        onTokenChange={(token) => {
                          setTurnstileToken(token)
                          setTouched((previousState) => ({ ...previousState, challenge: true }))
                          clearSubmitErrors()
                        }}
                      />
                    ) : (
                      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_180px] sm:items-center">
                        <Input
                          ref={captchaInputRef}
                          id="login-captcha"
                          type="text"
                          placeholder="输入右侧字符"
                          value={captcha}
                          onChange={(event) => {
                            setCaptcha(
                              event.target.value
                                .toUpperCase()
                                .replace(/[^A-Z0-9]/g, "")
                                .slice(0, LOGIN_CAPTCHA_LENGTH)
                            )
                            setTouched((previousState) => ({ ...previousState, challenge: true }))
                            clearSubmitErrors()
                          }}
                          onBlur={() =>
                            setTouched((previousState) => ({ ...previousState, challenge: true }))
                          }
                          className={cn(
                            "rounded-xl border-slate-200 bg-white/90 tracking-[0.32em] uppercase",
                            shouldShowChallengeError && "border-red-500 focus-visible:ring-red-500"
                          )}
                          aria-invalid={shouldShowChallengeError}
                          aria-describedby={
                            shouldShowChallengeError ? "login-challenge-error" : "login-challenge-help"
                          }
                          autoComplete="off"
                          spellCheck={false}
                          inputMode="text"
                          maxLength={LOGIN_CAPTCHA_LENGTH}
                          disabled={isLoading}
                        />
                        <CaptchaPreviewButton
                          src={`${humanVerification.loginCaptchaPath}?v=${captchaVersion}`}
                          alt="登录验证码"
                          onRefresh={handleChallengeRefresh}
                          disabled={isLoading}
                          className="sm:justify-self-end"
                        />
                      </div>
                    )}
                    <p id="login-challenge-help" className="text-xs leading-5 text-slate-500">
                      {isTurnstileVerification
                        ? "检测到连续失败后，已启用第三方人机验证。完成验证后再继续登录。"
                        : "检测到连续失败后，已启用图形验证码。输入图片中的字符后再继续登录。"}
                    </p>
                    {shouldShowChallengeError ? (
                      <p id="login-challenge-error" className="text-sm text-red-600 dark:text-red-400">
                        {challengeFeedback || challengeError}
                      </p>
                    ) : null}
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-slate-200 bg-slate-50/90 px-4 py-3 text-xs leading-5 text-slate-600">
                  连续输错多次后将启用人机验证；同一 IP 的异常登录请求会被临时限制。
                </div>
              )}
            </CardContent>
            <CardFooter className="flex flex-col space-y-4 pt-2">
              <Button
                type="submit"
                className="h-11 w-full rounded-xl text-sm font-semibold shadow-[0_12px_30px_rgba(37,99,235,0.18)]"
                style={{ backgroundColor: brandConfig.primaryColor }}
                aria-disabled={
                  isLoading || (ssoRuntime.enabled && ssoRuntime.enforceSso && !ssoRuntime.allowLocalFallback)
                }
                disabled={isLoading}
              >
                {isLoading ? "登录中..." : "登录"}
              </Button>
              <p className="text-center text-sm text-slate-600 dark:text-slate-400">
                还没有账号？{" "}
                <Link href="/register" className="font-medium text-blue-600 hover:underline">
                  立即注册
                </Link>
              </p>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  )
}
