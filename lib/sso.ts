import { IdentitySource, SsoProviderStatus, SsoProviderType } from "@prisma/client"

import { sanitizeJsonValue, sanitizeMultilineTextInput, sanitizeTextInput } from "@/lib/security"

export type SsoProviderInput = {
  id?: string
  type?: string
  status?: string
  name?: string
  issuerUrl?: string
  ssoUrl?: string
  clientId?: string
  clientSecret?: string
  domains?: unknown
  roleMapping?: unknown
  defaultRole?: string
  enforceSso?: boolean
  allowLocalFallback?: boolean
}

export type SanitizedSsoProvider = {
  type: SsoProviderType
  status: SsoProviderStatus
  name: string
  issuerUrl: string
  ssoUrl: string
  clientId: string
  clientSecret: string
  domains: string[]
  roleMapping: Record<string, string>
  defaultRole: string
  enforceSso: boolean
  allowLocalFallback: boolean
}

export const DEFAULT_SSO_PROVIDER_CONFIG: SanitizedSsoProvider = {
  type: SsoProviderType.OIDC,
  status: SsoProviderStatus.DISABLED,
  name: "企业 SSO",
  issuerUrl: "",
  ssoUrl: "",
  clientId: "",
  clientSecret: "",
  domains: [],
  roleMapping: {
    admin: "OWNER",
    member: "EDITOR",
    viewer: "VIEWER",
  },
  defaultRole: "VIEWER",
  enforceSso: false,
  allowLocalFallback: true,
}

const VALID_ROLE_PATTERN = /^(OWNER|EDITOR|REVIEWER|VIEWER)$/

function normalizeRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {}
  }
  return value as Record<string, unknown>
}

export function normalizeSsoProviderType(value: unknown) {
  const normalized = sanitizeTextInput(value, 16).toUpperCase()
  if (normalized === SsoProviderType.SAML) {
    return SsoProviderType.SAML
  }
  return SsoProviderType.OIDC
}

export function normalizeSsoProviderStatus(value: unknown) {
  const normalized = sanitizeTextInput(value, 16).toUpperCase()
  if (normalized === SsoProviderStatus.ACTIVE) {
    return SsoProviderStatus.ACTIVE
  }
  return SsoProviderStatus.DISABLED
}

function normalizeDomainList(value: unknown) {
  const source = Array.isArray(value)
    ? value
    : sanitizeMultilineTextInput(value, 800)
        .split(/[\n,;\s]+/)
        .filter(Boolean)

  const normalized = source
    .map((item) =>
      sanitizeTextInput(item, 120)
        .toLowerCase()
        .replace(/^https?:\/\//, "")
        .replace(/\/.*$/, "")
    )
    .filter(Boolean)

  return Array.from(new Set(normalized)).slice(0, 20)
}

function normalizeRoleMapping(value: unknown) {
  const raw = sanitizeJsonValue(value, {
    maxDepth: 2,
    maxKeysPerObject: 32,
    maxArrayLength: 0,
    maxStringLength: 64,
  })

  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ...DEFAULT_SSO_PROVIDER_CONFIG.roleMapping }
  }

  const mapping: Record<string, string> = {}
  for (const [key, role] of Object.entries(raw)) {
    const normalizedKey = sanitizeTextInput(key, 40).toLowerCase()
    const normalizedRole = sanitizeTextInput(role, 20).toUpperCase()
    if (!normalizedKey || !VALID_ROLE_PATTERN.test(normalizedRole)) {
      continue
    }
    mapping[normalizedKey] = normalizedRole
  }

  if (Object.keys(mapping).length === 0) {
    return { ...DEFAULT_SSO_PROVIDER_CONFIG.roleMapping }
  }

  return mapping
}

function normalizeUrl(value: unknown, maxLength: number) {
  const url = sanitizeTextInput(value, maxLength)
  if (!url) {
    return ""
  }

  if (url.startsWith("https://") || url.startsWith("http://")) {
    return url
  }

  return ""
}

export function sanitizeSsoProviderConfig(
  input: SsoProviderInput,
  fallback: Partial<SanitizedSsoProvider> = {}
): SanitizedSsoProvider {
  const source = normalizeRecord(input)
  const defaultRole = sanitizeTextInput(source.defaultRole, 20).toUpperCase()

  return {
    type: normalizeSsoProviderType(source.type || fallback.type || DEFAULT_SSO_PROVIDER_CONFIG.type),
    status: normalizeSsoProviderStatus(
      source.status || fallback.status || DEFAULT_SSO_PROVIDER_CONFIG.status
    ),
    name:
      sanitizeTextInput(source.name, 80) ||
      fallback.name ||
      DEFAULT_SSO_PROVIDER_CONFIG.name,
    issuerUrl:
      normalizeUrl(source.issuerUrl, 320) ||
      fallback.issuerUrl ||
      DEFAULT_SSO_PROVIDER_CONFIG.issuerUrl,
    ssoUrl: normalizeUrl(source.ssoUrl, 320) || fallback.ssoUrl || DEFAULT_SSO_PROVIDER_CONFIG.ssoUrl,
    clientId:
      sanitizeTextInput(source.clientId, 160) ||
      fallback.clientId ||
      DEFAULT_SSO_PROVIDER_CONFIG.clientId,
    clientSecret:
      sanitizeTextInput(source.clientSecret, 240) ||
      fallback.clientSecret ||
      DEFAULT_SSO_PROVIDER_CONFIG.clientSecret,
    domains: normalizeDomainList(source.domains || fallback.domains || []),
    roleMapping: normalizeRoleMapping(source.roleMapping || fallback.roleMapping || {}),
    defaultRole: VALID_ROLE_PATTERN.test(defaultRole)
      ? defaultRole
      : fallback.defaultRole || DEFAULT_SSO_PROVIDER_CONFIG.defaultRole,
    enforceSso:
      typeof source.enforceSso === "boolean"
        ? source.enforceSso
        : fallback.enforceSso ?? DEFAULT_SSO_PROVIDER_CONFIG.enforceSso,
    allowLocalFallback:
      typeof source.allowLocalFallback === "boolean"
        ? source.allowLocalFallback
        : fallback.allowLocalFallback ?? DEFAULT_SSO_PROVIDER_CONFIG.allowLocalFallback,
  }
}

export function toIdentitySource(providerType: SsoProviderType) {
  if (providerType === SsoProviderType.SAML) {
    return IdentitySource.SAML
  }
  return IdentitySource.OIDC
}

export function normalizeDirectoryRole(rawRole: unknown, mapping: Record<string, string>, fallback: string) {
  const key = sanitizeTextInput(rawRole, 40).toLowerCase()
  const mapped = sanitizeTextInput(mapping[key], 20).toUpperCase()
  if (VALID_ROLE_PATTERN.test(mapped)) {
    return mapped
  }

  const normalizedFallback = sanitizeTextInput(fallback, 20).toUpperCase()
  if (VALID_ROLE_PATTERN.test(normalizedFallback)) {
    return normalizedFallback
  }

  return DEFAULT_SSO_PROVIDER_CONFIG.defaultRole
}

export function buildSsoAuthorizeUrl({
  provider,
  callbackUrl,
  state,
  loginHint,
}: {
  provider: {
    type: SsoProviderType
    issuerUrl: string
    ssoUrl?: string | null
    clientId?: string | null
  }
  callbackUrl: string
  state: string
  loginHint?: string
}) {
  const authorizationEndpoint =
    provider.type === SsoProviderType.SAML
      ? provider.ssoUrl || provider.issuerUrl
      : provider.ssoUrl || `${provider.issuerUrl.replace(/\/$/, "")}/authorize`

  const params = new URLSearchParams()
  if (provider.clientId) {
    params.set("client_id", provider.clientId)
  }
  params.set("redirect_uri", callbackUrl)
  params.set("response_type", provider.type === SsoProviderType.SAML ? "saml" : "code")
  params.set("scope", "openid profile email")
  params.set("state", state)
  if (loginHint) {
    params.set("login_hint", sanitizeTextInput(loginHint, 120))
  }

  return `${authorizationEndpoint}?${params.toString()}`
}

export function maskSecret(secret: string | null | undefined) {
  const value = sanitizeTextInput(secret, 240)
  if (!value) {
    return ""
  }

  if (value.length <= 6) {
    return "******"
  }

  return `${value.slice(0, 3)}***${value.slice(-2)}`
}

export function resolveIdentityConflictReason({
  incomingEmail,
  existingEmail,
  source,
}: {
  incomingEmail: string
  existingEmail: string
  source: IdentitySource
}) {
  if (incomingEmail.toLowerCase() !== existingEmail.toLowerCase()) {
    return `外部身份在 ${source} 中的邮箱与本地账号不一致，需人工确认。`
  }

  return `外部身份在 ${source} 中发生映射冲突，需人工确认。`
}

export function hasSsoAccess(planId: string) {
  return planId === "enterprise"
}
