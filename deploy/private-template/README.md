# Enterprise Private Deployment Template

This folder provides an enterprise-ready private deployment baseline for Aura.

## Included templates

- `docker-compose.enterprise.yml`: production-safe compose baseline
- `nginx/enterprise.conf`: reverse proxy template
- `env/staging.env.example`: staging environment variables
- `env/production.env.example`: production environment variables
- `env/dr.env.example`: disaster recovery environment variables

## Quick start

1. Copy an environment template:

```bash
cp deploy/private-template/env/production.env.example .deploy/production.env
```

2. Run one-click preflight:

```bash
bash ./tools/enterprise-deploy-preflight.sh --env production --mode fast
```

3. Render and deploy:

```bash
docker compose \
  --env-file .deploy/production.env \
  -f deploy/private-template/docker-compose.enterprise.yml \
  config >/tmp/aura-prod-compose.yaml

docker compose \
  --env-file .deploy/production.env \
  -f deploy/private-template/docker-compose.enterprise.yml \
  up -d
```

4. Apply migration:

```bash
docker compose \
  --env-file .deploy/production.env \
  -f deploy/private-template/docker-compose.enterprise.yml \
  exec app npx prisma migrate deploy
```

For upgrade and rollback details, see `docs/enterprise-upgrade-rollback-runbook.md`.
