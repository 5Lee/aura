import { Prisma, SsoProviderStatus } from "@prisma/client"

import { extractBrandConfig } from "@/lib/branding"
import { prisma } from "@/lib/db"

function isMissingSsoProviderTableError(error: unknown) {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
    return false
  }
  if (error.code !== "P2021") {
    return false
  }
  const table = String(error.meta?.table || "").toLowerCase()
  return table.includes("ssoprovider")
}

export async function findTenantOwnerUserId(tenantDomain: string) {
  const normalizedTenant = tenantDomain.trim().toLowerCase()
  if (!normalizedTenant) {
    return null
  }

  const profiles = await prisma.brandProfile.findMany({
    where: {
      status: "PUBLISHED",
    },
    select: {
      userId: true,
      publishedConfig: true,
    },
  })

  for (const profile of profiles) {
    if (!profile.publishedConfig) {
      continue
    }
    const config = extractBrandConfig(profile.publishedConfig)
    if (config.domain && config.domain === normalizedTenant) {
      return profile.userId
    }
  }

  return null
}

export async function getActiveSsoProviderForUser(userId: string) {
  try {
    return await prisma.ssoProvider.findFirst({
      where: {
        userId,
        status: SsoProviderStatus.ACTIVE,
      },
      orderBy: [{ updatedAt: "desc" }],
    })
  } catch (error) {
    if (isMissingSsoProviderTableError(error)) {
      return null
    }
    throw error
  }
}

export async function getSsoRuntimePolicy({
  tenantDomain,
  userId,
}: {
  tenantDomain?: string
  userId?: string
}) {
  let targetUserId = userId || ""

  if (!targetUserId && tenantDomain) {
    targetUserId = (await findTenantOwnerUserId(tenantDomain)) || ""
  }

  if (!targetUserId) {
    return {
      enabled: false,
      enforceSso: false,
      allowLocalFallback: true,
      provider: null,
      tenantMatched: false,
    }
  }

  const provider = await getActiveSsoProviderForUser(targetUserId)
  if (!provider) {
    return {
      enabled: false,
      enforceSso: false,
      allowLocalFallback: true,
      provider: null,
      tenantMatched: Boolean(tenantDomain),
    }
  }

  return {
    enabled: true,
    enforceSso: provider.enforceSso,
    allowLocalFallback: provider.allowLocalFallback,
    provider,
    tenantMatched: Boolean(tenantDomain),
  }
}

export async function getCredentialGuardForEmail(email: string) {
  const normalizedEmail = email.trim().toLowerCase()
  if (!normalizedEmail) {
    return {
      allowed: false,
      reason: "邮箱不能为空",
      providerId: "",
    }
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: {
        id: true,
        ssoProviders: {
          where: {
            status: SsoProviderStatus.ACTIVE,
            enforceSso: true,
            allowLocalFallback: false,
          },
          orderBy: [{ updatedAt: "desc" }],
          take: 1,
        },
      },
    })

    const provider = user?.ssoProviders?.[0]
    if (!provider) {
      return {
        allowed: true,
        reason: "",
        providerId: "",
      }
    }

    return {
      allowed: false,
      reason: "当前企业已启用强制 SSO，请使用企业单点登录。",
      providerId: provider.id,
    }
  } catch (error) {
    if (isMissingSsoProviderTableError(error)) {
      return {
        allowed: true,
        reason: "",
        providerId: "",
      }
    }
    throw error
  }
}
