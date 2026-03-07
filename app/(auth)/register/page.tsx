"use client"

import { useEffect, useRef, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"

import { AuthExperiencePanel } from "@/components/auth/auth-experience-panel"
import { AuthFormNotice } from "@/components/auth/auth-form-notice"
import { CaptchaPreviewButton } from "@/components/auth/captcha-preview-button"
import { PasswordField } from "@/components/auth/password-field"
import { TurnstileWidget } from "@/components/auth/turnstile-widget"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
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
const REGISTRATION_CAPTCHA_LENGTH = 5

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
  registerCaptchaPath: string
}

const DEFAULT_HUMAN_VERIFICATION: HumanVerificationRuntime = {
  provider: "captcha",
  turnstileSiteKey: null,
  registerCaptchaPath: "/api/auth/register-captcha",
}

type FormNotice = {
  tone: "error" | "warning" | "info"
  message: string
}

export default function RegisterPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const captchaInputRef = useRef<HTMLInputElement | null>(null)
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [captcha, setCaptcha] = useState("")
  const [captchaVersion, setCaptchaVersion] = useState(0)
  const [captchaFeedback, setCaptchaFeedback] = useState("")
  const [turnstileToken, setTurnstileToken] = useState("")
  const [turnstileResetCount, setTurnstileResetCount] = useState(0)
  const [humanVerification, setHumanVerification] = useState<HumanVerificationRuntime>(
    DEFAULT_HUMAN_VERIFICATION
  )
  const [touched, setTouched] = useState({
    name: false,
    email: false,
    password: false,
    confirmPassword: false,
    challenge: false,
  })
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
  const tenant = searchParams.get("tenant")?.trim() || ""

  const isTurnstileVerification =
    humanVerification.provider === "turnstile" && Boolean(humanVerification.turnstileSiteKey)
  const normalizedName = name.trim()
  const normalizedEmail = email.trim()
  const normalizedCaptcha = captcha.trim().toUpperCase()
  const nameError = !name.trim()
    ? "请输入昵称"
    : normalizedName.length < 2
      ? "昵称至少2个字符"
      : ""
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
  const confirmPasswordError = !confirmPassword
    ? "请再次输入密码"
    : confirmPassword !== password
      ? "两次输入的密码不一致"
      : ""
  const challengeError = isTurnstileVerification
    ? !turnstileToken
      ? "请完成人机验证"
      : ""
    : !normalizedCaptcha
      ? "请输入图形验证码"
      : ""
  const displayedChallengeError = captchaFeedback || challengeError

  const hasValidationError =
    Boolean(nameError) ||
    Boolean(emailError) ||
    Boolean(passwordError) ||
    Boolean(confirmPasswordError) ||
    Boolean(challengeError)
  const shouldShowNameError = (touched.name || hasSubmitted) && Boolean(nameError)
  const shouldShowEmailError = (touched.email || hasSubmitted) && Boolean(emailError)
  const shouldShowPasswordError = (touched.password || hasSubmitted) && Boolean(passwordError)
  const shouldShowConfirmPasswordError =
    (touched.confirmPassword || hasSubmitted) && Boolean(confirmPasswordError)
  const shouldShowChallengeError =
    Boolean(captchaFeedback) || ((touched.challenge || hasSubmitted) && Boolean(challengeError))

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
          registerCaptchaPath: payload.registerCaptchaPath || "/api/auth/register-captcha",
        })
      } catch (loadError) {
        console.error("Load human verification config failed:", loadError)
      }
    }

    void loadHumanVerification()
  }, [])

  useEffect(() => {
    if (isTurnstileVerification || captchaVersion === 0) {
      return
    }

    captchaInputRef.current?.focus()
  }, [captchaVersion, isTurnstileVerification])

  const clearSubmitErrors = () => {
    setNotice(null)
    setCaptchaFeedback("")
  }

  const refreshVerification = (clearInput = true) => {
    setCaptchaFeedback("")
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

  const handleVerificationRefresh = () => {
    clearSubmitErrors()
    refreshVerification()
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    clearSubmitErrors()
    setHasSubmitted(true)
    setTouched({
      name: true,
      email: true,
      password: true,
      confirmPassword: true,
      challenge: true,
    })

    if (hasValidationError) {
      return
    }

    if (ssoRuntime.enabled && ssoRuntime.enforceSso && !ssoRuntime.allowLocalFallback) {
      const message = "当前企业已启用强制 SSO，请使用企业单点登录完成注册。"
      setNotice({ tone: "info", message })
      return
    }

    setIsLoading(true)

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: normalizedName,
          email: normalizedEmail,
          password,
          captcha: normalizedCaptcha,
          turnstileToken,
          tenant,
        }),
      })

      const result = await response.json()
      if (!response.ok) {
        const nextError = result?.error || "注册失败"
        refreshVerification()

        if (CHALLENGE_ERROR_CODES.has(result?.code)) {
          setCaptchaFeedback(nextError)
        } else {
          setNotice({
            tone: result?.code === "register_rate_limited" ? "warning" : "error",
            message: nextError,
          })
        }

        return
      }

      router.push("/login?registered=true")
    } catch (submitError) {
      refreshVerification()
      setNotice({ tone: "error", message: "网络异常，请稍后再试。" })
    } finally {
      setIsLoading(false)
    }
  }

  const readinessItems = [
    { label: "昵称", ready: normalizedName.length >= 2 },
    { label: "邮箱格式", ready: EMAIL_REGEX.test(normalizedEmail) },
    { label: "密码长度", ready: password.length >= 6 },
    { label: "确认一致", ready: Boolean(confirmPassword) && confirmPassword === password },
  ]
  const experienceStats = [
    { label: "验证模式", value: isTurnstileVerification ? "Turnstile" : "内置文字验证码" },
    { label: "注册策略", value: "同 IP 成功注册进入冷却期" },
    { label: "接入方式", value: ssoRuntime.enabled ? "SSO + 本地注册" : "本地注册" },
  ]
  const experienceItems = [
    {
      title: "降低误填成本",
      description: "表单实时展示输入完成度，密码可直接查看，减少来回返工。",
    },
    {
      title: "安全动作可感知",
      description: "输入图片中的字符；失败后系统会自动刷新验证码。同一 IP 1 分钟内仅允许成功注册一次。",
    },
    {
      title: "企业接入也顺手",
      description: ssoRuntime.enabled
        ? "当前租户已开放企业 SSO，可按需切换到单点登录。"
        : "后续接入企业 SSO 时，当前页面也能平滑扩展。",
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
          eyebrow="Protected sign-up"
          title="把首个注册动作做得更轻，但不给脚本留空档。"
          description="注册页现在把输入引导、验证码刷新和频控说明合在同一条路径里，真实用户理解更快，脚本滥用也更难钻空子。"
          stats={experienceStats}
          items={experienceItems}
          footer={tenant ? `当前租户：${tenant}` : "支持品牌定制、企业 SSO 与本地账号注册"}
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
                <CardTitle className="text-center text-2xl font-semibold text-slate-950">创建账号</CardTitle>
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
                同一 IP 成功注册后进入冷却期
              </span>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700">
                {ssoRuntime.enabled ? "支持企业 SSO" : "本地账号注册"}
              </span>
            </div>
          </CardHeader>
          <form onSubmit={handleSubmit} noValidate className="w-full">
            <CardContent className="space-y-4">
              {ssoRuntime.enabled ? (
                <div className="rounded-2xl border border-blue-200 bg-blue-50/80 p-4 text-sm text-blue-800">
                  <p className="font-medium">企业单点登录已启用：{ssoRuntime.provider?.name || "SSO"}</p>
                  <p className="mt-1 text-xs leading-5 text-blue-700">
                    {ssoRuntime.enforceSso && !ssoRuntime.allowLocalFallback
                      ? "当前租户强制 SSO 注册，本地账号注册已禁用。"
                      : "你可以先完成本地注册，也可以使用企业 SSO。"}
                  </p>
                  <Button asChild variant="outline" size="sm" className="mt-3 rounded-full bg-white/80">
                    <a
                      href={`/api/sso/login?${new URLSearchParams({
                        ...(tenant ? { tenant } : {}),
                        callbackUrl: "/dashboard",
                      }).toString()}`}
                    >
                      使用企业 SSO
                    </a>
                  </Button>
                </div>
              ) : null}
              {notice ? <AuthFormNotice tone={notice.tone} message={notice.message} /> : null}
              <div className="space-y-2">
                <label htmlFor="name" className="text-sm font-medium text-slate-800">
                  昵称
                </label>
                <Input
                  id="name"
                  type="text"
                  placeholder="你的昵称"
                  value={name}
                  onChange={(event) => {
                    setName(event.target.value)
                    setTouched((previousState) => ({ ...previousState, name: true }))
                    clearSubmitErrors()
                  }}
                  onBlur={() => setTouched((previousState) => ({ ...previousState, name: true }))}
                  className={cn(
                    "rounded-xl border-slate-200 bg-white/90",
                    shouldShowNameError && "border-red-500 focus-visible:ring-red-500"
                  )}
                  aria-invalid={shouldShowNameError}
                  aria-describedby={shouldShowNameError ? "register-name-error" : undefined}
                  autoComplete="nickname"
                  required
                  disabled={isLoading}
                />
                {shouldShowNameError ? (
                  <p id="register-name-error" className="text-sm text-red-600 dark:text-red-400">
                    {nameError}
                  </p>
                ) : null}
              </div>
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
                    clearSubmitErrors()
                  }}
                  onBlur={() => setTouched((previousState) => ({ ...previousState, email: true }))}
                  className={cn(
                    "rounded-xl border-slate-200 bg-white/90",
                    shouldShowEmailError && "border-red-500 focus-visible:ring-red-500"
                  )}
                  aria-invalid={shouldShowEmailError}
                  aria-describedby={shouldShowEmailError ? "register-email-error" : undefined}
                  autoComplete="email"
                  required
                  disabled={isLoading}
                />
                {shouldShowEmailError ? (
                  <p id="register-email-error" className="text-sm text-red-600 dark:text-red-400">
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
                  placeholder="至少6位"
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value)
                    setTouched((previousState) => ({ ...previousState, password: true }))
                    clearSubmitErrors()
                  }}
                  onBlur={() => setTouched((previousState) => ({ ...previousState, password: true }))}
                  className={cn(
                    "rounded-xl border-slate-200 bg-white/90",
                    shouldShowPasswordError && "border-red-500 focus-visible:ring-red-500"
                  )}
                  aria-invalid={shouldShowPasswordError}
                  aria-describedby={shouldShowPasswordError ? "register-password-error" : undefined}
                  autoComplete="new-password"
                  required
                  disabled={isLoading}
                />
                {shouldShowPasswordError ? (
                  <p id="register-password-error" className="text-sm text-red-600 dark:text-red-400">
                    {passwordError}
                  </p>
                ) : null}
              </div>
              <div className="space-y-2">
                <label htmlFor="confirmPassword" className="text-sm font-medium text-slate-800">
                  确认密码
                </label>
                <PasswordField
                  id="confirmPassword"
                  placeholder="再次输入密码"
                  value={confirmPassword}
                  onChange={(event) => {
                    setConfirmPassword(event.target.value)
                    setTouched((previousState) => ({ ...previousState, confirmPassword: true }))
                    clearSubmitErrors()
                  }}
                  onBlur={() =>
                    setTouched((previousState) => ({ ...previousState, confirmPassword: true }))
                  }
                  className={cn(
                    "rounded-xl border-slate-200 bg-white/90",
                    shouldShowConfirmPasswordError && "border-red-500 focus-visible:ring-red-500"
                  )}
                  aria-invalid={shouldShowConfirmPasswordError}
                  aria-describedby={
                    shouldShowConfirmPasswordError ? "register-confirm-password-error" : undefined
                  }
                  autoComplete="new-password"
                  required
                  disabled={isLoading}
                />
                {shouldShowConfirmPasswordError ? (
                  <p
                    id="register-confirm-password-error"
                    className="text-sm text-red-600 dark:text-red-400"
                  >
                    {confirmPasswordError}
                  </p>
                ) : null}
              </div>
              <div className="grid gap-2 rounded-[20px] border border-slate-200 bg-slate-50/90 p-3 sm:grid-cols-4">
                {readinessItems.map((item) => (
                  <div
                    key={item.label}
                    className={cn(
                      "rounded-2xl border px-3 py-2 text-center text-xs font-medium transition-colors",
                      item.ready
                        ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                        : "border-slate-200 bg-white text-slate-500"
                    )}
                  >
                    {item.label}
                  </div>
                ))}
              </div>
              <div className="space-y-3 rounded-[22px] border border-slate-200 bg-[linear-gradient(180deg,rgba(248,250,252,0.94),rgba(255,255,255,0.92))] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      提交前验证
                    </p>
                    <p className="mt-1 text-sm leading-6 text-slate-700">
                      {isTurnstileVerification
                        ? "完成人机验证后再提交，系统会在高风险时进一步保护注册入口。"
                        : "验证码帮助区分真实用户与脚本流量，刷新后输入焦点会自动回到填写框。"}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="rounded-full px-3 text-xs text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    onClick={handleVerificationRefresh}
                    disabled={isLoading}
                  >
                    {isTurnstileVerification ? "重置验证" : "刷新验证码"}
                  </Button>
                </div>
                <div className="space-y-2">
                  <label htmlFor="captcha" className="text-sm font-medium text-slate-800">
                    {isTurnstileVerification ? "人机验证" : "图形验证码"}
                  </label>
                  {isTurnstileVerification ? (
                    <TurnstileWidget
                      siteKey={humanVerification.turnstileSiteKey || ""}
                      action="register"
                      resetSignal={turnstileResetCount}
                      onTokenChange={(token) => {
                        setTurnstileToken(token)
                        setTouched((previousState) => ({ ...previousState, challenge: true }))
                        setCaptchaFeedback("")
                        setNotice(null)
                      }}
                    />
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_180px] sm:items-center">
                      <Input
                        ref={captchaInputRef}
                        id="captcha"
                        type="text"
                        placeholder="输入右侧字符"
                        value={captcha}
                        onChange={(event) => {
                          setCaptcha(
                            event.target.value
                              .toUpperCase()
                              .replace(/[^A-Z0-9]/g, "")
                              .slice(0, REGISTRATION_CAPTCHA_LENGTH)
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
                          shouldShowChallengeError ? "register-challenge-error" : "register-challenge-help"
                        }
                        autoComplete="off"
                        spellCheck={false}
                        inputMode="text"
                        maxLength={REGISTRATION_CAPTCHA_LENGTH}
                        required
                        disabled={isLoading}
                      />
                      <CaptchaPreviewButton
                        src={`${humanVerification.registerCaptchaPath}?v=${captchaVersion}`}
                        alt="注册验证码"
                        onRefresh={handleVerificationRefresh}
                        disabled={isLoading}
                        className="sm:justify-self-end"
                      />
                    </div>
                  )}
                  <p id="register-challenge-help" className="text-xs leading-5 text-slate-500">
                    {isTurnstileVerification
                      ? "完成第三方人机验证后再提交；同一 IP 1 分钟内仅允许成功注册一次。"
                      : "输入图片中的字符；失败后系统会自动刷新验证码。同一 IP 1 分钟内仅允许成功注册一次。"}
                  </p>
                  {shouldShowChallengeError ? (
                    <p id="register-challenge-error" className="text-sm text-red-600 dark:text-red-400">
                      {displayedChallengeError}
                    </p>
                  ) : null}
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col space-y-4 pt-2">
              <Button
                type="submit"
                className="h-11 w-full rounded-xl text-sm font-semibold shadow-[0_12px_30px_rgba(37,99,235,0.18)]"
                style={{ backgroundColor: brandConfig.primaryColor }}
                disabled={isLoading}
              >
                {isLoading ? "注册中..." : "注册"}
              </Button>
              <p className="text-center text-sm text-slate-600 dark:text-slate-400">
                已有账号？{" "}
                <Link href="/login" className="font-medium text-blue-600 hover:underline">
                  立即登录
                </Link>
              </p>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  )
}
