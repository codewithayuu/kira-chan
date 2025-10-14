@echo off
echo 🌸 Setting up Aanya - Your AI Companion 🌸
echo ==========================================

REM Check if Docker is installed
docker --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Docker is not installed. Please install Docker first.
    pause
    exit /b 1
)

REM Check if Docker Compose is installed
docker-compose --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Docker Compose is not installed. Please install Docker Compose first.
    pause
    exit /b 1
)

REM Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js is not installed. Please install Node.js 18+ first.
    pause
    exit /b 1
)

echo ✅ Prerequisites check passed!

REM Create .env file if it doesn't exist
if not exist .env (
    echo 📝 Creating .env file from template...
    copy env.example .env
    echo ⚠️  Please edit .env file with your API keys before continuing.
    echo    Required keys: OPENAI_API_KEY, ELEVENLABS_API_KEY, DEEPGRAM_API_KEY
    pause
)

REM Install dependencies
echo 📦 Installing dependencies...
call npm install

REM Build shared package
echo 🔨 Building shared package...
cd packages\shared
call npm run build
cd ..\..

REM Start database
echo 🗄️  Starting PostgreSQL database...
docker-compose up postgres -d

REM Wait for database to be ready
echo ⏳ Waiting for database to be ready...
timeout /t 10 /nobreak >nul

REM Run database migrations
echo 🔄 Running database migrations...
cd apps\orchestrator
call npm run db:push
cd ..\..

REM Seed database
echo 🌱 Seeding database with sample data...
cd apps\orchestrator
call npm run db:seed
cd ..\..

REM Start all services
echo 🚀 Starting all services...
docker-compose up -d

REM Wait for services to be ready
echo ⏳ Waiting for services to start...
timeout /t 15 /nobreak >nul

REM Check service health
echo 🔍 Checking service health...

REM Check web app
curl -f http://localhost:3000 >nul 2>&1
if %errorlevel% equ 0 (
    echo ✅ Web app is running at http://localhost:3000
) else (
    echo ❌ Web app is not responding
)

REM Check orchestrator
curl -f http://localhost:3001/health >nul 2>&1
if %errorlevel% equ 0 (
    echo ✅ Orchestrator API is running at http://localhost:3001
) else (
    echo ❌ Orchestrator API is not responding
)

REM Check LiteLLM
curl -f http://localhost:4000/health >nul 2>&1
if %errorlevel% equ 0 (
    echo ✅ LiteLLM router is running at http://localhost:4000
) else (
    echo ❌ LiteLLM router is not responding
)

echo.
echo 🎉 Setup complete!
echo.
echo 🌐 Access your AI companion at: http://localhost:3000
echo 🔧 API documentation: http://localhost:3001/health
echo ⚙️  LiteLLM admin: http://localhost:4000
echo.
echo 📚 For more information, see README.md
echo.
echo 🌸 Welcome to Aanya! 🌸
pause
