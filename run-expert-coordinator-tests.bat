@echo off
REM Expert Coordinator Test Runner for Windows
echo.
echo ====================================
echo Expert Coordinator Tests
echo ====================================
echo.

REM Run npm test
echo Running npm test...
npm test

echo.
echo ====================================
echo To run manual QA, open index.html in browser
echo and run: runExpertCoordinatorTests()
echo ====================================
echo.

pause

