# Migrasi TMCpos dari Gudang Kain ke Gudang Buah

Rencana ini merinci langkah-langkah yang diperlukan untuk mengubah arsitektur aplikasi berbasis kain (TMCpos) menjadi aplikasi manajemen stok buah-buahan yang memperhatikan masa kadaluarsa (FEFO) dan penyusutan alami.

> [!WARNING]
> **User Review Required**
> Migrasi ini bersifat destruktif terhadap skema database saat ini karena kita akan menghapus struktur satuan "Roll" dan "Meter" lalu menggantinya menjadi "Kg" dan "Box/Krat". Data lama yang bergantung pada skema kain mungkin tidak akan kompatibel setelah migrasi. Pastikan database Anda siap untuk di-reset (dev mode).

> [!IMPORTANT]
> **Open Questions**
> 1. Apakah Anda ingin tetap menyimpan satuan ganda (misalnya `Box` sebagai satuan utama dan `Kg` sebagai satuan sekunder), atau haruskah kita hanya menggunakan satu metrik (misal `Kg` saja)?
> 2. Untuk sistem kadaluarsa, apakah cukup menggunakan input tanggal `expiry_date` (Tanggal Kadaluarsa) saat penerimaan barang dari supplier, atau Anda butuh pencatatan `harvest_date` (Tanggal Panen)?

## Proposed Changes

Perubahan akan difokuskan pada file *core* (skema & kontrak API). Setelah bagian inti ini disetujui, perubahan akan menjalar ke *frontend* dan *backend routes*.

---

### Database Schema

Modifikasi skema Drizzle ORM untuk menghapus atribut tekstil dan menambahkan atribut komoditas buah.

#### [MODIFY] [`index.ts`](file:///d:/Alma-Ecosystem/lib/db/src/schema/index.ts)
- **Tabel `products`**:
  - Hapus kolom: `primaryUnit`, `secondaryUnit`, `lotNumber`, `pricePerMeter`, `pricePerRoll`, `costPricePerMeter`, `costPricePerRoll`, `rollStock`, `meterStock`.
  - Tambah kolom: `grade` (A/B/C/Reject), `origin` (asal kebun), `temperature_zone` (kebutuhan suhu), `price_per_unit`, `cost_price_per_unit`, `stock` (stok total).
- **Tabel `product_rolls`**:
  - Ubah nama menjadi `product_batches` (atau hapus sepenuhnya jika tidak menggunakan sistem lot per peti). Jika diubah ke `product_batches`, tambahkan kolom `harvest_date` dan `expiry_date` untuk tracking FEFO.
- **Tabel `sale_items`, `purchase_items`, `stock_mutations`, `return_*`**:
  - Hapus `rolls`, `meters`, `price_per_meter`, dll. Ganti menjadi `quantity` (jumlah berat/box) dan `price`.
- **Tabel `stock_mutations`**:
  - Modifikasi `mutationTypeEnum` untuk mengakomodasi "penyusutan" (shrinkage) atau "busuk".

---

### OpenAPI Spec

Penyesuaian spesifikasi API sebagai *source of truth* agar sesuai dengan skema database yang baru.

#### [MODIFY] [`openapi.yaml`](file:///d:/Alma-Ecosystem/lib/api-spec/openapi.yaml)
- **Skema `Product`, `ProductInput`, `ProductUpdate`**:
  - Ganti field terkait tekstil dengan field buah (Grade, Origin, Expiry, dll).
- **Skema `ProductRoll` -> `ProductBatch`**:
  - Refactor endpoint `/products/{id}/rolls` menjadi `/products/{id}/batches` dengan struktur *payload* yang mengakomodasi umur simpan buah.
- **Skema Transaksi (`SaleItem`, `PurchaseItem`)**:
  - Sesuaikan field transaksi agar menggunakan `quantity` bukan lagi meteran/gulungan.

---

### Backend Logic

Penyesuaian logika bisnis di server Express.

#### [MODIFY] `artifacts/api-server/src/routes/`
- **Mutasi & Penjualan**: Terapkan metode **FEFO** (First Expired First Out) saat pemotongan stok otomatis (sistem akan mengambil `product_batches` yang paling cepat kadaluarsa).
- **Penyusutan (Shrinkage)**: Tambahkan logika khusus untuk menangani *stock adjustment* akibat buah busuk atau penyusutan berat air.

---

### Frontend (React/Vite)

Penyesuaian antar muka aplikasi kasir dan ERP.

#### [MODIFY] `artifacts/tmcpos/src/pages/`
- **Form Produk**: Ubah form input barang baru agar memuat dropdown `Grade` dan `Asal Buah`.
- **Halaman Kasir (POS)**: Sederhanakan input kuantitas penjualan, hapus pilihan "Beli Roll/Meter" menjadi cukup input "Berat (Kg)".
- **Dashboard**: Tambahkan *widget* notifikasi "Buah Hampir Busuk (Mendekati Expiry)" menggantikan notifikasi "Stok Kain Menipis".

## Verification Plan

Setelah semua kode disesuaikan, verifikasi akan dilakukan melalui:

### Automated Tests
- Menjalankan `pnpm run typecheck` secara menyeluruh setelah *codegen* Zod Schema dan React Query Hooks berhasil (`pnpm --filter @workspace/api-spec run codegen`).
- Memastikan tidak ada *error* TS terkait sisa-sisa atribut `roll` atau `meter`.

### Manual Verification
1. Mendorong skema baru ke database dev lokal (`pnpm --filter @workspace/db run push`).
2. Membuat produk buah (contoh: "Apel Fuji", Grade A) melalui antarmuka web.
3. Menambahkan stok (Purchase) dengan 2 batch tanggal kadaluarsa yang berbeda.
4. Melakukan Penjualan (Sale) dan memverifikasi bahwa sistem memotong stok dari batch buah yang tanggal kadaluarsanya paling dekat (FEFO).
