@echo off
echo Setting up AI Companion locally...

echo Installing shared package...
cd packages\shared
npm install
if %errorlevel% neq 0 (
    echo Failed to install shared package
    pause
    exit /b 1
)

echo Installing web app...
cd ..\..\apps\web
npm install
if %errorlevel% neq 0 (
    echo Failed to install web app
    pause
    exit /b 1
)

echo Installing orchestrator...
cd ..\orchestrator
npm install
if %errorlevel% neq 0 (
    echo Failed to install orchestrator
    pause
    exit /b 1
)

echo Building shared package...
cd ..\..\packages\shared
npm run build
if %errorlevel% neq 0 (
    echo Failed to build shared package
    pause
    exit /b 1
)

echo Setup complete! 
echo.
echo To start the web app: cd apps\web && npm run dev
echo To start the orchestrator: cd apps\orchestrator && npm run dev
echo.
pause
