import { PhaseClosureStatus } from "@prisma/client"

import { sanitizeMultilineTextInput, sanitizeTextInput } from "@/lib/security"

function toRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {} as Record<string, unknown>
  }
  return value as Record<string, unknown>
}

export function normalizePhaseClosureStatus(value: unknown) {
  const normalized = sanitizeTextInput(value, 20).toUpperCase()
  if (normalized === PhaseClosureStatus.IN_REVIEW) {
    return PhaseClosureStatus.IN_REVIEW
  }
  if (normalized === PhaseClosureStatus.SIGNED_OFF) {
    return PhaseClosureStatus.SIGNED_OFF
  }
  if (normalized === PhaseClosureStatus.FROZEN) {
    return PhaseClosureStatus.FROZEN
  }
  return PhaseClosureStatus.DRAFT
}

export function sanitizePhaseClosureInput(input: unknown) {
  const source = toRecord(input)

  return {
    status: normalizePhaseClosureStatus(source.status),
    functionalGatePassed: source.functionalGatePassed === true,
    performanceGatePassed: source.performanceGatePassed === true,
    securityGatePassed: source.securityGatePassed === true,
    runbookUrl: sanitizeTextInput(source.runbookUrl, 300),
    emergencyPlanUrl: sanitizeTextInput(source.emergencyPlanUrl, 300),
    trainingMaterialUrl: sanitizeTextInput(source.trainingMaterialUrl, 300),
    rehearsalSummary: sanitizeMultilineTextInput(source.rehearsalSummary, 2000).trim(),
    roadmap: sanitizeMultilineTextInput(source.roadmap, 3000).trim(),
    baselineTag: sanitizeTextInput(source.baselineTag, 80),
  }
}

export function resolvePhase6ClosureScore(input: {
  functionalGatePassed: boolean
  performanceGatePassed: boolean
  securityGatePassed: boolean
  runbookUrl: string
  emergencyPlanUrl: string
  trainingMaterialUrl: string
}) {
  const checks = [
    input.functionalGatePassed,
    input.performanceGatePassed,
    input.securityGatePassed,
    Boolean(input.runbookUrl),
    Boolean(input.emergencyPlanUrl),
    Boolean(input.trainingMaterialUrl),
  ]

  const passed = checks.filter(Boolean).length
  const percent = Number(((passed / checks.length) * 100).toFixed(2))

  return {
    passed,
    total: checks.length,
    percent,
    readyToFreeze: percent >= 90,
  }
}

export function listPhaseClosureTransitions(status: PhaseClosureStatus, readyToFreeze: boolean): PhaseClosureStatus[] {
  switch (status) {
    case PhaseClosureStatus.DRAFT:
      return [PhaseClosureStatus.IN_REVIEW]
    case PhaseClosureStatus.IN_REVIEW:
      return readyToFreeze ? [PhaseClosureStatus.DRAFT, PhaseClosureStatus.SIGNED_OFF] : [PhaseClosureStatus.DRAFT]
    case PhaseClosureStatus.SIGNED_OFF:
      return readyToFreeze ? [PhaseClosureStatus.IN_REVIEW, PhaseClosureStatus.FROZEN] : [PhaseClosureStatus.IN_REVIEW]
    case PhaseClosureStatus.FROZEN:
    default:
      return []
  }
}

export function canTransitionPhaseClosureStatus(
  from: PhaseClosureStatus,
  to: PhaseClosureStatus,
  readyToFreeze: boolean
) {
  if (from === to) {
    return true
  }

  return listPhaseClosureTransitions(from, readyToFreeze).includes(to)
}

export function resolvePhase6FreezeTimestamp(status: PhaseClosureStatus, currentFrozenAt: Date | null) {
  if (status !== PhaseClosureStatus.FROZEN) {
    return null
  }

  return currentFrozenAt || new Date()
}
