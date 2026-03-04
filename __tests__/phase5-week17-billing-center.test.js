import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const billingPageSource = readFileSync(
  new URL("../app/(dashboard)/billing/page.tsx", import.meta.url),
  "utf8"
)
const billingActionsSource = readFileSync(
  new URL("../components/billing/subscription-management-panel.tsx", import.meta.url),
  "utf8"
)
const historyRouteSource = readFileSync(
  new URL("../app/api/subscription/history/route.ts", import.meta.url),
  "utf8"
)
const changePlanRouteSource = readFileSync(
  new URL("../app/api/subscription/change-plan/route.ts", import.meta.url),
  "utf8"
)
const resumeRouteSource = readFileSync(
  new URL("../app/api/subscription/resume/route.ts", import.meta.url),
  "utf8"
)
const entitlementsSource = readFileSync(
  new URL("../lib/subscription-entitlements.ts", import.meta.url),
  "utf8"
)
const promptsRouteSource = readFileSync(
  new URL("../app/api/prompts/route.ts", import.meta.url),
  "utf8"
)
const promptDetailRouteSource = readFileSync(
  new URL("../app/api/prompts/[id]/route.ts", import.meta.url),
  "utf8"
)
const middlewareSource = readFileSync(new URL("../middleware.ts", import.meta.url), "utf8")
const phase5FeatureList = JSON.parse(
  readFileSync(new URL("../feature_list_phase5_commercialization.json", import.meta.url), "utf8")
)

test("billing center page includes subscription status, usage, actions and csv export", () => {
  assert.match(billingPageSource, /订阅管理与账单中心/)
  assert.match(billingPageSource, /SubscriptionManagementPanel/)
  assert.match(billingPageSource, /下一计费时间/)
  assert.match(billingPageSource, /\/api\/subscription\/history\?format=csv/)
})

test("billing management panel supports plan change, renew, cancel and resume actions", () => {
  assert.match(billingActionsSource, /\/api\/subscription\/change-plan/)
  assert.match(billingActionsSource, /\/api\/subscription\/renew/)
  assert.match(billingActionsSource, /\/api\/subscription\/cancel/)
  assert.match(billingActionsSource, /\/api\/subscription\/resume/)
})

test("billing history and lifecycle routes support export and plan transition handling", () => {
  assert.match(historyRouteSource, /format === "csv"/)
  assert.match(historyRouteSource, /Content-Disposition/)
  assert.match(changePlanRouteSource, /subscription\.plan\.changed/)
  assert.match(resumeRouteSource, /subscription\.resume\.requested/)
})

test("entitlement checks are wired into prompt create and visibility transition flows", () => {
  assert.match(entitlementsSource, /validatePromptCreationQuota/)
  assert.match(entitlementsSource, /validatePrivateVisibilityTransition/)
  assert.match(promptsRouteSource, /validatePromptCreationQuota/)
  assert.match(promptDetailRouteSource, /validatePrivateVisibilityTransition/)
})

test("billing route is protected and phase5 tracker marks week17-003 complete", () => {
  assert.match(middlewareSource, /\/billing\/:path\*/)
  assert.equal(phase5FeatureList.meta.completed_features, 3)
  const feature = phase5FeatureList.features.find((item) => item.id === "phase5-week17-003")
  assert.ok(feature)
  assert.equal(feature.passes, true)
})
