# Ignite Fitness Environment Setup Script
# Run this script to set up environment variables for testing

Write-Host "Setting up Ignite Fitness environment variables..." -ForegroundColor Green

# Set environment variables for the current session
$env:DATABASE_URL = "postgresql://username:password@ep-xxxxx.us-east-1.aws.neon.tech/ignitefitness?sslmode=require"
$env:TEST_DATABASE_URL = "postgresql://username:password@ep-xxxxx.us-east-1.aws.neon.tech/ignitefitness_test?sslmode=require"
$env:JWT_SECRET = "test-jwt-secret-for-development-only"
$env:ADMIN_KEY = "test-admin-key-for-development-only"
$env:STRAVA_CLIENT_ID = "168662"
$env:STRAVA_CLIENT_SECRET = "your_strava_client_secret_here"
$env:OPENAI_API_KEY = "your_openai_api_key_here"
$env:API_BASE_URL = "http://localhost:8888/.netlify/functions"
$env:NODE_ENV = "development"
$env:DEBUG = "true"
$env:TEST_MODE = "false"

Write-Host "Environment variables set for current session:" -ForegroundColor Yellow
Write-Host "DATABASE_URL: $env:DATABASE_URL" -ForegroundColor Cyan
Write-Host "TEST_DATABASE_URL: $env:TEST_DATABASE_URL" -ForegroundColor Cyan
Write-Host "JWT_SECRET: $env:JWT_SECRET" -ForegroundColor Cyan
Write-Host "ADMIN_KEY: $env:ADMIN_KEY" -ForegroundColor Cyan

Write-Host "`nTo make these permanent, you can:" -ForegroundColor Yellow
Write-Host "1. Create a .env file with these values" -ForegroundColor White
Write-Host "2. Set them in your system environment variables" -ForegroundColor White
Write-Host "3. Run this script before each testing session" -ForegroundColor White

Write-Host "`nNow you can run: npm test" -ForegroundColor Green
