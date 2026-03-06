import { OpsNotificationStatus, OpsTaskChannel, Prisma } from "@prisma/client"
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"

import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import {
  buildNotificationRuleSeed,
  buildNotificationDeliveryKey,
  resolveNotificationDedupKey,
  resolveNotificationStatus,
  resolveNotificationWindowSuppressed,
  sanitizeNotificationPayload,
  sanitizeNotificationRuleInput,
} from "@/lib/ops-notifications"
import { recordPromptAuditLog } from "@/lib/prompt-audit-log"
import { sanitizeMultilineTextInput, sanitizeTextInput } from "@/lib/security"
import {
  getUserEntitlementSnapshot,
  hasNotificationOrchestrationAccess,
} from "@/lib/subscription-entitlements"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 })
  }

  const snapshot = await getUserEntitlementSnapshot(session.user.id)
  if (!hasNotificationOrchestrationAccess(snapshot.plan.id)) {
    return NextResponse.json(
      {
        error: "通知编排仅对 Pro / Team / Enterprise 套餐开放",
        upgradeRequired: true,
      },
      { status: 403 }
    )
  }

  const count = await prisma.opsNotificationRule.count({
    where: {
      userId: session.user.id,
    },
  })

  if (count === 0) {
    await prisma.opsNotificationRule.createMany({
      data: buildNotificationRuleSeed(session.user.id),
    })
  }

  const [rules, deliveries] = await Promise.all([
    prisma.opsNotificationRule.findMany({
      where: {
        userId: session.user.id,
      },
      orderBy: [{ updatedAt: "desc" }],
      take: 80,
    }),
    prisma.opsNotificationDelivery.findMany({
      where: {
        userId: session.user.id,
      },
      include: {
        rule: {
          select: {
            id: true,
            name: true,
            frequencyCapPerHour: true,
            dedupeWindowMinutes: true,
          },
        },
      },
      orderBy: [{ createdAt: "desc" }],
      take: 200,
    }),
  ])

  const stats = deliveries.reduce(
    (acc, item) => {
      acc.total += 1
      if (item.status === OpsNotificationStatus.SENT) {
        acc.sent += 1
      }
      if (item.status === OpsNotificationStatus.FAILED) {
        acc.failed += 1
      }
      if (item.status === OpsNotificationStatus.DEDUPED) {
        acc.deduped += 1
      }
      if (item.status === OpsNotificationStatus.SUPPRESSED) {
        acc.suppressed += 1
      }
      return acc
    },
    { total: 0, sent: 0, failed: 0, deduped: 0, suppressed: 0 }
  )

  return NextResponse.json({ rules, deliveries, stats })
}

export async function PUT(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 })
  }

  const snapshot = await getUserEntitlementSnapshot(session.user.id)
  if (!hasNotificationOrchestrationAccess(snapshot.plan.id)) {
    return NextResponse.json(
      {
        error: "通知编排仅对 Pro / Team / Enterprise 套餐开放",
        upgradeRequired: true,
      },
      { status: 403 }
    )
  }

  try {
    const body = await request.json().catch(() => ({}))
    const sanitized = sanitizeNotificationRuleInput(body)

    if (!sanitized.name) {
      return NextResponse.json({ error: "通知规则名称不能为空" }, { status: 400 })
    }

    const current = sanitized.id
      ? await prisma.opsNotificationRule.findFirst({
          where: {
            id: sanitized.id,
            userId: session.user.id,
          },
        })
      : null

    const rule = await prisma.opsNotificationRule.upsert({
      where: {
        id: current?.id || "__create_notification_rule__",
      },
      create: {
        userId: session.user.id,
        name: sanitized.name,
        enabled: sanitized.enabled,
        channels: sanitized.channels,
        quietWindowStart: sanitized.quietWindowStart,
        quietWindowEnd: sanitized.quietWindowEnd,
        frequencyCapPerHour: sanitized.frequencyCapPerHour,
        dedupeWindowMinutes: sanitized.dedupeWindowMinutes,
        webhookUrl: sanitized.webhookUrl || null,
        metadata: sanitized.note
          ? {
              note: sanitized.note,
            }
          : undefined,
      },
      update: {
        name: sanitized.name,
        enabled: sanitized.enabled,
        channels: sanitized.channels,
        quietWindowStart: sanitized.quietWindowStart,
        quietWindowEnd: sanitized.quietWindowEnd,
        frequencyCapPerHour: sanitized.frequencyCapPerHour,
        dedupeWindowMinutes: sanitized.dedupeWindowMinutes,
        webhookUrl: sanitized.webhookUrl || null,
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
      action: "ops.notification.rule.upsert",
      resource: "ops-notification",
      request,
      metadata: {
        ruleId: rule.id,
        enabled: rule.enabled,
        channels: rule.channels,
      },
    })

    return NextResponse.json({ rule })
  } catch (error) {
    console.error("Save notification rule failed:", error)
    return NextResponse.json({ error: "保存通知编排规则失败" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 })
  }

  const snapshot = await getUserEntitlementSnapshot(session.user.id)
  if (!hasNotificationOrchestrationAccess(snapshot.plan.id)) {
    return NextResponse.json(
      {
        error: "通知编排仅对 Pro / Team / Enterprise 套餐开放",
        upgradeRequired: true,
      },
      { status: 403 }
    )
  }

  try {
    const body = await request.json().catch(() => ({}))
    const ruleId = sanitizeTextInput(body.ruleId, 80)
    const recipient = sanitizeTextInput(body.recipient, 180) || "ops@aura.local"
    const message = sanitizeMultilineTextInput(body.message, 2000).trim()
    const payload = sanitizeNotificationPayload(body.payload)

    if (!ruleId || !message) {
      return NextResponse.json({ error: "ruleId 与 message 不能为空" }, { status: 400 })
    }

    const rule = await prisma.opsNotificationRule.findFirst({
      where: {
        id: ruleId,
        userId: session.user.id,
      },
    })

    if (!rule) {
      return NextResponse.json({ error: "通知规则不存在" }, { status: 404 })
    }

    if (!rule.enabled) {
      return NextResponse.json({ error: "通知规则已禁用" }, { status: 400 })
    }

    const channels: OpsTaskChannel[] = Array.isArray(rule.channels)
      ? rule.channels
          .map((item) => String(item).toUpperCase())
          .map((item) => {
            if (item === OpsTaskChannel.EMAIL) {
              return OpsTaskChannel.EMAIL
            }
            if (item === OpsTaskChannel.WEBHOOK) {
              return OpsTaskChannel.WEBHOOK
            }
            return OpsTaskChannel.IN_APP
          })
      : [OpsTaskChannel.IN_APP]
    const now = new Date()

    const deliveries = await Promise.all(
      channels.map(async (channel) => {
        const dedupeFingerprint = resolveNotificationDedupKey({
          ruleId: rule.id,
          channel,
          recipient,
          message,
          payload,
        })

        const dedupeWindowStart = new Date(now.getTime() - rule.dedupeWindowMinutes * 60 * 1000)
        const deduped =
          (await prisma.opsNotificationDelivery.count({
            where: {
              ruleId: rule.id,
              channel,
              dedupeKey: {
                startsWith: dedupeFingerprint,
              },
              createdAt: {
                gte: dedupeWindowStart,
              },
            },
          })) > 0

        const suppressed = resolveNotificationWindowSuppressed({
          now,
          quietWindowStart: rule.quietWindowStart,
          quietWindowEnd: rule.quietWindowEnd,
        })

        const forceFail = payload.forceFail === true
        const status = resolveNotificationStatus({
          suppressed,
          deduped,
          forceFail,
        })

        const deliveryKey = buildNotificationDeliveryKey({
          dedupeKey: dedupeFingerprint,
          deduped,
        })

        return prisma.opsNotificationDelivery.create({
          data: {
            userId: session.user.id,
            ruleId: rule.id,
            channel,
            status,
            dedupeKey: deliveryKey,
            recipient,
            message,
            sentAt:
              status === OpsNotificationStatus.SENT || status === OpsNotificationStatus.FAILED
                ? now
                : null,
            receiptCode:
              status === OpsNotificationStatus.SENT
                ? `${channel}-${Date.now().toString(36)}`
                : null,
            errorMessage: status === OpsNotificationStatus.FAILED ? "通道发送失败" : null,
            metadata: {
              ...payload,
              dedupeFingerprint,
            } as Prisma.InputJsonValue,
          },
        })
      })
    )

    await recordPromptAuditLog({
      actorId: session.user.id,
      action: "ops.notification.delivery.dispatch",
      resource: "ops-notification",
      request,
      metadata: {
        ruleId: rule.id,
        deliveryCount: deliveries.length,
        sentCount: deliveries.filter((item) => item.status === OpsNotificationStatus.SENT).length,
        failedCount: deliveries.filter((item) => item.status === OpsNotificationStatus.FAILED).length,
      },
    })

    return NextResponse.json({ deliveries })
  } catch (error) {
    console.error("Dispatch notification failed:", error)
    return NextResponse.json({ error: "发送通知失败" }, { status: 500 })
  }
}
