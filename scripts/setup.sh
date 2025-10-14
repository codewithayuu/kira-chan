#!/bin/bash

# AI Companion Setup Script
echo "🌸 Setting up Aanya - Your AI Companion 🌸"
echo "=========================================="

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

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version 18+ is required. Current version: $(node -v)"
    exit 1
fi

echo "✅ Prerequisites check passed!"

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env file from template..."
    cp env.example .env
    echo "⚠️  Please edit .env file with your API keys before continuing."
    echo "   Required keys: OPENAI_API_KEY, ELEVENLABS_API_KEY, DEEPGRAM_API_KEY"
    read -p "Press Enter to continue after editing .env file..."
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Build shared package
echo "🔨 Building shared package..."
cd packages/shared
npm run build
cd ../..

# Start database
echo "🗄️  Starting PostgreSQL database..."
docker-compose up postgres -d

# Wait for database to be ready
echo "⏳ Waiting for database to be ready..."
sleep 10

# Run database migrations
echo "🔄 Running database migrations..."
cd apps/orchestrator
npm run db:push
cd ../..

# Seed database
echo "🌱 Seeding database with sample data..."
cd apps/orchestrator
npm run db:seed
cd ../..

# Start all services
echo "🚀 Starting all services..."
docker-compose up -d

# Wait for services to be ready
echo "⏳ Waiting for services to start..."
sleep 15

# Check service health
echo "🔍 Checking service health..."

# Check web app
if curl -f http://localhost:3000 > /dev/null 2>&1; then
    echo "✅ Web app is running at http://localhost:3000"
else
    echo "❌ Web app is not responding"
fi

# Check orchestrator
if curl -f http://localhost:3001/health > /dev/null 2>&1; then
    echo "✅ Orchestrator API is running at http://localhost:3001"
else
    echo "❌ Orchestrator API is not responding"
fi

# Check LiteLLM
if curl -f http://localhost:4000/health > /dev/null 2>&1; then
    echo "✅ LiteLLM router is running at http://localhost:4000"
else
    echo "❌ LiteLLM router is not responding"
fi

echo ""
echo "🎉 Setup complete!"
echo ""
echo "🌐 Access your AI companion at: http://localhost:3000"
echo "🔧 API documentation: http://localhost:3001/health"
echo "⚙️  LiteLLM admin: http://localhost:4000"
echo ""
echo "📚 For more information, see README.md"
echo ""
echo "🌸 Welcome to Aanya! 🌸"
