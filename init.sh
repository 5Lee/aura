#!/bin/bash

# Aura Development Server Startup Script
# Based on Anthropic's "Effective Harnesses for Long-Running Agents" best practices
# This script ensures a consistent development environment for each agent session

set -e  # Exit on error

echo "🚀 Starting Aura Development Environment..."
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ============================================
# STEP 1: Environment Check
# ============================================
echo -e "${BLUE}📋 Step 1: Environment Check${NC}"

# Check Node.js version
NODE_VERSION=$(node -v 2>/dev/null || echo "not installed")
if [ "$NODE_VERSION" = "not installed" ]; then
    echo -e "${RED}❌ Node.js is not installed!${NC}"
    exit 1
fi
echo -e "${GREEN}   ✓ Node.js: $NODE_VERSION${NC}"

# Check npm version
NPM_VERSION=$(npm -v 2>/dev/null || echo "not installed")
echo -e "${GREEN}   ✓ npm: $NPM_VERSION${NC}"

# Check MySQL status (macOS with Homebrew)
if command -v brew &> /dev/null; then
    MYSQL_RUNNING=$(brew services list | grep mysql | grep started || true)
    if [ -z "$MYSQL_RUNNING" ]; then
        echo -e "${YELLOW}   ⚠ MySQL is not running. Starting...${NC}"
        brew services start mysql
        sleep 3
    fi
    echo -e "${GREEN}   ✓ MySQL: running${NC}"
fi

echo ""

# ============================================
# STEP 2: Dependencies Check
# ============================================
echo -e "${BLUE}📦 Step 2: Dependencies Check${NC}"

# Check if .env exists
if [ ! -f .env ]; then
    echo -e "${RED}❌ .env file not found!${NC}"
    echo "Creating .env from .env.example..."
    cp .env.example .env
    echo -e "${YELLOW}⚠️  Please edit .env with your database credentials${NC}"
    echo ""
fi

# Check if node_modules exists
if [ ! -d node_modules ]; then
    echo -e "${YELLOW}   Installing dependencies...${NC}"
    npm install
else
    echo -e "${GREEN}   ✓ node_modules exists${NC}"
fi

# Check if Prisma client is generated
if [ ! -d node_modules/.prisma ]; then
    echo -e "${YELLOW}   Generating Prisma client...${NC}"
    npx prisma generate
else
    echo -e "${GREEN}   ✓ Prisma client generated${NC}"
fi

echo ""

# ============================================
# STEP 3: Database Check
# ============================================
echo -e "${BLUE}🗄️  Step 3: Database Check${NC}"

# Check if database exists and run migrations if needed
if npx prisma migrate status > /dev/null 2>&1; then
    echo -e "${GREEN}   ✓ Database migrations applied${NC}"
else
    echo -e "${YELLOW}   Running database migrations...${NC}"
    npx prisma migrate dev
fi

# Seed database if needed (check if any prompts exist)
SEED_CHECK=$(npx prisma db execute --stdin <<EOF
SELECT COUNT(*) as count FROM Prompt;
EOF
2>/dev/null || echo "0")

if [[ "$SEED_CHECK" == *"0"* ]] || [[ "$SEED_CHECK" == "" ]]; then
    echo -e "${YELLOW}   Seeding database with initial data...${NC}"
    npx prisma db seed 2>/dev/null || echo -e "${YELLOW}   Seed skipped (may already have data)${NC}"
else
    echo -e "${GREEN}   ✓ Database has data${NC}"
fi

echo ""

# ============================================
# STEP 4: Code Quality Check
# ============================================
echo -e "${BLUE}🔍 Step 4: Code Quality Check${NC}"

# Check for TypeScript errors
echo -e "${YELLOW}   Checking TypeScript...${NC}"
if npx tsc --noEmit 2>/dev/null; then
    echo -e "${GREEN}   ✓ No TypeScript errors${NC}"
else
    echo -e "${YELLOW}   ⚠ TypeScript errors found (will still start server)${NC}"
fi

# Check for lint errors if configured
if [ -f ".eslintrc.json" ] || [ -f ".eslintrc.js" ]; then
    echo -e "${YELLOW}   Checking lint...${NC}"
    if npm run lint > /dev/null 2>&1; then
        echo -e "${GREEN}   ✓ No lint errors${NC}"
    else
        echo -e "${YELLOW}   ⚠ Lint errors found (will still start server)${NC}"
    fi
fi

echo ""

# ============================================
# STEP 5: Session Info
# ============================================
echo -e "${BLUE}📊 Step 5: Session Info${NC}"

# Show git status
GIT_BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
GIT_STATUS=$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')
echo -e "${GREEN}   Branch: $GIT_BRANCH${NC}"
if [ "$GIT_STATUS" -gt 0 ]; then
    echo -e "${YELLOW}   Uncommitted changes: $GIT_STATUS files${NC}"
else
    echo -e "${GREEN}   Working tree clean${NC}"
fi

# Show feature progress
if [ -f "feature_list_phase1.json" ]; then
    COMPLETED=$(grep -c '"passes": true' feature_list_phase1.json 2>/dev/null || echo "0")
    TOTAL=$(grep -c '"passes"' feature_list_phase1.json 2>/dev/null || echo "0")
    echo -e "${GREEN}   Phase 1 Progress: $COMPLETED/$TOTAL features${NC}"
fi

echo ""

# ============================================
# STEP 6: Start Development Server
# ============================================
echo -e "${GREEN}✅ Starting Next.js development server...${NC}"
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}🎯 Aura is running at:${NC}"
echo -e "${GREEN}   ➜  Local:   http://localhost:3000${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${YELLOW}💡 Test credentials: demo@aura.ai / demo123456${NC}"
echo ""
echo -e "${BLUE}📚 Next steps:${NC}"
echo -e "${BLUE}   1. Read CLAUDE_PROGRESS.md for session history${NC}"
echo -e "${BLUE}   2. Check feature_list_phase1.json for pending features${NC}"
echo -e "${BLUE}   3. Pick ONE feature to implement${NC}"
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop the server${NC}"
echo ""

# Run the dev server
npm run dev