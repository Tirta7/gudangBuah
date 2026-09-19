/**
 * Script untuk membuat semua tabel di database gudangBuah
 * Menggunakan drizzle-orm langsung (bukan drizzle-kit)
 * sehingga tidak perlu TTY / interaksi manual
 */
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema/index.js";
import { sql } from "drizzle-orm";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error("DATABASE_URL tidak ditemukan di .env");

const pool = new pg.Pool({ connectionString: DATABASE_URL });
const db = drizzle(pool, { schema });

async function migrate() {
  console.log("Membuat tabel-tabel database gudangBuah...");
  console.log("URL:", DATABASE_URL?.replace(/:([^:@]+)@/, ":***@"));

  // Coba koneksi dulu
  await pool.connect();
  console.log("[OK] Terhubung ke database");

  // Jalankan SQL untuk membuat semua extension yang dibutuhkan
  await db.execute(sql`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

  // Gunakan drizzle migrate dengan custom approach
  const { migrate } = await import("drizzle-orm/node-postgres/migrator");
  
  // Cek apakah folder drizzle ada snapshot terbaru
  const fs = await import("fs");
  const path = await import("path");
  const drizzleDir = path.resolve("./drizzle");
  
  if (!fs.existsSync(drizzleDir)) {
    console.error("[ERROR] Folder drizzle/ tidak ditemukan");
    process.exit(1);
  }

  console.log("Menjalankan migrasi dari folder drizzle/...");
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("[OK] Semua tabel berhasil dibuat!");
  
  await pool.end();
  process.exit(0);
}

migrate().catch(e => {
  console.error("[ERROR]", e.message);
  process.exit(1);
});
