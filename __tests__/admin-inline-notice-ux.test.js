import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const brandingPanelSource = readFileSync(
  new URL("../components/branding/brand-customization-panel.tsx", import.meta.url),
  "utf8"
)
const ssoPanelSource = readFileSync(
  new URL("../components/sso/sso-management-panel.tsx", import.meta.url),
  "utf8"
)
const subscriptionPanelSource = readFileSync(
  new URL("../components/billing/subscription-management-panel.tsx", import.meta.url),
  "utf8"
)
const slaPanelSource = readFileSync(
  new URL("../components/sla/sla-monitoring-panel.tsx", import.meta.url),
  "utf8"
)
const supportPanelSource = readFileSync(
  new URL("../components/support/support-ticket-panel.tsx", import.meta.url),
  "utf8"
)
const compliancePanelSource = readFileSync(
  new URL("../components/compliance/audit-compliance-panel.tsx", import.meta.url),
  "utf8"
)
const enterpriseSupportPanelSource = readFileSync(
  new URL("../components/support/enterprise-support-process-panel.tsx", import.meta.url),
  "utf8"
)
const invoicePanelSource = readFileSync(
  new URL("../components/billing/invoice-management-panel.tsx", import.meta.url),
  "utf8"
)
const apiPricingPanelSource = readFileSync(
  new URL("../components/developer/api-pricing-quota-panel.tsx", import.meta.url),
  "utf8"
)
const partnerPanelSource = readFileSync(
  new URL("../components/partners/partner-program-panel.tsx", import.meta.url),
  "utf8"
)
const inlineNoticeSource = readFileSync(
  new URL("../components/ui/inline-notice.tsx", import.meta.url),
  "utf8"
)
const persistentNoticeHookSource = readFileSync(
  new URL("../components/ui/use-persistent-inline-notice.ts", import.meta.url),
  "utf8"
)

test("shared inline notice supports success state for backoffice form feedback", () => {
  assert.match(inlineNoticeSource, /export type InlineNoticeTone = "error" \| "warning" \| "info" \| "success"/)
  assert.match(inlineNoticeSource, /CheckCircle2/)
  assert.match(inlineNoticeSource, /tone === "error" \|\| tone === "warning" \? "alert" : "status"/)
})

test("persistent inline notice hook stores success feedback across refreshes", () => {
  assert.match(persistentNoticeHookSource, /sessionStorage/)
  assert.match(persistentNoticeHookSource, /STORAGE_PREFIX = "aura:inline-notice:"/)
  assert.match(persistentNoticeHookSource, /NOTICE_TTL_MS = 4000/)
  assert.match(persistentNoticeHookSource, /persistNotice/)
})

test("admin action panels use inline notices instead of toast-driven errors", () => {
  for (const source of [
    brandingPanelSource,
    ssoPanelSource,
    subscriptionPanelSource,
    slaPanelSource,
    supportPanelSource,
    compliancePanelSource,
    enterpriseSupportPanelSource,
    invoicePanelSource,
    apiPricingPanelSource,
    partnerPanelSource,
  ]) {
    assert.match(source, /InlineNotice/)
    assert.match(source, /usePersistentInlineNotice/)
    assert.match(source, /persistNotice\(\{ tone: "success", message: success \}\)/)
    assert.match(source, /tone: "error"/)
    assert.doesNotMatch(source, /useToast/)
    assert.doesNotMatch(source, /toast\(/)
  }
})


test("support ticket form only clears after a successful create action", () => {
  assert.match(supportPanelSource, /const created = await runAction\(/)
  assert.match(supportPanelSource, /if \(!created\) \{\s*return\s*\}/)
  assert.match(supportPanelSource, /return true/)
  assert.match(supportPanelSource, /return false/)
})
