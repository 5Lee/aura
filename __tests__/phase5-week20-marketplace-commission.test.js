import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const schemaSource = readFileSync(new URL("../prisma/schema.prisma", import.meta.url), "utf8")
const commissionLibSource = readFileSync(
  new URL("../lib/marketplace-commission.ts", import.meta.url),
  "utf8"
)
const entitlementsSource = readFileSync(
  new URL("../lib/subscription-entitlements.ts", import.meta.url),
  "utf8"
)
const rulesRouteSource = readFileSync(
  new URL("../app/api/marketplace/commission/rules/route.ts", import.meta.url),
  "utf8"
)
const ledgerRouteSource = readFileSync(
  new URL("../app/api/marketplace/commission/ledger/route.ts", import.meta.url),
  "utf8"
)
const settlementsRouteSource = readFileSync(
  new URL("../app/api/marketplace/commission/settlements/route.ts", import.meta.url),
  "utf8"
)
const settlementRouteSource = readFileSync(
  new URL("../app/api/marketplace/commission/settlements/[id]/route.ts", import.meta.url),
  "utf8"
)
const marketplacePageSource = readFileSync(
  new URL("../app/(dashboard)/marketplace/page.tsx", import.meta.url),
  "utf8"
)
const marketplacePanelSource = readFileSync(
  new URL("../components/marketplace/commission-management-panel.tsx", import.meta.url),
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

test("schema includes marketplace commission rules, ledger and settlement models", () => {
  assert.match(schemaSource, /enum MarketplaceLedgerStatus \{/) 
  assert.match(schemaSource, /enum MarketplaceSettlementStatus \{/) 
  assert.match(schemaSource, /model MarketplaceCommissionRule \{/) 
  assert.match(schemaSource, /model MarketplaceCommissionLedger \{/) 
  assert.match(schemaSource, /model MarketplaceSettlementBatch \{/) 
  assert.match(schemaSource, /marketplaceCommissionRules\s+MarketplaceCommissionRule\[\]/)
  assert.match(schemaSource, /marketplaceCommissionLedgers\s+MarketplaceCommissionLedger\[\]/)
  assert.match(schemaSource, /marketplaceSettlementBatches\s+MarketplaceSettlementBatch\[\]/)
})

test("marketplace commission lib provides rule presets, commission calculation and settlement summary", () => {
  assert.match(commissionLibSource, /DEFAULT_MARKETPLACE_COMMISSION_RULES/)
  assert.match(commissionLibSource, /sanitizeMarketplaceCommissionRuleInput/)
  assert.match(commissionLibSource, /calculateMarketplaceCommission/)
  assert.match(commissionLibSource, /buildDefaultMarketplaceRuleSeed/)
  assert.match(commissionLibSource, /summarizeMarketplaceSettlement/)
  assert.match(commissionLibSource, /normalizeMarketplaceSettlementStatus/)
})

test("subscription entitlement exposes marketplace commission access gate", () => {
  assert.match(entitlementsSource, /MARKETPLACE_COMMISSION_PLANS/)
  assert.match(entitlementsSource, /hasMarketplaceCommissionAccess/)
  assert.match(entitlementsSource, /"pro"/)
  assert.match(entitlementsSource, /"team"/)
  assert.match(entitlementsSource, /"enterprise"/)
})

test("marketplace API routes cover rules, ledger sync, settlement creation and status tracking", () => {
  assert.match(rulesRouteSource, /export async function GET\(\)/)
  assert.match(rulesRouteSource, /export async function PUT\(request: Request\)/)
  assert.match(rulesRouteSource, /marketplace\.rule\.upsert/)

  assert.match(ledgerRouteSource, /export async function GET\(request: Request\)/)
  assert.match(ledgerRouteSource, /export async function POST\(request: Request\)/)
  assert.match(ledgerRouteSource, /marketplace\.ledger\.sync/)
  assert.match(ledgerRouteSource, /calculateMarketplaceCommission/)

  assert.match(settlementsRouteSource, /export async function GET\(\)/)
  assert.match(settlementsRouteSource, /export async function POST\(request: Request\)/)
  assert.match(settlementsRouteSource, /marketplace\.settlement\.create/)
  assert.match(settlementsRouteSource, /marketplace\.settlement\.paid/)

  assert.match(settlementRouteSource, /export async function PATCH\(request: Request/)
  assert.match(settlementRouteSource, /marketplace\.settlement\.update/)
})

test("marketplace page and panel expose commission rules, earnings stats and settlement status workflow", () => {
  assert.match(marketplacePageSource, /应用市场佣金体系/)
  assert.match(marketplacePageSource, /CommissionManagementPanel/)
  assert.match(marketplacePageSource, /Week20-001/)

  assert.match(marketplacePanelSource, /\/api\/marketplace\/commission\/rules/)
  assert.match(marketplacePanelSource, /\/api\/marketplace\/commission\/ledger/)
  assert.match(marketplacePanelSource, /\/api\/marketplace\/commission\/settlements/)
  assert.match(marketplacePanelSource, /同步创作者收益台账/)
  assert.match(marketplacePanelSource, /更新结算状态/)
})

test("marketplace route is exposed in navigation and protected by middleware", () => {
  assert.match(navbarSource, /href: "\/marketplace"/)
  assert.match(mobileHeaderSource, /pathname === "\/marketplace"/)
  assert.match(middlewareSource, /"\/marketplace\/:path\*"/)
})

test("phase5 tracker marks week20-001 complete with synced metadata", () => {
  assert.equal(phase5FeatureList.meta.total_features, 16)
  assert.ok(phase5FeatureList.meta.completed_features >= 13)
  const feature = phase5FeatureList.features.find((item) => item.id === "phase5-week20-001")
  assert.ok(feature)
  assert.equal(feature.passes, true)
})
