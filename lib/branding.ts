import { sanitizeMultilineTextInput, sanitizeTextInput } from "@/lib/security"

export type BrandConfig = {
  brandName: string
  logoUrl: string
  primaryColor: string
  secondaryColor: string
  domain: string
  loginSubtitle: string
  emailSignature: string
}

export const DEFAULT_BRAND_CONFIG: BrandConfig = {
  brandName: "Aura",
  logoUrl: "",
  primaryColor: "#2563EB",
  secondaryColor: "#8B5CF6",
  domain: "",
  loginSubtitle: "登录你的 Aura 账号",
  emailSignature: "Aura Team",
}

const HEX_COLOR_PATTERN = /^#([0-9a-fA-F]{6})$/

function normalizeColor(value: unknown, fallback: string) {
  const normalized = sanitizeTextInput(value, 16).toUpperCase()
  if (HEX_COLOR_PATTERN.test(normalized)) {
    return normalized
  }
  return fallback
}

function normalizeDomain(value: unknown) {
  const raw = sanitizeTextInput(value, 120).toLowerCase()
  if (!raw) {
    return ""
  }

  const stripped = raw
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/\s+/g, "")

  return stripped
}

function normalizeLogoUrl(value: unknown) {
  const url = sanitizeTextInput(value, 400)
  if (!url) {
    return ""
  }

  if (url.startsWith("/") || url.startsWith("https://") || url.startsWith("http://")) {
    return url
  }

  return ""
}

function normalizeConfigRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {}
  }

  return value as Record<string, unknown>
}

export function sanitizeBrandConfig(input: unknown, fallback: Partial<BrandConfig> = {}): BrandConfig {
  const source = normalizeConfigRecord(input)
  return {
    brandName:
      sanitizeTextInput(source.brandName, 80) ||
      fallback.brandName ||
      DEFAULT_BRAND_CONFIG.brandName,
    logoUrl: normalizeLogoUrl(source.logoUrl) || fallback.logoUrl || DEFAULT_BRAND_CONFIG.logoUrl,
    primaryColor: normalizeColor(
      source.primaryColor,
      fallback.primaryColor || DEFAULT_BRAND_CONFIG.primaryColor
    ),
    secondaryColor: normalizeColor(
      source.secondaryColor,
      fallback.secondaryColor || DEFAULT_BRAND_CONFIG.secondaryColor
    ),
    domain: normalizeDomain(source.domain) || fallback.domain || DEFAULT_BRAND_CONFIG.domain,
    loginSubtitle:
      sanitizeTextInput(source.loginSubtitle, 120) ||
      fallback.loginSubtitle ||
      DEFAULT_BRAND_CONFIG.loginSubtitle,
    emailSignature:
      sanitizeMultilineTextInput(source.emailSignature, 240).trim() ||
      fallback.emailSignature ||
      DEFAULT_BRAND_CONFIG.emailSignature,
  }
}

export function mergeBrandConfig(
  baseConfig: Partial<BrandConfig> | null | undefined,
  partialConfig: Partial<BrandConfig> | null | undefined
) {
  return sanitizeBrandConfig(
    {
      ...(baseConfig || {}),
      ...(partialConfig || {}),
    },
    DEFAULT_BRAND_CONFIG
  )
}

export function extractBrandConfig(raw: unknown): BrandConfig {
  return sanitizeBrandConfig(raw, DEFAULT_BRAND_CONFIG)
}

export function buildBrandingCssVariables(config: BrandConfig) {
  return {
    "--aura-brand-primary": config.primaryColor,
    "--aura-brand-secondary": config.secondaryColor,
  } as const
}

export function renderBrandedEmailTemplate({
  config,
  subject,
  message,
  ctaLabel,
  ctaUrl,
}: {
  config: BrandConfig
  subject: string
  message: string
  ctaLabel: string
  ctaUrl: string
}) {
  const safeSubject = sanitizeTextInput(subject, 160) || "来自 Aura 的通知"
  const safeMessage = sanitizeMultilineTextInput(message, 2000) || "请查看最新更新。"
  const safeCtaLabel = sanitizeTextInput(ctaLabel, 40) || "查看详情"
  const safeCtaUrl = sanitizeTextInput(ctaUrl, 500) || "https://example.com"

  return `
<!doctype html>
<html lang="zh-CN">
  <body style="margin:0;padding:24px;background:#F3F4F6;font-family:'PingFang SC','Microsoft YaHei',sans-serif;">
    <table role="presentation" style="max-width:640px;width:100%;margin:0 auto;background:#FFFFFF;border-radius:14px;overflow:hidden;border:1px solid #E5E7EB;">
      <tr>
        <td style="padding:20px 24px;background:linear-gradient(135deg, ${config.primaryColor}, ${config.secondaryColor});color:#FFFFFF;">
          <p style="margin:0;font-size:14px;opacity:0.85;">${config.brandName}</p>
          <h1 style="margin:6px 0 0 0;font-size:24px;line-height:1.3;">${safeSubject}</h1>
        </td>
      </tr>
      <tr>
        <td style="padding:24px;">
          <p style="margin:0 0 16px 0;font-size:15px;line-height:1.7;color:#111827;white-space:pre-wrap;">${safeMessage}</p>
          <a href="${safeCtaUrl}" style="display:inline-block;background:${config.primaryColor};color:#FFFFFF;text-decoration:none;padding:10px 16px;border-radius:10px;font-size:14px;font-weight:600;">${safeCtaLabel}</a>
          <p style="margin:20px 0 0 0;font-size:12px;color:#6B7280;">${config.emailSignature}</p>
        </td>
      </tr>
    </table>
  </body>
</html>
  `.trim()
}
