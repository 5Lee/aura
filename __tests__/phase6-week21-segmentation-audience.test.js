import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const schemaSource = readFileSync(new URL("../prisma/schema.prisma", import.meta.url), "utf8")
const segmentationLibSource = readFileSync(new URL("../lib/growth-segmentation.ts", import.meta.url), "utf8")
const experimentsRouteSource = readFileSync(
  new URL("../app/api/growth-lab/experiments/route.ts", import.meta.url),
  "utf8"
)
const segmentsRouteSource = readFileSync(
  new URL("../app/api/growth-lab/segments/route.ts", import.meta.url),
  "utf8"
)
const audienceRouteSource = readFileSync(
  new URL("../app/api/growth-lab/experiments/[id]/audience/route.ts", import.meta.url),
  "utf8"
)
const growthPageSource = readFileSync(
  new URL("../app/(dashboard)/growth-lab/page.tsx", import.meta.url),
  "utf8"
)
const growthPanelSource = readFileSync(
  new URL("../components/growth/growth-experiment-panel.tsx", import.meta.url),
  "utf8"
)
const phase6FeatureList = JSON.parse(
  readFileSync(new URL("../feature_list_phase6_growth_ecosystem.json", import.meta.url), "utf8")
)

test("schema includes audience segment and experiment audience orchestration models", () => {
  assert.match(schemaSource, /enum GrowthSegmentStatus \{/)
  assert.match(schemaSource, /enum GrowthSegmentMatchMode \{/)
  assert.match(schemaSource, /model GrowthAudienceSegment \{/)
  assert.match(schemaSource, /model GrowthExperimentAudience \{/)
  assert.match(schemaSource, /growthAudienceSegments\s+GrowthAudienceSegment\[\]/)
  assert.match(schemaSource, /growthExperimentAudiences\s+GrowthExperimentAudience\[\]/)
})

test("segmentation lib provides default segments, sanitizers and audience estimate resolver", () => {
  assert.match(segmentationLibSource, /DEFAULT_GROWTH_AUDIENCE_SEGMENTS/)
  assert.match(segmentationLibSource, /buildGrowthAudienceSegmentSeed/)
  assert.match(segmentationLibSource, /sanitizeGrowthAudienceSegmentInput/)
  assert.match(segmentationLibSource, /normalizeGrowthSegmentStatus/)
  assert.match(segmentationLibSource, /normalizeGrowthSegmentMatchMode/)
  assert.match(segmentationLibSource, /resolveGrowthAudienceEstimate/)
  assert.match(segmentationLibSource, /sanitizeExcludedSegmentKeys/)
})

test("growth lab routes cover segment management and audience orchestration", () => {
  assert.match(experimentsRouteSource, /segments/)
  assert.match(experimentsRouteSource, /audiences/)

  assert.match(segmentsRouteSource, /export async function GET\(\)/)
  assert.match(segmentsRouteSource, /export async function PUT\(request: Request\)/)
  assert.match(segmentsRouteSource, /buildGrowthAudienceSegmentSeed/)
  assert.match(segmentsRouteSource, /growth\.segment\.upsert/)

  assert.match(audienceRouteSource, /export async function PATCH\(request: Request/)
  assert.match(audienceRouteSource, /resolveGrowthAudienceEstimate/)
  assert.match(audienceRouteSource, /growth\.audience\.upsert/)
})

test("growth page and panel expose segment setup and audience rollout workflow", () => {
  assert.match(growthPageSource, /segments=/)
  assert.match(growthPageSource, /audiences=/)

  assert.match(growthPanelSource, /用户分群管理/)
  assert.match(growthPanelSource, /用户分群与实验受众编排/)
  assert.match(growthPanelSource, /\/api\/growth-lab\/segments/)
  assert.match(growthPanelSource, /\/api\/growth-lab\/experiments\/\$\{selectedAudienceExperimentId\}\/audience/)
  assert.match(growthPanelSource, /保存受众编排/)
})

test("phase6 tracker marks week21-002 complete with synced metadata", () => {
  assert.equal(phase6FeatureList.meta.total_features, 16)
  assert.ok(phase6FeatureList.meta.completed_features >= 2)
  const feature = phase6FeatureList.features.find((item) => item.id === "phase6-week21-002")
  assert.ok(feature)
  assert.equal(feature.passes, true)
})
