import { BillingEventProcessStatus, BillingProvider, InvoiceStatus } from "@prisma/client"
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"

import {
  createRefundCompensationDraft,
  generateInvoiceNo,
  resolveInvoiceStatusAfterRefund,
} from "@/lib/billing-invoice"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { sanitizeMultilineTextInput } from "@/lib/security"

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 })
  }

  try {
    const body = await request.json().catch(() => ({}))
    const invoice = await prisma.billingInvoice.findFirst({
      where: {
        id: params.id,
        userId: session.user.id,
      },
    })

    if (!invoice) {
      return NextResponse.json({ error: "发票不存在" }, { status: 404 })
    }

    if (invoice.status === InvoiceStatus.VOID) {
      return NextResponse.json({ error: "作废发票不可退款" }, { status: 400 })
    }

    const remainingRefundable = Math.max(0, invoice.totalCents - invoice.refundedCents)
    if (remainingRefundable <= 0) {
      return NextResponse.json({ error: "发票已完成冲销" }, { status: 400 })
    }

    const requestedRefund = Math.floor(Number(body.refundCents ?? remainingRefundable))
    const refundCents = Math.min(Math.max(requestedRefund, 1), remainingRefundable)
    const note = sanitizeMultilineTextInput(body.note, 800).trim() || null

    const updated = await prisma.$transaction(async (tx) => {
      const nextRefundedCents = invoice.refundedCents + refundCents
      const nextAmountDueCents = Math.max(0, invoice.amountDueCents - refundCents)
      const status = resolveInvoiceStatusAfterRefund(invoice.status, nextAmountDueCents)

      const updatedInvoice = await tx.billingInvoice.update({
        where: { id: invoice.id },
        data: {
          refundedCents: nextRefundedCents,
          amountDueCents: nextAmountDueCents,
          status,
          refundedAt: nextRefundedCents >= invoice.totalCents ? new Date() : invoice.refundedAt,
          notes: note || invoice.notes,
        },
      })

      const compensationDraft = createRefundCompensationDraft(invoice, refundCents)
      const compensationInvoice = await tx.billingInvoice.create({
        data: {
          invoiceNo: generateInvoiceNo(),
          userId: invoice.userId,
          profileId: invoice.profileId,
          subscriptionId: invoice.subscriptionId,
          billingEventId: invoice.billingEventId,
          ...compensationDraft,
        },
      })

      await tx.billingEvent.create({
        data: {
          userId: invoice.userId,
          subscriptionId: invoice.subscriptionId,
          provider: BillingProvider.MOCKPAY,
          providerEventId: `local_invoice_refund_${Date.now()}`,
          type: "invoice.refund.processed",
          status: BillingEventProcessStatus.PROCESSED,
          payload: {
            invoiceId: invoice.id,
            invoiceNo: invoice.invoiceNo,
            refundCents,
            compensationInvoiceId: compensationInvoice.id,
            compensationInvoiceNo: compensationInvoice.invoiceNo,
          },
          processedAt: new Date(),
        },
      })

      return {
        updatedInvoice,
        compensationInvoice,
      }
    })

    return NextResponse.json({
      refunded: true,
      invoice: updated.updatedInvoice,
      compensationInvoice: updated.compensationInvoice,
    })
  } catch (error) {
    console.error("Invoice refund failed:", error)
    return NextResponse.json({ error: "发票退款失败，请稍后重试" }, { status: 500 })
  }
}
