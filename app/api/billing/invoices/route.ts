import { BillingEventProcessStatus, InvoiceStatus, InvoiceType } from "@prisma/client"
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"

import { authOptions } from "@/lib/auth"
import { calculateInvoiceTotals, generateInvoiceNo, resolvePlanAmountCents } from "@/lib/billing-invoice"
import { prisma } from "@/lib/db"
import { sanitizeMultilineTextInput } from "@/lib/security"

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

function buildCsv(records: Array<Record<string, unknown>>) {
  const headers = [
    "invoiceNo",
    "type",
    "status",
    "currency",
    "subtotal",
    "tax",
    "total",
    "refunded",
    "amountDue",
    "issuedAt",
  ]

  const rows = records.map((record) => headers.map((key) => escapeCsvValue(record[key])).join(","))
  return `${headers.join(",")}\n${rows.join("\n")}\n`
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const format = searchParams.get("format")
  const page = resolvePositiveInt(searchParams.get("page"), 1, 1, 1000)
  const pageSize = resolvePositiveInt(searchParams.get("pageSize"), 20, 10, 100)
  const skip = (page - 1) * pageSize

  const [invoices, total] = await prisma.$transaction([
    prisma.billingInvoice.findMany({
      where: { userId: session.user.id },
      include: {
        profile: true,
        subscription: {
          select: {
            planId: true,
            cycle: true,
            status: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
    }),
    prisma.billingInvoice.count({ where: { userId: session.user.id } }),
  ])

  if (format === "csv") {
    const csv = buildCsv(
      invoices.map((item) => ({
        invoiceNo: item.invoiceNo,
        type: item.type,
        status: item.status,
        currency: item.currency,
        subtotal: (item.subtotalCents / 100).toFixed(2),
        tax: (item.taxCents / 100).toFixed(2),
        total: (item.totalCents / 100).toFixed(2),
        refunded: (item.refundedCents / 100).toFixed(2),
        amountDue: (item.amountDueCents / 100).toFixed(2),
        issuedAt: item.issuedAt.toISOString(),
      }))
    )
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": "attachment; filename=\"aura-invoices.csv\"",
      },
    })
  }

  return NextResponse.json({
    data: invoices,
    meta: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  })
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 })
  }

  try {
    const body = await request.json().catch(() => ({}))
    const note = sanitizeMultilineTextInput(body.note, 800).trim() || null
    const subscription =
      (await prisma.subscription.findFirst({
        where: { userId: session.user.id },
        orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      })) ?? null

    if (!subscription) {
      return NextResponse.json({ error: "暂无订阅可开票" }, { status: 400 })
    }

    const profile = await prisma.invoiceProfile.findUnique({
      where: { userId: session.user.id },
    })

    if (!profile) {
      return NextResponse.json({ error: "请先完善发票抬头与税号信息" }, { status: 400 })
    }

    const billingEvent =
      (await prisma.billingEvent.findFirst({
        where: {
          userId: session.user.id,
          subscriptionId: subscription.id,
          status: BillingEventProcessStatus.PROCESSED,
        },
        orderBy: { createdAt: "desc" },
      })) ?? null

    const subtotalCents = resolvePlanAmountCents(subscription.planId, subscription.cycle)
    const taxRateBasisPoints = profile.taxNumber ? 600 : 0
    const totals = calculateInvoiceTotals(subtotalCents, taxRateBasisPoints)

    const invoice = await prisma.billingInvoice.create({
      data: {
        invoiceNo: generateInvoiceNo(),
        userId: session.user.id,
        profileId: profile.id,
        subscriptionId: subscription.id,
        billingEventId: billingEvent?.id,
        type: InvoiceType.SUBSCRIPTION,
        status: InvoiceStatus.ISSUED,
        currency: "CNY",
        subtotalCents: totals.subtotalCents,
        taxRateBasisPoints: totals.taxRateBasisPoints,
        taxCents: totals.taxCents,
        totalCents: totals.totalCents,
        refundedCents: 0,
        amountDueCents: totals.totalCents,
        dueAt: subscription.currentPeriodEnd ?? null,
        notes: note,
        metadata: {
          planId: subscription.planId,
          cycle: subscription.cycle,
          sourceBillingEventId: billingEvent?.id ?? null,
        },
      },
      include: {
        profile: true,
      },
    })

    if (billingEvent) {
      const payload = (billingEvent.payload && typeof billingEvent.payload === "object"
        ? billingEvent.payload
        : {}) as Record<string, unknown>
      await prisma.billingEvent.update({
        where: { id: billingEvent.id },
        data: {
          payload: {
            ...payload,
            invoiceId: invoice.id,
            invoiceNo: invoice.invoiceNo,
          },
        },
      })
    }

    await prisma.billingEvent.create({
      data: {
        userId: session.user.id,
        subscriptionId: subscription.id,
        provider: subscription.provider,
        providerEventId: `local_invoice_issue_${Date.now()}`,
        type: "invoice.issued",
        status: BillingEventProcessStatus.PROCESSED,
        payload: {
          invoiceId: invoice.id,
          invoiceNo: invoice.invoiceNo,
          totalCents: invoice.totalCents,
        },
        processedAt: new Date(),
      },
    })

    return NextResponse.json({ invoice }, { status: 201 })
  } catch (error) {
    console.error("Issue invoice failed:", error)
    return NextResponse.json({ error: "开具发票失败，请稍后重试" }, { status: 500 })
  }
}
