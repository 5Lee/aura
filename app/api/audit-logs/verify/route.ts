import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { AuditRiskLevel } from "@prisma/client"

import { authOptions } from "@/lib/auth"
import { verifyAuditHashChain } from "@/lib/compliance-audit"
import { prisma } from "@/lib/db"
import { recordPromptAuditLog } from "@/lib/prompt-audit-log"

export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 })
  }

  try {
    const logs = await prisma.promptAuditLog.findMany({
      where: {
        OR: [{ actorId: session.user.id }, { prompt: { authorId: session.user.id } }],
      },
      select: {
        id: true,
        action: true,
        status: true,
        resource: true,
        promptId: true,
        actorId: true,
        metadata: true,
        createdAt: true,
        previousHash: true,
        entryHash: true,
      },
      orderBy: { createdAt: "asc" },
      take: 5000,
    })

    const verification = await verifyAuditHashChain(logs)

    await recordPromptAuditLog({
      actorId: session.user.id,
      action: "audit.chain.verify",
      resource: "compliance",
      status: verification.valid ? "success" : "failure",
      request,
      riskLevel: verification.valid ? undefined : AuditRiskLevel.HIGH,
      metadata: {
        verifiedCount: verification.verifiedCount,
        valid: verification.valid,
        brokenCount: verification.brokenEntries.length,
      },
    })

    return NextResponse.json({
      ...verification,
      inspectedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error("Verify audit hash chain failed:", error)
    return NextResponse.json({ error: "审计链路校验失败" }, { status: 500 })
  }
}
