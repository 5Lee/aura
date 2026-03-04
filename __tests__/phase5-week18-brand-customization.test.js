import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const schemaSource = readFileSync(new URL("../prisma/schema.prisma", import.meta.url), "utf8")
const brandingLibSource = readFileSync(new URL("../lib/branding.ts", import.meta.url), "utf8")
const brandingRouteSource = readFileSync(new URL("../app/api/branding/route.ts", import.meta.url), "utf8")
const brandingPublishRouteSource = readFileSync(
  new URL("../app/api/branding/publish/route.ts", import.meta.url),
  "utf8"
)
const brandingRuntimeRouteSource = readFileSync(
  new URL("../app/api/branding/runtime/route.ts", import.meta.url),
  "utf8"
)
const brandingEmailRouteSource = readFileSync(
  new URL("../app/api/branding/email-template/route.ts", import.meta.url),
  "utf8"
)
const brandingPageSource = readFileSync(
  new URL("../app/(dashboard)/branding/page.tsx", import.meta.url),
  "utf8"
)
const brandingPanelSource = readFileSync(
  new URL("../components/branding/brand-customization-panel.tsx", import.meta.url),
  "utf8"
)
const loginPageSource = readFileSync(new URL("../app/(auth)/login/page.tsx", import.meta.url), "utf8")
const registerPageSource = readFileSync(
  new URL("../app/(auth)/register/page.tsx", import.meta.url),
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

test("schema includes brand profile model and config status enum", () => {
  assert.match(schemaSource, /enum BrandConfigStatus \{/)
  assert.match(schemaSource, /model BrandProfile \{/)
  assert.match(schemaSource, /draftConfig\s+Json\?/)
  assert.match(schemaSource, /publishedConfig\s+Json\?/)
  assert.match(schemaSource, /brandProfile\s+BrandProfile\?/)
})

test("branding lib defines config sanitization, merge and email rendering helpers", () => {
  assert.match(brandingLibSource, /DEFAULT_BRAND_CONFIG/)
  assert.match(brandingLibSource, /sanitizeBrandConfig/)
  assert.match(brandingLibSource, /mergeBrandConfig/)
  assert.match(brandingLibSource, /buildBrandingCssVariables/)
  assert.match(brandingLibSource, /renderBrandedEmailTemplate/)
})

test("branding APIs support draft, publish, runtime and email preview workflows", () => {
  assert.match(brandingRouteSource, /export async function GET\(\)/)
  assert.match(brandingRouteSource, /export async function PUT\(request: Request\)/)
  assert.match(brandingRouteSource, /prisma\.brandProfile\.upsert/)
  assert.match(brandingPublishRouteSource, /export async function POST\(\)/)
  assert.match(brandingPublishRouteSource, /domain/)
  assert.match(brandingPublishRouteSource, /BrandConfigStatus\.PUBLISHED/)
  assert.match(brandingRuntimeRouteSource, /searchParams\.get\("tenant"\)/)
  assert.match(brandingRuntimeRouteSource, /tenantMatched/)
  assert.match(brandingEmailRouteSource, /renderBrandedEmailTemplate/)
  assert.match(brandingEmailRouteSource, /export async function POST\(request: Request\)/)
})

test("branding dashboard page and panel provide save, publish and preview controls", () => {
  assert.match(brandingPageSource, /品牌定制中心/)
  assert.match(brandingPageSource, /BrandCustomizationPanel/)
  assert.match(brandingPanelSource, /\/api\/branding/)
  assert.match(brandingPanelSource, /\/api\/branding\/publish/)
  assert.match(brandingPanelSource, /\/api\/branding\/email-template/)
  assert.match(brandingPanelSource, /预览登录页品牌/)
  assert.match(brandingPanelSource, /生成邮件模板/)
})

test("auth pages load runtime branding by tenant for multi-tenant login and registration", () => {
  assert.match(loginPageSource, /fetch\(`\/api\/branding\/runtime\$\{query\}`\)/)
  assert.match(loginPageSource, /const tenant = searchParams\.get\("tenant"\)/)
  assert.match(registerPageSource, /fetch\(`\/api\/branding\/runtime\$\{query\}`\)/)
  assert.match(registerPageSource, /const tenant = searchParams\.get\("tenant"\)/)
})

test("branding route is exposed in navigation and protected by middleware", () => {
  assert.match(navbarSource, /href: "\/branding"/)
  assert.match(mobileHeaderSource, /pathname === "\/branding"/)
  assert.match(middlewareSource, /"\/branding\/:path\*"/)
})

test("phase5 tracker marks week18-003 complete with synced metadata", () => {
  assert.equal(phase5FeatureList.meta.total_features, 16)
  assert.ok(phase5FeatureList.meta.completed_features >= 7)
  const feature = phase5FeatureList.features.find((item) => item.id === "phase5-week18-003")
  assert.ok(feature)
  assert.equal(feature.passes, true)
})
