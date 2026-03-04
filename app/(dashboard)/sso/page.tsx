import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"

import { SsoManagementPanel } from "@/components/sso/sso-management-panel"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { maskSecret } from "@/lib/sso"
import { getUserEntitlementSnapshot, hasEnterpriseSsoAccess } from "@/lib/subscription-entitlements"

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
    if (typeof role === "string") {
      mapping[key] = role
    }
  }

  return mapping
}

export default async function SsoPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    redirect("/login")
  }

  const entitlement = await getUserEntitlementSnapshot(session.user.id)
  const hasAccess = hasEnterpriseSsoAccess(entitlement.plan.id)

  const [providers, syncRuns, conflicts] = await Promise.all([
    hasAccess
      ? prisma.ssoProvider.findMany({
          where: {
            userId: session.user.id,
          },
          orderBy: [{ updatedAt: "desc" }],
        })
      : Promise.resolve([]),
    hasAccess
      ? prisma.directorySyncRun.findMany({
          where: {
            provider: {
              userId: session.user.id,
            },
          },
          orderBy: [{ startedAt: "desc" }],
          take: 20,
        })
      : Promise.resolve([]),
    hasAccess
      ? prisma.identityConflict.findMany({
          where: {
            provider: {
              userId: session.user.id,
            },
          },
          include: {
            provider: {
              select: {
                id: true,
                name: true,
                type: true,
              },
            },
            existingUser: {
              select: {
                id: true,
                email: true,
                name: true,
              },
            },
          },
          orderBy: [{ createdAt: "desc" }],
          take: 30,
        })
      : Promise.resolve([]),
  ])

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-3">
            <CardTitle>SSO 与企业身份集成</CardTitle>
            <Badge variant="secondary">Week19-002</Badge>
            <Badge>{entitlement.plan.name}</Badge>
          </div>
          <CardDescription>
            支持 OIDC/SAML 单点登录、企业目录同步与角色映射，提供强制 SSO 与本地回退策略，并追踪多身份源冲突。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SsoManagementPanel
            hasAccess={hasAccess}
            planId={entitlement.plan.id}
            providers={providers.map((provider) => ({
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
            }))}
            syncRuns={syncRuns.map((run) => ({
              id: run.id,
              status: run.status,
              totalUsers: run.totalUsers,
              createdUsers: run.createdUsers,
              linkedUsers: run.linkedUsers,
              conflictCount: run.conflictCount,
              summary: run.summary,
              startedAt: run.startedAt.toISOString(),
              finishedAt: run.finishedAt?.toISOString() ?? null,
            }))}
            conflicts={conflicts.map((conflict) => ({
              id: conflict.id,
              provider: conflict.provider,
              externalUserId: conflict.externalUserId,
              incomingEmail: conflict.incomingEmail,
              incomingName: conflict.incomingName,
              existingUser: conflict.existingUser,
              reason: conflict.reason,
              status: conflict.status,
              createdAt: conflict.createdAt.toISOString(),
              updatedAt: conflict.updatedAt.toISOString(),
            }))}
          />
        </CardContent>
      </Card>
    </div>
  )
}
