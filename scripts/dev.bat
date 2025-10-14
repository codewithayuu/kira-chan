@echo off
echo 🌸 Starting Aanya development environment 🌸
echo =============================================

REM Check if .env exists
if not exist .env (
    echo ❌ .env file not found. Please run setup.bat first.
    pause
    exit /b 1
)

REM Start database
echo 🗄️  Starting PostgreSQL database...
docker-compose up postgres -d

REM Wait for database
echo ⏳ Waiting for database...
timeout /t 5 /nobreak >nul

REM Start LiteLLM in background
echo 🚀 Starting LiteLLM router...
cd infra\litellm
call npm install
start /b litellm --config litellm.config.yaml --port 4000
cd ..\..

REM Start orchestrator in background
echo 🔧 Starting orchestrator API...
cd apps\orchestrator
call npm install
start /b npm run dev
cd ..\..

REM Start web app
echo 🌐 Starting web application...
cd apps\web
call npm install
start /b npm run dev
cd ..\..

echo.
echo 🎉 Development environment started!
echo.
echo 🌐 Web App: http://localhost:3000
echo 🔧 API: http://localhost:3001
echo ⚙️  LiteLLM: http://localhost:4000
echo.
echo Press any key to stop all services

pause

echo.
echo 🛑 Stopping services...
docker-compose down
echo ✅ All services stopped
