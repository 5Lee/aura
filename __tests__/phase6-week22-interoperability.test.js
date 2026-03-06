import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const schemaSource = readFileSync(new URL("../prisma/schema.prisma", import.meta.url), "utf8")
const entitlementsSource = readFileSync(
  new URL("../lib/subscription-entitlements.ts", import.meta.url),
  "utf8"
)
const interopLibSource = readFileSync(new URL("../lib/prompt-interoperability.ts", import.meta.url), "utf8")
const interopRouteSource = readFileSync(
  new URL("../app/api/interoperability/route.ts", import.meta.url),
  "utf8"
)
const interopPageSource = readFileSync(
  new URL("../app/(dashboard)/interoperability/page.tsx", import.meta.url),
  "utf8"
)
const interopPanelSource = readFileSync(
  new URL("../components/interoperability/interoperability-panel.tsx", import.meta.url),
  "utf8"
)
const navbarSource = readFileSync(new URL("../components/layout/navbar.tsx", import.meta.url), "utf8")
const mobileHeaderSource = readFileSync(
  new URL("../components/layout/mobile-page-header.tsx", import.meta.url),
  "utf8"
)
const middlewareSource = readFileSync(new URL("../middleware.ts", import.meta.url), "utf8")
const phase6FeatureList = JSON.parse(
  readFileSync(new URL("../feature_list_phase6_growth_ecosystem.json", import.meta.url), "utf8")
)

test("schema includes interoperability profile and job models", () => {
  assert.match(schemaSource, /enum PromptInteropPlatform \{/)
  assert.match(schemaSource, /enum PromptInteropMode \{/)
  assert.match(schemaSource, /enum PromptInteropJobStatus \{/)
  assert.match(schemaSource, /model PromptInteropProfile \{/) 
  assert.match(schemaSource, /model PromptInteropJob \{/) 
  assert.match(schemaSource, /promptInteropProfiles\s+PromptInteropProfile\[\]/)
  assert.match(schemaSource, /promptInteropJobs\s+PromptInteropJob\[\]/)
})

test("interop lib provides mapping sanitization, preview, export and round-trip helpers", () => {
  assert.match(interopLibSource, /DEFAULT_PROMPT_INTEROP_PROFILES/)
  assert.match(interopLibSource, /sanitizeInteropProfileInput/)
  assert.match(interopLibSource, /buildInteropImportPreview/)
  assert.match(interopLibSource, /buildInteropExportPayload/)
  assert.match(interopLibSource, /buildInteropRoundTripCheck/)
})

test("interop API supports profile management, preview apply and export actions", () => {
  assert.match(interopRouteSource, /export async function GET\(\)/)
  assert.match(interopRouteSource, /export async function PUT\(request: Request\)/)
  assert.match(interopRouteSource, /export async function POST\(request: Request\)/)
  assert.match(interopRouteSource, /preview-import/)
  assert.match(interopRouteSource, /apply-import/)
  assert.match(interopRouteSource, /action === "export"/)
  assert.match(interopRouteSource, /interop\.profile\.upsert/)
  assert.match(interopRouteSource, /interop\.import\.preview/)
  assert.match(interopRouteSource, /interop\.import\.apply/)
  assert.match(interopRouteSource, /interop\.export\.run/)
})

test("interop dashboard exposes mapping, preview and compatibility workflow", () => {
  assert.match(entitlementsSource, /PROMPT_INTEROP_PLANS/)
  assert.match(entitlementsSource, /hasPromptInteropAccess/)
  assert.match(interopPageSource, /Week22-003/)
  assert.match(interopPanelSource, /多源字段映射与冲突策略/)
  assert.match(interopPanelSource, /批量导入预览与差异确认/)
  assert.match(interopPanelSource, /导出模板与兼容模式切换/)
  assert.match(interopPanelSource, /round-trip 导入导出一致性检查/)
  assert.match(interopPanelSource, /\/api\/interoperability/)
  assert.match(navbarSource, /href="\/admin"/)
  assert.match(navbarSource, /"\/interoperability"/)
  assert.match(mobileHeaderSource, /pathname === "\/interoperability"/)
  assert.match(middlewareSource, /"\/interoperability\/:path\*"/)
})

test("phase6 tracker marks week22-003 complete with synced metadata", () => {
  assert.equal(phase6FeatureList.meta.total_features, 16)
  assert.ok(phase6FeatureList.meta.completed_features >= 7)
  const feature = phase6FeatureList.features.find((item) => item.id === "phase6-week22-003")
  assert.ok(feature)
  assert.equal(feature.passes, true)
})
