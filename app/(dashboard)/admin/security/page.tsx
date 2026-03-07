import {
  AlertTriangle,
  Gauge,
  LockKeyhole,
  Radar,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react"
import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"

import {
  LOGIN_ATTEMPT_MAX_REQUESTS,
  LOGIN_ATTEMPT_WINDOW_SECONDS,
  LOGIN_CHALLENGE_FAILURE_THRESHOLD,
  LOGIN_CHALLENGE_WINDOW_SECONDS,
  LOGIN_RATE_LIMIT_MAX_FAILURES,
} from "@/lib/auth-login-guard"
import { REGISTRATION_RATE_LIMIT_WINDOW_SECONDS } from "@/lib/auth-registration-guard"
import { getHumanVerificationProvider } from "@/lib/auth-human-verification"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { isDistributedRateLimitEnabled } from "@/lib/distributed-rate-limit"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export const dynamic = "force-dynamic"

const AUTH_ACTIONS = ["auth.login", "auth.register"] as const
const CHALLENGE_REASONS = new Set([
  "captcha_required",
  "captcha_missing",
  "captcha_invalid",
  "captcha_expired",
  "turnstile_required",
  "turnstile_invalid",
  "turnstile_unavailable",
])
const RATE_LIMIT_REASONS = new Set(["login_rate_limited", "register_rate_limited"])

function getMetadataRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {} as Record<string, unknown>
  }

  return value as Record<string, unknown>
}

function getMetadataString(value: unknown, key: string) {
  const record = getMetadataRecord(value)
  const target = record[key]
  return typeof target === "string" ? target : ""
}

function getLogReason(log: { metadata: unknown }) {
  return getMetadataString(log.metadata, "reason") || "success"
}

function getVerificationProvider(log: { metadata: unknown }) {
  return getMetadataString(log.metadata, "verificationProvider") || getMetadataString(log.metadata, "provider") || "captcha"
}

function shortHash(value: string | null) {
  if (!value) {
    return "-"
  }

  return `${value.slice(0, 8)}...${value.slice(-4)}`
}

function formatTimestamp(value: Date) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value)
}

function formatWindow(seconds: number) {
  if (seconds % 60 === 0) {
    return `${seconds / 60} 分钟`
  }

  return `${seconds} 秒`
}

function resolveActionLabel(action: string) {
  if (action === "auth.login") {
    return "登录"
  }

  if (action === "auth.register") {
    return "注册"
  }

  return action
}

function resolveReasonLabel(reason: string) {
  const reasonMap: Record<string, string> = {
    success: "通过",
    invalid_credentials: "账号或密码错误",
    login_rate_limited: "登录限流",
    register_rate_limited: "注册限流",
    email_exists: "邮箱重复",
    captcha_required: "缺少验证码",
    captcha_missing: "验证码失效",
    captcha_invalid: "验证码错误",
    captcha_expired: "验证码过期",
    turnstile_required: "缺少第三方验证",
    turnstile_invalid: "第三方验证失败",
    turnstile_unavailable: "第三方验证不可用",
  }

  return reasonMap[reason] || reason
}

export default async function AdminSecurityPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    redirect("/login")
  }

  const now = Date.now()
  const dayAgo = new Date(now - 24 * 60 * 60 * 1000)
  const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000)

  const [recentAuthLogs, loginFailure24h, loginSuccess24h, registerFailure24h, registerSuccess24h] =
    await Promise.all([
      prisma.promptAuditLog.findMany({
        where: {
          resource: "auth",
          action: {
            in: [...AUTH_ACTIONS],
          },
          createdAt: {
            gte: weekAgo,
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        select: {
          id: true,
          action: true,
          status: true,
          riskLevel: true,
          ipHash: true,
          metadata: true,
          createdAt: true,
        },
        take: 240,
      }),
      prisma.promptAuditLog.count({
        where: {
          resource: "auth",
          action: "auth.login",
          status: "failure",
          createdAt: {
            gte: dayAgo,
          },
        },
      }),
      prisma.promptAuditLog.count({
        where: {
          resource: "auth",
          action: "auth.login",
          status: "success",
          createdAt: {
            gte: dayAgo,
          },
        },
      }),
      prisma.promptAuditLog.count({
        where: {
          resource: "auth",
          action: "auth.register",
          status: "failure",
          createdAt: {
            gte: dayAgo,
          },
        },
      }),
      prisma.promptAuditLog.count({
        where: {
          resource: "auth",
          action: "auth.register",
          status: "success",
          createdAt: {
            gte: dayAgo,
          },
        },
      }),
    ])

  const recent24hLogs = recentAuthLogs.filter((item) => item.createdAt >= dayAgo)
  const rateLimited24h = recent24hLogs.filter((item) => RATE_LIMIT_REASONS.has(getLogReason(item))).length
  const challengeRejected24h = recent24hLogs.filter((item) => CHALLENGE_REASONS.has(getLogReason(item))).length

  const topIpRows = Array.from(
    recentAuthLogs.reduce((accumulator, item) => {
      if (item.status !== "failure" || !item.ipHash) {
        return accumulator
      }

      const current = accumulator.get(item.ipHash) || {
        ipHash: item.ipHash,
        failures: 0,
        latestReason: "success",
      }
      current.failures += 1
      current.latestReason = getLogReason(item)
      accumulator.set(item.ipHash, current)
      return accumulator
    }, new Map<string, { ipHash: string; failures: number; latestReason: string }>())
      .values()
  )
    .sort((left, right) => right.failures - left.failures)
    .slice(0, 5)

  const reasonRows = Array.from(
    recent24hLogs.reduce((accumulator, item) => {
      const reason = getLogReason(item)
      accumulator.set(reason, (accumulator.get(reason) || 0) + 1)
      return accumulator
    }, new Map<string, number>()).entries()
  )
    .sort((left, right) => right[1] - left[1])
    .slice(0, 6)

  const verificationProvider = getHumanVerificationProvider()
  const rateLimitBackend = isDistributedRateLimitEnabled() ? "Upstash Redis" : "本地审计窗口"

  return (
    <div className="space-y-6">
      <Card className="border-slate-200 bg-[linear-gradient(135deg,rgba(15,23,42,0.03),rgba(245,158,11,0.08),rgba(255,255,255,0.92))]">
        <CardHeader>
          <div className="flex flex-wrap items-center gap-3">
            <CardTitle>认证安全风控</CardTitle>
            <Badge variant="secondary">无第三方模式已收紧阈值</Badge>
            <Badge>{verificationProvider === "turnstile" ? "Turnstile" : "内置文字验证码"}</Badge>
            <Badge variant="outline">{rateLimitBackend}</Badge>
          </div>
          <CardDescription>
            汇总最近 24 小时注册/登录防刷表现，重点观察验证码拦截、登录爆破和同 IP 重复注册。
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-emerald-200/70 bg-white/80 p-4 shadow-sm">
            <div className="flex items-center gap-3 text-emerald-700">
              <ShieldCheck className="h-4 w-4" />
              <p className="text-xs font-semibold uppercase tracking-[0.16em]">24h 注册成功</p>
            </div>
            <p className="mt-3 text-3xl font-semibold text-slate-900">{registerSuccess24h}</p>
            <p className="mt-1 text-xs text-slate-500">登录成功 {loginSuccess24h} 次</p>
          </div>
          <div className="rounded-2xl border border-amber-200/70 bg-white/80 p-4 shadow-sm">
            <div className="flex items-center gap-3 text-amber-700">
              <ShieldAlert className="h-4 w-4" />
              <p className="text-xs font-semibold uppercase tracking-[0.16em]">24h 注册拦截</p>
            </div>
            <p className="mt-3 text-3xl font-semibold text-slate-900">{registerFailure24h}</p>
            <p className="mt-1 text-xs text-slate-500">同 IP 注册、重复邮箱、验证码失败均记入</p>
          </div>
          <div className="rounded-2xl border border-rose-200/70 bg-white/80 p-4 shadow-sm">
            <div className="flex items-center gap-3 text-rose-700">
              <LockKeyhole className="h-4 w-4" />
              <p className="text-xs font-semibold uppercase tracking-[0.16em]">24h 登录失败</p>
            </div>
            <p className="mt-3 text-3xl font-semibold text-slate-900">{loginFailure24h}</p>
            <p className="mt-1 text-xs text-slate-500">其中验证失败 {challengeRejected24h} 次</p>
          </div>
          <div className="rounded-2xl border border-sky-200/70 bg-white/80 p-4 shadow-sm">
            <div className="flex items-center gap-3 text-sky-700">
              <Radar className="h-4 w-4" />
              <p className="text-xs font-semibold uppercase tracking-[0.16em]">24h 限流命中</p>
            </div>
            <p className="mt-3 text-3xl font-semibold text-slate-900">{rateLimited24h}</p>
            <p className="mt-1 text-xs text-slate-500">覆盖登录高频请求与重复注册</p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Gauge className="h-4 w-4 text-amber-600" />
              <CardTitle className="text-lg">当前策略</CardTitle>
            </div>
            <CardDescription>当前未启用 Turnstile / Redis，因此登录阈值按更严格的内置模式执行。</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-border bg-muted/20 p-4">
              <p className="text-xs text-muted-foreground">注册成功频控</p>
              <p className="mt-1 text-lg font-semibold">同一 IP {formatWindow(REGISTRATION_RATE_LIMIT_WINDOW_SECONDS)} 内仅 1 次成功注册</p>
            </div>
            <div className="rounded-xl border border-border bg-muted/20 p-4">
              <p className="text-xs text-muted-foreground">登录触发验证</p>
              <p className="mt-1 text-lg font-semibold">连续失败 {LOGIN_CHALLENGE_FAILURE_THRESHOLD} 次后强制验证码</p>
            </div>
            <div className="rounded-xl border border-border bg-muted/20 p-4">
              <p className="text-xs text-muted-foreground">登录失败封禁</p>
              <p className="mt-1 text-lg font-semibold">{formatWindow(LOGIN_CHALLENGE_WINDOW_SECONDS)} 内失败 {LOGIN_RATE_LIMIT_MAX_FAILURES} 次</p>
            </div>
            <div className="rounded-xl border border-border bg-muted/20 p-4">
              <p className="text-xs text-muted-foreground">登录高频限速</p>
              <p className="mt-1 text-lg font-semibold">{formatWindow(LOGIN_ATTEMPT_WINDOW_SECONDS)} 内最多 {LOGIN_ATTEMPT_MAX_REQUESTS} 次请求</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-4 w-4 text-rose-600" />
              <CardTitle className="text-lg">热点原因</CardTitle>
            </div>
            <CardDescription>最近 24 小时命中最多的认证事件原因。</CardDescription>
          </CardHeader>
          <CardContent>
            {reasonRows.length === 0 ? (
              <p className="text-sm text-muted-foreground">最近 24 小时暂无认证审计事件。</p>
            ) : (
              <div className="space-y-2">
                {reasonRows.map(([reason, count]) => (
                  <div
                    key={reason}
                    className="flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/20 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {resolveReasonLabel(reason)}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">{reason}</p>
                    </div>
                    <span className="text-sm font-semibold text-foreground">{count}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">热点 IP Hash</CardTitle>
            <CardDescription>仅展示已哈希后的标识，避免暴露真实 IP。</CardDescription>
          </CardHeader>
          <CardContent>
            {topIpRows.length === 0 ? (
              <p className="text-sm text-muted-foreground">最近 7 天暂无失败请求。</p>
            ) : (
              <div className="space-y-2">
                {topIpRows.map((item) => (
                  <div
                    key={item.ipHash}
                    className="rounded-xl border border-border bg-muted/20 px-3 py-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-mono text-sm text-foreground">{shortHash(item.ipHash)}</p>
                      <span className="text-sm font-semibold text-foreground">{item.failures} 次失败</span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      最近原因：{resolveReasonLabel(item.latestReason)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">最近安全事件</CardTitle>
            <CardDescription>最近 7 天内的登录/注册审计记录，方便快速查看风控命中走势。</CardDescription>
          </CardHeader>
          <CardContent>
            {recentAuthLogs.length === 0 ? (
              <p className="text-sm text-muted-foreground">暂无认证安全事件。</p>
            ) : (
              <div className="space-y-2">
                {recentAuthLogs.slice(0, 18).map((item) => {
                  const reason = getLogReason(item)
                  return (
                    <div
                      key={item.id}
                      className="grid gap-2 rounded-xl border border-border bg-background px-3 py-3 md:grid-cols-[96px_72px_minmax(0,1fr)_110px_120px] md:items-center"
                    >
                      <p className="text-xs text-muted-foreground">{formatTimestamp(item.createdAt)}</p>
                      <div className="flex items-center gap-2">
                        <Badge variant={item.status === "success" ? "secondary" : "outline"}>
                          {resolveActionLabel(item.action)}
                        </Badge>
                        <Badge variant={item.status === "success" ? "secondary" : "outline"}>
                          {item.status === "success" ? "成功" : "失败"}
                        </Badge>
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">
                          {resolveReasonLabel(reason)}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">{reason}</p>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {getVerificationProvider(item) === "turnstile" ? "Turnstile" : "内置验证"}
                      </p>
                      <p className="font-mono text-xs text-muted-foreground">{shortHash(item.ipHash)}</p>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
