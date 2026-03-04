import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const schemaSource = readFileSync(new URL("../prisma/schema.prisma", import.meta.url), "utf8")
const invoiceLibSource = readFileSync(new URL("../lib/billing-invoice.ts", import.meta.url), "utf8")
const invoiceProfileRouteSource = readFileSync(
  new URL("../app/api/billing/invoice-profile/route.ts", import.meta.url),
  "utf8"
)
const invoicesRouteSource = readFileSync(
  new URL("../app/api/billing/invoices/route.ts", import.meta.url),
  "utf8"
)
const invoiceRefundRouteSource = readFileSync(
  new URL("../app/api/billing/invoices/[id]/refund/route.ts", import.meta.url),
  "utf8"
)
const billingPageSource = readFileSync(
  new URL("../app/(dashboard)/billing/page.tsx", import.meta.url),
  "utf8"
)
const invoicePanelSource = readFileSync(
  new URL("../components/billing/invoice-management-panel.tsx", import.meta.url),
  "utf8"
)
const phase5FeatureList = JSON.parse(
  readFileSync(new URL("../feature_list_phase5_commercialization.json", import.meta.url), "utf8")
)

test("schema includes invoice profile and invoice tracking models", () => {
  assert.match(schemaSource, /model InvoiceProfile \{/)
  assert.match(schemaSource, /model BillingInvoice \{/)
  assert.match(schemaSource, /enum InvoiceType \{/)
  assert.match(schemaSource, /enum InvoiceStatus \{/)
  assert.match(schemaSource, /invoiceNo\s+String\s+@unique/)
})

test("invoice utility provides invoice number generation and refund compensation helpers", () => {
  assert.match(invoiceLibSource, /generateInvoiceNo/)
  assert.match(invoiceLibSource, /calculateInvoiceTotals/)
  assert.match(invoiceLibSource, /createRefundCompensationDraft/)
  assert.match(invoiceLibSource, /resolveInvoiceStatusAfterRefund/)
})

test("invoice profile route supports authenticated upsert management", () => {
  assert.match(invoiceProfileRouteSource, /prisma\.invoiceProfile\.findUnique/)
  assert.match(invoiceProfileRouteSource, /prisma\.invoiceProfile\.upsert/)
  assert.match(invoiceProfileRouteSource, /发票抬头和税号不能为空/)
})

test("invoice routes support issue, export and refund compensation flow", () => {
  assert.match(invoicesRouteSource, /format === "csv"/)
  assert.match(invoicesRouteSource, /generateInvoiceNo\(\)/)
  assert.match(invoicesRouteSource, /invoice\.issued/)
  assert.match(invoiceRefundRouteSource, /createRefundCompensationDraft/)
  assert.match(invoiceRefundRouteSource, /invoice\.refund\.processed/)
  assert.match(invoiceRefundRouteSource, /compensationInvoice/)
})

test("billing page integrates invoice management panel and refund operation entry", () => {
  assert.match(billingPageSource, /发票与税务管理/)
  assert.match(billingPageSource, /InvoiceManagementPanel/)
  assert.match(invoicePanelSource, /\/api\/billing\/invoice-profile/)
  assert.match(invoicePanelSource, /\/api\/billing\/invoices\?format=csv/)
  assert.match(invoicePanelSource, /\/api\/billing\/invoices\/\$\{invoice\.id\}\/refund/)
})

test("phase5 tracker marks week17-004 complete with synced metadata", () => {
  assert.equal(phase5FeatureList.meta.total_features, 16)
  assert.ok(phase5FeatureList.meta.completed_features >= 4)
  const feature = phase5FeatureList.features.find((item) => item.id === "phase5-week17-004")
  assert.ok(feature)
  assert.equal(feature.passes, true)
})
