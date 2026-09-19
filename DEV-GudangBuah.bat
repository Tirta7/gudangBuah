@echo off
title GudangBuah - Development Mode
color 0E
setlocal enabledelayedexpansion
cls

echo.
echo  ============================================================
echo    GUDANG BUAH - MODE DEVELOPMENT (Preview Tampilan)
echo  ============================================================
echo.
echo  Mode ini digunakan untuk MELIHAT TAMPILAN dan EDIT KODING.
echo  Perubahan kode frontend otomatis update di browser!
echo.
echo  PORT yang digunakan (BERBEDA dari app gudang kain):
echo    Backend API  : http://localhost:3001
echo    Frontend     : http://localhost:5174
echo.
echo  App gudang kain Anda TIDAK akan terganggu.
echo  ============================================================
echo.

set "INSTALL_DIR=%~dp0"
cd /d "%INSTALL_DIR%"

set DATABASE_URL=postgresql://postgres:vocpos2026@127.0.0.1:4538/gudangbuah

echo [1/2] Membuka Backend API GudangBuah (port 3001)...
start "GudangBuah - Backend API (port 3001)" cmd /k "color 0B & title GudangBuah Backend & echo ===== BACKEND API GUDANG BUAH (port 3001) ===== & echo. & set PORT=3001 & pnpm --filter @workspace/api-server run dev"

:: Delay sedikit agar backend sempat start
timeout /t 3 /nobreak >nul

echo.
echo [2/2] Membuka Frontend GudangBuah (port 5174)...
start "GudangBuah - Frontend Vite (port 5174)" cmd /k "color 0A & title GudangBuah Frontend & echo ===== FRONTEND GUDANG BUAH (port 5174) ===== & echo. & set PORT=5174 & pnpm --filter @workspace/tmcpos run dev"

:: Tunggu server siap lalu buka browser
timeout /t 8 /nobreak >nul

cls
echo.
echo  ============================================================
echo    GUDANG BUAH - DEV MODE AKTIF!
echo  ============================================================
echo.
echo  Buka di browser:
echo    http://localhost:5174
echo.
echo  Login:
echo    Username : admin
echo    Password : admin123
echo.
echo  Perubahan kode otomatis update di browser (Hot Reload).
echo.
echo  Untuk berhenti: tutup 2 jendela hitam yang terbuka.
echo  ============================================================
echo.

start http://localhost:5174

pause
endlocal
