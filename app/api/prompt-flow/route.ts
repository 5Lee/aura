import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"

import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import {
  buildPromptFlowSeed,
  resolvePromptFlowReplayToken,
  sanitizePromptFlowInput,
  simulatePromptFlowExecution,
} from "@/lib/prompt-flow"
import { recordPromptAuditLog } from "@/lib/prompt-audit-log"
import { sanitizeTextInput } from "@/lib/security"
import { getUserEntitlementSnapshot, hasPromptFlowAccess } from "@/lib/subscription-entitlements"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 })
  }

  const snapshot = await getUserEntitlementSnapshot(session.user.id)
  if (!hasPromptFlowAccess(snapshot.plan.id)) {
    return NextResponse.json(
      {
        error: "Prompt Flow 节点编排仅对 Pro / Team / Enterprise 套餐开放",
        upgradeRequired: true,
      },
      { status: 403 }
    )
  }

  const count = await prisma.promptFlowDefinition.count({
    where: {
      userId: session.user.id,
    },
  })

  if (count === 0) {
    await prisma.promptFlowDefinition.createMany({
      data: buildPromptFlowSeed(session.user.id),
    })
  }

  const [flows, runs] = await Promise.all([
    prisma.promptFlowDefinition.findMany({
      where: {
        userId: session.user.id,
      },
      orderBy: [{ updatedAt: "desc" }],
      take: 60,
    }),
    prisma.promptFlowRun.findMany({
      where: {
        userId: session.user.id,
      },
      include: {
        flow: {
          select: {
            id: true,
            name: true,
            status: true,
            executionMode: true,
          },
        },
      },
      orderBy: [{ createdAt: "desc" }],
      take: 200,
    }),
  ])

  return NextResponse.json({ flows, runs })
}

export async function PUT(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 })
  }

  const snapshot = await getUserEntitlementSnapshot(session.user.id)
  if (!hasPromptFlowAccess(snapshot.plan.id)) {
    return NextResponse.json(
      {
        error: "Prompt Flow 节点编排仅对 Pro / Team / Enterprise 套餐开放",
        upgradeRequired: true,
      },
      { status: 403 }
    )
  }

  try {
    const body = await request.json().catch(() => ({}))
    const sanitized = sanitizePromptFlowInput(body)

    if (!sanitized.name) {
      return NextResponse.json({ error: "工作流名称不能为空" }, { status: 400 })
    }

    const current = sanitized.id
      ? await prisma.promptFlowDefinition.findFirst({
          where: {
            id: sanitized.id,
            userId: session.user.id,
          },
        })
      : null

    const flow = await prisma.promptFlowDefinition.upsert({
      where: {
        id: current?.id || "__create_prompt_flow__",
      },
      create: {
        userId: session.user.id,
        name: sanitized.name,
        description: sanitized.description,
        status: sanitized.status,
        executionMode: sanitized.executionMode,
        nodes: sanitized.nodes,
        edges: sanitized.edges,
        contextVariables: sanitized.contextVariables,
        retryPolicy: sanitized.retryPolicy,
        version: 1,
        lastPublishedAt: sanitized.status === "ACTIVE" ? new Date() : null,
      },
      update: {
        name: sanitized.name,
        description: sanitized.description,
        status: sanitized.status,
        executionMode: sanitized.executionMode,
        nodes: sanitized.nodes,
        edges: sanitized.edges,
        contextVariables: sanitized.contextVariables,
        retryPolicy: sanitized.retryPolicy,
        version: {
          increment: 1,
        },
        lastPublishedAt: sanitized.status === "ACTIVE" ? new Date() : current?.lastPublishedAt || null,
      },
    })

    await recordPromptAuditLog({
      actorId: session.user.id,
      action: "promptflow.flow.upsert",
      resource: "prompt-flow",
      request,
      metadata: {
        flowId: flow.id,
        status: flow.status,
        mode: flow.executionMode,
        version: flow.version,
      },
    })

    return NextResponse.json({ flow })
  } catch (error) {
    console.error("Save prompt flow failed:", error)
    return NextResponse.json({ error: "保存 Prompt Flow 失败" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 })
  }

  const snapshot = await getUserEntitlementSnapshot(session.user.id)
  if (!hasPromptFlowAccess(snapshot.plan.id)) {
    return NextResponse.json(
      {
        error: "Prompt Flow 节点编排仅对 Pro / Team / Enterprise 套餐开放",
        upgradeRequired: true,
      },
      { status: 403 }
    )
  }

  try {
    const body = await request.json().catch(() => ({}))
    const flowId = sanitizeTextInput(body.flowId, 80)
    if (!flowId) {
      return NextResponse.json({ error: "flowId 不能为空" }, { status: 400 })
    }

    const flow = await prisma.promptFlowDefinition.findFirst({
      where: {
        id: flowId,
        userId: session.user.id,
      },
    })

    if (!flow) {
      return NextResponse.json({ error: "工作流不存在" }, { status: 404 })
    }

    const replayToken = resolvePromptFlowReplayToken(flow.id, body.replayToken)

    const existingRun = await prisma.promptFlowRun.findUnique({
      where: {
        flowId_replayToken: {
          flowId: flow.id,
          replayToken,
        },
      },
      include: {
        flow: {
          select: {
            id: true,
            name: true,
            status: true,
            executionMode: true,
          },
        },
      },
    })

    if (existingRun) {
      return NextResponse.json({
        run: existingRun,
        replayToken,
        idempotent: true,
      })
    }

    const simulation = simulatePromptFlowExecution({
      nodes: Array.isArray(flow.nodes) ? (flow.nodes as Array<{ id: string; type: string; title: string; config?: Record<string, unknown> }>) : [],
      edges: Array.isArray(flow.edges) ? (flow.edges as Array<{ from: string; to: string; condition?: string }>) : [],
      executionMode: flow.executionMode,
      retryPolicy:
        flow.retryPolicy && typeof flow.retryPolicy === "object" && !Array.isArray(flow.retryPolicy)
          ? {
              maxRetries: Number((flow.retryPolicy as Record<string, unknown>).maxRetries || 0),
              backoffSeconds: Number((flow.retryPolicy as Record<string, unknown>).backoffSeconds || 0),
            }
          : {
              maxRetries: 0,
              backoffSeconds: 0,
            },
    })

    const run = await prisma.promptFlowRun.create({
      data: {
        userId: session.user.id,
        flowId: flow.id,
        replayToken,
        status: simulation.status,
        executionMode: flow.executionMode,
        attempts: simulation.attempts,
        runLog: simulation.runLog,
        metrics: simulation.metrics,
        errorMessage: simulation.errorMessage || null,
        startedAt: simulation.startedAt,
        endedAt: simulation.endedAt,
      },
      include: {
        flow: {
          select: {
            id: true,
            name: true,
            status: true,
            executionMode: true,
          },
        },
      },
    })

    await recordPromptAuditLog({
      actorId: session.user.id,
      action: "promptflow.run.execute",
      resource: "prompt-flow",
      request,
      metadata: {
        flowId: flow.id,
        runId: run.id,
        status: run.status,
        replayToken,
        attempts: run.attempts,
      },
    })

    return NextResponse.json({
      run,
      replayToken,
      idempotent: false,
    })
  } catch (error) {
    console.error("Execute prompt flow failed:", error)
    return NextResponse.json({ error: "执行 Prompt Flow 失败" }, { status: 500 })
  }
}
