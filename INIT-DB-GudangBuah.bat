@echo off
title GudangBuah - Inisialisasi Database (Push Schema)
color 0B
cls

echo.
echo  ============================================================
echo    GUDANG BUAH - Inisialisasi Database
echo  ============================================================
echo.
echo  Script ini akan membuat semua tabel gudang buah ke database.
echo  Harap tunggu dan jawab pertanyaan yang muncul jika ada.
echo.

set "INSTALL_DIR=%~dp0"
cd /d "%INSTALL_DIR%"

echo [1/2] Push schema ke database gudangbuah...
echo.
call pnpm --filter @workspace/db exec drizzle-kit push --config lib/db/drizzle.config.ts

if errorlevel 1 (
    echo.
    echo  [!] Push gagal atau dibatalkan.
    echo  Coba jalankan secara manual:
    echo    pnpm --filter @workspace/db run push-force
) else (
    echo.
    echo  [OK] Schema database berhasil dibuat!

    echo.
    echo [2/2] Mengisi data awal (buah)...
    set DATABASE_URL=postgresql://postgres:vocpos2026@127.0.0.1:4538/gudangbuah
    node "d:\GudangBuah_App\node_modules\.pnpm\tsx@4.22.4\node_modules\tsx\dist\cli.mjs" "d:\GudangBuah_App\lib\db\src\seed.ts"
    
    echo.
    echo  ============================================================
    echo    SELESAI! Data awal berhasil diisi.
    echo    Login: admin / admin123
    echo  ============================================================
)

echo.
pause
