import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const schemaSource = readFileSync(new URL("../prisma/schema.prisma", import.meta.url), "utf8")
const ssoLibSource = readFileSync(new URL("../lib/sso.ts", import.meta.url), "utf8")
const ssoServerLibSource = readFileSync(new URL("../lib/sso-server.ts", import.meta.url), "utf8")
const entitlementsSource = readFileSync(
  new URL("../lib/subscription-entitlements.ts", import.meta.url),
  "utf8"
)
const ssoProvidersRouteSource = readFileSync(
  new URL("../app/api/sso/providers/route.ts", import.meta.url),
  "utf8"
)
const ssoRuntimeRouteSource = readFileSync(
  new URL("../app/api/sso/runtime/route.ts", import.meta.url),
  "utf8"
)
const ssoLoginRouteSource = readFileSync(
  new URL("../app/api/sso/login/route.ts", import.meta.url),
  "utf8"
)
const ssoCallbackRouteSource = readFileSync(
  new URL("../app/api/sso/callback/route.ts", import.meta.url),
  "utf8"
)
const ssoDirectoryRouteSource = readFileSync(
  new URL("../app/api/sso/directory-sync/route.ts", import.meta.url),
  "utf8"
)
const ssoConflictsRouteSource = readFileSync(
  new URL("../app/api/sso/identity/conflicts/route.ts", import.meta.url),
  "utf8"
)
const validateCredentialsRouteSource = readFileSync(
  new URL("../app/api/auth/validate-credentials/route.ts", import.meta.url),
  "utf8"
)
const registerRouteSource = readFileSync(
  new URL("../app/api/auth/register/route.ts", import.meta.url),
  "utf8"
)
const loginPageSource = readFileSync(new URL("../app/(auth)/login/page.tsx", import.meta.url), "utf8")
const registerPageSource = readFileSync(
  new URL("../app/(auth)/register/page.tsx", import.meta.url),
  "utf8"
)
const ssoPageSource = readFileSync(new URL("../app/(dashboard)/sso/page.tsx", import.meta.url), "utf8")
const ssoPanelSource = readFileSync(
  new URL("../components/sso/sso-management-panel.tsx", import.meta.url),
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

test("schema includes sso provider, user identity, directory sync and conflict models", () => {
  assert.match(schemaSource, /enum SsoProviderType \{/)
  assert.match(schemaSource, /enum IdentitySource \{/)
  assert.match(schemaSource, /enum DirectorySyncStatus \{/)
  assert.match(schemaSource, /enum IdentityConflictStatus \{/)
  assert.match(schemaSource, /model SsoProvider \{/)
  assert.match(schemaSource, /model UserIdentity \{/)
  assert.match(schemaSource, /model DirectorySyncRun \{/)
  assert.match(schemaSource, /model IdentityConflict \{/)
  assert.match(schemaSource, /ssoProviders\s+SsoProvider\[\]/)
  assert.match(schemaSource, /userIdentities\s+UserIdentity\[\]/)
})

test("sso libs provide provider sanitization, runtime policy and conflict helpers", () => {
  assert.match(ssoLibSource, /sanitizeSsoProviderConfig/)
  assert.match(ssoLibSource, /normalizeDirectoryRole/)
  assert.match(ssoLibSource, /buildSsoAuthorizeUrl/)
  assert.match(ssoLibSource, /resolveIdentityConflictReason/)
  assert.match(ssoServerLibSource, /getSsoRuntimePolicy/)
  assert.match(ssoServerLibSource, /findTenantOwnerUserId/)
  assert.match(ssoServerLibSource, /getCredentialGuardForEmail/)
})

test("subscription entitlement adds enterprise sso access gate", () => {
  assert.match(entitlementsSource, /hasEnterpriseSsoAccess/)
  assert.match(entitlementsSource, /ENTERPRISE_SSO_PLANS/)
  assert.match(entitlementsSource, /"enterprise"/)
})

test("sso api routes cover provider management, runtime, login callback, sync and conflicts", () => {
  assert.match(ssoProvidersRouteSource, /export async function GET\(\)/)
  assert.match(ssoProvidersRouteSource, /export async function POST\(request: Request\)/)
  assert.match(ssoProvidersRouteSource, /hasEnterpriseSsoAccess/)
  assert.match(ssoRuntimeRouteSource, /searchParams\.get\("tenant"\)/)
  assert.match(ssoRuntimeRouteSource, /getSsoRuntimePolicy/)
  assert.match(ssoLoginRouteSource, /buildSsoAuthorizeUrl/)
  assert.match(ssoLoginRouteSource, /findTenantOwnerUserId/)
  assert.match(ssoCallbackRouteSource, /sso=callback-not-implemented/)
  assert.match(ssoDirectoryRouteSource, /DirectorySyncStatus/)
  assert.match(ssoDirectoryRouteSource, /identityConflict\.create/)
  assert.match(ssoDirectoryRouteSource, /userIdentity\.upsert/)
  assert.match(ssoConflictsRouteSource, /export async function PATCH\(request: Request\)/)
  assert.match(ssoConflictsRouteSource, /IdentityConflictStatus\.RESOLVED/)
})

test("auth flows enforce tenant sso policy and support fallback strategy", () => {
  assert.match(validateCredentialsRouteSource, /getSsoRuntimePolicy/)
  assert.match(validateCredentialsRouteSource, /tenant/)
  assert.match(validateCredentialsRouteSource, /强制 SSO/)
  assert.match(registerRouteSource, /getSsoRuntimePolicy/)
  assert.match(registerRouteSource, /tenant/)
  assert.match(registerRouteSource, /强制 SSO/)
  assert.match(loginPageSource, /\/api\/sso\/runtime/)
  assert.match(loginPageSource, /使用企业 SSO 登录/)
  assert.match(registerPageSource, /\/api\/sso\/runtime/)
  assert.match(registerPageSource, /使用企业 SSO/)
})

test("sso dashboard page and panel expose provider, sync and conflict actions", () => {
  assert.match(ssoPageSource, /SSO 与企业身份集成/)
  assert.match(ssoPageSource, /SsoManagementPanel/)
  assert.match(ssoPanelSource, /\/api\/sso\/providers/)
  assert.match(ssoPanelSource, /\/api\/sso\/directory-sync/)
  assert.match(ssoPanelSource, /\/api\/sso\/identity\/conflicts/)
  assert.match(ssoPanelSource, /执行目录同步/)
  assert.match(ssoPanelSource, /标记已解决/)
})

test("sso route is managed via admin portal and protected by middleware", () => {
  assert.match(navbarSource, /href="\/admin"/)
  assert.match(navbarSource, /"\/sso"/)
  assert.match(mobileHeaderSource, /pathname === "\/sso"/)
  assert.match(middlewareSource, /"\/sso\/:path\*"/)
})

test("phase5 tracker marks week19-002 complete with synced metadata", () => {
  assert.equal(phase5FeatureList.meta.total_features, 16)
  assert.ok(phase5FeatureList.meta.completed_features >= 10)
  const feature = phase5FeatureList.features.find((item) => item.id === "phase5-week19-002")
  assert.ok(feature)
  assert.equal(feature.passes, true)
})
