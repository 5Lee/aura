import { ConnectorCheckStatus, ConnectorStatus } from "@prisma/client"
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"

import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import {
  buildConnectorSeed,
  decryptConnectorCredential,
  encryptConnectorCredential,
  fingerprintCredential,
  maskCredential,
  resolveConnectorHealthCheck,
  sanitizeConnectorInput,
} from "@/lib/integration-connectors"
import { recordPromptAuditLog } from "@/lib/prompt-audit-log"
import { sanitizeTextInput } from "@/lib/security"
import { getUserEntitlementSnapshot, hasConnectorCatalogAccess } from "@/lib/subscription-entitlements"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 })
  }

  const snapshot = await getUserEntitlementSnapshot(session.user.id)
  if (!hasConnectorCatalogAccess(snapshot.plan.id)) {
    return NextResponse.json(
      {
        error: "连接器目录仅对 Pro / Team / Enterprise 套餐开放",
        upgradeRequired: true,
      },
      { status: 403 }
    )
  }

  const count = await prisma.integrationConnector.count({
    where: {
      userId: session.user.id,
    },
  })

  if (count === 0) {
    await prisma.integrationConnector.createMany({
      data: buildConnectorSeed(session.user.id),
    })
  }

  const [connectors, healthChecks] = await Promise.all([
    prisma.integrationConnector.findMany({
      where: {
        userId: session.user.id,
      },
      orderBy: [{ updatedAt: "desc" }],
      take: 80,
    }),
    prisma.integrationConnectorHealthCheck.findMany({
      where: {
        userId: session.user.id,
      },
      include: {
        connector: {
          select: {
            id: true,
            name: true,
            provider: true,
            status: true,
          },
        },
      },
      orderBy: [{ checkAt: "desc" }],
      take: 120,
    }),
  ])

  return NextResponse.json({
    connectors: connectors.map((item) => ({
      id: item.id,
      name: item.name,
      provider: item.provider,
      status: item.status,
      apiBaseUrl: item.apiBaseUrl,
      credentialPreview: item.credentialPreview,
      secretVersion: item.secretVersion,
      lastRotatedAt: item.lastRotatedAt,
      lastCheckedAt: item.lastCheckedAt,
      lastCheckStatus: item.lastCheckStatus,
      lastCheckMessage: item.lastCheckMessage,
      metadata: item.metadata,
    })),
    healthChecks,
  })
}

export async function PUT(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 })
  }

  const snapshot = await getUserEntitlementSnapshot(session.user.id)
  if (!hasConnectorCatalogAccess(snapshot.plan.id)) {
    return NextResponse.json(
      {
        error: "连接器目录仅对 Pro / Team / Enterprise 套餐开放",
        upgradeRequired: true,
      },
      { status: 403 }
    )
  }

  try {
    const body = await request.json().catch(() => ({}))
    const sanitized = sanitizeConnectorInput(body)

    if (!sanitized.name) {
      return NextResponse.json({ error: "连接器名称不能为空" }, { status: 400 })
    }

    const current = sanitized.id
      ? await prisma.integrationConnector.findFirst({
          where: {
            id: sanitized.id,
            userId: session.user.id,
          },
        })
      : null

    const existing = await prisma.integrationConnector.findFirst({
      where: {
        userId: session.user.id,
        provider: sanitized.provider,
        name: sanitized.name,
        NOT: current ? { id: current.id } : undefined,
      },
      select: {
        id: true,
      },
    })

    if (existing) {
      return NextResponse.json({ error: "相同提供方下连接器名称已存在" }, { status: 400 })
    }

    const credentialChanged = Boolean(sanitized.credential)
    const credentialCipher = credentialChanged
      ? encryptConnectorCredential(sanitized.credential)
      : current?.credentialCipher || null

    const connector = await prisma.integrationConnector.upsert({
      where: {
        id: current?.id || "__create_connector__",
      },
      create: {
        userId: session.user.id,
        name: sanitized.name,
        provider: sanitized.provider,
        status: sanitized.status,
        apiBaseUrl: sanitized.apiBaseUrl || null,
        credentialCipher,
        credentialPreview: credentialChanged ? maskCredential(sanitized.credential) : null,
        credentialFingerprint: credentialChanged ? fingerprintCredential(sanitized.credential) : null,
        secretVersion: credentialChanged ? 1 : 1,
        lastRotatedAt: credentialChanged ? new Date() : null,
        metadata: sanitized.note
          ? {
              note: sanitized.note,
            }
          : undefined,
      },
      update: {
        name: sanitized.name,
        provider: sanitized.provider,
        status: sanitized.status,
        apiBaseUrl: sanitized.apiBaseUrl || null,
        credentialCipher,
        credentialPreview: credentialChanged
          ? maskCredential(sanitized.credential)
          : current?.credentialPreview || null,
        credentialFingerprint: credentialChanged
          ? fingerprintCredential(sanitized.credential)
          : current?.credentialFingerprint || null,
        secretVersion: credentialChanged
          ? {
              increment: 1,
            }
          : undefined,
        lastRotatedAt: credentialChanged ? new Date() : current?.lastRotatedAt || null,
        metadata: sanitized.note
          ? {
              ...(current?.metadata && typeof current.metadata === "object" && !Array.isArray(current.metadata)
                ? (current.metadata as Record<string, unknown>)
                : {}),
              note: sanitized.note,
            }
          : current?.metadata || undefined,
      },
    })

    await recordPromptAuditLog({
      actorId: session.user.id,
      action: "integration.connector.upsert",
      resource: "connectors",
      request,
      metadata: {
        connectorId: connector.id,
        provider: connector.provider,
        status: connector.status,
        credentialRotated: credentialChanged,
        secretVersion: connector.secretVersion,
      },
    })

    return NextResponse.json({
      connector: {
        id: connector.id,
        name: connector.name,
        provider: connector.provider,
        status: connector.status,
        apiBaseUrl: connector.apiBaseUrl,
        credentialPreview: connector.credentialPreview,
        secretVersion: connector.secretVersion,
        lastRotatedAt: connector.lastRotatedAt,
      },
    })
  } catch (error) {
    console.error("Save connector failed:", error)
    return NextResponse.json({ error: "保存连接器失败" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 })
  }

  const snapshot = await getUserEntitlementSnapshot(session.user.id)
  if (!hasConnectorCatalogAccess(snapshot.plan.id)) {
    return NextResponse.json(
      {
        error: "连接器目录仅对 Pro / Team / Enterprise 套餐开放",
        upgradeRequired: true,
      },
      { status: 403 }
    )
  }

  try {
    const body = await request.json().catch(() => ({}))
    const connectorId = sanitizeTextInput(body.id, 80)
    if (!connectorId) {
      return NextResponse.json({ error: "连接器 id 不能为空" }, { status: 400 })
    }

    const connector = await prisma.integrationConnector.findFirst({
      where: {
        id: connectorId,
        userId: session.user.id,
      },
    })

    if (!connector) {
      return NextResponse.json({ error: "连接器不存在" }, { status: 404 })
    }

    const credential = connector.credentialCipher ? decryptConnectorCredential(connector.credentialCipher) : ""
    const health = resolveConnectorHealthCheck({
      connector: {
        status: connector.status,
        provider: connector.provider,
        name: connector.name,
        apiBaseUrl: connector.apiBaseUrl,
      },
      credential,
    })

    const [healthCheck] = await prisma.$transaction([
      prisma.integrationConnectorHealthCheck.create({
        data: {
          userId: session.user.id,
          connectorId: connector.id,
          status: health.status,
          message: health.message,
          latencyMs: health.latencyMs,
          diagnostics: health.diagnostics,
        },
      }),
      prisma.integrationConnector.update({
        where: {
          id: connector.id,
        },
        data: {
          lastCheckedAt: new Date(),
          lastCheckStatus: health.status,
          lastCheckMessage: health.message,
          status:
            health.status === ConnectorCheckStatus.FAIL
              ? ConnectorStatus.DEGRADED
              : connector.status === ConnectorStatus.DISABLED
                ? ConnectorStatus.DISABLED
                : ConnectorStatus.ACTIVE,
        },
      }),
    ])

    await recordPromptAuditLog({
      actorId: session.user.id,
      action: "integration.connector.healthcheck",
      resource: "connectors",
      request,
      metadata: {
        connectorId: connector.id,
        checkStatus: healthCheck.status,
        latencyMs: healthCheck.latencyMs,
      },
    })

    return NextResponse.json({
      healthCheck,
      leastPrivilege: {
        credentialExposed: false,
        credentialPreview: connector.credentialPreview || "",
      },
    })
  } catch (error) {
    console.error("Run connector health check failed:", error)
    return NextResponse.json({ error: "连接器健康检查失败" }, { status: 500 })
  }
}
