import { DirectorySyncStatus } from "@prisma/client"
import * as bcrypt from "bcryptjs"
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"

import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { recordPromptAuditLog } from "@/lib/prompt-audit-log"
import {
  normalizeDirectoryRole,
  resolveIdentityConflictReason,
  toIdentitySource,
} from "@/lib/sso"
import { sanitizeTextInput } from "@/lib/security"
import { getUserEntitlementSnapshot, hasEnterpriseSsoAccess } from "@/lib/subscription-entitlements"

type IncomingDirectoryUser = {
  externalUserId: string
  email: string
  name: string
  role: string
}

function normalizeIncomingUsers(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as IncomingDirectoryUser[]
  }

  const users: IncomingDirectoryUser[] = []
  for (const item of value.slice(0, 1000)) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      continue
    }

    const row = item as Record<string, unknown>
    const email = sanitizeTextInput(row.email, 160).toLowerCase()
    const externalUserId =
      sanitizeTextInput(row.externalUserId, 160) || sanitizeTextInput(row.id, 160) || email

    if (!email || !externalUserId) {
      continue
    }

    users.push({
      externalUserId,
      email,
      name: sanitizeTextInput(row.name, 80),
      role: sanitizeTextInput(row.role, 40),
    })
  }

  return users
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
    const providerId = sanitizeTextInput(body.providerId, 64)
    const users = normalizeIncomingUsers(body.users)

    if (!providerId) {
      return NextResponse.json({ error: "providerId 不能为空" }, { status: 400 })
    }

    const provider = await prisma.ssoProvider.findFirst({
      where: {
        id: providerId,
        userId: session.user.id,
      },
    })

    if (!provider) {
      return NextResponse.json({ error: "SSO 配置不存在" }, { status: 404 })
    }

    if (provider.status !== "ACTIVE") {
      return NextResponse.json({ error: "请先启用 SSO 配置后再执行目录同步" }, { status: 400 })
    }

    const now = new Date()
    const source = toIdentitySource(provider.type)
    const roleMapping = parseRoleMapping(provider.roleMapping)

    const syncRun = await prisma.directorySyncRun.create({
      data: {
        providerId: provider.id,
        actorId: session.user.id,
        status: DirectorySyncStatus.SUCCESS,
        totalUsers: users.length,
        startedAt: now,
        metadata: {
          source: "manual",
        },
      },
    })

    let createdUsers = 0
    let linkedUsers = 0
    let conflictCount = 0

    for (const incoming of users) {
      const role = normalizeDirectoryRole(incoming.role, roleMapping, provider.defaultRole)

      const existingIdentity = await prisma.userIdentity.findUnique({
        where: {
          source_externalUserId: {
            source,
            externalUserId: incoming.externalUserId,
          },
        },
        include: {
          user: true,
        },
      })

      if (existingIdentity && existingIdentity.email !== incoming.email) {
        await prisma.identityConflict.create({
          data: {
            providerId: provider.id,
            syncRunId: syncRun.id,
            externalUserId: incoming.externalUserId,
            incomingEmail: incoming.email,
            incomingName: incoming.name || null,
            existingUserId: existingIdentity.userId,
            reason: resolveIdentityConflictReason({
              source,
              incomingEmail: incoming.email,
              existingEmail: existingIdentity.email,
            }),
            metadata: {
              existingIdentityId: existingIdentity.id,
            },
          },
        })
        conflictCount += 1
        continue
      }

      const aliasIdentity = await prisma.userIdentity.findFirst({
        where: {
          source,
          email: incoming.email,
          NOT: {
            externalUserId: incoming.externalUserId,
          },
        },
      })

      if (aliasIdentity) {
        await prisma.identityConflict.create({
          data: {
            providerId: provider.id,
            syncRunId: syncRun.id,
            externalUserId: incoming.externalUserId,
            incomingEmail: incoming.email,
            incomingName: incoming.name || null,
            existingUserId: aliasIdentity.userId,
            reason: `同一邮箱在 ${source} 中已绑定其他外部身份。`,
            metadata: {
              aliasIdentityId: aliasIdentity.id,
            },
          },
        })
        conflictCount += 1
        continue
      }

      let user = await prisma.user.findUnique({
        where: {
          email: incoming.email,
        },
      })

      if (!user) {
        const seed = `${incoming.externalUserId}:${Date.now()}:${Math.random()}`
        const password = await bcrypt.hash(seed, 10)
        user = await prisma.user.create({
          data: {
            email: incoming.email,
            name: incoming.name || null,
            password,
          },
        })
        createdUsers += 1
      } else {
        linkedUsers += 1
      }

      const existingUserSameProvider = await prisma.userIdentity.findFirst({
        where: {
          userId: user.id,
          source,
          providerId: provider.id,
          NOT: {
            externalUserId: incoming.externalUserId,
          },
        },
      })

      if (existingUserSameProvider) {
        await prisma.identityConflict.create({
          data: {
            providerId: provider.id,
            syncRunId: syncRun.id,
            externalUserId: incoming.externalUserId,
            incomingEmail: incoming.email,
            incomingName: incoming.name || null,
            existingUserId: existingUserSameProvider.userId,
            reason: "同一用户在该身份源下存在多个外部身份映射冲突。",
            metadata: {
              existingIdentityId: existingUserSameProvider.id,
            },
          },
        })
        conflictCount += 1
        continue
      }

      await prisma.userIdentity.upsert({
        where: {
          source_externalUserId: {
            source,
            externalUserId: incoming.externalUserId,
          },
        },
        create: {
          userId: user.id,
          providerId: provider.id,
          source,
          externalUserId: incoming.externalUserId,
          email: incoming.email,
          displayName: incoming.name || null,
          role,
          metadata: {
            source: "directory_sync",
          },
        },
        update: {
          userId: user.id,
          providerId: provider.id,
          email: incoming.email,
          displayName: incoming.name || null,
          role,
        },
      })
    }

    const status =
      conflictCount === 0
        ? DirectorySyncStatus.SUCCESS
        : users.length > conflictCount
          ? DirectorySyncStatus.PARTIAL
          : DirectorySyncStatus.FAILED

    const finishedAt = new Date()

    const updatedRun = await prisma.directorySyncRun.update({
      where: {
        id: syncRun.id,
      },
      data: {
        status,
        createdUsers,
        linkedUsers,
        conflictCount,
        summary: `同步 ${users.length} 条目录用户，新增账号 ${createdUsers}，关联账号 ${linkedUsers}，冲突 ${conflictCount}。`,
        finishedAt,
      },
    })

    await prisma.ssoProvider.update({
      where: {
        id: provider.id,
      },
      data: {
        lastSyncedAt: finishedAt,
      },
    })

    await recordPromptAuditLog({
      actorId: session.user.id,
      action: "sso.directory.sync",
      resource: "identity",
      status: status === DirectorySyncStatus.FAILED ? "failure" : "success",
      request,
      metadata: {
        providerId: provider.id,
        syncRunId: updatedRun.id,
        status: updatedRun.status,
        totalUsers: updatedRun.totalUsers,
        createdUsers: updatedRun.createdUsers,
        linkedUsers: updatedRun.linkedUsers,
        conflictCount: updatedRun.conflictCount,
      },
    })

    return NextResponse.json({
      syncRun: {
        id: updatedRun.id,
        status: updatedRun.status,
        totalUsers: updatedRun.totalUsers,
        createdUsers: updatedRun.createdUsers,
        linkedUsers: updatedRun.linkedUsers,
        conflictCount: updatedRun.conflictCount,
        summary: updatedRun.summary,
      },
    })
  } catch (error) {
    console.error("Run directory sync failed:", error)
    return NextResponse.json({ error: "目录同步失败" }, { status: 500 })
  }
}
