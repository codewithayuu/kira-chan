#!/bin/bash

# Kira Chan AI Companion - Unified Startup Script
# Starts both backend and frontend servers

set -e  # Exit on any error

echo "🤖 Starting Kira Chan AI Companion..."
echo "=================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed. Please install Node.js 18+ and try again."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    print_error "Node.js version 18+ is required. Current version: $(node -v)"
    exit 1
fi

print_success "Node.js $(node -v) detected"

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    print_error "npm is not installed. Please install npm and try again."
    exit 1
fi

print_success "npm $(npm -v) detected"

# Check if .env file exists
if [ ! -f ".env" ]; then
    print_warning ".env file not found. Creating from template..."
    if [ -f "env.example" ]; then
        cp env.example .env
        print_success "Created .env file from template"
        print_warning "Please edit .env file with your API keys before continuing"
        print_warning "At minimum, you need GROQ_API_KEY"
        read -p "Press Enter to continue after editing .env file..."
    else
        print_error "env.example file not found. Please create .env file manually."
        exit 1
    fi
fi

# Check if dependencies are installed
print_status "Checking dependencies..."

if [ ! -d "minimal-backend/node_modules" ]; then
    print_status "Installing backend dependencies..."
    cd minimal-backend
    npm install
    cd ..
    print_success "Backend dependencies installed"
else
    print_success "Backend dependencies already installed"
fi

if [ ! -d "minimal-web/node_modules" ]; then
    print_status "Installing frontend dependencies..."
    cd minimal-web
    npm install
    cd ..
    print_success "Frontend dependencies installed"
else
    print_success "Frontend dependencies already installed"
fi

# Function to start backend
start_backend() {
    print_status "Starting backend server..."
    cd minimal-backend
    
    # Check which server to start (prefer optimized)
    if [ -f "server-optimized.js" ]; then
        print_status "Starting optimized server (recommended)"
        npm run start:optimized &
    elif [ -f "server-advanced.js" ]; then
        print_status "Starting advanced server"
        npm run start:advanced &
    elif [ -f "server-flagship.js" ]; then
        print_status "Starting flagship server"
        npm run start:flagship &
    else
        print_status "Starting basic server"
        npm start &
    fi
    
    BACKEND_PID=$!
    cd ..
    print_success "Backend started with PID: $BACKEND_PID"
}

# Function to start frontend
start_frontend() {
    print_status "Starting frontend server..."
    cd minimal-web
    npm run dev &
    FRONTEND_PID=$!
    cd ..
    print_success "Frontend started with PID: $FRONTEND_PID"
}

# Function to check if servers are running
check_servers() {
    print_status "Checking server status..."
    
    # Wait a moment for servers to start
    sleep 3
    
    # Check backend
    if curl -s http://localhost:3001/api/health > /dev/null 2>&1; then
        print_success "Backend is running on http://localhost:3001"
    else
        print_warning "Backend may not be ready yet. Check logs for details."
    fi
    
    # Check frontend
    if curl -s http://localhost:3002 > /dev/null 2>&1; then
        print_success "Frontend is running on http://localhost:3002"
    else
        print_warning "Frontend may not be ready yet. Check logs for details."
    fi
}

# Function to cleanup on exit
cleanup() {
    print_status "Shutting down servers..."
    if [ ! -z "$BACKEND_PID" ]; then
        kill $BACKEND_PID 2>/dev/null || true
        print_success "Backend stopped"
    fi
    if [ ! -z "$FRONTEND_PID" ]; then
        kill $FRONTEND_PID 2>/dev/null || true
        print_success "Frontend stopped"
    fi
    print_success "Cleanup complete"
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

# Start servers
start_backend
start_frontend

# Check server status
check_servers

echo ""
echo "🎉 Kira Chan AI Companion is starting up!"
echo "=================================="
echo -e "${GREEN}✅ Backend:${NC} http://localhost:3001"
echo -e "${GREEN}✅ Frontend:${NC} http://localhost:3002"
echo -e "${GREEN}✅ Advanced:${NC} http://localhost:3002/advanced"
echo ""
echo -e "${CYAN}📊 Monitor:${NC} Check the Quality Dashboard in the frontend"
echo -e "${CYAN}🔧 Health:${NC} http://localhost:3001/api/health"
echo -e "${CYAN}📈 Metrics:${NC} http://localhost:3001/api/metrics"
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop all servers${NC}"
echo ""

# Wait for user interrupt
wait
