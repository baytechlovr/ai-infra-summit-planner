@echo off
set PATH=C:\Users\anura\.gemini\antigravity\scratch\tools\git\cmd;C:\Program Files\GitHub CLI;%PATH%
echo ===================================================
echo AI Infra Summit Planner - Pushing to GitHub
echo Repository: https://github.com/baytechlovr/ai-infra-summit-planner
echo ===================================================

echo.
echo [1/3] Setting remote origin...
git remote remove origin 2>nul
git remote add origin https://github.com/baytechlovr/ai-infra-summit-planner.git
git branch -M main

echo.
echo [2/3] Checking authentication...
gh auth status >nul 2>&1
if errorlevel 1 (
    echo.
    echo Please log into GitHub (select GitHub.com -^> HTTPS -^> Login with a web browser):
    echo.
    gh auth login
)

echo.
echo [3/3] Pushing to main branch...
git push -u origin main

if errorlevel 1 (
    echo.
    echo Git push failed. If needed, you can also push using GitHub CLI:
    gh auth setup-git
    git push -u origin main
)

echo.
echo ===================================================
echo SUCCESS! Your code is now live on GitHub:
echo https://github.com/baytechlovr/ai-infra-summit-planner
echo ===================================================
echo.
echo Next step: Enable GitHub Pages!
echo 1. Go to: https://github.com/baytechlovr/ai-infra-summit-planner/settings/pages
echo 2. Under 'Branch', select 'main' and click 'Save'.
echo.
pause
