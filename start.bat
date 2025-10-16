@echo off
REM Kira Chan AI Companion - Unified Startup Script for Windows
REM Starts both backend and frontend servers

setlocal enabledelayedexpansion

echo 🤖 Starting Kira Chan AI Companion...
echo ==================================

REM Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed. Please install Node.js 18+ and try again.
    pause
    exit /b 1
)

REM Check Node.js version
for /f "tokens=1" %%i in ('node --version') do set NODE_VERSION=%%i
echo [SUCCESS] Node.js %NODE_VERSION% detected

REM Check if npm is installed
npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] npm is not installed. Please install npm and try again.
    pause
    exit /b 1
)

for /f "tokens=1" %%i in ('npm --version') do set NPM_VERSION=%%i
echo [SUCCESS] npm %NPM_VERSION% detected

REM Check if .env file exists
if not exist ".env" (
    echo [WARNING] .env file not found. Creating from template...
    if exist "env.example" (
        copy env.example .env >nul
        echo [SUCCESS] Created .env file from template
        echo [WARNING] Please edit .env file with your API keys before continuing
        echo [WARNING] At minimum, you need GROQ_API_KEY
        pause
    ) else (
        echo [ERROR] env.example file not found. Please create .env file manually.
        pause
        exit /b 1
    )
)

REM Check if dependencies are installed
echo [INFO] Checking dependencies...

if not exist "minimal-backend\node_modules" (
    echo [INFO] Installing backend dependencies...
    cd minimal-backend
    call npm install
    if %errorlevel% neq 0 (
        echo [ERROR] Failed to install backend dependencies
        pause
        exit /b 1
    )
    cd ..
    echo [SUCCESS] Backend dependencies installed
) else (
    echo [SUCCESS] Backend dependencies already installed
)

if not exist "minimal-web\node_modules" (
    echo [INFO] Installing frontend dependencies...
    cd minimal-web
    call npm install
    if %errorlevel% neq 0 (
        echo [ERROR] Failed to install frontend dependencies
        pause
        exit /b 1
    )
    cd ..
    echo [SUCCESS] Frontend dependencies installed
) else (
    echo [SUCCESS] Frontend dependencies already installed
)

REM Start backend server
echo [INFO] Starting backend server...
cd minimal-backend

REM Check which server to start (prefer optimized)
if exist "server-optimized.js" (
    echo [INFO] Starting optimized server (recommended)
    start "Kira Chan Backend" cmd /k "npm run start:optimized"
) else if exist "server-advanced.js" (
    echo [INFO] Starting advanced server
    start "Kira Chan Backend" cmd /k "npm run start:advanced"
) else if exist "server-flagship.js" (
    echo [INFO] Starting flagship server
    start "Kira Chan Backend" cmd /k "npm run start:flagship"
) else (
    echo [INFO] Starting basic server
    start "Kira Chan Backend" cmd /k "npm start"
)

cd ..

REM Wait a moment for backend to start
timeout /t 3 /nobreak >nul

REM Start frontend server
echo [INFO] Starting frontend server...
cd minimal-web
start "Kira Chan Frontend" cmd /k "npm run dev"
cd ..

REM Wait a moment for frontend to start
timeout /t 5 /nobreak >nul

REM Check server status
echo [INFO] Checking server status...

REM Check backend
curl -s http://localhost:3001/api/health >nul 2>&1
if %errorlevel% equ 0 (
    echo [SUCCESS] Backend is running on http://localhost:3001
) else (
    echo [WARNING] Backend may not be ready yet. Check the backend window for details.
)

REM Check frontend
curl -s http://localhost:3002 >nul 2>&1
if %errorlevel% equ 0 (
    echo [SUCCESS] Frontend is running on http://localhost:3002
) else (
    echo [WARNING] Frontend may not be ready yet. Check the frontend window for details.
)

echo.
echo 🎉 Kira Chan AI Companion is starting up!
echo ==================================
echo ✅ Backend: http://localhost:3001
echo ✅ Frontend: http://localhost:3002
echo ✅ Advanced: http://localhost:3002/advanced
echo.
echo 📊 Monitor: Check the Quality Dashboard in the frontend
echo 🔧 Health: http://localhost:3001/api/health
echo 📈 Metrics: http://localhost:3001/api/metrics
echo.
echo Press any key to open the application in your browser...
pause >nul

REM Open browser
start http://localhost:3002

echo.
echo [INFO] Servers are running in separate windows.
echo [INFO] Close those windows to stop the servers.
echo [INFO] Press any key to exit this script...
pause >nul
