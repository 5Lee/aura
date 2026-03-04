#!/usr/bin/env bash

set -uo pipefail

MODE="fast"
ENV_SCOPE="all"
ENV_DIR="deploy/private-template/env"
COMPOSE_FILE="deploy/private-template/docker-compose.enterprise.yml"
RUN_QUALITY=1
SKIP_DOCKER=0

REQUIRED_ENV_VARS=(
  DEPLOY_ENV
  AURA_APP_IMAGE
  APP_IMAGE_TAG
  NEXTAUTH_URL
  NEXTAUTH_SECRET
  FEATURE_FLAG_PRIVATE_DEPLOY
  MYSQL_ROOT_PASSWORD
  MYSQL_DATABASE
  MYSQL_USER
  MYSQL_PASSWORD
  DATABASE_URL
)

usage() {
  cat <<'USAGE'
Usage:
  ./tools/enterprise-deploy-preflight.sh [options]

Options:
  --env <staging|production|dr|all>    Target environment scope (default: all)
  --mode <fast|full>                   Quality preflight mode (default: fast)
  --env-dir <path>                     Environment template directory
  --compose-file <path>                Compose template path
  --skip-quality                       Skip code quality preflight checks
  --skip-docker                        Skip docker compose render checks
  -h, --help                           Show help
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --env)
      ENV_SCOPE="${2:-}"
      shift 2
      ;;
    --mode)
      MODE="${2:-}"
      shift 2
      ;;
    --env-dir)
      ENV_DIR="${2:-}"
      shift 2
      ;;
    --compose-file)
      COMPOSE_FILE="${2:-}"
      shift 2
      ;;
    --skip-quality)
      RUN_QUALITY=0
      shift
      ;;
    --skip-docker)
      SKIP_DOCKER=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "[ERROR] Unknown option: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if [[ "$MODE" != "fast" && "$MODE" != "full" ]]; then
  echo "[ERROR] --mode must be fast or full, got: $MODE" >&2
  exit 1
fi

if [[ "$ENV_SCOPE" != "staging" && "$ENV_SCOPE" != "production" && "$ENV_SCOPE" != "dr" && "$ENV_SCOPE" != "all" ]]; then
  echo "[ERROR] --env must be staging|production|dr|all, got: $ENV_SCOPE" >&2
  exit 1
fi

TOTAL=0
PASS=0
FAIL=0
SKIP=0

run_step() {
  local id="$1"
  local desc="$2"
  shift 2
  TOTAL=$((TOTAL + 1))

  echo "[RUN ] ${id} | ${desc}"
  if "$@"; then
    PASS=$((PASS + 1))
    echo "[PASS] ${id}"
    return 0
  fi

  FAIL=$((FAIL + 1))
  echo "[FAIL] ${id}"
  return 1
}

skip_step() {
  local id="$1"
  local desc="$2"
  TOTAL=$((TOTAL + 1))
  SKIP=$((SKIP + 1))
  echo "[SKIP] ${id} | ${desc}"
}

cmd_exists() {
  command -v "$1" >/dev/null 2>&1
}

docker_compose_exists() {
  docker compose version >/dev/null 2>&1
}

resolve_env_file() {
  local target="$1"
  echo "${ENV_DIR}/${target}.env.example"
}

extract_env_value() {
  local key="$1"
  local file="$2"
  local line
  line=$(grep -E "^${key}=" "$file" | head -n 1 || true)
  if [[ -z "$line" ]]; then
    echo ""
    return 0
  fi
  echo "${line#*=}"
}

validate_env_file() {
  local target="$1"
  local file="$2"
  local allow_placeholders=0

  if [[ ! -f "$file" ]]; then
    echo "[ERROR] Missing env template: $file" >&2
    return 1
  fi

  if [[ "$file" == *.example ]]; then
    allow_placeholders=1
  fi

  local missing=0
  local key
  for key in "${REQUIRED_ENV_VARS[@]}"; do
    if ! grep -Eq "^${key}=" "$file"; then
      echo "[ERROR] ${target}: missing key ${key}" >&2
      missing=1
    fi
  done

  if [[ "$missing" -eq 1 ]]; then
    return 1
  fi

  local deploy_env
  deploy_env=$(extract_env_value "DEPLOY_ENV" "$file")
  if [[ "$deploy_env" != "$target" ]]; then
    echo "[ERROR] ${target}: DEPLOY_ENV should be ${target}, got ${deploy_env}" >&2
    return 1
  fi

  local nextauth_url
  nextauth_url=$(extract_env_value "NEXTAUTH_URL" "$file")
  if [[ "$nextauth_url" != https://* ]]; then
    echo "[ERROR] ${target}: NEXTAUTH_URL must start with https://" >&2
    return 1
  fi

  local image_tag
  image_tag=$(extract_env_value "APP_IMAGE_TAG" "$file")
  if [[ -z "$image_tag" ]]; then
    echo "[ERROR] ${target}: APP_IMAGE_TAG cannot be empty" >&2
    return 1
  fi

  if [[ "$target" == "production" && "$image_tag" == *"latest"* ]]; then
    echo "[ERROR] production: APP_IMAGE_TAG must not use latest" >&2
    return 1
  fi

  local nextauth_secret
  nextauth_secret=$(extract_env_value "NEXTAUTH_SECRET" "$file")
  if [[ "$nextauth_secret" == "" ]]; then
    echo "[ERROR] ${target}: NEXTAUTH_SECRET cannot be empty" >&2
    return 1
  fi

  if [[ "$allow_placeholders" -eq 0 && ( "$nextauth_secret" == *"replace_with"* || "$nextauth_secret" == *"change_me"* ) ]]; then
    echo "[ERROR] ${target}: NEXTAUTH_SECRET still uses placeholder" >&2
    return 1
  fi

  return 0
}

validate_keyset_consistency() {
  local targets=("$@")
  local baseline="$(resolve_env_file "${targets[0]}")"

  local baseline_keys
  baseline_keys=$(grep -E '^[A-Z0-9_]+=' "$baseline" | cut -d '=' -f 1 | sort -u)

  local target
  for target in "${targets[@]:1}"; do
    local candidate
    candidate="$(resolve_env_file "$target")"
    local candidate_keys
    candidate_keys=$(grep -E '^[A-Z0-9_]+=' "$candidate" | cut -d '=' -f 1 | sort -u)

    if [[ "$baseline_keys" != "$candidate_keys" ]]; then
      echo "[ERROR] Keyset mismatch between ${baseline} and ${candidate}" >&2
      return 1
    fi
  done

  return 0
}

render_compose_config() {
  local target="$1"
  local env_file="$2"

  docker compose \
    --env-file "$env_file" \
    -f "$COMPOSE_FILE" \
    config >/dev/null
}

quality_preflight() {
  bash ./tools/preflight-check.sh --mode "$MODE" --skip-db >/dev/null
}

if [[ "$ENV_SCOPE" == "all" ]]; then
  TARGETS=("staging" "production" "dr")
else
  TARGETS=("$ENV_SCOPE")
fi

echo "== Aura Enterprise Deploy Preflight =="
echo "env_scope=${ENV_SCOPE} mode=${MODE} env_dir=${ENV_DIR} compose_file=${COMPOSE_FILE}"

run_step "dep.env_dir" "environment template directory exists" test -d "$ENV_DIR" || true
run_step "dep.compose_file" "enterprise compose template exists" test -f "$COMPOSE_FILE" || true

for target in "${TARGETS[@]}"; do
  env_file="$(resolve_env_file "$target")"
  run_step "env.${target}.vars" "validate required vars and security for ${target}" validate_env_file "$target" "$env_file" || true
done

if [[ "${#TARGETS[@]}" -gt 1 ]]; then
  run_step "env.matrix.consistency" "validate keyset consistency across environments" validate_keyset_consistency "${TARGETS[@]}" || true
else
  skip_step "env.matrix.consistency" "single environment scope"
fi

if [[ "$SKIP_DOCKER" -eq 1 ]]; then
  skip_step "compose.binary" "docker compose check skipped"
  skip_step "compose.render" "compose render checks skipped"
else
  run_step "compose.binary" "docker and docker compose are available" bash -lc 'command -v docker >/dev/null && docker compose version >/dev/null' || true
  for target in "${TARGETS[@]}"; do
    env_file="$(resolve_env_file "$target")"
    run_step "compose.${target}.render" "render compose config for ${target}" render_compose_config "$target" "$env_file" || true
  done
fi

if [[ "$RUN_QUALITY" -eq 1 ]]; then
  run_step "quality.preflight" "run code quality preflight in ${MODE} mode" quality_preflight || true
else
  skip_step "quality.preflight" "skipped by --skip-quality"
fi

echo ""
echo "== Enterprise Preflight Summary =="
echo "total=${TOTAL} pass=${PASS} fail=${FAIL} skip=${SKIP}"

if [[ "$FAIL" -gt 0 ]]; then
  exit 1
fi

exit 0
