@echo off
title Auto Push to GitHub

rem Tu dong tim kiem duong dan Git neu PATH chua cap nhat
set "GIT_CMD=git"

where git >nul 2>nul
if %errorlevel% neq 0 (
    if exist "C:\Program Files\Git\cmd\git.exe" (
        set "GIT_CMD=C:\Program Files\Git\cmd\git.exe"
    ) else (
        echo =======================================================
        echo [LOI] Khong tim thay Git trong he thong.
        echo Vui long khoi dong lai may tinh hoac chay lai file bat nay.
        echo =======================================================
        echo.
        pause
        exit /b
    )
)

echo [INFO] Git executable found: "%GIT_CMD%"

if not exist ".git" (
    echo [INFO] Khoi tao Git cục bo...
    "%GIT_CMD%" init
)

echo [INFO] Cau hinh Remote URL...
"%GIT_CMD%" remote remove origin >nul 2>nul
"%GIT_CMD%" remote add origin https://github.com/CHLLogistics/Xu_ly_sao_ke.git
"%GIT_CMD%" branch -M main

echo [INFO] Cau hinh Identity tam thoi...
"%GIT_CMD%" config user.email "chllogistics@example.com"
"%GIT_CMD%" config user.name "CHL Logistics"

echo [INFO] Dang commit code...
"%GIT_CMD%" add .
"%GIT_CMD%" commit -m "feat: update categories panel and CRUD"

echo [INFO] Dang push code len GitHub...
"%GIT_CMD%" push -u origin main --force

echo =======================================================
echo          DAY CODE CONG MOI LEN GITHUB THANH CONG!
echo =======================================================
echo.
pause
