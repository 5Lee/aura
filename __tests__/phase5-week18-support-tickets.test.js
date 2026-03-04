import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const schemaSource = readFileSync(new URL("../prisma/schema.prisma", import.meta.url), "utf8")
const supportLibSource = readFileSync(new URL("../lib/support-tickets.ts", import.meta.url), "utf8")
const supportTicketsRouteSource = readFileSync(
  new URL("../app/api/support/tickets/route.ts", import.meta.url),
  "utf8"
)
const supportTicketRouteSource = readFileSync(
  new URL("../app/api/support/tickets/[id]/route.ts", import.meta.url),
  "utf8"
)
const supportPageSource = readFileSync(
  new URL("../app/(dashboard)/support/page.tsx", import.meta.url),
  "utf8"
)
const supportPanelSource = readFileSync(
  new URL("../components/support/support-ticket-panel.tsx", import.meta.url),
  "utf8"
)
const navbarSource = readFileSync(new URL("../components/layout/navbar.tsx", import.meta.url), "utf8")
const mobileHeaderSource = readFileSync(
  new URL("../components/layout/mobile-page-header.tsx", import.meta.url),
  "utf8"
)
const middlewareSource = readFileSync(new URL("../middleware.ts", import.meta.url), "utf8")
const phase5FeatureList = JSON.parse(
  readFileSync(new URL("../feature_list_phase5_commercialization.json", import.meta.url), "utf8")
)

test("schema includes support ticket models with tier and priority enums", () => {
  assert.match(schemaSource, /enum SupportTicketPriority \{/)
  assert.match(schemaSource, /enum SupportTicketStatus \{/)
  assert.match(schemaSource, /enum SupportTicketTier \{/)
  assert.match(schemaSource, /model SupportTicket \{/)
  assert.match(schemaSource, /model SupportTicketEvent \{/)
})

test("support policy maps plans to SLA tiers and caps priority by plan", () => {
  assert.match(supportLibSource, /PLAN_SUPPORT_POLICY/)
  assert.match(supportLibSource, /slaHours: 72/)
  assert.match(supportLibSource, /slaHours: 24/)
  assert.match(supportLibSource, /slaHours: 8/)
  assert.match(supportLibSource, /slaHours: 2/)
  assert.match(supportLibSource, /capPriorityByPlan/)
  assert.match(supportLibSource, /resolvePriorityDispatchScore/)
})

test("support ticket routes create tickets with plan policy and enforce status transitions", () => {
  assert.match(supportTicketsRouteSource, /getUserEntitlementSnapshot/)
  assert.match(supportTicketsRouteSource, /resolveSupportPolicy/)
  assert.match(supportTicketsRouteSource, /capPriorityByPlan/)
  assert.match(supportTicketsRouteSource, /priorityDowngraded/)
  assert.match(supportTicketsRouteSource, /dispatchScore/)
  assert.match(supportTicketRouteSource, /ALLOWED_TRANSITIONS/)
  assert.match(supportTicketRouteSource, /ticket\.updated/)
})

test("support center page and panel expose dedicated support workflow", () => {
  assert.match(supportPageSource, /专属支持通道与工单体系/)
  assert.match(supportPageSource, /SupportTicketPanel/)
  assert.match(supportPageSource, /调度优先级预览/)
  assert.match(supportPanelSource, /\/api\/support\/tickets/)
  assert.match(supportPanelSource, /提交工单/)
  assert.match(supportPanelSource, /标记处理中/)
})

test("support route is visible in navigation and protected by middleware", () => {
  assert.match(navbarSource, /href: "\/support"/)
  assert.match(mobileHeaderSource, /pathname === "\/support"/)
  assert.match(middlewareSource, /"\/support\/:path\*"/)
})

test("phase5 tracker marks week18-002 complete with synced metadata", () => {
  assert.equal(phase5FeatureList.meta.total_features, 16)
  assert.ok(phase5FeatureList.meta.completed_features >= 6)
  const feature = phase5FeatureList.features.find((item) => item.id === "phase5-week18-002")
  assert.ok(feature)
  assert.equal(feature.passes, true)
})
