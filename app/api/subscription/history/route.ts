import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"

import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"

function resolvePositiveInt(value: string | null, fallback: number, min: number, max: number) {
  const parsed = Number(value || "")
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

function escapeCsvValue(value: unknown) {
  const normalized = String(value ?? "")
  if (normalized.includes(",") || normalized.includes("\"") || normalized.includes("\n")) {
    return `"${normalized.replace(/"/g, "\"\"")}"`
  }
  return normalized
}

function toCsv(rows: Array<Record<string, unknown>>) {
  if (rows.length === 0) {
    return "id,type,status,provider,providerEventId,createdAt,processedAt\n"
  }

  const headers = ["id", "type", "status", "provider", "providerEventId", "createdAt", "processedAt"]
  const lines = rows.map((row) =>
    headers.map((header) => escapeCsvValue(row[header])).join(",")
  )
  return `${headers.join(",")}\n${lines.join("\n")}\n`
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const format = searchParams.get("format")
  const page = resolvePositiveInt(searchParams.get("page"), 1, 1, 1000)
  const pageSize = resolvePositiveInt(searchParams.get("pageSize"), 20, 10, 200)
  const skip = (page - 1) * pageSize

  const where = {
    userId: session.user.id,
  }

  const [events, total] = await prisma.$transaction([
    prisma.billingEvent.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
      include: {
        subscription: {
          select: {
            planId: true,
            status: true,
            cycle: true,
          },
        },
      },
    }),
    prisma.billingEvent.count({ where }),
  ])

  if (format === "csv") {
    const csvRows = events.map((event) => ({
      id: event.id,
      type: event.type,
      status: event.status,
      provider: event.provider,
      providerEventId: event.providerEventId,
      createdAt: event.createdAt.toISOString(),
      processedAt: event.processedAt?.toISOString() ?? "",
    }))
    const csvContent = toCsv(csvRows)

    return new NextResponse(csvContent, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": "attachment; filename=\"aura-billing-history.csv\"",
      },
    })
  }

  return NextResponse.json({
    data: events,
    meta: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  })
}
