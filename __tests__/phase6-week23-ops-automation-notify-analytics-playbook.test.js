import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const schemaSource = readFileSync(new URL("../prisma/schema.prisma", import.meta.url), "utf8")
const entitlementsSource = readFileSync(
  new URL("../lib/subscription-entitlements.ts", import.meta.url),
  "utf8"
)
const opsAutomationLib = readFileSync(new URL("../lib/ops-automation.ts", import.meta.url), "utf8")
const notificationsLib = readFileSync(new URL("../lib/ops-notifications.ts", import.meta.url), "utf8")
const opsAnalyticsLib = readFileSync(new URL("../lib/ops-analytics.ts", import.meta.url), "utf8")
const playbookLib = readFileSync(new URL("../lib/ops-playbook.ts", import.meta.url), "utf8")

const taskApiSource = readFileSync(new URL("../app/api/ops/tasks/route.ts", import.meta.url), "utf8")
const notificationApiSource = readFileSync(
  new URL("../app/api/ops/notifications/route.ts", import.meta.url),
  "utf8"
)
const analyticsApiSource = readFileSync(new URL("../app/api/ops/analytics/route.ts", import.meta.url), "utf8")
const playbookApiSource = readFileSync(new URL("../app/api/ops/playbooks/route.ts", import.meta.url), "utf8")

const opsPageSource = readFileSync(new URL("../app/(dashboard)/ops-center/page.tsx", import.meta.url), "utf8")
const notifyPageSource = readFileSync(
  new URL("../app/(dashboard)/notification-orchestration/page.tsx", import.meta.url),
  "utf8"
)
const analyticsPageSource = readFileSync(
  new URL("../app/(dashboard)/ops-analytics/page.tsx", import.meta.url),
  "utf8"
)
const playbookPageSource = readFileSync(
  new URL("../app/(dashboard)/playbook-market/page.tsx", import.meta.url),
  "utf8"
)

const opsPanelSource = readFileSync(
  new URL("../components/ops/ops-task-center-panel.tsx", import.meta.url),
  "utf8"
)
const notifyPanelSource = readFileSync(
  new URL("../components/ops/notification-orchestration-panel.tsx", import.meta.url),
  "utf8"
)
const analyticsPanelSource = readFileSync(
  new URL("../components/ops/ops-analytics-panel.tsx", import.meta.url),
  "utf8"
)
const playbookPanelSource = readFileSync(
  new URL("../components/ops/playbook-market-panel.tsx", import.meta.url),
  "utf8"
)

const adminPageSource = readFileSync(new URL("../app/(dashboard)/admin/page.tsx", import.meta.url), "utf8")
const adminSubnavSource = readFileSync(new URL("../components/layout/admin-subnav.tsx", import.meta.url), "utf8")
const mobileHeaderSource = readFileSync(
  new URL("../components/layout/mobile-page-header.tsx", import.meta.url),
  "utf8"
)
const middlewareSource = readFileSync(new URL("../middleware.ts", import.meta.url), "utf8")

const phase6FeatureList = JSON.parse(
  readFileSync(new URL("../feature_list_phase6_growth_ecosystem.json", import.meta.url), "utf8")
)

test("schema includes ops automation, notifications, analytics and playbook models", () => {
  assert.match(schemaSource, /enum OpsTaskStatus \{/)
  assert.match(schemaSource, /enum OpsNotificationStatus \{/)
  assert.match(schemaSource, /enum OpsAnalyticsMetricType \{/)
  assert.match(schemaSource, /enum PlaybookTemplateStatus \{/)
  assert.match(schemaSource, /model OpsTaskTemplate \{/) 
  assert.match(schemaSource, /model OpsTaskRun \{/) 
  assert.match(schemaSource, /model OpsNotificationRule \{/) 
  assert.match(schemaSource, /model OpsNotificationDelivery \{/) 
  assert.match(schemaSource, /model OpsAnalyticsSnapshot \{/) 
  assert.match(schemaSource, /model OpsPlaybookTemplate \{/) 
  assert.match(schemaSource, /opsTaskTemplates\s+OpsTaskTemplate\[\]/)
  assert.match(schemaSource, /opsNotificationRules\s+OpsNotificationRule\[\]/)
  assert.match(schemaSource, /opsAnalyticsSnapshots\s+OpsAnalyticsSnapshot\[\]/)
  assert.match(schemaSource, /opsPlaybookTemplates\s+OpsPlaybookTemplate\[\]/)
})

test("ops libs provide scheduling, dedupe, funnel and playbook helpers", () => {
  assert.match(opsAutomationLib, /DEFAULT_OPS_TASK_TEMPLATES/)
  assert.match(opsAutomationLib, /sanitizeOpsTaskTemplateInput/)
  assert.match(opsAutomationLib, /resolveOpsTaskReplayToken/)
  assert.match(opsAutomationLib, /simulateOpsTaskExecution/)

  assert.match(notificationsLib, /DEFAULT_NOTIFICATION_RULES/)
  assert.match(notificationsLib, /resolveNotificationWindowSuppressed/)
  assert.match(notificationsLib, /resolveNotificationDedupKey/)
  assert.match(notificationsLib, /resolveNotificationStatus/)

  assert.match(opsAnalyticsLib, /buildOpsFunnelSummary/)
  assert.match(opsAnalyticsLib, /buildOpsCohortComparison/)
  assert.match(opsAnalyticsLib, /resolveOpsFunnelConsistency/)

  assert.match(playbookLib, /DEFAULT_PLAYBOOK_TEMPLATES/)
  assert.match(playbookLib, /resolvePlaybookRating/)
  assert.match(playbookLib, /resolvePlaybookCompatibility/)
})

test("ops APIs support template execution, multi-channel delivery, cohort analytics and playbook apply", () => {
  assert.match(taskApiSource, /export async function GET\(\)/)
  assert.match(taskApiSource, /export async function PUT\(request: Request\)/)
  assert.match(taskApiSource, /export async function POST\(request: Request\)/)
  assert.match(taskApiSource, /ops\.task\.run\.execute/)

  assert.match(notificationApiSource, /export async function GET\(\)/)
  assert.match(notificationApiSource, /export async function PUT\(request: Request\)/)
  assert.match(notificationApiSource, /export async function POST\(request: Request\)/)
  assert.match(notificationApiSource, /resolveNotificationStatus/)
  assert.match(notificationApiSource, /ops\.notification\.delivery\.dispatch/)

  assert.match(analyticsApiSource, /export async function GET\(\)/)
  assert.match(analyticsApiSource, /export async function POST\(request: Request\)/)
  assert.match(analyticsApiSource, /buildOpsFunnelSummary/)
  assert.match(analyticsApiSource, /ops\.analytics\.snapshot\.create/)

  assert.match(playbookApiSource, /export async function GET\(\)/)
  assert.match(playbookApiSource, /export async function PUT\(request: Request\)/)
  assert.match(playbookApiSource, /export async function POST\(request: Request\)/)
  assert.match(playbookApiSource, /ops\.playbook\.template\.apply/)
})

test("week23 pages and panels expose end-to-end operations workflow", () => {
  assert.match(entitlementsSource, /OPS_AUTOMATION_PLANS/)
  assert.match(entitlementsSource, /NOTIFICATION_ORCHESTRATION_PLANS/)
  assert.match(entitlementsSource, /OPS_ANALYTICS_PLANS/)
  assert.match(entitlementsSource, /OPS_PLAYBOOK_PLANS/)
  assert.match(entitlementsSource, /hasOpsAutomationAccess/)
  assert.match(entitlementsSource, /hasNotificationOrchestrationAccess/)
  assert.match(entitlementsSource, /hasOpsAnalyticsAccess/)
  assert.match(entitlementsSource, /hasOpsPlaybookAccess/)

  assert.match(opsPageSource, /Week23-001/)
  assert.match(notifyPageSource, /Week23-002/)
  assert.match(analyticsPageSource, /Week23-003/)
  assert.match(playbookPageSource, /Week23-004/)

  assert.match(opsPanelSource, /\/api\/ops\/tasks/)
  assert.match(opsPanelSource, /定时执行、重试、失败告警与运行历史追踪/)

  assert.match(notifyPanelSource, /\/api\/ops\/notifications/)
  assert.match(notifyPanelSource, /频控、去重补偿与触达回执/)

  assert.match(analyticsPanelSource, /\/api\/ops\/analytics/)
  assert.match(analyticsPanelSource, /cohort 对比与实验联动分析/)

  assert.match(playbookPanelSource, /\/api\/ops\/playbooks/)
  assert.match(playbookPanelSource, /一键应用到任务中心并支持升级回滚/)
})

test("week23 modules are wired into admin portal and guarded routes", () => {
  assert.match(adminPageSource, /href: "\/admin\/ops-center"/)
  assert.match(adminPageSource, /href: "\/admin\/notification-orchestration"/)
  assert.match(adminPageSource, /href: "\/admin\/ops-analytics"/)
  assert.match(adminPageSource, /href: "\/admin\/playbook-market"/)

  assert.match(adminSubnavSource, /href: "\/admin\/ops-center"/)
  assert.match(adminSubnavSource, /href: "\/admin\/notification-orchestration"/)
  assert.match(adminSubnavSource, /href: "\/admin\/ops-analytics"/)
  assert.match(adminSubnavSource, /href: "\/admin\/playbook-market"/)

  assert.match(mobileHeaderSource, /"ops-center": "任务中心"/)
  assert.match(mobileHeaderSource, /"notification-orchestration": "通知编排"/)
  assert.match(mobileHeaderSource, /"ops-analytics": "运营漏斗"/)
  assert.match(mobileHeaderSource, /"playbook-market": "Playbook 市场"/)

  assert.match(middlewareSource, /"\/ops-center\/:path\*"/)
  assert.match(middlewareSource, /"\/notification-orchestration\/:path\*"/)
  assert.match(middlewareSource, /"\/ops-analytics\/:path\*"/)
  assert.match(middlewareSource, /"\/playbook-market\/:path\*"/)
})

test("phase6 tracker marks all week23 features complete", () => {
  for (const id of [
    "phase6-week23-001",
    "phase6-week23-002",
    "phase6-week23-003",
    "phase6-week23-004",
  ]) {
    const item = phase6FeatureList.features.find((feature) => feature.id === id)
    assert.ok(item)
    assert.equal(item.passes, true)
  }
})
