@echo off
REM Quick Setup Script for New Features (Windows)

echo 🚀 Setting up Rate Limiting, Security Headers ^& API Key Analytics...

REM Step 1: Generate Prisma Client with new model
echo 📦 Generating Prisma Client...
cd packages\database
call npx prisma generate

REM Step 2: Create and run database migration
echo 🗄️  Running database migration...
call npx prisma migrate dev --name add_api_key_usage_analytics

REM Step 3: Go back to root
cd ..\..

REM Step 4: Install dependencies (if needed)
echo 📚 Installing dependencies...
call npm install

REM Step 5: Build the API
echo 🔨 Building API...
cd apps\api
call npm run build

REM Step 6: Start the development server
echo 🎉 Starting development server...
call npm run dev

echo.
echo ✅ Setup complete!
echo.
echo 🔍 Test the new features:
echo   - Rate limiting: curl -I http://localhost:3001/api/v1/bands
echo   - Security headers: Check response headers for CSP, HSTS, etc.
echo   - API Analytics: GET /api/v1/admin/api-keys/{id}/analytics
echo.
echo 📊 Prometheus metrics available at: http://localhost:3001/api/metrics
echo 📖 Full documentation: docs\SECURITY_RATE_LIMITING_IMPLEMENTATION.md
pause
