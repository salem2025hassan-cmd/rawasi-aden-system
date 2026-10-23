@echo off
setlocal enableextensions
title Push to GitHub - Rawasi Aden System
color 0A

echo =====================================================================
echo           RAWASI ADEN SYSTEM - PUSH TO GITHUB
echo              رفع مشروع رواسي عدن إلى GitHub
echo =====================================================================
echo.

set "PATH=%LOCALAPPDATA%\Programs\Git\cmd;%PATH%"

echo [*] Checking Git...
git --version
if errorlevel 1 (
    echo [ERROR] Git is not installed or not in PATH!
    pause
    exit /b 1
)

echo [*] Pushing main branch to GitHub...
echo [INFO] A browser window may open to ask you to authorize GitHub login.
echo.

git push -u origin main

if errorlevel 1 (
    echo.
    echo [ERROR] Push failed. If authentication failed, please ensure you are logged into GitHub.
) else (
    echo.
    echo [SUCCESS] =======================================================
    echo [SUCCESS] Project uploaded successfully to GitHub!
    echo [SUCCESS] تم رفع المشروع بالكامل إلى GitHub بنجاح!
    echo [SUCCESS] =======================================================
)

echo.
pause
