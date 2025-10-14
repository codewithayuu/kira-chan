#!/bin/bash

# Development script for AI Companion
echo "🌸 Starting Aanya development environment 🌸"
echo "============================================="

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ .env file not found. Please run setup.sh first."
    exit 1
fi

# Start database
echo "🗄️  Starting PostgreSQL database..."
docker-compose up postgres -d

# Wait for database
echo "⏳ Waiting for database..."
sleep 5

# Start LiteLLM in background
echo "🚀 Starting LiteLLM router..."
cd infra/litellm
npm install
litellm --config litellm.config.yaml --port 4000 &
LITELLM_PID=$!
cd ../..

# Start orchestrator in background
echo "🔧 Starting orchestrator API..."
cd apps/orchestrator
npm install
npm run dev &
ORCHESTRATOR_PID=$!
cd ../..

# Start web app
echo "🌐 Starting web application..."
cd apps/web
npm install
npm run dev &
WEB_PID=$!
cd ../..

echo ""
echo "🎉 Development environment started!"
echo ""
echo "🌐 Web App: http://localhost:3000"
echo "🔧 API: http://localhost:3001"
echo "⚙️  LiteLLM: http://localhost:4000"
echo ""
echo "Press Ctrl+C to stop all services"

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "🛑 Stopping services..."
    kill $LITELLM_PID 2>/dev/null
    kill $ORCHESTRATOR_PID 2>/dev/null
    kill $WEB_PID 2>/dev/null
    docker-compose down
    echo "✅ All services stopped"
    exit 0
}

# Set trap for cleanup
trap cleanup SIGINT SIGTERM

# Wait for any process to exit
wait
