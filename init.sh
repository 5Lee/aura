#!/bin/bash

# Aura Development Server Startup Script
# This script starts all necessary services for local development

set -e  # Exit on error

echo "🚀 Starting Aura Development Environment..."
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

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
    echo -e "${YELLOW}📦 Installing dependencies...${NC}"
    npm install
    echo ""
fi

# Check if Prisma client is generated
if [ ! -d node_modules/.prisma ]; then
    echo -e "${YELLOW}🔧 Generating Prisma client...${NC}"
    npx prisma generate
    echo ""
fi

# Check if database exists and run migrations if needed
echo -e "${YELLOW}🗄️  Checking database status...${NC}"
if npx prisma migrate status > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Database migrations applied${NC}"
else
    echo -e "${YELLOW}⚠️  Running database migrations...${NC}"
    npx prisma migrate dev
    echo ""
fi

# Seed database if needed (check if any prompts exist)
PROMPT_COUNT=$(npx prisma db execute --stdin <<EOF
SELECT COUNT(*) as count FROM Prompt;
EOF
2>/dev/null || echo "0")

if [ "$PROMPT_COUNT" -eq "0" ]; then
    echo -e "${YELLOW}🌱 Seeding database with initial data...${NC}"
    npx prisma db seed
    echo ""
fi

# Start development server
echo -e "${GREEN}✅ Starting Next.js development server...${NC}"
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}🎯 Aura is running at:${NC}"
echo -e "${GREEN}   ➜  Local:   http://localhost:3000${NC}"
echo -e "${GREEN}   ➜  Network: http://$(hostname -I | awk '{print $1}'):3000${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${YELLOW}💡 Test credentials: demo@aura.ai / demo123456${NC}"
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop the server${NC}"
echo ""

# Run the dev server
npm run dev
