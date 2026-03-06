"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"

import type { BrandConfig } from "@/lib/branding"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toaster"

type BrandCustomizationPanelProps = {
  draftConfig: BrandConfig
  publishedConfig: BrandConfig | null
  status: "DRAFT" | "PUBLISHED"
  publishedAt: string | null
}

async function requestJson(path: string, init: RequestInit) {
  const response = await fetch(path, init)
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(String(payload?.error || "请求失败"))
  }
  return payload
}

function hexWithAlpha(hex: string, alpha: string) {
  return `${hex}${alpha}`
}

export function BrandCustomizationPanel({
  draftConfig,
  publishedConfig,
  status,
  publishedAt,
}: BrandCustomizationPanelProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [draft, setDraft] = useState<BrandConfig>(draftConfig)
  const [emailSubject, setEmailSubject] = useState("Aura 通知：请查看最新评测结果")
  const [emailMessage, setEmailMessage] = useState("你好，\n本次回归评测已完成，请尽快检查失败断言并处理。")
  const [emailHtml, setEmailHtml] = useState("")
  const [pendingAction, setPendingAction] = useState<string | null>(null)

  const previewLoginUrl = useMemo(() => {
    if (!draft.domain) {
      return "/login"
    }
    return `/login?tenant=${encodeURIComponent(draft.domain)}`
  }, [draft.domain])

  async function runAction(actionKey: string, fn: () => Promise<unknown>, success: string) {
    setPendingAction(actionKey)
    try {
      await fn()
      toast({ title: success, type: "success" })
      router.refresh()
    } catch (error) {
      toast({
        title: "操作失败",
        description: error instanceof Error ? error.message : "请稍后重试",
        type: "error",
      })
    } finally {
      setPendingAction(null)
    }
  }

  function updateDraft<K extends keyof BrandConfig>(key: K, value: BrandConfig[K]) {
    setDraft((prev) => ({
      ...prev,
      [key]: value,
    }))
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3 lg:grid-cols-2">
        <label className="space-y-1.5">
          <span className="text-sm text-muted-foreground">品牌名称</span>
          <input
            value={draft.brandName}
            onChange={(event) => updateDraft("brandName", event.target.value)}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            placeholder="例如：Aura Enterprise"
          />
        </label>
        <label className="space-y-1.5">
          <span className="text-sm text-muted-foreground">品牌 Logo 地址</span>
          <input
            value={draft.logoUrl}
            onChange={(event) => updateDraft("logoUrl", event.target.value)}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            placeholder="https://example.com/logo.svg"
          />
        </label>
        <label className="space-y-1.5">
          <span className="text-sm text-muted-foreground">主色（HEX）</span>
          <input
            value={draft.primaryColor}
            onChange={(event) => updateDraft("primaryColor", event.target.value)}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            placeholder="#2563EB"
          />
        </label>
        <label className="space-y-1.5">
          <span className="text-sm text-muted-foreground">辅助色（HEX）</span>
          <input
            value={draft.secondaryColor}
            onChange={(event) => updateDraft("secondaryColor", event.target.value)}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            placeholder="#8B5CF6"
          />
        </label>
        <label className="space-y-1.5">
          <span className="text-sm text-muted-foreground">租户域名标识</span>
          <input
            value={draft.domain}
            onChange={(event) => updateDraft("domain", event.target.value)}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            placeholder="tenant.example.com"
          />
        </label>
        <label className="space-y-1.5">
          <span className="text-sm text-muted-foreground">登录页副标题</span>
          <input
            value={draft.loginSubtitle}
            onChange={(event) => updateDraft("loginSubtitle", event.target.value)}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            placeholder="登录你的企业工作台"
          />
        </label>
        <label className="space-y-1.5 lg:col-span-2">
          <span className="text-sm text-muted-foreground">邮件签名</span>
          <textarea
            value={draft.emailSignature}
            onChange={(event) => updateDraft("emailSignature", event.target.value)}
            className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder="Aura Enterprise Platform Team"
          />
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          disabled={pendingAction !== null}
          onClick={() =>
            runAction(
              "save-draft",
              () =>
                requestJson("/api/branding", {
                  method: "PUT",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(draft),
                }),
              "品牌草稿保存成功"
            )
          }
        >
          {pendingAction === "save-draft" ? "保存中..." : "保存草稿"}
        </Button>
        <Button
          variant="outline"
          disabled={pendingAction !== null}
          onClick={() =>
            runAction(
              "publish",
              () =>
                requestJson("/api/branding/publish", {
                  method: "POST",
                }),
              "品牌配置已发布"
            )
          }
        >
          {pendingAction === "publish" ? "发布中..." : "发布品牌"}
        </Button>
        <Button asChild variant="outline">
          <a href={previewLoginUrl} target="_blank" rel="noreferrer">
            预览登录页品牌
          </a>
        </Button>
      </div>

      <div className="rounded-lg border border-border bg-muted/20 p-4 text-sm">
        <p className="font-medium">发布状态：{status}</p>
        <p className="mt-1 text-muted-foreground">
          发布时间：{publishedAt ? new Date(publishedAt).toLocaleString("zh-CN") : "-"}
        </p>
        {publishedConfig ? (
          <p className="mt-1 text-muted-foreground">
            当前生效品牌：{publishedConfig.brandName}（{publishedConfig.domain || "未配置域名"}）
          </p>
        ) : (
          <p className="mt-1 text-muted-foreground">当前还没有已发布品牌配置。</p>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-background p-4">
          <p className="text-sm font-medium">登录页预览（草稿）</p>
          <div
            className="mt-3 rounded-xl border border-white/50 p-4"
            style={{
              background: `linear-gradient(135deg, ${hexWithAlpha(draft.primaryColor, "22")}, ${hexWithAlpha(
                draft.secondaryColor,
                "22"
              )})`,
            }}
          >
            <div className="rounded-lg border border-border bg-white p-4 shadow-sm">
              <p className="text-xs text-muted-foreground">{draft.brandName}</p>
              <p className="mt-1 text-lg font-semibold">欢迎回来</p>
              <p className="mt-1 text-sm text-muted-foreground">{draft.loginSubtitle}</p>
              <div className="mt-3 h-9 rounded-md text-center text-sm font-medium leading-9 text-white" style={{ backgroundColor: draft.primaryColor }}>
                登录
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-background p-4">
          <p className="text-sm font-medium">邮件模板预览（草稿）</p>
          <div className="mt-3 space-y-2">
            <input
              value={emailSubject}
              onChange={(event) => setEmailSubject(event.target.value)}
              aria-label="邮件标题"
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              placeholder="邮件标题"
            />
            <textarea
              value={emailMessage}
              onChange={(event) => setEmailMessage(event.target.value)}
              aria-label="邮件正文"
              className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="邮件正文"
            />
            <Button
              variant="outline"
              size="sm"
              disabled={pendingAction !== null}
              onClick={() =>
                runAction(
                  "email-preview",
                  async () => {
                    const payload = await requestJson("/api/branding/email-template", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        subject: emailSubject,
                        message: emailMessage,
                        ctaLabel: "查看详情",
                        ctaUrl: "https://aura.local/dashboard",
                      }),
                    })
                    setEmailHtml(String(payload.html || ""))
                  },
                  "邮件模板已生成"
                )
              }
            >
              {pendingAction === "email-preview" ? "生成中..." : "生成邮件模板"}
            </Button>
            {emailHtml ? (
              <iframe
                title="branding-email-preview"
                srcDoc={emailHtml}
                className="h-64 w-full rounded-md border border-border"
              />
            ) : (
              <p className="text-xs text-muted-foreground">点击“生成邮件模板”查看品牌化邮件效果。</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
