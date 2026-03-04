import { SsoProviderStatus } from "@prisma/client"
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"

import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { maskSecret, sanitizeSsoProviderConfig } from "@/lib/sso"
import { hasEnterpriseSsoAccess, getUserEntitlementSnapshot } from "@/lib/subscription-entitlements"

function parseStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as string[]
  }
  return value.filter((item) => typeof item === "string")
}

function parseRoleMapping(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {} as Record<string, string>
  }
  const mapping: Record<string, string> = {}
  for (const [key, role] of Object.entries(value)) {
    if (typeof role !== "string") {
      continue
    }
    mapping[key] = role
  }
  return mapping
}

function toProviderResponse(provider: {
  id: string
  type: string
  status: SsoProviderStatus
  name: string
  issuerUrl: string
  ssoUrl: string | null
  clientId: string | null
  clientSecret: string | null
  domains: unknown
  roleMapping: unknown
  defaultRole: string
  enforceSso: boolean
  allowLocalFallback: boolean
  lastSyncedAt: Date | null
  updatedAt: Date
}) {
  return {
    id: provider.id,
    type: provider.type,
    status: provider.status,
    name: provider.name,
    issuerUrl: provider.issuerUrl,
    ssoUrl: provider.ssoUrl || "",
    clientId: provider.clientId || "",
    clientSecretMasked: maskSecret(provider.clientSecret),
    hasClientSecret: Boolean(provider.clientSecret),
    domains: parseStringArray(provider.domains),
    roleMapping: parseRoleMapping(provider.roleMapping),
    defaultRole: provider.defaultRole,
    enforceSso: provider.enforceSso,
    allowLocalFallback: provider.allowLocalFallback,
    lastSyncedAt: provider.lastSyncedAt?.toISOString() ?? null,
    updatedAt: provider.updatedAt.toISOString(),
  }
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 })
  }

  const entitlement = await getUserEntitlementSnapshot(session.user.id)
  if (!hasEnterpriseSsoAccess(entitlement.plan.id)) {
    return NextResponse.json(
      {
        error: "SSO 与企业身份集成仅对 Enterprise 套餐开放",
        upgradeRequired: true,
      },
      { status: 403 }
    )
  }

  const providers = await prisma.ssoProvider.findMany({
    where: {
      userId: session.user.id,
    },
    orderBy: [{ updatedAt: "desc" }],
  })

  return NextResponse.json({
    providers: providers.map(toProviderResponse),
    planId: entitlement.plan.id,
  })
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 })
  }

  const entitlement = await getUserEntitlementSnapshot(session.user.id)
  if (!hasEnterpriseSsoAccess(entitlement.plan.id)) {
    return NextResponse.json(
      {
        error: "SSO 与企业身份集成仅对 Enterprise 套餐开放",
        upgradeRequired: true,
      },
      { status: 403 }
    )
  }

  try {
    const body = await request.json().catch(() => ({}))
    const providerId = typeof body.id === "string" ? body.id : ""

    const existing = providerId
      ? await prisma.ssoProvider.findFirst({
          where: {
            id: providerId,
            userId: session.user.id,
          },
        })
      : null

    const sanitized = sanitizeSsoProviderConfig(body, existing
      ? {
          type: existing.type,
          status: existing.status,
          name: existing.name,
          issuerUrl: existing.issuerUrl,
          ssoUrl: existing.ssoUrl || "",
          clientId: existing.clientId || "",
          clientSecret: existing.clientSecret || "",
          domains: parseStringArray(existing.domains),
          roleMapping: parseRoleMapping(existing.roleMapping),
          defaultRole: existing.defaultRole,
          enforceSso: existing.enforceSso,
          allowLocalFallback: existing.allowLocalFallback,
        }
      : {})

    if (!sanitized.name || !sanitized.issuerUrl) {
      return NextResponse.json(
        { error: "请填写 SSO 名称与发行方地址" },
        { status: 400 }
      )
    }

    const persisted = await prisma.ssoProvider.upsert({
      where: {
        id: existing?.id || "__create_new_provider__",
      },
      create: {
        userId: session.user.id,
        type: sanitized.type,
        status: sanitized.status,
        name: sanitized.name,
        issuerUrl: sanitized.issuerUrl,
        ssoUrl: sanitized.ssoUrl || null,
        clientId: sanitized.clientId || null,
        clientSecret: sanitized.clientSecret || null,
        domains: sanitized.domains,
        roleMapping: sanitized.roleMapping,
        defaultRole: sanitized.defaultRole,
        enforceSso: sanitized.enforceSso,
        allowLocalFallback: sanitized.allowLocalFallback,
      },
      update: {
        type: sanitized.type,
        status: sanitized.status,
        name: sanitized.name,
        issuerUrl: sanitized.issuerUrl,
        ssoUrl: sanitized.ssoUrl || null,
        clientId: sanitized.clientId || null,
        clientSecret: sanitized.clientSecret || existing?.clientSecret || null,
        domains: sanitized.domains,
        roleMapping: sanitized.roleMapping,
        defaultRole: sanitized.defaultRole,
        enforceSso: sanitized.enforceSso,
        allowLocalFallback: sanitized.allowLocalFallback,
      },
    })

    return NextResponse.json({ provider: toProviderResponse(persisted) })
  } catch (error) {
    console.error("Save SSO provider failed:", error)
    return NextResponse.json({ error: "保存 SSO 配置失败" }, { status: 500 })
  }
}
