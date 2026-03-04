import {
  SupportEscalationLevel,
  SupportEscalationStatus,
  SupportPostmortemStatus,
  SupportTicketPriority,
  SupportTicketTier,
} from "@prisma/client"

import { sanitizeJsonValue, sanitizeMultilineTextInput, sanitizeTextInput } from "@/lib/security"
import { isSubscriptionPlanId, type SubscriptionPlanId } from "@/lib/subscription-plans"

export type SupportEscalationPath = {
  planId: SubscriptionPlanId
  level: SupportEscalationLevel
  fromTier: SupportTicketTier
  fromPriority: SupportTicketPriority
  targetTier: SupportTicketTier
  targetPriority: SupportTicketPriority
  targetTeam: string
  targetRole: string
  responseSlaHours: number
  resolutionSlaHours: number
  workflowSteps: string[]
}

export const PLAN_ENTERPRISE_ESCALATION_PATHS: Record<SubscriptionPlanId, SupportEscalationPath[]> = {
  free: [
    {
      planId: "free",
      level: SupportEscalationLevel.L1,
      fromTier: SupportTicketTier.COMMUNITY,
      fromPriority: SupportTicketPriority.NORMAL,
      targetTier: SupportTicketTier.STANDARD,
      targetPriority: SupportTicketPriority.NORMAL,
      targetTeam: "community-success",
      targetRole: "support-owner",
      responseSlaHours: 48,
      resolutionSlaHours: 120,
      workflowSteps: ["确认问题", "收集复现信息", "社区升级排队"],
    },
  ],
  pro: [
    {
      planId: "pro",
      level: SupportEscalationLevel.L1,
      fromTier: SupportTicketTier.STANDARD,
      fromPriority: SupportTicketPriority.HIGH,
      targetTier: SupportTicketTier.PRIORITY,
      targetPriority: SupportTicketPriority.HIGH,
      targetTeam: "pro-support",
      targetRole: "incident-commander",
      responseSlaHours: 8,
      resolutionSlaHours: 48,
      workflowSteps: ["确认影响范围", "同步值班人员", "拉起快速诊断"],
    },
  ],
  team: [
    {
      planId: "team",
      level: SupportEscalationLevel.L2,
      fromTier: SupportTicketTier.PRIORITY,
      fromPriority: SupportTicketPriority.HIGH,
      targetTier: SupportTicketTier.DEDICATED,
      targetPriority: SupportTicketPriority.URGENT,
      targetTeam: "team-incident-response",
      targetRole: "incident-commander",
      responseSlaHours: 4,
      resolutionSlaHours: 24,
      workflowSteps: ["创建事故群", "指定 IC", "跨团队联动排障", "输出阶段进展"],
    },
  ],
  enterprise: [
    {
      planId: "enterprise",
      level: SupportEscalationLevel.L3,
      fromTier: SupportTicketTier.DEDICATED,
      fromPriority: SupportTicketPriority.HIGH,
      targetTier: SupportTicketTier.DEDICATED,
      targetPriority: SupportTicketPriority.URGENT,
      targetTeam: "enterprise-incident-response",
      targetRole: "incident-commander",
      responseSlaHours: 1,
      resolutionSlaHours: 8,
      workflowSteps: [
        "5 分钟内完成分级",
        "15 分钟内建立跨团队战情室",
        "30 分钟内同步客户状态",
        "恢复后 24 小时内完成复盘",
      ],
    },
    {
      planId: "enterprise",
      level: SupportEscalationLevel.EXECUTIVE,
      fromTier: SupportTicketTier.DEDICATED,
      fromPriority: SupportTicketPriority.URGENT,
      targetTier: SupportTicketTier.DEDICATED,
      targetPriority: SupportTicketPriority.URGENT,
      targetTeam: "executive-escalation-board",
      targetRole: "executive-sponsor",
      responseSlaHours: 1,
      resolutionSlaHours: 4,
      workflowSteps: ["升级到管理层", "客户高频同步", "资源优先级调整", "结案确认"],
    },
  ],
}

export function buildSupportEscalationPolicySeed(planId: string) {
  const normalizedPlan = normalizePlanId(planId)
  const source = PLAN_ENTERPRISE_ESCALATION_PATHS[normalizedPlan]

  return source.map((item) => ({
    planId: item.planId,
    level: item.level,
    fromTier: item.fromTier,
    fromPriority: item.fromPriority,
    targetTier: item.targetTier,
    targetPriority: item.targetPriority,
    targetTeam: item.targetTeam,
    targetRole: item.targetRole,
    responseSlaHours: item.responseSlaHours,
    resolutionSlaHours: item.resolutionSlaHours,
    workflowSteps: item.workflowSteps,
  }))
}

export type SupportRunbookConfig = {
  triageChecklist: string[]
  escalationWorkflow: string[]
  responseWorkflow: string[]
  contactMatrix: Array<{
    role: string
    team: string
    channel: string
    owner: string
  }>
  postmortemTemplate: {
    timeline: string[]
    impactAssessment: string[]
    rootCause: string[]
    actionItems: string[]
  }
}

export const DEFAULT_SUPPORT_RUNBOOK_CONFIG: SupportRunbookConfig = {
  triageChecklist: [
    "确认问题是否可复现",
    "确认影响用户范围和业务影响",
    "标记优先级与支持等级",
    "绑定对应工单与监控告警",
  ],
  escalationWorkflow: [
    "L1: 值班支持工程师接单",
    "L2: 研发/运维联合排障",
    "L3: 跨团队战情室",
    "Executive: 管理层沟通与资源协调",
  ],
  responseWorkflow: [
    "10 分钟内首次响应",
    "30 分钟内给出阶段性判断",
    "每 60 分钟同步一次进展",
    "恢复后 24 小时内完成 RCA 草稿",
  ],
  contactMatrix: [
    {
      role: "Incident Commander",
      team: "enterprise-support",
      channel: "#incident-war-room",
      owner: "oncall-ic",
    },
    {
      role: "Tech Lead",
      team: "platform-engineering",
      channel: "#platform-oncall",
      owner: "oncall-platform",
    },
    {
      role: "Customer Success",
      team: "enterprise-cs",
      channel: "#customer-updates",
      owner: "cs-owner",
    },
  ],
  postmortemTemplate: {
    timeline: ["事件开始", "发现告警", "升级动作", "恢复动作", "结案时间"],
    impactAssessment: ["受影响客户", "受影响时长", "业务损失估算"],
    rootCause: ["直接原因", "触发条件", "系统性因素"],
    actionItems: ["短期修复", "中期改进", "长期治理"],
  },
}

export function hasEnterpriseSupportProcessAccess(planId: string) {
  if (!isSubscriptionPlanId(planId)) {
    return false
  }
  return planId === "team" || planId === "enterprise"
}

function normalizePlanId(planId: string) {
  if (!isSubscriptionPlanId(planId)) {
    return "free" as const
  }
  return planId
}

function sanitizeStringArray(value: unknown, maxItems: number, maxLength: number) {
  const rawArray = Array.isArray(value)
    ? value
    : sanitizeMultilineTextInput(value, 3000)
        .split(/\n+/)
        .map((item) => item.trim())

  return rawArray
    .map((item) => sanitizeTextInput(item, maxLength))
    .filter(Boolean)
    .slice(0, maxItems)
}

function sanitizeContactMatrix(value: unknown) {
  if (!Array.isArray(value)) {
    return DEFAULT_SUPPORT_RUNBOOK_CONFIG.contactMatrix
  }

  const rows = value
    .slice(0, 20)
    .map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        return null
      }
      const row = item as Record<string, unknown>
      const role = sanitizeTextInput(row.role, 80)
      const team = sanitizeTextInput(row.team, 80)
      const channel = sanitizeTextInput(row.channel, 120)
      const owner = sanitizeTextInput(row.owner, 120)
      if (!role || !team || !channel) {
        return null
      }
      return { role, team, channel, owner }
    })
    .filter((item): item is { role: string; team: string; channel: string; owner: string } =>
      Boolean(item)
    )

  if (rows.length === 0) {
    return DEFAULT_SUPPORT_RUNBOOK_CONFIG.contactMatrix
  }
  return rows
}

function normalizeRunbookRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {} as Record<string, unknown>
  }
  return value as Record<string, unknown>
}

export function extractSupportRunbookConfig(raw: unknown): SupportRunbookConfig {
  const source = normalizeRunbookRecord(raw)
  const rawTemplate = normalizeRunbookRecord(source.postmortemTemplate)
  const triageChecklist = sanitizeStringArray(source.triageChecklist, 20, 160)
  const escalationWorkflow = sanitizeStringArray(source.escalationWorkflow, 20, 180)
  const responseWorkflow = sanitizeStringArray(source.responseWorkflow, 20, 180)
  const templateTimeline = sanitizeStringArray(rawTemplate.timeline, 20, 160)
  const templateImpact = sanitizeStringArray(rawTemplate.impactAssessment, 20, 160)
  const templateRootCause = sanitizeStringArray(rawTemplate.rootCause, 20, 160)
  const templateActionItems = sanitizeStringArray(rawTemplate.actionItems, 20, 160)

  return {
    triageChecklist:
      triageChecklist.length > 0
        ? triageChecklist
        : DEFAULT_SUPPORT_RUNBOOK_CONFIG.triageChecklist,
    escalationWorkflow:
      escalationWorkflow.length > 0
        ? escalationWorkflow
        : DEFAULT_SUPPORT_RUNBOOK_CONFIG.escalationWorkflow,
    responseWorkflow:
      responseWorkflow.length > 0
        ? responseWorkflow
        : DEFAULT_SUPPORT_RUNBOOK_CONFIG.responseWorkflow,
    contactMatrix: sanitizeContactMatrix(source.contactMatrix),
    postmortemTemplate: {
      timeline:
        templateTimeline.length > 0
          ? templateTimeline
          : DEFAULT_SUPPORT_RUNBOOK_CONFIG.postmortemTemplate.timeline,
      impactAssessment:
        templateImpact.length > 0
          ? templateImpact
          : DEFAULT_SUPPORT_RUNBOOK_CONFIG.postmortemTemplate.impactAssessment,
      rootCause:
        templateRootCause.length > 0
          ? templateRootCause
          : DEFAULT_SUPPORT_RUNBOOK_CONFIG.postmortemTemplate.rootCause,
      actionItems:
        templateActionItems.length > 0
          ? templateActionItems
          : DEFAULT_SUPPORT_RUNBOOK_CONFIG.postmortemTemplate.actionItems,
    },
  }
}

export function resolveEscalationPath({
  planId,
  tier,
  priority,
}: {
  planId: string
  tier: SupportTicketTier
  priority: SupportTicketPriority
}) {
  const normalizedPlan = normalizePlanId(planId)
  const paths = PLAN_ENTERPRISE_ESCALATION_PATHS[normalizedPlan]

  const matched =
    paths.find(
      (path) =>
        path.fromTier === tier &&
        path.fromPriority === priority
    ) ||
    paths.find((path) => path.fromTier === tier)

  return matched || null
}

export function normalizeSupportEscalationLevel(value: unknown) {
  const normalized = sanitizeTextInput(value, 20).toUpperCase()
  if (normalized === SupportEscalationLevel.L2) {
    return SupportEscalationLevel.L2
  }
  if (normalized === SupportEscalationLevel.L3) {
    return SupportEscalationLevel.L3
  }
  if (normalized === SupportEscalationLevel.EXECUTIVE) {
    return SupportEscalationLevel.EXECUTIVE
  }
  return SupportEscalationLevel.L1
}

export function normalizeSupportTicketPriority(value: unknown) {
  const normalized = sanitizeTextInput(value, 20).toUpperCase()
  if (normalized === SupportTicketPriority.LOW) {
    return SupportTicketPriority.LOW
  }
  if (normalized === SupportTicketPriority.NORMAL) {
    return SupportTicketPriority.NORMAL
  }
  if (normalized === SupportTicketPriority.HIGH) {
    return SupportTicketPriority.HIGH
  }
  if (normalized === SupportTicketPriority.URGENT) {
    return SupportTicketPriority.URGENT
  }
  return SupportTicketPriority.NORMAL
}

export function normalizeEscalationStatus(value: unknown) {
  const normalized = sanitizeTextInput(value, 20).toUpperCase()
  if (normalized === SupportEscalationStatus.ACKNOWLEDGED) {
    return SupportEscalationStatus.ACKNOWLEDGED
  }
  if (normalized === SupportEscalationStatus.RESOLVED) {
    return SupportEscalationStatus.RESOLVED
  }
  return SupportEscalationStatus.OPEN
}

export function normalizePostmortemStatus(value: unknown) {
  const normalized = sanitizeTextInput(value, 20).toUpperCase()
  if (normalized === SupportPostmortemStatus.PUBLISHED) {
    return SupportPostmortemStatus.PUBLISHED
  }
  if (normalized === SupportPostmortemStatus.ARCHIVED) {
    return SupportPostmortemStatus.ARCHIVED
  }
  return SupportPostmortemStatus.DRAFT
}

export function sanitizePostmortemInput(input: unknown) {
  const source = normalizeRunbookRecord(input)
  const timeline = sanitizeJsonValue(source.timeline, {
    maxDepth: 3,
    maxKeysPerObject: 32,
    maxArrayLength: 50,
    maxStringLength: 400,
  })
  const actionItems = sanitizeJsonValue(source.actionItems, {
    maxDepth: 3,
    maxKeysPerObject: 32,
    maxArrayLength: 50,
    maxStringLength: 400,
  })

  const severity = normalizeSupportTicketPriority(source.severity)

  return {
    summary: sanitizeMultilineTextInput(source.summary, 1200).trim(),
    impact: sanitizeMultilineTextInput(source.impact, 2000).trim(),
    rootCause: sanitizeMultilineTextInput(source.rootCause, 2000).trim(),
    severity,
    timeline: timeline || undefined,
    actionItems: actionItems || undefined,
  }
}

export function resolveCrossTeamCollaborationEfficiency({
  escalationEvents,
  postmortems,
}: {
  escalationEvents: Array<{ status: SupportEscalationStatus; createdAt: Date; resolvedAt: Date | null }>
  postmortems: Array<{ status: SupportPostmortemStatus; publishedAt: Date | null; createdAt: Date }>
}) {
  if (escalationEvents.length === 0) {
    return {
      score: 100,
      handoffCount: 0,
      resolvedHandoffRate: 100,
      postmortemPublishRate: postmortems.length > 0 ? 0 : 100,
    }
  }

  const resolvedEscalations = escalationEvents.filter(
    (item) => item.status === SupportEscalationStatus.RESOLVED
  ).length
  const resolvedHandoffRate = Math.round((resolvedEscalations / escalationEvents.length) * 100)

  const publishedPostmortems = postmortems.filter(
    (item) => item.status === SupportPostmortemStatus.PUBLISHED
  ).length
  const postmortemPublishRate =
    postmortems.length === 0 ? 100 : Math.round((publishedPostmortems / postmortems.length) * 100)

  const score = Math.round(resolvedHandoffRate * 0.6 + postmortemPublishRate * 0.4)

  return {
    score,
    handoffCount: escalationEvents.length,
    resolvedHandoffRate,
    postmortemPublishRate,
  }
}
