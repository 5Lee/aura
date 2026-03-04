# Enterprise Private Deployment Guide

This guide standardizes Aura private delivery for enterprise tenants.

## Deliverables

- Deployment template: `deploy/private-template/docker-compose.enterprise.yml`
- Environment matrix:
  - `deploy/private-template/env/staging.env.example`
  - `deploy/private-template/env/production.env.example`
  - `deploy/private-template/env/dr.env.example`
- Reverse proxy template: `deploy/private-template/nginx/enterprise.conf`
- One-click preflight: `tools/enterprise-deploy-preflight.sh`
- Upgrade and rollback runbook: `docs/enterprise-upgrade-rollback-runbook.md`

## One-click preflight

Run preflight before every deployment window:

```bash
bash ./tools/enterprise-deploy-preflight.sh --env all --mode fast
```

What it validates:

1. Required environment variables for each target environment.
2. Security baseline checks (HTTPS URL, non-placeholder secret, non-latest production tag).
3. Multi-environment keyset consistency (`staging` / `production` / `dr`).
4. Compose rendering for each target environment.
5. Optional code quality preflight (reusing `tools/preflight-check.sh`).

Useful options:

```bash
# only validate production
bash ./tools/enterprise-deploy-preflight.sh --env production --mode full

# local validation without docker render
bash ./tools/enterprise-deploy-preflight.sh --env all --skip-docker

# validate templates only
bash ./tools/enterprise-deploy-preflight.sh --env all --skip-docker --skip-quality
```

## Deployment workflow

1. Copy target env template to secure path (example `.deploy/production.env`).
2. Fill real secrets and image tag.
3. Run preflight.
4. Deploy compose stack.
5. Run migration and post-check.

Example:

```bash
cp deploy/private-template/env/production.env.example .deploy/production.env

bash ./tools/enterprise-deploy-preflight.sh --env production --mode full

docker compose \
  --env-file .deploy/production.env \
  -f deploy/private-template/docker-compose.enterprise.yml \
  up -d

docker compose \
  --env-file .deploy/production.env \
  -f deploy/private-template/docker-compose.enterprise.yml \
  exec app npx prisma migrate deploy
```

## Multi-environment consistency strategy

- Keep the same variable keyset in all env files.
- Only values differ by environment.
- Validate compose rendering for every environment before release.
- Keep production and DR on the same `APP_IMAGE_TAG` for deterministic rollback.
