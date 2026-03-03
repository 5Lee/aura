#!/usr/bin/env bash

set -uo pipefail

MODE="fast"
SKIP_DB=0

usage() {
  cat <<'EOF'
Usage:
  ./tools/preflight-check.sh [--mode fast|full] [--skip-db]

Modes:
  fast  - dependencies + db ping + typecheck + smoke test
  full  - dependencies + db ping + typecheck + lint + full test + build
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --mode)
      MODE="${2:-}"
      shift 2
      ;;
    --skip-db)
      SKIP_DB=1
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

check_node_modules() {
  [[ -d node_modules ]]
}

db_ping() {
  npx prisma db execute --stdin >/dev/null 2>&1 <<'SQL'
SELECT 1;
SQL
}

typecheck() {
  npm run typecheck >/dev/null
}

lint() {
  npm run lint >/dev/null
}

test_smoke() {
  npm test -- __tests__/feature-list-meta-consistency.test.js >/dev/null
}

test_full() {
  npm test >/dev/null
}

build_prod() {
  npm run build >/dev/null
}

echo "== Aura Preflight Check =="
echo "mode=${MODE} skip_db=${SKIP_DB}"

run_step "dep.node" "node command exists" cmd_exists node || true
run_step "dep.npm" "npm command exists" cmd_exists npm || true
run_step "dep.node_modules" "node_modules directory exists" check_node_modules || true

if [[ "$SKIP_DB" -eq 1 ]]; then
  skip_step "db.ping" "database ping (skipped by --skip-db)"
else
  run_step "db.ping" "database ping via prisma" db_ping || true
fi

run_step "quality.typecheck" "npm run typecheck" typecheck || true

if [[ "$MODE" == "full" ]]; then
  run_step "quality.lint" "npm run lint" lint || true
  run_step "quality.test" "npm test" test_full || true
  run_step "quality.build" "npm run build" build_prod || true
else
  run_step "quality.test.smoke" "npm test -- __tests__/feature-list-meta-consistency.test.js" test_smoke || true
fi

echo ""
echo "== Preflight Summary =="
echo "total=${TOTAL} pass=${PASS} fail=${FAIL} skip=${SKIP}"

if [[ "$FAIL" -gt 0 ]]; then
  exit 1
fi

exit 0
