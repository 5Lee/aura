"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/components/ui/toaster"
import { DEFAULT_BRAND_CONFIG, type BrandConfig } from "@/lib/branding"
import { cn } from "@/lib/utils"

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function RegisterPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [touched, setTouched] = useState({
    name: false,
    email: false,
    password: false,
    confirmPassword: false,
  })
  const [hasSubmitted, setHasSubmitted] = useState(false)
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [brandConfig, setBrandConfig] = useState<BrandConfig>(DEFAULT_BRAND_CONFIG)
  const tenant = searchParams.get("tenant")?.trim() || ""

  const normalizedName = name.trim()
  const normalizedEmail = email.trim()
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

  const hasValidationError =
    Boolean(nameError) ||
    Boolean(emailError) ||
    Boolean(passwordError) ||
    Boolean(confirmPasswordError)
  const shouldShowNameError = (touched.name || hasSubmitted) && Boolean(nameError)
  const shouldShowEmailError = (touched.email || hasSubmitted) && Boolean(emailError)
  const shouldShowPasswordError = (touched.password || hasSubmitted) && Boolean(passwordError)
  const shouldShowConfirmPasswordError =
    (touched.confirmPassword || hasSubmitted) && Boolean(confirmPasswordError)

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
      } catch (error) {
        console.error("Load branding runtime failed:", error)
      }
    }

    void loadBranding()
  }, [tenant])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setHasSubmitted(true)
    setTouched({
      name: true,
      email: true,
      password: true,
      confirmPassword: true,
    })

    if (hasValidationError) {
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
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || "注册失败")
        toast({
          type: "error",
          title: "注册失败",
          description: data.error || "请稍后重试。",
        })
        return
      }

      toast({
        type: "success",
        title: "注册成功",
        description: "账号创建成功，请继续登录。",
      })
      router.push("/login?registered=true")
    } catch (error) {
      setError("注册失败，请重试")
      toast({
        type: "error",
        title: "注册失败",
        description: "网络异常，请稍后重试。",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen overflow-y-auto px-4 py-6 sm:flex sm:items-center sm:justify-center sm:p-4"
      style={{
        background: `linear-gradient(135deg, ${brandConfig.primaryColor}18, #ffffff, ${brandConfig.secondaryColor}18)`,
      }}
    >
      <Card className="w-full max-w-md border-white/60 bg-white/90 backdrop-blur">
        <CardHeader className="space-y-1">
          <div className="flex flex-col items-center gap-2">
            {brandConfig.logoUrl ? (
              <img
                src={brandConfig.logoUrl}
                alt={`${brandConfig.brandName} logo`}
                className="h-10 w-auto rounded-md object-contain"
              />
            ) : null}
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              {brandConfig.brandName}
            </p>
          </div>
          <CardTitle className="text-2xl font-bold text-center">创建账号</CardTitle>
          <CardDescription className="text-center">
            {brandConfig.loginSubtitle}
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit} className="w-full">
          <CardContent className="space-y-4">
            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <label htmlFor="name" className="text-sm font-medium">
                昵称
              </label>
              <Input
                id="name"
                type="text"
                placeholder="你的昵称"
                value={name}
                onChange={(e) => {
                  setName(e.target.value)
                  setTouched((prev) => ({ ...prev, name: true }))
                  setError("")
                }}
                onBlur={() => setTouched((prev) => ({ ...prev, name: true }))}
                className={cn(shouldShowNameError && "border-red-500 focus-visible:ring-red-500")}
                aria-invalid={shouldShowNameError}
                aria-describedby={shouldShowNameError ? "register-name-error" : undefined}
                required
                disabled={isLoading}
              />
              {shouldShowNameError && (
                <p id="register-name-error" className="text-sm text-red-600 dark:text-red-400">
                  {nameError}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium">
                邮箱
              </label>
              <Input
                id="email"
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  setTouched((prev) => ({ ...prev, email: true }))
                  setError("")
                }}
                onBlur={() => setTouched((prev) => ({ ...prev, email: true }))}
                className={cn(shouldShowEmailError && "border-red-500 focus-visible:ring-red-500")}
                aria-invalid={shouldShowEmailError}
                aria-describedby={shouldShowEmailError ? "register-email-error" : undefined}
                required
                disabled={isLoading}
              />
              {shouldShowEmailError && (
                <p id="register-email-error" className="text-sm text-red-600 dark:text-red-400">
                  {emailError}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium">
                密码
              </label>
              <Input
                id="password"
                type="password"
                placeholder="至少6位"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  setTouched((prev) => ({ ...prev, password: true }))
                  setError("")
                }}
                onBlur={() => setTouched((prev) => ({ ...prev, password: true }))}
                className={cn(shouldShowPasswordError && "border-red-500 focus-visible:ring-red-500")}
                aria-invalid={shouldShowPasswordError}
                aria-describedby={shouldShowPasswordError ? "register-password-error" : undefined}
                required
                disabled={isLoading}
              />
              {shouldShowPasswordError && (
                <p id="register-password-error" className="text-sm text-red-600 dark:text-red-400">
                  {passwordError}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <label htmlFor="confirmPassword" className="text-sm font-medium">
                确认密码
              </label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="再次输入密码"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value)
                  setTouched((prev) => ({ ...prev, confirmPassword: true }))
                  setError("")
                }}
                onBlur={() => setTouched((prev) => ({ ...prev, confirmPassword: true }))}
                className={cn(
                  shouldShowConfirmPasswordError && "border-red-500 focus-visible:ring-red-500"
                )}
                aria-invalid={shouldShowConfirmPasswordError}
                aria-describedby={
                  shouldShowConfirmPasswordError ? "register-confirm-password-error" : undefined
                }
                required
                disabled={isLoading}
              />
              {shouldShowConfirmPasswordError && (
                <p
                  id="register-confirm-password-error"
                  className="text-sm text-red-600 dark:text-red-400"
                >
                  {confirmPasswordError}
                </p>
              )}
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <Button
              type="submit"
              className="w-full"
              style={{ backgroundColor: brandConfig.primaryColor }}
              disabled={isLoading}
            >
              {isLoading ? "注册中..." : "注册"}
            </Button>
            <p className="text-sm text-center text-gray-600 dark:text-gray-400">
              已有账号？{" "}
              <Link href="/login" className="text-blue-600 hover:underline">
                立即登录
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
