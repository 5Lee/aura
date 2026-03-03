"use client"

import { useEffect, useRef, useState } from "react"
import { signIn } from "next-auth/react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/components/ui/toaster"
import { cn } from "@/lib/utils"

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const hasShownRegisteredNotice = useRef(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [touched, setTouched] = useState({ email: false, password: false })
  const [hasSubmitted, setHasSubmitted] = useState(false)
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const callbackUrl = searchParams.get("callbackUrl")
  const safeCallbackUrl = callbackUrl?.startsWith("/") ? callbackUrl : "/dashboard"

  const normalizedEmail = email.trim()
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

  const shouldShowEmailError = (touched.email || hasSubmitted) && Boolean(emailError)
  const shouldShowPasswordError = (touched.password || hasSubmitted) && Boolean(passwordError)

  useEffect(() => {
    if (searchParams.get("registered") !== "true" || hasShownRegisteredNotice.current) {
      return
    }

    toast({
      type: "info",
      title: "注册已完成",
      description: "请使用新账号登录 Aura。",
    })
    hasShownRegisteredNotice.current = true
    const nextParams = new URLSearchParams(searchParams.toString())
    nextParams.delete("registered")
    const nextUrl = nextParams.size > 0 ? `/login?${nextParams.toString()}` : "/login"
    router.replace(nextUrl)
  }, [router, searchParams, toast])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setHasSubmitted(true)
    setTouched({ email: true, password: true })

    if (emailError || passwordError) {
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
        }),
      })

      const precheckResult = await precheckResponse.json()
      if (!precheckResponse.ok) {
        setError(precheckResult.error || "登录失败，请重试")
        toast({
          type: "error",
          title: "登录失败",
          description: precheckResult.error || "网络异常，请稍后再试。",
        })
        return
      }

      if (!precheckResult.ok) {
        setError("邮箱或密码错误")
        toast({
          type: "error",
          title: "登录失败",
          description: "邮箱或密码错误，请检查后重试。",
        })
        return
      }

      const result = await signIn("credentials", {
        email: normalizedEmail,
        password,
        redirect: false,
      })

      if (result?.error) {
        setError("邮箱或密码错误")
        toast({
          type: "error",
          title: "登录失败",
          description: "邮箱或密码错误，请检查后重试。",
        })
      } else {
        toast({
          type: "success",
          title: "登录成功",
          description: "欢迎回来，正在进入控制台。",
        })
        router.push(safeCallbackUrl)
        router.refresh()
      }
    } catch (error) {
      setError("登录失败，请重试")
      toast({
        type: "error",
        title: "登录失败",
        description: "网络异常，请稍后再试。",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen overflow-y-auto bg-gradient-to-br from-blue-50 via-white to-purple-50 px-4 py-6 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 sm:flex sm:items-center sm:justify-center sm:p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">欢迎回来</CardTitle>
          <CardDescription className="text-center">
            登录你的 Aura 账号
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit} noValidate className="w-full">
          <CardContent className="space-y-4">
            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400">
                {error}
              </div>
            )}
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
                aria-describedby={shouldShowEmailError ? "login-email-error" : undefined}
                disabled={isLoading}
              />
              {shouldShowEmailError && (
                <p id="login-email-error" className="text-sm text-red-600 dark:text-red-400">
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
                placeholder="••••••••"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  setTouched((prev) => ({ ...prev, password: true }))
                  setError("")
                }}
                onBlur={() => setTouched((prev) => ({ ...prev, password: true }))}
                className={cn(shouldShowPasswordError && "border-red-500 focus-visible:ring-red-500")}
                aria-invalid={shouldShowPasswordError}
                aria-describedby={shouldShowPasswordError ? "login-password-error" : undefined}
                disabled={isLoading}
              />
              {shouldShowPasswordError && (
                <p id="login-password-error" className="text-sm text-red-600 dark:text-red-400">
                  {passwordError}
                </p>
              )}
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <Button
              type="submit"
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? "登录中..." : "登录"}
            </Button>
            <p className="text-sm text-center text-gray-600 dark:text-gray-400">
              还没有账号？{" "}
              <Link href="/register" className="text-blue-600 hover:underline">
                立即注册
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
