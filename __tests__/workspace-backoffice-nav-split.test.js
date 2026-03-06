import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"

const navbarSource = readFileSync(new URL("../components/layout/navbar.tsx", import.meta.url), "utf8")
const adminPageSource = readFileSync(new URL("../app/(dashboard)/admin/page.tsx", import.meta.url), "utf8")
const adminSubnavSource = readFileSync(new URL("../components/layout/admin-subnav.tsx", import.meta.url), "utf8")

test("workspace navbar keeps only core entries and exposes admin entry", () => {
  assert.match(navbarSource, /const WORKSPACE_NAV_ITEMS = \[/)
  assert.match(navbarSource, /{ href: "\/dashboard", label: "仪表板" }/)
  assert.match(navbarSource, /{ href: "\/prompts", label: "提示词" }/)
  assert.match(navbarSource, /{ href: "\/collections", label: "收藏夹" }/)
  assert.match(navbarSource, /{ href: "\/browse", label: "浏览" }/)
  assert.match(navbarSource, /{ href: "\/support", label: "支持" }/)
  assert.match(navbarSource, /{ href: "\/billing", label: "账单" }/)
  assert.match(navbarSource, /href="\/admin"/)

  assert.doesNotMatch(navbarSource, /{ href: "\/branding", label: "品牌" }/)
  assert.doesNotMatch(navbarSource, /{ href: "\/sso", label: "SSO" }/)
  assert.doesNotMatch(navbarSource, /{ href: "\/growth-lab", label: "增长" }/)
})

test("admin portal routes link to /admin/* paths", () => {
  assert.match(adminPageSource, /href: "\/admin\/branding"/)
  assert.match(adminPageSource, /href: "\/admin\/sso"/)
  assert.match(adminPageSource, /href: "\/admin\/compliance"/)
  assert.match(adminPageSource, /href: "\/admin\/sla"/)
  assert.match(adminPageSource, /href: "\/admin\/growth-lab"/)
  assert.match(adminPageSource, /href: "\/admin\/interoperability"/)
})


test("backoffice navigation disables broad prefetching", () => {
  assert.match(adminPageSource, /prefetch=\{false\}/)
  assert.match(adminSubnavSource, /prefetch=\{false\}/)
})
