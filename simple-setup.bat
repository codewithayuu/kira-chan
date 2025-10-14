@echo off
echo Setting up AI Companion (simplified version)...

echo Installing shared package dependencies...
cd packages\shared
npm install zod typescript --save
if %errorlevel% neq 0 (
    echo Failed to install shared package
    pause
    exit /b 1
)

echo Building shared package...
npx tsc
if %errorlevel% neq 0 (
    echo Failed to build shared package
    pause
    exit /b 1
)

echo Installing web app (minimal)...
cd ..\..\apps\web
npm install next react react-dom lucide-react clsx tailwind-merge framer-motion react-hot-toast zustand axios uuid zod --save
if %errorlevel% neq 0 (
    echo Failed to install web app
    pause
    exit /b 1
)

echo Installing web dev dependencies...
npm install @types/node @types/react @types/react-dom @types/uuid typescript autoprefixer postcss tailwindcss eslint eslint-config-next --save-dev
if %errorlevel% neq 0 (
    echo Failed to install web dev dependencies
    pause
    exit /b 1
)

echo Setup complete! 
echo.
echo To start the web app: cd apps\web && npm run dev
echo.
pause
