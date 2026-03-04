import { randomUUID } from "node:crypto"
import { BillingCycle, InvoiceStatus, type BillingInvoice, type InvoiceType } from "@prisma/client"

import { getSubscriptionPlanById, isSubscriptionPlanId } from "@/lib/subscription-plans"

export function generateInvoiceNo(now = new Date()) {
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const day = String(now.getDate()).padStart(2, "0")
  const suffix = randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase()
  return `AURA-${year}${month}${day}-${suffix}`
}

export function resolvePlanAmountCents(planId: string, cycle: BillingCycle) {
  const safePlanId = isSubscriptionPlanId(planId) ? planId : "free"
  const plan = getSubscriptionPlanById(safePlanId)

  if (plan.id === "enterprise") {
    return 0
  }

  const basePrice = cycle === BillingCycle.YEARLY ? plan.yearlyPriceCny : plan.monthlyPriceCny
  return Math.max(0, Number(basePrice ?? 0) * 100)
}

export function calculateInvoiceTotals(subtotalCents: number, taxRateBasisPoints: number) {
  const safeSubtotal = Math.max(0, Math.floor(subtotalCents))
  const safeRate = Math.max(0, Math.floor(taxRateBasisPoints))
  const taxCents = Math.round((safeSubtotal * safeRate) / 10000)
  const totalCents = safeSubtotal + taxCents

  return {
    subtotalCents: safeSubtotal,
    taxRateBasisPoints: safeRate,
    taxCents,
    totalCents,
  }
}

export function formatCents(cents: number) {
  return (cents / 100).toFixed(2)
}

export function createRefundCompensationDraft(invoice: BillingInvoice, refundCents: number) {
  const safeRefund = Math.max(0, Math.floor(refundCents))
  const taxRefundCents = Math.round((safeRefund * invoice.taxRateBasisPoints) / 10000)
  const totalRefundCents = safeRefund + taxRefundCents

  return {
    type: "REFUND" as InvoiceType,
    status: InvoiceStatus.REFUNDED,
    subtotalCents: -safeRefund,
    taxRateBasisPoints: invoice.taxRateBasisPoints,
    taxCents: -taxRefundCents,
    totalCents: -totalRefundCents,
    refundedCents: totalRefundCents,
    amountDueCents: 0,
    refundedAt: new Date(),
    notes: `Refund compensation for ${invoice.invoiceNo}`,
    metadata: {
      sourceInvoiceId: invoice.id,
      sourceInvoiceNo: invoice.invoiceNo,
      refundedPrincipalCents: safeRefund,
      refundedTaxCents: taxRefundCents,
    },
  }
}

export function resolveInvoiceStatusAfterRefund(current: InvoiceStatus, remainingDueCents: number) {
  if (remainingDueCents <= 0) {
    return InvoiceStatus.REFUNDED
  }

  if (current === InvoiceStatus.PAID) {
    return InvoiceStatus.PAID
  }

  return InvoiceStatus.ISSUED
}
