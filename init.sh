#!/bin/bash

# Aura Development Server Startup Script
# Based on Anthropic's "Effective Harnesses for Long-Running Agents" best practices
# This script ensures a consistent development environment for each agent session

set -u

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() {
  echo -e "${BLUE}$1${NC}"
}

log_ok() {
  echo -e "${GREEN}$1${NC}"
}

log_warn() {
  echo -e "${YELLOW}$1${NC}"
}

log_error() {
  echo -e "${RED}$1${NC}"
}

is_port_in_use() {
  local port="$1"
  lsof -tiTCP:"${port}" -sTCP:LISTEN >/dev/null 2>&1
}

get_port_owner() {
  local port="$1"
  lsof -nP -iTCP:"${port}" -sTCP:LISTEN 2>/dev/null | awk 'NR==2 {print $1 " (pid=" $2 ")"}'
}

choose_dev_port() {
  local requested_port="${AURA_DEV_PORT:-3000}"
  local strategy="${AURA_PORT_STRATEGY:-auto}"
  local max_scans="${AURA_PORT_SCAN_LIMIT:-20}"
  local chosen_port="${requested_port}"
  local scans=0

  while is_port_in_use "${chosen_port}"; do
    local owner
    owner=$(get_port_owner "${chosen_port}")

    if [ "${strategy}" = "fail" ]; then
      log_error "   ❌ Port ${chosen_port} already in use by ${owner:-unknown process}."
      log_info "   建议: 关闭占用进程，或设置 AURA_DEV_PORT=3001（或更高端口）后重试。"
      exit 1
    fi

    scans=$((scans + 1))
    if [ "${scans}" -ge "${max_scans}" ]; then
      log_error "   ❌ Unable to find available port after scanning ${max_scans} ports from ${requested_port}."
      log_info "   建议: 设置 AURA_DEV_PORT 到空闲端口，或设置 AURA_PORT_STRATEGY=fail 直接失败。"
      exit 1
    fi

    log_warn "   ⚠ Port ${chosen_port} occupied by ${owner:-unknown process}, trying next port..."
    chosen_port=$((chosen_port + 1))
  done

  DEV_PORT="${chosen_port}"

  if [ "${DEV_PORT}" != "${requested_port}" ]; then
    log_warn "   ⚠ Requested port ${requested_port} unavailable, switched to ${DEV_PORT}."
  else
    log_ok "   ✓ Dev port available: ${DEV_PORT}"
  fi
}

is_database_ready() {
  npx prisma db execute --stdin >/dev/null 2>&1 <<'SQL'
SELECT 1;
SQL
}

print_db_recovery_help() {
  log_info "   修复建议:"
  log_info "   1) 检查 .env 中 DATABASE_URL 是否正确"
  log_info "   2) 启动数据库服务（如 MySQL: brew services start mysql）"
  log_info "   3) 数据库可用后执行: npm run db:push && npm run db:seed"
}

echo "🚀 Starting Aura Development Environment..."
echo ""

log_info "📋 Step 1: Environment Check"

NODE_VERSION=$(node -v 2>/dev/null || echo "")
if [ -z "${NODE_VERSION}" ]; then
  log_error "❌ Node.js is not installed."
  exit 1
fi
log_ok "   ✓ Node.js: ${NODE_VERSION}"

NPM_VERSION=$(npm -v 2>/dev/null || echo "")
if [ -z "${NPM_VERSION}" ]; then
  log_error "❌ npm is not installed."
  exit 1
fi
log_ok "   ✓ npm: ${NPM_VERSION}"

if command -v brew >/dev/null 2>&1; then
  MYSQL_STATE=$(brew services list 2>/dev/null | awk '$1=="mysql" {print $2}')
  if [ -z "${MYSQL_STATE}" ]; then
    log_warn "   ⚠ MySQL service is not installed via Homebrew (skip auto-start)."
  elif [ "${MYSQL_STATE}" != "started" ]; then
    log_warn "   ⚠ MySQL is ${MYSQL_STATE}. Trying to start..."
    if brew services start mysql >/dev/null 2>&1; then
      sleep 2
      log_ok "   ✓ MySQL started"
    else
      log_warn "   ⚠ Unable to auto-start MySQL."
      print_db_recovery_help
    fi
  else
    log_ok "   ✓ MySQL: running"
  fi
fi

echo ""

log_info "📦 Step 2: Dependencies Check"

if [ ! -f .env ]; then
  log_error "❌ .env file not found."
  if [ -f .env.example ]; then
    cp .env.example .env
    log_warn "   ⚠ Created .env from .env.example. Please update credentials."
  else
    log_error "   ❌ .env.example not found. Please create .env manually."
  fi
fi

if [ ! -d node_modules ]; then
  log_warn "   Installing dependencies..."
  if npm install; then
    log_ok "   ✓ Dependencies installed"
  else
    log_error "   ❌ npm install failed."
    log_info "   建议: 检查网络后重试 npm ci --ignore-scripts --no-audit --no-fund"
    exit 1
  fi
else
  log_ok "   ✓ node_modules exists"
fi

if [ ! -d node_modules/.prisma ]; then
  log_warn "   Generating Prisma client..."
  if npx prisma generate >/dev/null 2>&1; then
    log_ok "   ✓ Prisma client generated"
  else
    log_warn "   ⚠ Prisma client generate failed. API routes may fail until fixed."
    log_info "   建议: 运行 npm run db:generate 查看详细错误"
  fi
else
  log_ok "   ✓ Prisma client generated"
fi

echo ""

log_info "🗄️  Step 3: Database Check"

DB_READY=false
if [ "${AURA_SKIP_DB:-0}" = "1" ]; then
  log_warn "   ⚠ AURA_SKIP_DB=1, skipping database checks and migration/seed."
elif is_database_ready; then
  DB_READY=true
  log_ok "   ✓ Database connection available"
else
  log_warn "   ⚠ Database is currently unreachable."
  log_warn "   ⚠ Continue without DB migration/seed; app pages using DB may fail at runtime."
  print_db_recovery_help
fi

if [ "${DB_READY}" = "true" ]; then
  if npx prisma migrate status >/dev/null 2>&1; then
    log_ok "   ✓ Database migrations applied"
  else
    log_warn "   ⚠ Migration status check failed, attempting prisma db push..."
    if npx prisma db push >/dev/null 2>&1; then
      log_ok "   ✓ Database schema synced by prisma db push"
    else
      log_warn "   ⚠ Database schema sync failed."
      print_db_recovery_help
    fi
  fi

  if npx prisma db execute --stdin >/dev/null 2>&1 <<'SQL'
SELECT COUNT(*) FROM Prompt;
SQL
  then
    PROMPT_COUNT=$(npx prisma db execute --stdin 2>/dev/null <<'SQL'
SELECT COUNT(*) AS count FROM Prompt;
SQL
)
    if echo "${PROMPT_COUNT}" | grep -q "0"; then
      log_warn "   Seeding database with initial data..."
      if npx prisma db seed >/dev/null 2>&1; then
        log_ok "   ✓ Database seeded"
      else
        log_warn "   ⚠ Seed skipped/failed (may already have data)"
      fi
    else
      log_ok "   ✓ Database has seed data"
    fi
  else
    log_warn "   ⚠ Prompt table not ready yet, skip seed check."
  fi
fi

echo ""

log_info "🔍 Step 4: Code Quality Check"

log_warn "   Checking TypeScript..."
if npm run typecheck >/dev/null 2>&1; then
  log_ok "   ✓ No TypeScript errors"
else
  log_warn "   ⚠ TypeScript errors found (server will still start)"
fi

if [ -f ".eslintrc.json" ] || [ -f ".eslintrc.js" ] || [ -f "eslint.config.js" ] || [ -f "eslint.config.mjs" ]; then
  log_warn "   Checking lint..."
  if npm run lint >/dev/null 2>&1; then
    log_ok "   ✓ No lint errors"
  else
    log_warn "   ⚠ Lint errors found (server will still start)"
  fi
fi

echo ""

log_info "📊 Step 5: Session Info"

GIT_BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
GIT_STATUS=$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')
log_ok "   Branch: ${GIT_BRANCH}"
if [ "${GIT_STATUS}" -gt 0 ]; then
  log_warn "   Uncommitted changes: ${GIT_STATUS} files"
else
  log_ok "   Working tree clean"
fi

if [ -f "feature_list_phase2.json" ]; then
  COMPLETED=$(grep -c '"passes": true' feature_list_phase2.json 2>/dev/null || echo "0")
  TOTAL=$(grep -c '"passes"' feature_list_phase2.json 2>/dev/null || echo "0")
  log_ok "   Phase 2 Progress: ${COMPLETED}/${TOTAL} features"
elif [ -f "feature_list_phase1.json" ]; then
  COMPLETED=$(grep -c '"passes": true' feature_list_phase1.json 2>/dev/null || echo "0")
  TOTAL=$(grep -c '"passes"' feature_list_phase1.json 2>/dev/null || echo "0")
  log_ok "   Phase 1 Progress: ${COMPLETED}/${TOTAL} features"
fi

echo ""

log_info "🧭 Step 6: Port Preflight"
choose_dev_port

echo ""

if [ "${AURA_INIT_NO_DEV:-0}" = "1" ]; then
  log_warn "⏭️  AURA_INIT_NO_DEV=1 set, skipping dev server startup."
  exit 0
fi

log_ok "✅ Starting Next.js development server..."
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}🎯 Aura is running at:${NC}"
echo -e "${GREEN}   ➜  Local:   http://localhost:${DEV_PORT}${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${YELLOW}💡 Test credentials: demo@aura.ai / demo123456${NC}"
echo ""
echo -e "${BLUE}📚 Next steps:${NC}"
echo -e "${BLUE}   1. Read CLAUDE_PROGRESS.md for session history${NC}"
echo -e "${BLUE}   2. Check feature_list_phase2.json for pending features${NC}"
echo -e "${BLUE}   3. Pick ONE feature to implement${NC}"
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop the server${NC}"
echo ""

PORT="${DEV_PORT}" npm run dev
