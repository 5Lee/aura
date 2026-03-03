import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"

import * as mobileHeaderExports from "../components/layout/mobile-page-header.tsx"

const mobileHeaderModule =
  mobileHeaderExports.default ?? mobileHeaderExports["module.exports"] ?? mobileHeaderExports
const { resolveMobileRouteMeta } = mobileHeaderModule

const mobileHeaderSource = readFileSync(
  new URL("../components/layout/mobile-page-header.tsx", import.meta.url),
  "utf8"
)
const mobileBottomNavSource = readFileSync(
  new URL("../components/layout/mobile-bottom-nav.tsx", import.meta.url),
  "utf8"
)
const dashboardLayoutSource = readFileSync(
  new URL("../app/(dashboard)/layout.tsx", import.meta.url),
  "utf8"
)

test("mobile route meta resolves titles and back targets for key pages", () => {
  assert.deepEqual(resolveMobileRouteMeta("/dashboard"), {
    title: "仪表板",
    showBackButton: false,
  })

  assert.deepEqual(resolveMobileRouteMeta("/prompts/new"), {
    title: "新建提示词",
    showBackButton: true,
    backHref: "/prompts",
  })

  assert.deepEqual(resolveMobileRouteMeta("/prompts/abc/edit"), {
    title: "编辑提示词",
    showBackButton: true,
    backHref: "/prompts/abc",
  })

  assert.deepEqual(resolveMobileRouteMeta("/prompts/abc"), {
    title: "提示词详情",
    showBackButton: true,
    backHref: "/prompts",
  })
})

test("mobile page header back action supports history and fallback route", () => {
  assert.match(mobileHeaderSource, /window\.history\.length > 1/)
  assert.match(mobileHeaderSource, /router\.back\(\)/)
  assert.match(mobileHeaderSource, /router\.push\(routeMeta\.backHref \|\| "\/dashboard"\)/)
  assert.match(mobileHeaderSource, /aria-label="返回上一页"/)
})

test("mobile bottom nav includes touch-friendly controls and safe-area padding", () => {
  assert.match(mobileBottomNavSource, /pb-\[calc\(env\(safe-area-inset-bottom\)\+0\.35rem\)\]/)
  assert.match(mobileBottomNavSource, /touch-manipulation inline-flex min-h-11/)
  assert.match(mobileBottomNavSource, /label: "仪表板"/)
  assert.match(mobileBottomNavSource, /label: "提示词"/)
  assert.match(mobileBottomNavSource, /label: "收藏"/)
  assert.match(mobileBottomNavSource, /label: "浏览"/)
})

test("dashboard layout mounts mobile header and bottom nav", () => {
  assert.match(dashboardLayoutSource, /MobilePageHeader/)
  assert.match(dashboardLayoutSource, /MobileBottomNav/)
  assert.match(dashboardLayoutSource, /pb-24/)
})
