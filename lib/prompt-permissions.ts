import { PromptPublishStatus, PromptRole } from "@prisma/client"

import { prisma } from "@/lib/db"

export interface PromptPermissionContext {
  promptId: string
  isPublic: boolean
  publishStatus: PromptPublishStatus
  authorId: string | null
}

export interface PromptPermissionResult {
  role: PromptRole | null
  isOwner: boolean
  canView: boolean
  canEdit: boolean
  canReview: boolean
  canPublish: boolean
  canManageMembers: boolean
}

export function getRoleCapabilities(role: PromptRole | null, isOwner: boolean) {
  const normalizedRole = isOwner ? PromptRole.OWNER : role

  return {
    role: normalizedRole,
    canView: Boolean(normalizedRole),
    canEdit: normalizedRole === PromptRole.OWNER || normalizedRole === PromptRole.EDITOR,
    canReview:
      normalizedRole === PromptRole.OWNER ||
      normalizedRole === PromptRole.EDITOR ||
      normalizedRole === PromptRole.REVIEWER,
    canPublish: normalizedRole === PromptRole.OWNER || normalizedRole === PromptRole.REVIEWER,
    canManageMembers: normalizedRole === PromptRole.OWNER,
  }
}

export async function resolvePromptPermission(
  context: PromptPermissionContext,
  userId?: string | null
): Promise<PromptPermissionResult> {
  const isOwner = Boolean(userId && context.authorId && userId === context.authorId)

  let role: PromptRole | null = null
  if (!isOwner && userId) {
    const member = await prisma.promptMember.findUnique({
      where: {
        promptId_userId: {
          promptId: context.promptId,
          userId,
        },
      },
      select: {
        role: true,
      },
    })
    role = member?.role || null
  }

  const capabilities = getRoleCapabilities(role, isOwner)

  const canPublicRead = context.isPublic && context.publishStatus === PromptPublishStatus.PUBLISHED

  return {
    role: capabilities.role,
    isOwner,
    canView: canPublicRead || capabilities.canView,
    canEdit: capabilities.canEdit,
    canReview: capabilities.canReview,
    canPublish: capabilities.canPublish,
    canManageMembers: capabilities.canManageMembers,
  }
}

export function canTransitionPublishStatus(
  from: PromptPublishStatus,
  to: PromptPublishStatus,
  capabilities: Pick<PromptPermissionResult, "canReview" | "canPublish">,
  isPublic: boolean
) {
  if (from === to) {
    return true
  }

  if (to === PromptPublishStatus.DRAFT) {
    return capabilities.canReview
  }

  if (to === PromptPublishStatus.IN_REVIEW) {
    return capabilities.canReview
  }

  if (to === PromptPublishStatus.PUBLISHED) {
    return capabilities.canPublish && isPublic
  }

  if (to === PromptPublishStatus.ARCHIVED) {
    return capabilities.canPublish
  }

  return false
}
