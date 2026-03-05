import { OpsTaskStatus, PlaybookTemplateStatus } from "@prisma/client"
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"

import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import {
  buildPlaybookSeed,
  resolvePlaybookCompatibility,
  resolvePlaybookRating,
  sanitizePlaybookInput,
} from "@/lib/ops-playbook"
import { recordPromptAuditLog } from "@/lib/prompt-audit-log"
import { sanitizeTextInput } from "@/lib/security"
import { getUserEntitlementSnapshot, hasOpsPlaybookAccess } from "@/lib/subscription-entitlements"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 })
  }

  const snapshot = await getUserEntitlementSnapshot(session.user.id)
  if (!hasOpsPlaybookAccess(snapshot.plan.id)) {
    return NextResponse.json(
      {
        error: "运营 Playbook 模板市场仅对 Pro / Team / Enterprise 套餐开放",
        upgradeRequired: true,
      },
      { status: 403 }
    )
  }

  const count = await prisma.opsPlaybookTemplate.count({
    where: {
      userId: session.user.id,
    },
  })

  if (count === 0) {
    await prisma.opsPlaybookTemplate.createMany({
      data: buildPlaybookSeed(session.user.id),
    })
  }

  const playbooks = await prisma.opsPlaybookTemplate.findMany({
    where: {
      userId: session.user.id,
    },
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
    take: 120,
  })

  return NextResponse.json({ playbooks })
}

export async function PUT(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 })
  }

  const snapshot = await getUserEntitlementSnapshot(session.user.id)
  if (!hasOpsPlaybookAccess(snapshot.plan.id)) {
    return NextResponse.json(
      {
        error: "运营 Playbook 模板市场仅对 Pro / Team / Enterprise 套餐开放",
        upgradeRequired: true,
      },
      { status: 403 }
    )
  }

  try {
    const body = await request.json().catch(() => ({}))
    const sanitized = sanitizePlaybookInput(body)

    if (!sanitized.name || !sanitized.summary) {
      return NextResponse.json({ error: "模板名称和摘要不能为空" }, { status: 400 })
    }

    const current = sanitized.id
      ? await prisma.opsPlaybookTemplate.findFirst({
          where: {
            id: sanitized.id,
            userId: session.user.id,
          },
        })
      : null

    const compatibility = resolvePlaybookCompatibility({
      templateVersion: current?.version || sanitized.version,
      targetVersion: sanitized.rollbackTargetVersion,
    })

    if (!compatibility.compatible) {
      return NextResponse.json({ error: compatibility.reason }, { status: 400 })
    }

    const rating =
      body.rating !== undefined
        ? resolvePlaybookRating({
            currentScore: current?.ratingScore || 0,
            currentCount: current?.ratingCount || 0,
            nextRating: Number(body.rating),
          })
        : {
            ratingScore: current?.ratingScore || sanitized.rating,
            ratingCount: current?.ratingCount || 0,
          }

    const playbook = await prisma.opsPlaybookTemplate.upsert({
      where: {
        id: current?.id || "__create_playbook__",
      },
      create: {
        userId: session.user.id,
        name: sanitized.name,
        summary: sanitized.summary,
        status: sanitized.status,
        tags: sanitized.tags,
        version: sanitized.version,
        ratingScore: rating.ratingScore,
        ratingCount: rating.ratingCount,
        content: sanitized.content,
        compatibilityNotes: sanitized.compatibilityNotes || compatibility.reason,
        rollbackTargetVersion: sanitized.rollbackTargetVersion || null,
      },
      update: {
        name: sanitized.name,
        summary: sanitized.summary,
        status: sanitized.status,
        tags: sanitized.tags,
        version: {
          increment: 1,
        },
        ratingScore: rating.ratingScore,
        ratingCount: rating.ratingCount,
        content: sanitized.content,
        compatibilityNotes: sanitized.compatibilityNotes || compatibility.reason,
        rollbackTargetVersion: sanitized.rollbackTargetVersion || null,
      },
    })

    await recordPromptAuditLog({
      actorId: session.user.id,
      action: "ops.playbook.template.upsert",
      resource: "ops-playbook",
      request,
      metadata: {
        playbookId: playbook.id,
        status: playbook.status,
        version: playbook.version,
      },
    })

    return NextResponse.json({ playbook })
  } catch (error) {
    console.error("Save ops playbook failed:", error)
    return NextResponse.json({ error: "保存运营 Playbook 失败" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 })
  }

  const snapshot = await getUserEntitlementSnapshot(session.user.id)
  if (!hasOpsPlaybookAccess(snapshot.plan.id)) {
    return NextResponse.json(
      {
        error: "运营 Playbook 模板市场仅对 Pro / Team / Enterprise 套餐开放",
        upgradeRequired: true,
      },
      { status: 403 }
    )
  }

  try {
    const body = await request.json().catch(() => ({}))
    const playbookId = sanitizeTextInput(body.playbookId, 80)
    if (!playbookId) {
      return NextResponse.json({ error: "playbookId 不能为空" }, { status: 400 })
    }

    const playbook = await prisma.opsPlaybookTemplate.findFirst({
      where: {
        id: playbookId,
        userId: session.user.id,
      },
    })

    if (!playbook) {
      return NextResponse.json({ error: "模板不存在" }, { status: 404 })
    }

    if (playbook.status === PlaybookTemplateStatus.ARCHIVED) {
      return NextResponse.json({ error: "归档模板不能应用" }, { status: 400 })
    }

    const taskTemplate = await prisma.opsTaskTemplate.create({
      data: {
        userId: session.user.id,
        name: `${playbook.name} · 应用实例`,
        description: playbook.summary,
        status: OpsTaskStatus.SCHEDULED,
        scheduleCron: "0 */6 * * *",
        retryLimit: 2,
        failAlertEnabled: true,
        idempotencyWindowMinutes: 30,
        outputTrackingEnabled: true,
        metadata: {
          playbookId: playbook.id,
          playbookVersion: playbook.version,
          source: "one-click-apply",
        },
      },
    })

    await recordPromptAuditLog({
      actorId: session.user.id,
      action: "ops.playbook.template.apply",
      resource: "ops-playbook",
      request,
      metadata: {
        playbookId: playbook.id,
        taskTemplateId: taskTemplate.id,
        version: playbook.version,
      },
    })

    return NextResponse.json({ taskTemplate })
  } catch (error) {
    console.error("Apply ops playbook failed:", error)
    return NextResponse.json({ error: "应用 Playbook 模板失败" }, { status: 500 })
  }
}
