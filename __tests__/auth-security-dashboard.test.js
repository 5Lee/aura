import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const securityPageSource = readFileSync(
  new URL("../app/(dashboard)/admin/security/page.tsx", import.meta.url),
  "utf8"
)
const adminPageSource = readFileSync(new URL("../app/(dashboard)/admin/page.tsx", import.meta.url), "utf8")
const adminSubnavSource = readFileSync(
  new URL("../components/layout/admin-subnav.tsx", import.meta.url),
  "utf8"
)
const mobileHeaderSource = readFileSync(
  new URL("../components/layout/mobile-page-header.tsx", import.meta.url),
  "utf8"
)

test("security dashboard reads auth audit logs and keeps identifiers anonymized", () => {
  assert.match(securityPageSource, /export const dynamic = "force-dynamic"/)
  assert.match(securityPageSource, /prisma\.promptAuditLog\.findMany\(/)
  assert.match(securityPageSource, /prisma\.promptAuditLog\.count\(/)
  assert.match(securityPageSource, /const AUTH_ACTIONS = \["auth\.login", "auth\.register"\] as const/)
  assert.match(securityPageSource, /shortHash\(value: string \| null\)/)
  assert.match(securityPageSource, /shortHash\(item\.ipHash\)/)
})

test("admin surfaces the security dashboard across desktop and mobile navigation", () => {
  assert.match(adminPageSource, /href: "\/admin\/security", label: "安全风控"/)
  assert.match(adminSubnavSource, /\{ href: "\/admin\/security", label: "安全" \}/)
  assert.match(mobileHeaderSource, /security: "安全风控"/)
})
