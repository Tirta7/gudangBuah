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

:: ============================================================
:: Cari Docker untuk pastikan DB berjalan
:: ============================================================
echo [1/3] Memastikan database gudangBuah aktif...

set "DOCKER_EXE="
if exist "C:\Program Files\Docker\Docker\resources\bin\docker.exe" (
    set "DOCKER_EXE=C:\Program Files\Docker\Docker\resources\bin\docker.exe"
) else (
    for /f "delims=" %%i in ('where docker.exe 2^>nul') do set "DOCKER_EXE=%%i"
)

if "!DOCKER_EXE!"=="" (
    echo  [!] Docker tidak ditemukan. Memastikan database berjalan via koneksi langsung...
    goto SKIP_DOCKER
)

:: Pastikan Docker Engine running
"!DOCKER_EXE!" info >nul 2>&1
if errorlevel 1 (
    echo  [!] Docker Engine tidak aktif. Membuka Docker Desktop...
    start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe" 2>nul
    echo  Menunggu 30 detik...
    timeout /t 30 /nobreak >nul
    "!DOCKER_EXE!" info >nul 2>&1
    if errorlevel 1 (
        echo  [!] Docker masih tidak aktif. Pastikan buka Docker Desktop manual.
        goto SKIP_DOCKER
    )
)

:: Start container DB jika belum jalan
"!DOCKER_EXE!" start gudangbuah-db >nul 2>&1
if not errorlevel 1 (
    echo  [OK] Container database gudangBuah aktif.
) else (
    echo  [..] Container belum ada, membuat baru...
    "!DOCKER_EXE!" compose -f "%INSTALL_DIR%docker-compose-buah.yml" up -d >nul 2>&1
    echo  [OK] Database baru dibuat.
)
timeout /t 5 /nobreak >nul

:SKIP_DOCKER
echo.
echo [2/3] Membuka Backend API GudangBuah (port 3001)...
start "GudangBuah - Backend API (port 3001)" cmd /k "color 0B & title GudangBuah Backend & echo ===== BACKEND API GUDANG BUAH (port 3001) ===== & echo. & set PORT=3001 & pnpm --filter @workspace/api-server run dev"

:: Delay sedikit agar backend sempat start
timeout /t 3 /nobreak >nul

echo.
echo [3/3] Membuka Frontend GudangBuah (port 5174)...
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
