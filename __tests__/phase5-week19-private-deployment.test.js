import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"))
const composeTemplateSource = readFileSync(
  new URL("../deploy/private-template/docker-compose.enterprise.yml", import.meta.url),
  "utf8"
)
const stagingEnvSource = readFileSync(
  new URL("../deploy/private-template/env/staging.env.example", import.meta.url),
  "utf8"
)
const productionEnvSource = readFileSync(
  new URL("../deploy/private-template/env/production.env.example", import.meta.url),
  "utf8"
)
const drEnvSource = readFileSync(
  new URL("../deploy/private-template/env/dr.env.example", import.meta.url),
  "utf8"
)
const preflightSource = readFileSync(
  new URL("../tools/enterprise-deploy-preflight.sh", import.meta.url),
  "utf8"
)
const deployGuideSource = readFileSync(
  new URL("../docs/enterprise-private-deployment.md", import.meta.url),
  "utf8"
)
const runbookSource = readFileSync(
  new URL("../docs/enterprise-upgrade-rollback-runbook.md", import.meta.url),
  "utf8"
)
const phase5FeatureList = JSON.parse(
  readFileSync(new URL("../feature_list_phase5_commercialization.json", import.meta.url), "utf8")
)

test("enterprise template includes private compose baseline with image tag and health checks", () => {
  assert.match(composeTemplateSource, /services:/)
  assert.match(composeTemplateSource, /mysql:/)
  assert.match(composeTemplateSource, /app:/)
  assert.match(composeTemplateSource, /nginx:/)
  assert.match(composeTemplateSource, /backup:/)
  assert.match(composeTemplateSource, /AURA_APP_IMAGE/)
  assert.match(composeTemplateSource, /APP_IMAGE_TAG/)
  assert.match(composeTemplateSource, /healthcheck:/)
})

test("environment templates cover staging, production and dr with aligned deployment keys", () => {
  assert.match(stagingEnvSource, /DEPLOY_ENV=staging/)
  assert.match(productionEnvSource, /DEPLOY_ENV=production/)
  assert.match(drEnvSource, /DEPLOY_ENV=dr/)

  assert.match(stagingEnvSource, /NEXTAUTH_URL=https:\/\//)
  assert.match(productionEnvSource, /NEXTAUTH_URL=https:\/\//)
  assert.match(drEnvSource, /NEXTAUTH_URL=https:\/\//)

  assert.match(stagingEnvSource, /DATABASE_URL=mysql:\/\//)
  assert.match(productionEnvSource, /DATABASE_URL=mysql:\/\//)
  assert.match(drEnvSource, /DATABASE_URL=mysql:\/\//)
})

test("enterprise preflight supports env var validation, one-click preflight and multi-env consistency", () => {
  assert.match(preflightSource, /REQUIRED_ENV_VARS=/)
  assert.match(preflightSource, /--env <staging\|production\|dr\|all>/)
  assert.match(preflightSource, /validate_env_file/)
  assert.match(preflightSource, /validate_keyset_consistency/)
  assert.match(preflightSource, /render_compose_config/)
  assert.match(preflightSource, /docker compose/)
  assert.match(preflightSource, /quality_preflight/)
  assert.match(preflightSource, /tools\/preflight-check\.sh/)
})

test("docs include private deployment guide and upgrade rollback runbook", () => {
  assert.match(deployGuideSource, /Enterprise Private Deployment Guide/)
  assert.match(deployGuideSource, /tools\/enterprise-deploy-preflight\.sh/)
  assert.match(deployGuideSource, /staging/)
  assert.match(deployGuideSource, /production/)
  assert.match(deployGuideSource, /dr/)

  assert.match(runbookSource, /Upgrade procedure/)
  assert.match(runbookSource, /Rollback procedure/)
  assert.match(runbookSource, /APP_IMAGE_TAG/)
  assert.match(runbookSource, /RTO\/RPO/)
})

test("package scripts expose enterprise preflight commands", () => {
  assert.equal(
    packageJson.scripts?.["enterprise:preflight"],
    "bash ./tools/enterprise-deploy-preflight.sh --env all --mode fast --skip-docker"
  )
  assert.equal(
    packageJson.scripts?.["enterprise:preflight:full"],
    "bash ./tools/enterprise-deploy-preflight.sh --env all --mode full --skip-docker"
  )
})

test("phase5 tracker marks week19-001 complete with synced metadata", () => {
  assert.equal(phase5FeatureList.meta.total_features, 16)
  assert.ok(phase5FeatureList.meta.completed_features >= 9)
  const feature = phase5FeatureList.features.find((item) => item.id === "phase5-week19-001")
  assert.ok(feature)
  assert.equal(feature.passes, true)
})
