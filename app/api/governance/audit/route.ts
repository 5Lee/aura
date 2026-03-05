import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"

import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import {
  resolveAuditLogResourceMatch,
  resolveGovernanceIntegritySummary,
  sanitizeGovernanceResourceFilter,
} from "@/lib/integration-governance"
import { sanitizeTextInput } from "@/lib/security"
import {
  getUserEntitlementSnapshot,
  hasIntegrationGovernanceAccess,
} from "@/lib/subscription-entitlements"

function resolveTake(value: string | null) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    return 80
  }
  const rounded = Math.floor(parsed)
  if (rounded < 1) {
    return 1
  }
  if (rounded > 300) {
    return 300
  }
  return rounded
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 })
  }

  const snapshot = await getUserEntitlementSnapshot(session.user.id)
  if (!hasIntegrationGovernanceAccess(snapshot.plan.id)) {
    return NextResponse.json(
      {
        error: "连接器与工作流治理仅对 Pro / Team / Enterprise 套餐开放",
        upgradeRequired: true,
      },
      { status: 403 }
    )
  }

  const { searchParams } = new URL(request.url)
  const resource = sanitizeGovernanceResourceFilter(searchParams.get("resource"))
  const resourceId = sanitizeTextInput(searchParams.get("resourceId"), 80)
  const action = sanitizeTextInput(searchParams.get("action"), 120)
  const take = resolveTake(searchParams.get("take"))

  const logs = await prisma.promptAuditLog.findMany({
    where: {
      actorId: session.user.id,
      ...(resource ? { resource } : {}),
      ...(action ? { action: { contains: action } } : {}),
    },
    orderBy: {
      createdAt: "desc",
    },
    take,
  })

  const filtered = resourceId ? logs.filter((item) => resolveAuditLogResourceMatch(item, resourceId)) : logs
  const integrity = resolveGovernanceIntegritySummary(filtered)

  return NextResponse.json({
    logs: filtered,
    integrity,
    resourceScope: {
      resource: resource || "all",
      resourceId: resourceId || "",
    },
  })
}
