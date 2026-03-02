#!/bin/bash

# Aura Docker Deployment Script
# This script helps deploy the Aura application using Docker Compose

set -e

echo "🚀 Aura Docker Deployment Script"
echo "================================"

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

# Check if .env file exists
if [ ! -f .env ]; then
    echo "📝 Creating .env file from .env.docker template..."
    cp .env.docker .env
    echo "⚠️  Please edit .env file with your configuration before continuing!"
    echo "   Update passwords and NEXTAUTH_SECRET with secure values."
    read -p "Press Enter after editing .env file..."
fi

# Change to docker directory
cd docker

echo "🏗️  Building Docker images..."
docker-compose build

echo "🚀 Starting Docker containers..."
docker-compose up -d

echo "⏳ Waiting for services to be ready..."
sleep 10

echo "🗄️  Running database migrations..."
docker-compose exec app npx prisma migrate deploy || echo "⚠️  Migration failed or already run"

echo "🌱 Seeding database..."
docker-compose exec app npx prisma db seed || echo "⚠️  Seed failed or already run"

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📊 Services status:"
docker-compose ps
echo ""
echo "🌐 Application is running at:"
echo "   http://localhost:3000"
echo ""
echo "📝 Logs:"
echo "   docker-compose logs -f"
echo ""
echo "🛑 Stop services:"
echo "   docker-compose down"
echo ""
