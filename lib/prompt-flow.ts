import {
  PromptFlowExecutionMode,
  PromptFlowRunStatus,
  PromptFlowStatus,
} from "@prisma/client"
import { createHash } from "node:crypto"

import { sanitizeMultilineTextInput, sanitizeTextInput } from "@/lib/security"

type FlowNode = {
  id: string
  type: string
  title: string
  config?: Record<string, unknown>
}

type FlowEdge = {
  from: string
  to: string
  condition?: string
}

export const DEFAULT_PROMPT_FLOW_TEMPLATES = [
  {
    name: "新提示词上线回归流",
    description: "编辑 -> 评测 -> 审核 -> 发布",
    executionMode: PromptFlowExecutionMode.SERIAL,
    nodes: [
      { id: "edit", type: "task", title: "编辑提示词" },
      { id: "eval", type: "task", title: "运行评测" },
      { id: "review", type: "approval", title: "人工审核" },
      { id: "publish", type: "release", title: "发布上线" },
    ],
    edges: [
      { from: "edit", to: "eval" },
      { from: "eval", to: "review" },
      { from: "review", to: "publish" },
    ],
    contextVariables: [
      { key: "promptId", source: "manual" },
      { key: "releaseWindow", source: "system" },
    ],
    retryPolicy: {
      maxRetries: 1,
      backoffSeconds: 5,
    },
  },
  {
    name: "多渠道运营触达编排",
    description: "并行执行站内信、邮件与 Webhook",
    executionMode: PromptFlowExecutionMode.PARALLEL,
    nodes: [
      { id: "segment", type: "segment", title: "计算目标分群" },
      { id: "inbox", type: "notify", title: "站内信触达" },
      { id: "email", type: "notify", title: "邮件触达" },
      { id: "webhook", type: "notify", title: "Webhook 回调" },
    ],
    edges: [
      { from: "segment", to: "inbox" },
      { from: "segment", to: "email" },
      { from: "segment", to: "webhook" },
    ],
    contextVariables: [
      { key: "campaignId", source: "manual" },
      { key: "sendAt", source: "system" },
    ],
    retryPolicy: {
      maxRetries: 2,
      backoffSeconds: 10,
    },
  },
]

function normalizeRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {} as Record<string, unknown>
  }

  return value as Record<string, unknown>
}

function sanitizeNodes(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as FlowNode[]
  }

  return value
    .map((item) => normalizeRecord(item))
    .map((item) => ({
      id: sanitizeTextInput(item.id, 80),
      type: sanitizeTextInput(item.type, 40) || "task",
      title: sanitizeTextInput(item.title, 120),
      config:
        item.config && typeof item.config === "object" && !Array.isArray(item.config)
          ? (item.config as Record<string, unknown>)
          : undefined,
    }))
    .filter((item) => item.id && item.title)
    .slice(0, 40)
}

function sanitizeEdges(value: unknown, nodes: FlowNode[]) {
  if (!Array.isArray(value)) {
    return [] as FlowEdge[]
  }

  const nodeIds = new Set(nodes.map((item) => item.id))

  return value
    .map((item) => normalizeRecord(item))
    .map((item) => ({
      from: sanitizeTextInput(item.from, 80),
      to: sanitizeTextInput(item.to, 80),
      condition: sanitizeTextInput(item.condition, 120),
    }))
    .filter((item) => nodeIds.has(item.from) && nodeIds.has(item.to))
    .slice(0, 80)
}

function resolvePositiveInt(value: unknown, fallback: number, min: number, max: number) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    return fallback
  }

  const rounded = Math.floor(parsed)
  if (rounded < min) {
    return min
  }
  if (rounded > max) {
    return max
  }

  return rounded
}

export function normalizePromptFlowStatus(value: unknown) {
  const normalized = sanitizeTextInput(value, 20).toUpperCase()

  if (normalized === PromptFlowStatus.ACTIVE) {
    return PromptFlowStatus.ACTIVE
  }
  if (normalized === PromptFlowStatus.ARCHIVED) {
    return PromptFlowStatus.ARCHIVED
  }
  if (normalized === PromptFlowStatus.DRAFT) {
    return PromptFlowStatus.DRAFT
  }

  return PromptFlowStatus.DRAFT
}

export function normalizePromptFlowExecutionMode(value: unknown) {
  const normalized = sanitizeTextInput(value, 20).toUpperCase()

  if (normalized === PromptFlowExecutionMode.PARALLEL) {
    return PromptFlowExecutionMode.PARALLEL
  }
  if (normalized === PromptFlowExecutionMode.SERIAL) {
    return PromptFlowExecutionMode.SERIAL
  }

  return PromptFlowExecutionMode.SERIAL
}

export function sanitizePromptFlowInput(input: unknown, fallback = DEFAULT_PROMPT_FLOW_TEMPLATES[0]) {
  const source = normalizeRecord(input)
  const nodes = sanitizeNodes(source.nodes)
  const safeNodes = nodes.length > 0 ? nodes : fallback.nodes
  const edges = sanitizeEdges(source.edges, safeNodes)
  const safeEdges = edges.length > 0 ? edges : fallback.edges

  const rawRetry = normalizeRecord(source.retryPolicy)

  return {
    id: sanitizeTextInput(source.id, 80),
    name: sanitizeTextInput(source.name, 120) || fallback.name,
    description:
      sanitizeMultilineTextInput(source.description, 800).trim() || fallback.description,
    status: normalizePromptFlowStatus(source.status),
    executionMode: normalizePromptFlowExecutionMode(source.executionMode || fallback.executionMode),
    nodes: safeNodes,
    edges: safeEdges,
    contextVariables: Array.isArray(source.contextVariables)
      ? source.contextVariables.slice(0, 40)
      : fallback.contextVariables,
    retryPolicy: {
      maxRetries: resolvePositiveInt(rawRetry.maxRetries, fallback.retryPolicy.maxRetries, 0, 5),
      backoffSeconds: resolvePositiveInt(rawRetry.backoffSeconds, fallback.retryPolicy.backoffSeconds, 0, 300),
    },
  }
}

export function buildPromptFlowSeed(userId: string) {
  return DEFAULT_PROMPT_FLOW_TEMPLATES.map((item) => ({
    userId,
    name: item.name,
    description: item.description,
    status: PromptFlowStatus.DRAFT,
    executionMode: item.executionMode,
    nodes: item.nodes,
    edges: item.edges,
    contextVariables: item.contextVariables,
    retryPolicy: item.retryPolicy,
    version: 1,
  }))
}

function buildExecutionOrder(nodes: FlowNode[], edges: FlowEdge[], mode: PromptFlowExecutionMode) {
  if (mode === PromptFlowExecutionMode.SERIAL) {
    return nodes.map((item) => [item.id])
  }

  const incoming = new Map<string, number>()
  const outgoing = new Map<string, string[]>()
  for (const node of nodes) {
    incoming.set(node.id, 0)
    outgoing.set(node.id, [])
  }

  for (const edge of edges) {
    incoming.set(edge.to, (incoming.get(edge.to) || 0) + 1)
    outgoing.set(edge.from, [...(outgoing.get(edge.from) || []), edge.to])
  }

  const levels: string[][] = []
  let queue = nodes.filter((item) => (incoming.get(item.id) || 0) === 0).map((item) => item.id)
  const visited = new Set<string>()

  while (queue.length > 0) {
    levels.push(queue)
    const nextQueue: string[] = []

    for (const nodeId of queue) {
      visited.add(nodeId)
      for (const target of outgoing.get(nodeId) || []) {
        incoming.set(target, (incoming.get(target) || 1) - 1)
        if ((incoming.get(target) || 0) <= 0) {
          nextQueue.push(target)
        }
      }
    }

    queue = Array.from(new Set(nextQueue))
  }

  if (visited.size !== nodes.length) {
    return nodes.map((item) => [item.id])
  }

  return levels
}

export function simulatePromptFlowExecution({
  nodes,
  edges,
  executionMode,
  retryPolicy,
}: {
  nodes: FlowNode[]
  edges: FlowEdge[]
  executionMode: PromptFlowExecutionMode
  retryPolicy: {
    maxRetries: number
    backoffSeconds: number
  }
}) {
  const startedAt = new Date()
  const executionOrder = buildExecutionOrder(nodes, edges, executionMode)
  const nodeMap = new Map(nodes.map((item) => [item.id, item]))

  const events: Array<{
    nodeId: string
    nodeTitle: string
    stage: string
    attempt: number
    status: string
    timestamp: string
  }> = []

  let failedNodeId = ""
  let attempts = 0

  for (const level of executionOrder) {
    for (const nodeId of level) {
      const node = nodeMap.get(nodeId)
      if (!node) {
        continue
      }

      const failTimes = resolvePositiveInt(node.config?.failTimes, 0, 0, 3)
      let succeeded = false
      let attempt = 0

      while (attempt <= retryPolicy.maxRetries) {
        attempt += 1
        attempts += 1

        const shouldFail = attempt <= failTimes
        events.push({
          nodeId: node.id,
          nodeTitle: node.title,
          stage: node.type,
          attempt,
          status: shouldFail ? "failed" : "succeeded",
          timestamp: new Date().toISOString(),
        })

        if (!shouldFail) {
          succeeded = true
          break
        }
      }

      if (!succeeded) {
        failedNodeId = node.id
        if (executionMode === PromptFlowExecutionMode.SERIAL) {
          break
        }
      }
    }

    if (failedNodeId && executionMode === PromptFlowExecutionMode.SERIAL) {
      break
    }
  }

  const endedAt = new Date()
  const failedCount = failedNodeId ? 1 : 0

  return {
    status: failedNodeId ? PromptFlowRunStatus.FAILED : PromptFlowRunStatus.SUCCEEDED,
    startedAt,
    endedAt,
    attempts,
    errorMessage: failedNodeId ? `节点 ${failedNodeId} 执行失败并耗尽重试次数` : "",
    metrics: {
      totalNodes: nodes.length,
      totalEdges: edges.length,
      failedNodes: failedCount,
      durationMs: endedAt.getTime() - startedAt.getTime(),
      executionMode,
    },
    runLog: {
      executionOrder,
      retryPolicy,
      events,
    },
  }
}

export function resolvePromptFlowReplayToken(flowId: string, rawToken: unknown) {
  const explicit = sanitizeTextInput(rawToken, 120)
  if (explicit) {
    return explicit
  }

  return createHash("sha256").update(`${flowId}:${new Date().toISOString().slice(0, 13)}`).digest("hex").slice(0, 24)
}
