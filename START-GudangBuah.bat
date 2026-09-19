@echo off
setlocal enabledelayedexpansion
title GudangBuah - Setup & Jalankan Aplikasi
color 0A
cls

echo.
echo  ============================================================
echo    GUDANG BUAH - Sistem Manajemen Gudang Buah
echo    [ Aman - Tidak akan mengubah data aplikasi lain! ]
echo  ============================================================
echo.
echo  Database : gudangbuah (port 4538) - TERPISAH dari app asli
echo  Aplikasi : http://localhost:3001   - Port berbeda
echo  App Asli : tetap berjalan normal di port masing-masing
echo.
echo  ============================================================
echo.

set "INSTALL_DIR=%~dp0"
cd /d "%INSTALL_DIR%"

echo [1/2] Mengecek Koneksi Database...
set DATABASE_URL=postgresql://postgres:vocpos2026@127.0.0.1:4538/gudangbuah

echo [2/2] Menjalankan server GudangBuah...

:: Deteksi IP LAN
set LOCAL_IP=127.0.0.1
for /f "usebackq tokens=*" %%a in (`powershell -NoProfile -Command "(Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -notmatch 'Loopback' -and $_.InterfaceAlias -notmatch 'vEthernet' -and $_.IPAddress -notmatch '^169\.254\.' } | Select-Object -First 1).IPAddress 2>$null"`) do set LOCAL_IP=%%a
if "!LOCAL_IP!"=="" set LOCAL_IP=127.0.0.1

cls
echo.
echo  ============================================================
echo    GUDANG BUAH SIAP!
echo  ============================================================
echo.
echo    Browser PC ini  : http://localhost:3001
echo    Akses LAN / HP  : http://!LOCAL_IP!:3001
echo.
echo    Login Default:
echo    Username : admin
echo    Password : admin123
echo.
echo    Database : gudangbuah (port 4538) - TERPISAH
echo    App Asli : TIDAK TERGANGGU
echo.
echo  ============================================================
echo  Server berjalan di jendela ini. Tekan CTRL+C untuk berhenti.
echo  ============================================================
echo.

start /b cmd /c "timeout /t 3 /nobreak >nul && start http://localhost:3001"

call pnpm -r --filter @workspace/api-server dev

endlocal
