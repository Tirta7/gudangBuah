import { db } from "./index";
import { 
  unitsTable, categoriesTable, productsTable, suppliersTable, customersTable, 
  purchasesTable, purchaseItemsTable, stockMutationsTable, cashEntriesTable,
  salesTable, saleItemsTable, payablesTable, receivablesTable, usersTable,
  paymentMethodsTable, settingsTable
} from "./schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

async function runSeed() {
  console.log("Mulai proses seeding data gudang buah...");

  // 0. User Admin
  console.log("Membuat User Admin...");
  const passwordHash = await bcrypt.hash("admin123", 10);
  await db.insert(usersTable).values([
    { username: "admin", passwordHash, fullName: "Administrator", role: "admin" },
  ]).onConflictDoNothing();

  // 0b. Metode Pembayaran
  console.log("Membuat Metode Pembayaran...");
  await db.insert(paymentMethodsTable).values([
    { code: "tunai", name: "Tunai", isActive: true, sortOrder: 1 },
    { code: "transfer", name: "Transfer Bank", isActive: true, sortOrder: 2 },
    { code: "tempo", name: "Tempo (Kredit)", isActive: true, sortOrder: 3 },
  ]).onConflictDoNothing();

  // 0c. Settings
  console.log("Membuat Pengaturan...");
  await db.insert(settingsTable).values([
    { key: "store_name", value: "Gudang Buah Segar", description: "Nama Toko/Gudang" },
    { key: "store_address", value: "Jl. Raya Buah No. 1", description: "Alamat Toko" },
    { key: "store_phone", value: "08123456789", description: "No. Telepon Toko" },
  ]).onConflictDoNothing();

  // 1. Satuan
  console.log("Membuat Satuan...");
  await db.insert(unitsTable).values([
    { name: "KG", symbol: "kg" },
    { name: "KRAT", symbol: "krat" },
    { name: "BOX", symbol: "box" },
    { name: "KARUNG", symbol: "krg" },
    { name: "PCS", symbol: "pcs" },
    { name: "TON", symbol: "ton" },
  ]).onConflictDoNothing();

  // 2. Kategori Buah
  console.log("Membuat Kategori...");
  const [catLokal, catImpor, catSayur] = await db.insert(categoriesTable).values([
    { name: "Buah Lokal", description: "Buah-buahan hasil produksi dalam negeri" },
    { name: "Buah Impor", description: "Buah-buahan dari luar negeri" },
    { name: "Sayuran", description: "Berbagai jenis sayuran segar" },
  ]).returning();

  // 3. Produk Buah
  console.log("Membuat Produk Buah...");
  const products = await db.insert(productsTable).values([
    { name: "Apel Fuji", categoryId: catImpor.id, barcode: "11111111", primaryUnit: "KG", secondaryUnit: "KRAT", pricePerKg: "28000", pricePerKrat: "350000", costPricePerKg: "22000", costPricePerKrat: "280000", kratStock: "0", kgStock: "0", minStock: "50", rackLocation: "A1" },
    { name: "Jeruk Mandarin", categoryId: catImpor.id, barcode: "22222222", primaryUnit: "KG", secondaryUnit: "KRAT", pricePerKg: "25000", pricePerKrat: "300000", costPricePerKg: "20000", costPricePerKrat: "240000", kratStock: "0", kgStock: "0", minStock: "50", rackLocation: "A2" },
    { name: "Mangga Harum Manis", categoryId: catLokal.id, barcode: "33333333", primaryUnit: "KG", secondaryUnit: "KRAT", pricePerKg: "18000", pricePerKrat: "200000", costPricePerKg: "13000", costPricePerKrat: "150000", kratStock: "0", kgStock: "0", minStock: "30", rackLocation: "B1" },
    { name: "Semangka", categoryId: catLokal.id, barcode: "44444444", primaryUnit: "KG", secondaryUnit: "KRAT", pricePerKg: "8000", pricePerKrat: "120000", costPricePerKg: "5000", costPricePerKrat: "80000", kratStock: "0", kgStock: "0", minStock: "100", rackLocation: "B2" },
    { name: "Anggur Hijau", categoryId: catImpor.id, barcode: "55555555", primaryUnit: "KG", secondaryUnit: "BOX", pricePerKg: "45000", pricePerKrat: "180000", costPricePerKg: "38000", costPricePerKrat: "150000", kratStock: "0", kgStock: "0", minStock: "20", rackLocation: "C1" },
    { name: "Pisang Cavendish", categoryId: catLokal.id, barcode: "66666666", primaryUnit: "KG", secondaryUnit: "KRAT", pricePerKg: "12000", pricePerKrat: "150000", costPricePerKg: "9000", costPricePerKrat: "110000", kratStock: "0", kgStock: "0", minStock: "50", rackLocation: "C2" },
  ]).returning();

  // 4. Supplier
  console.log("Membuat Supplier...");
  const [sup1, sup2] = await db.insert(suppliersTable).values([
    { name: "UD Sumber Buah", phone: "081111111111", address: "Pasar Induk Kramat Jati, Jakarta", contactPerson: "Pak Budi" },
    { name: "CV Impor Buah Segar", phone: "082222222222", address: "Tanjung Priok, Jakarta", contactPerson: "Pak Hendra" },
  ]).returning();

  // 5. Pelanggan
  console.log("Membuat Pelanggan...");
  const [cust1, cust2] = await db.insert(customersTable).values([
    { name: "Supermarket Segar", phone: "083333333333", address: "Jl. Sudirman No. 10, Jakarta", creditLimit: "20000000" },
    { name: "Warung Buah Pak Joko", phone: "084444444444", address: "Pasar Baru, Bogor", creditLimit: "5000000" },
    { name: "Hotel Grand Palace", phone: "085555555555", address: "Jl. Gatot Subroto, Jakarta", creditLimit: "50000000" },
  ]).returning();

  // 6. Stok Masuk - Pembelian Awal
  console.log("Mencatat Pembelian/Stok Masuk Awal...");
  const now = new Date();
  const expiry14days = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
  const expiry7days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const [purchase1] = await db.insert(purchasesTable).values({
    invoiceNumber: "PB-" + Date.now(),
    supplierId: sup1.id,
    paymentType: "tunai",
    totalAmount: "25000000",
    paidAmount: "25000000",
    status: "lunas"
  }).returning();

  for (const p of products) {
    await db.insert(purchaseItemsTable).values({
      purchaseId: purchase1.id,
      productId: p.id,
      krats: "20",
      kgs: "250",
      pricePerKg: p.costPricePerKg ?? "10000",
      subtotal: String(parseFloat(p.costPricePerKg ?? "10000") * 250),
    });

    await db.insert(stockMutationsTable).values({
      productId: p.id,
      type: "masuk",
      krats: "20",
      kgs: "250",
      description: "Stok awal masuk",
      reference: purchase1.invoiceNumber
    });

    await db.update(productsTable)
      .set({ kratStock: "20", kgStock: "250" })
      .where(eq(productsTable.id, p.id));
  }

  await db.insert(cashEntriesTable).values({
    type: "keluar",
    amount: "25000000",
    description: "Pembayaran tunai pembelian buah awal",
    reference: purchase1.invoiceNumber
  });

  // 7. Penjualan Tunai
  console.log("Mencatat Penjualan Tunai...");
  const [sale1] = await db.insert(salesTable).values({
    invoiceNumber: "PJ-" + Date.now(),
    customerId: cust1.id,
    paymentType: "tunai",
    totalAmount: "7000000",
    paidAmount: "7000000",
    status: "lunas"
  }).returning();

  await db.insert(saleItemsTable).values({
    saleId: sale1.id,
    productId: products[0].id,
    krats: "5",
    kgs: "62.5",
    pricePerKg: products[0].pricePerKg ?? "28000",
    subtotal: "1750000"
  });

  await db.insert(stockMutationsTable).values({
    productId: products[0].id,
    type: "keluar",
    krats: "5",
    kgs: "62.5",
    description: "Penjualan ke Supermarket Segar",
    reference: sale1.invoiceNumber
  });

  await db.update(productsTable)
    .set({ kratStock: "15", kgStock: "187.5" })
    .where(eq(productsTable.id, products[0].id));

  await db.insert(cashEntriesTable).values({
    type: "masuk",
    amount: "7000000",
    description: "Penerimaan tunai penjualan buah ke Supermarket Segar",
    reference: sale1.invoiceNumber
  });

  // 8. Pembelian Tempo (Hutang)
  console.log("Mencatat Hutang...");
  const [purchaseTempo] = await db.insert(purchasesTable).values({
    invoiceNumber: "PB-TEMPO-" + Date.now(),
    supplierId: sup2.id,
    paymentType: "tempo",
    totalAmount: "12000000",
    paidAmount: "0",
    status: "tempo",
    dueDate: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
  }).returning();

  await db.insert(purchaseItemsTable).values({
    purchaseId: purchaseTempo.id,
    productId: products[4].id, // Anggur Hijau
    krats: "10",
    kgs: "40",
    pricePerKg: "38000",
    subtotal: "1520000"
  });

  await db.insert(payablesTable).values({
    purchaseId: purchaseTempo.id,
    supplierId: sup2.id,
    totalAmount: "12000000",
    paidAmount: "0",
    status: "unpaid",
    dueDate: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
  });

  // 9. Penjualan Tempo (Piutang)
  console.log("Mencatat Piutang...");
  const [saleTempo] = await db.insert(salesTable).values({
    invoiceNumber: "PJ-TEMPO-" + Date.now(),
    customerId: cust2.id,
    paymentType: "tempo",
    totalAmount: "3000000",
    paidAmount: "0",
    status: "tempo",
    dueDate: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)
  }).returning();

  await db.insert(saleItemsTable).values({
    saleId: saleTempo.id,
    productId: products[2].id, // Mangga
    krats: "5",
    kgs: "55",
    pricePerKg: "18000",
    subtotal: "990000"
  });

  await db.insert(receivablesTable).values({
    saleId: saleTempo.id,
    customerId: cust2.id,
    totalAmount: "3000000",
    paidAmount: "0",
    status: "unpaid",
    dueDate: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)
  });

  // 10. Histori Transaksi 30 Hari untuk Grafik
  console.log("Mencatat Histori Penjualan 30 hari (untuk grafik & laporan)...");
  const today = new Date();

  for (let i = 1; i <= 30; i++) {
    const numSales = Math.floor(Math.random() * 4) + 1;
    for (let j = 0; j < numSales; j++) {
      const txDate = new Date(today);
      txDate.setDate(today.getDate() - i);
      txDate.setHours(Math.floor(Math.random() * 10) + 8);

      const randProduct = products[Math.floor(Math.random() * products.length)];
      const randCustomer = Math.random() > 0.5 ? cust1 : cust2;
      const randKrats = Math.floor(Math.random() * 5) + 1;
      const kgsVal = randKrats * 12.5;
      const pricePerKg = parseFloat(randProduct.pricePerKg ?? "20000");
      const subtotal = kgsVal * pricePerKg;

      const [bulkSale] = await db.insert(salesTable).values({
        invoiceNumber: `PJ-H${i}-${j}-${Math.floor(Math.random() * 9999)}`,
        customerId: randCustomer.id,
        paymentType: "tunai",
        totalAmount: subtotal.toString(),
        paidAmount: subtotal.toString(),
        status: "lunas",
        createdAt: txDate,
        updatedAt: txDate
      }).returning();

      await db.insert(saleItemsTable).values({
        saleId: bulkSale.id,
        productId: randProduct.id,
        krats: randKrats.toString(),
        kgs: kgsVal.toString(),
        pricePerKg: pricePerKg.toString(),
        subtotal: subtotal.toString()
      });

      await db.insert(cashEntriesTable).values({
        type: "masuk",
        amount: subtotal.toString(),
        description: `Penjualan buah ${bulkSale.invoiceNumber}`,
        reference: bulkSale.invoiceNumber,
        createdAt: txDate
      });
    }
  }

  console.log("\n✅ Seeding data gudang buah selesai!");
  console.log("   Login: admin / admin123");
  process.exit(0);
}

runSeed().catch(err => {
  console.error("Gagal seed:", err);
  process.exit(1);
});
