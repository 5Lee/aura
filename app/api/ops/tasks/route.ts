import { OpsTaskStatus, Prisma } from "@prisma/client"
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"

import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import {
  buildOpsTaskTemplateSeed,
  resolveOpsTaskReplayToken,
  sanitizeOpsTaskTemplateInput,
  simulateOpsTaskExecution,
} from "@/lib/ops-automation"
import { recordPromptAuditLog } from "@/lib/prompt-audit-log"
import { sanitizeJsonValue, sanitizeTextInput } from "@/lib/security"
import { getUserEntitlementSnapshot, hasOpsAutomationAccess } from "@/lib/subscription-entitlements"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 })
  }

  const snapshot = await getUserEntitlementSnapshot(session.user.id)
  if (!hasOpsAutomationAccess(snapshot.plan.id)) {
    return NextResponse.json(
      {
        error: "运营自动化任务中心仅对 Pro / Team / Enterprise 套餐开放",
        upgradeRequired: true,
      },
      { status: 403 }
    )
  }

  const count = await prisma.opsTaskTemplate.count({
    where: {
      userId: session.user.id,
    },
  })

  if (count === 0) {
    await prisma.opsTaskTemplate.createMany({
      data: buildOpsTaskTemplateSeed(session.user.id),
    })
  }

  const [templates, runs] = await Promise.all([
    prisma.opsTaskTemplate.findMany({
      where: {
        userId: session.user.id,
      },
      orderBy: [{ updatedAt: "desc" }],
      take: 100,
    }),
    prisma.opsTaskRun.findMany({
      where: {
        userId: session.user.id,
      },
      include: {
        template: {
          select: {
            id: true,
            name: true,
            status: true,
            retryLimit: true,
          },
        },
      },
      orderBy: [{ createdAt: "desc" }],
      take: 200,
    }),
  ])

  return NextResponse.json({ templates, runs })
}

export async function PUT(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 })
  }

  const snapshot = await getUserEntitlementSnapshot(session.user.id)
  if (!hasOpsAutomationAccess(snapshot.plan.id)) {
    return NextResponse.json(
      {
        error: "运营自动化任务中心仅对 Pro / Team / Enterprise 套餐开放",
        upgradeRequired: true,
      },
      { status: 403 }
    )
  }

  try {
    const body = await request.json().catch(() => ({}))
    const sanitized = sanitizeOpsTaskTemplateInput(body)

    if (!sanitized.name) {
      return NextResponse.json({ error: "任务模板名称不能为空" }, { status: 400 })
    }

    const current = sanitized.id
      ? await prisma.opsTaskTemplate.findFirst({
          where: {
            id: sanitized.id,
            userId: session.user.id,
          },
        })
      : null

    const template = await prisma.opsTaskTemplate.upsert({
      where: {
        id: current?.id || "__create_ops_template__",
      },
      create: {
        userId: session.user.id,
        name: sanitized.name,
        description: sanitized.description,
        status: sanitized.status,
        scheduleCron: sanitized.scheduleCron,
        timezone: sanitized.timezone,
        retryLimit: sanitized.retryLimit,
        failAlertEnabled: sanitized.failAlertEnabled,
        defaultChannel: sanitized.defaultChannel,
        idempotencyWindowMinutes: sanitized.idempotencyWindowMinutes,
        outputTrackingEnabled: sanitized.outputTrackingEnabled,
        metadata: (sanitized.metadata as Prisma.InputJsonValue | undefined) || undefined,
      },
      update: {
        name: sanitized.name,
        description: sanitized.description,
        status: sanitized.status,
        scheduleCron: sanitized.scheduleCron,
        timezone: sanitized.timezone,
        retryLimit: sanitized.retryLimit,
        failAlertEnabled: sanitized.failAlertEnabled,
        defaultChannel: sanitized.defaultChannel,
        idempotencyWindowMinutes: sanitized.idempotencyWindowMinutes,
        outputTrackingEnabled: sanitized.outputTrackingEnabled,
        metadata:
          (sanitized.metadata as Prisma.InputJsonValue | undefined) ||
          ((current?.metadata as Prisma.InputJsonValue | null) ?? undefined),
      },
    })

    await recordPromptAuditLog({
      actorId: session.user.id,
      action: "ops.task.template.upsert",
      resource: "ops-task",
      request,
      metadata: {
        templateId: template.id,
        status: template.status,
        retryLimit: template.retryLimit,
      },
    })

    return NextResponse.json({ template })
  } catch (error) {
    console.error("Save ops task template failed:", error)
    return NextResponse.json({ error: "保存运营任务模板失败" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 })
  }

  const snapshot = await getUserEntitlementSnapshot(session.user.id)
  if (!hasOpsAutomationAccess(snapshot.plan.id)) {
    return NextResponse.json(
      {
        error: "运营自动化任务中心仅对 Pro / Team / Enterprise 套餐开放",
        upgradeRequired: true,
      },
      { status: 403 }
    )
  }

  try {
    const body = await request.json().catch(() => ({}))
    const templateId = sanitizeTextInput(body.templateId, 80)
    if (!templateId) {
      return NextResponse.json({ error: "templateId 不能为空" }, { status: 400 })
    }

    const template = await prisma.opsTaskTemplate.findFirst({
      where: {
        id: templateId,
        userId: session.user.id,
      },
    })

    if (!template) {
      return NextResponse.json({ error: "任务模板不存在" }, { status: 404 })
    }

    if (template.status === OpsTaskStatus.PAUSED) {
      return NextResponse.json({ error: "任务模板已暂停" }, { status: 400 })
    }

    const payload =
      (sanitizeJsonValue(body.payload, {
        maxDepth: 6,
        maxArrayLength: 30,
        maxKeysPerObject: 40,
        maxStringLength: 800,
      }) as Record<string, unknown> | undefined) || {}

    const replayToken = resolveOpsTaskReplayToken(template.id, body.replayToken)

    const existingRun = await prisma.opsTaskRun.findUnique({
      where: {
        templateId_replayToken: {
          templateId: template.id,
          replayToken,
        },
      },
      include: {
        template: {
          select: {
            id: true,
            name: true,
            status: true,
            retryLimit: true,
          },
        },
      },
    })

    if (existingRun) {
      return NextResponse.json({ run: existingRun, replayToken, idempotent: true })
    }

    const simulation = simulateOpsTaskExecution({
      template: {
        id: template.id,
        name: template.name,
        retryLimit: template.retryLimit,
        defaultChannel: template.defaultChannel,
      },
      payload,
    })

    const run = await prisma.$transaction(async (tx) => {
      const created = await tx.opsTaskRun.create({
        data: {
          userId: session.user.id,
          templateId: template.id,
          status: simulation.status,
          replayToken,
          triggerSource: "manual",
          attempts: simulation.attempts,
          outputSummary: simulation.outputSummary,
          outputPayload: simulation.outputPayload,
          alertSent: simulation.alertSent,
          errorMessage: simulation.status === OpsTaskStatus.FAILED ? "执行失败" : null,
          startedAt: new Date(),
          endedAt: new Date(),
        },
        include: {
          template: {
            select: {
              id: true,
              name: true,
              status: true,
              retryLimit: true,
            },
          },
        },
      })

      await tx.opsTaskTemplate.update({
        where: {
          id: template.id,
        },
        data: {
          status: simulation.status === OpsTaskStatus.FAILED ? OpsTaskStatus.FAILED : OpsTaskStatus.SCHEDULED,
          lastRunAt: new Date(),
        },
      })

      return created
    })

    await recordPromptAuditLog({
      actorId: session.user.id,
      action: "ops.task.run.execute",
      resource: "ops-task",
      request,
      metadata: {
        templateId: template.id,
        runId: run.id,
        replayToken,
        attempts: run.attempts,
        status: run.status,
      },
    })

    return NextResponse.json({ run, replayToken, idempotent: false })
  } catch (error) {
    console.error("Execute ops task failed:", error)
    return NextResponse.json({ error: "执行运营任务失败" }, { status: 500 })
  }
}
