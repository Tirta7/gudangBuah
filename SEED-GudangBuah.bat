@echo off
setlocal enabledelayedexpansion
title GudangBuah - Isi Data Awal (Seed)
color 0B
cls

echo.
echo  ============================================================
echo    GUDANG BUAH - Pengisian Data Awal (Seed)
echo  ============================================================
echo.
echo  Script ini akan mengisi database dengan:
echo  - Data produk buah (Apel, Jeruk, Mangga, dll)
echo  - Data supplier dan pelanggan
echo  - Transaksi demo 30 hari
echo  - Akun admin (username: admin, password: admin123)
echo.
echo  [!] PERINGATAN: Jalankan HANYA jika database masih kosong!
echo      Jika database sudah berisi data, JANGAN jalankan ini.
echo.
set /p "CONFIRM=Ketik YES untuk lanjutkan, atau tekan Enter untuk batal: "
if /i not "!CONFIRM!"=="YES" (
    echo Dibatalkan.
    pause
    exit /b 0
)

echo.
echo  Mengisi data awal...
set CI=true
set DATABASE_URL=postgresql://postgres:vocpos2026@127.0.0.1:4538/gudangbuah
node "d:\GudangBuah_App\node_modules\.pnpm\tsx@4.22.4\node_modules\tsx\dist\cli.mjs" "d:\GudangBuah_App\lib\db\src\seed.ts"

if errorlevel 1 (
    echo.
    echo  [ERROR] Gagal mengisi data! Kemungkinan data sudah ada.
    echo  Jalankan START-GudangBuah.bat dan login dengan data yang ada.
) else (
    echo.
    echo  ============================================================
    echo    DATA AWAL BERHASIL DIISI!
    echo  ============================================================
    echo.
    echo    Login dengan:
    echo    Username : admin
    echo    Password : admin123
    echo.
    echo  Silahkan jalankan START-GudangBuah.bat untuk membuka aplikasi.
)
echo.
pause
endlocal
