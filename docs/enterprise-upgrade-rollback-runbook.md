# Enterprise Upgrade and Rollback Runbook

This runbook defines the standard upgrade and rollback flow for private deployments.

## Scope

- Compose template: `deploy/private-template/docker-compose.enterprise.yml`
- Environment files: `deploy/private-template/env/*.env.example`
- Target environments: `staging`, `production`, `dr`

## Pre-upgrade checklist

1. Confirm release tag (example `APP_IMAGE_TAG=v1.2.3`).
2. Run one-click preflight:
   ```bash
   bash ./tools/enterprise-deploy-preflight.sh --env production --mode full
   ```
3. Verify latest backup is available and restorable.
4. Freeze schema-changing operations during migration window.

## Upgrade procedure

1. Update deployment env file:
   ```bash
   APP_IMAGE_TAG=v1.2.3
   ```
2. Pull and deploy:
   ```bash
   docker compose --env-file .deploy/production.env -f deploy/private-template/docker-compose.enterprise.yml pull
   docker compose --env-file .deploy/production.env -f deploy/private-template/docker-compose.enterprise.yml up -d
   ```
3. Apply migration:
   ```bash
   docker compose --env-file .deploy/production.env -f deploy/private-template/docker-compose.enterprise.yml exec app npx prisma migrate deploy
   ```
4. Post-upgrade verification:
   - `/api/health` returns 200
   - Login flow works
   - Prompt CRUD smoke passes
   - No active OPEN SLA alert spikes

## Rollback trigger conditions

Rollback immediately when one of the following persists over 10 minutes:

- Availability drops below plan target.
- Error rate exceeds threshold and does not recover.
- Data migration causes blocking application errors.

## Rollback procedure

1. Revert image tag in env file (example `APP_IMAGE_TAG=v1.2.2`).
2. Redeploy previous version:
   ```bash
   docker compose --env-file .deploy/production.env -f deploy/private-template/docker-compose.enterprise.yml up -d
   ```
3. If schema rollback is required, execute tested rollback SQL from migration plan.
4. Run preflight and smoke checks after rollback:
   ```bash
   bash ./tools/enterprise-deploy-preflight.sh --env production --mode fast --skip-docker
   ```

## DR drill recommendation

Run monthly DR consistency drill:

1. Keep DR env on same `APP_IMAGE_TAG` as production.
2. Run preflight for both production and DR.
3. Perform controlled failover test and document RTO/RPO.
4. Update this runbook when any gap is found.
