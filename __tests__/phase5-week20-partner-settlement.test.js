import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const schemaSource = readFileSync(new URL("../prisma/schema.prisma", import.meta.url), "utf8")
const partnerLibSource = readFileSync(new URL("../lib/partner-program.ts", import.meta.url), "utf8")
const entitlementsSource = readFileSync(
  new URL("../lib/subscription-entitlements.ts", import.meta.url),
  "utf8"
)
const tiersRouteSource = readFileSync(new URL("../app/api/partners/tiers/route.ts", import.meta.url), "utf8")
const leadsRouteSource = readFileSync(new URL("../app/api/partners/leads/route.ts", import.meta.url), "utf8")
const settlementsRouteSource = readFileSync(
  new URL("../app/api/partners/settlements/route.ts", import.meta.url),
  "utf8"
)
const settlementRouteSource = readFileSync(
  new URL("../app/api/partners/settlements/[id]/route.ts", import.meta.url),
  "utf8"
)
const partnersPageSource = readFileSync(
  new URL("../app/(dashboard)/partners/page.tsx", import.meta.url),
  "utf8"
)
const partnersPanelSource = readFileSync(
  new URL("../components/partners/partner-program-panel.tsx", import.meta.url),
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

test("schema includes partner tier, lead and settlement models", () => {
  assert.match(schemaSource, /enum PartnerTierLevel \{/)
  assert.match(schemaSource, /enum PartnerLeadStatus \{/)
  assert.match(schemaSource, /enum PartnerSettlementStatus \{/)
  assert.match(schemaSource, /model PartnerTier \{/)
  assert.match(schemaSource, /model PartnerLead \{/)
  assert.match(schemaSource, /model PartnerSettlement \{/)
  assert.match(schemaSource, /partnerTiers\s+PartnerTier\[\]/)
  assert.match(schemaSource, /partnerLeads\s+PartnerLead\[\]/)
  assert.match(schemaSource, /partnerSettlements\s+PartnerSettlement\[\]/)
})

test("partner program lib provides tier presets, attribution and settlement reconciliation", () => {
  assert.match(partnerLibSource, /DEFAULT_PARTNER_TIERS/)
  assert.match(partnerLibSource, /sanitizePartnerTierInput/)
  assert.match(partnerLibSource, /sanitizePartnerLeadInput/)
  assert.match(partnerLibSource, /resolvePartnerLeadAttribution/)
  assert.match(partnerLibSource, /calculatePartnerRevenueShare/)
  assert.match(partnerLibSource, /summarizePartnerSettlement/)
  assert.match(partnerLibSource, /reconcilePartnerSettlement/)
  assert.match(partnerLibSource, /normalizePartnerSettlementStatus/)
})

test("subscription entitlement adds partner program gate", () => {
  assert.match(entitlementsSource, /PARTNER_PROGRAM_PLANS/)
  assert.match(entitlementsSource, /hasPartnerProgramAccess/)
  assert.match(entitlementsSource, /"pro"/)
  assert.match(entitlementsSource, /"team"/)
  assert.match(entitlementsSource, /"enterprise"/)
})

test("partners API routes cover tier setup, lead attribution and settlement reconciliation", () => {
  assert.match(tiersRouteSource, /export async function GET\(\)/)
  assert.match(tiersRouteSource, /export async function PUT\(request: Request\)/)
  assert.match(tiersRouteSource, /partners\.tier\.upsert/)

  assert.match(leadsRouteSource, /export async function GET\(\)/)
  assert.match(leadsRouteSource, /export async function POST\(request: Request\)/)
  assert.match(leadsRouteSource, /resolvePartnerLeadAttribution/)
  assert.match(leadsRouteSource, /partners\.lead\.create/)

  assert.match(settlementsRouteSource, /export async function GET\(\)/)
  assert.match(settlementsRouteSource, /export async function POST\(request: Request\)/)
  assert.match(settlementsRouteSource, /calculatePartnerRevenueShare/)
  assert.match(settlementsRouteSource, /reconcilePartnerSettlement/)
  assert.match(settlementsRouteSource, /partners\.settlement\.create/)

  assert.match(settlementRouteSource, /export async function PATCH\(request: Request/)
  assert.match(settlementRouteSource, /partners\.settlement\.update/)
})

test("partners page and panel expose partner dashboard and reconciliation workflow", () => {
  assert.match(partnersPageSource, /合作伙伴分层与结算/)
  assert.match(partnersPageSource, /PartnerProgramPanel/)
  assert.match(partnersPageSource, /Week20-004/)

  assert.match(partnersPanelSource, /\/api\/partners\/tiers/)
  assert.match(partnersPanelSource, /\/api\/partners\/leads/)
  assert.match(partnersPanelSource, /\/api\/partners\/settlements/)
  assert.match(partnersPanelSource, /线索归因与分成规则/)
  assert.match(partnersPanelSource, /验证合作收益对账流程/)
})

test("partners panel normalizes settlement datetime payload and keeps form controls accessible", () => {
  assert.match(partnersPanelSource, /toLocalDateTimeInputValue/)
  assert.match(partnersPanelSource, /toIsoDateTime/)
  assert.match(partnersPanelSource, /periodStart: toIsoDateTime\(settlementCreateForm\.periodStart\)/)
  assert.match(partnersPanelSource, /periodEnd: toIsoDateTime\(settlementCreateForm\.periodEnd\)/)
  assert.match(partnersPanelSource, /aria-label=\"结算开始时间\"/)
  assert.match(partnersPanelSource, /aria-label=\"结算结束时间\"/)
  assert.match(partnersPanelSource, /aria-label=\"结算付款流水号\"/)
})

test("partners route is managed via admin portal and protected by middleware", () => {
  assert.match(navbarSource, /href="\/admin"/)
  assert.match(navbarSource, /"\/partners"/)
  assert.match(mobileHeaderSource, /pathname === "\/partners"/)
  assert.match(middlewareSource, /"\/partners\/:path\*"/)
})

test("phase5 tracker marks week20-004 complete with synced metadata", () => {
  assert.equal(phase5FeatureList.meta.total_features, 16)
  assert.ok(phase5FeatureList.meta.completed_features >= 16)
  const feature = phase5FeatureList.features.find((item) => item.id === "phase5-week20-004")
  assert.ok(feature)
  assert.equal(feature.passes, true)
})
