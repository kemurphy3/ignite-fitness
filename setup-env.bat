@echo off
echo Setting up Ignite Fitness environment variables...

REM Set environment variables for the current session
set DATABASE_URL=postgresql://username:password@ep-xxxxx.us-east-1.aws.neon.tech/ignitefitness?sslmode=require
set TEST_DATABASE_URL=postgresql://username:password@ep-xxxxx.us-east-1.aws.neon.tech/ignitefitness_test?sslmode=require
set JWT_SECRET=test-jwt-secret-for-development-only
set ADMIN_KEY=test-admin-key-for-development-only
set STRAVA_CLIENT_ID=168662
set STRAVA_CLIENT_SECRET=your_strava_client_secret_here
set OPENAI_API_KEY=your_openai_api_key_here
set API_BASE_URL=http://localhost:8888/.netlify/functions
set NODE_ENV=development
set DEBUG=true
set TEST_MODE=false

echo Environment variables set for current session:
echo DATABASE_URL: %DATABASE_URL%
echo TEST_DATABASE_URL: %TEST_DATABASE_URL%
echo JWT_SECRET: %JWT_SECRET%
echo ADMIN_KEY: %ADMIN_KEY%

echo.
echo To make these permanent, you can:
echo 1. Create a .env file with these values
echo 2. Set them in your system environment variables
echo 3. Run this script before each testing session

echo.
echo Now you can run: npm test
