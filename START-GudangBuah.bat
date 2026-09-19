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
echo  Database : gudangBuah (port 5433) - TERPISAH dari app asli
echo  Aplikasi : http://localhost:3001   - Port berbeda
echo  App Asli : tetap berjalan normal di port masing-masing
echo.
echo  ============================================================
echo.

set "INSTALL_DIR=%~dp0"
cd /d "%INSTALL_DIR%"

:: ============================================================
:: Cek Docker
:: ============================================================
echo [1/5] Mengecek Docker Desktop...

:: Cari docker di beberapa lokasi umum
set "DOCKER_EXE="
if exist "C:\Program Files\Docker\Docker\resources\bin\docker.exe" (
    set "DOCKER_EXE=C:\Program Files\Docker\Docker\resources\bin\docker.exe"
) else (
    for /f "delims=" %%i in ('where docker.exe 2^>nul') do set "DOCKER_EXE=%%i"
)

if "!DOCKER_EXE!"=="" (
    echo  [ERROR] Docker Desktop tidak ditemukan!
    echo.
    echo  Silahkan:
    echo  1. Install Docker Desktop dari https://www.docker.com/products/docker-desktop/
    echo  2. Restart komputer setelah instalasi
    echo  3. Pastikan Docker Desktop sudah berjalan (ikon di system tray)
    echo  4. Jalankan START-GudangBuah.bat kembali
    echo.
    pause
    exit /b 1
)
echo  [OK] Docker ditemukan: !DOCKER_EXE!

:: Set PATH agar docker bisa ditemukan
for %%i in ("!DOCKER_EXE!") do set "DOCKER_DIR=%%~dpi"
set "PATH=!DOCKER_DIR!;!PATH!"

:: Pastikan Docker Engine berjalan
echo  [..] Mengecek Docker Engine...
"!DOCKER_EXE!" info >nul 2>&1
if errorlevel 1 (
    echo  [!] Docker Engine belum aktif. Membuka Docker Desktop...
    start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe" 2>nul
    echo  Menunggu Docker Engine siap (maks 90 detik)...
    set "DOCKER_WAIT=0"
    :WAIT_DOCKER
    timeout /t 10 /nobreak >nul
    set /a "DOCKER_WAIT+=10"
    "!DOCKER_EXE!" info >nul 2>&1
    if not errorlevel 1 goto DOCKER_RUNNING
    echo  [..] Menunggu Docker... (!DOCKER_WAIT! detik)
    if !DOCKER_WAIT! LSS 90 goto WAIT_DOCKER
    echo.
    echo  [ERROR] Docker Engine tidak bisa berjalan.
    echo  Buka Docker Desktop dari Start Menu, tunggu ikon hijau di system tray,
    echo  lalu jalankan START-GudangBuah.bat kembali.
    pause
    exit /b 1
)
:DOCKER_RUNNING
echo  [OK] Docker Engine aktif.

:: ============================================================
:: Jalankan / Restart container database gudangBuah
:: ============================================================
echo.
echo [2/5] Mempersiapkan database gudangBuah (port 5433)...

:: Cek apakah container sudah ada
"!DOCKER_EXE!" inspect gudangbuah-db >nul 2>&1
if not errorlevel 1 (
    echo  [OK] Container database sudah ada, memastikan aktif...
    "!DOCKER_EXE!" start gudangbuah-db >nul 2>&1
) else (
    echo  [..] Membuat container database baru...
    "!DOCKER_EXE!" compose -f "%INSTALL_DIR%docker-compose-buah.yml" up -d
    if errorlevel 1 (
        echo  [ERROR] Gagal membuat container database!
        pause
        exit /b 1
    )
)
echo  [OK] Database gudangBuah aktif di port 5433.
echo  [!] Data app asli (port 5432) TIDAK terpengaruh.

:: Tunggu DB siap
echo.
echo [3/5] Menunggu database siap...
set "DB_WAIT=0"
:WAIT_DB
timeout /t 5 /nobreak >nul
set /a "DB_WAIT+=5"
"!DOCKER_EXE!" exec gudangbuah-db pg_isready -U postgres -d gudangBuah >nul 2>&1
if not errorlevel 1 goto DB_READY
echo  [..] Database menyala... (!DB_WAIT! detik)
if !DB_WAIT! LSS 60 goto WAIT_DB
echo  [!] Lanjut tanpa menunggu...
:DB_READY
echo  [OK] Database siap!

:: ============================================================
:: Push Schema Database
:: ============================================================
echo.
echo [4/5] Sinkronisasi skema database...
echo  (Membuat tabel-tabel gudang buah secara otomatis)
set CI=true
call pnpm --filter @workspace/db run push-force 2>&1
if errorlevel 1 (
    echo.
    echo  [!] Push skema gagal. Mencoba lagi sekali...
    timeout /t 5 /nobreak >nul
    call pnpm --filter @workspace/db run push-force 2>&1
    if errorlevel 1 (
        echo  [ERROR] Gagal inisialisasi database. Periksa koneksi.
        pause
        exit /b 1
    )
)
echo  [OK] Skema database siap!

:: ============================================================
:: Jalankan Server Dev
:: ============================================================
echo.
echo [5/5] Menjalankan server GudangBuah...

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
echo    Database : gudangBuah (port 5433) - TERPISAH
echo    App Asli : TIDAK TERGANGGU
echo.
echo  ============================================================
echo  Server berjalan di jendela ini. Tekan CTRL+C untuk berhenti.
echo  ============================================================
echo.

:: Buka browser otomatis setelah 3 detik
start /b cmd /c "timeout /t 3 /nobreak >nul && start http://localhost:3001"

call pnpm -r --filter @workspace/api-server dev

endlocal
