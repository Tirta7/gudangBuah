import { Router } from "express";
import { db } from "@workspace/db";
import { productsTable, categoriesTable, productBatchesTable, saleItemsTable, purchaseItemsTable, purchasesTable, payablesTable } from "@workspace/db";
import { eq, ilike, and, lte, sql, inArray, desc } from "drizzle-orm";
import { CreateProductBody, UpdateProductBody, CreateProductBatchBody, UpdateProductBatchBody } from "@workspace/api-zod";
import { pushService } from "../lib/push";
import * as XLSX from "xlsx";

const router = Router();

async function syncProductStockFromKrats(productId: number) {
  const existingKrats = await db.select().from(productBatchesTable).where(and(eq(productBatchesTable.productId, productId), eq(productBatchesTable.status, "available")));
  const kratStock = existingKrats.length;
  const kgStock = existingKrats.reduce((sum, r) => sum + parseFloat(r.currentWeight), 0);
  await db.update(productsTable).set({
    kratStock: String(kratStock),
    kgStock: String(kgStock)
  }).where(eq(productsTable.id, productId));
}

// Helper: Sync purchase totals from all its items (keepPaid=true: keep existing paidAmount)
async function syncPurchaseTotals(purchaseId: number, keepPaid: boolean = true) {
  try {
    const items = await db.select().from(purchaseItemsTable).where(eq(purchaseItemsTable.purchaseId, purchaseId));
    if (items.length === 0) return;
    const newTotal = items.reduce((s, i) => s + parseFloat(i.subtotal || "0"), 0);
    const [purchase] = await db.select().from(purchasesTable).where(eq(purchasesTable.id, purchaseId));
    if (!purchase) return;
    const existingPaid = keepPaid ? parseFloat(purchase.paidAmount || "0") : 0;
    const newStatus = existingPaid >= newTotal ? "lunas" : existingPaid > 0 ? "partial" : "tempo";
    await db.update(purchasesTable).set({ totalAmount: String(newTotal), paidAmount: String(existingPaid), status: newStatus, updatedAt: new Date() } as any).where(eq(purchasesTable.id, purchaseId));
    const [payable] = await db.select().from(payablesTable).where(eq(payablesTable.purchaseId, purchaseId));
    if (payable) {
      await db.update(payablesTable).set({ totalAmount: String(newTotal), paidAmount: String(existingPaid), status: newStatus === "lunas" ? "paid" : newStatus === "partial" ? "partial" : "unpaid", updatedAt: new Date() } as any).where(eq(payablesTable.purchaseId, purchaseId));
    } else if (newStatus !== "lunas") {
      await db.insert(payablesTable).values({ purchaseId, supplierId: purchase.supplierId, totalAmount: String(newTotal), paidAmount: String(existingPaid), status: newStatus === "partial" ? "partial" : "unpaid" } as any);
    }
  } catch (e) { console.error("syncPurchaseTotals error:", e); }
}

// Helper: After a specific krat is changed/deleted, update ONLY the purchase item that originally created it.
async function syncPurchaseItemForSpecificKrat(productId: number, modifiedKratId: number) {
  try {
    const purchaseItems = await db.select().from(purchaseItemsTable).where(eq(purchaseItemsTable.productId, productId));
    let targetItem = null;
    let originalKratIndex = -1;
    let originalKratCount = 0;
    
    for (const item of purchaseItems) {
      if (!item.batchId) continue;
      const startKratId = item.batchId as number;
      
      let count = Number(item.krats) || 0;
      if (item.batchWeightsJson) {
        try {
          const parsed = JSON.parse(item.batchWeightsJson);
          if (Array.isArray(parsed) && parsed.length > count) count = parsed.length;
        } catch(e){}
      }
      
      if (modifiedKratId >= startKratId && modifiedKratId < startKratId + count) {
        targetItem = item;
        originalKratIndex = modifiedKratId - startKratId;
        originalKratCount = count;
        break;
      }
    }
    
    if (!targetItem) return; 
    
    const batchIds = Array.from({ length: originalKratCount }, (_, i) => (targetItem.batchId as number) + i);
    const existingKrats = await db.select().from(productBatchesTable).where(inArray(productBatchesTable.id, batchIds));
    
    const batchWeights: number[] = [];
    for (const batchId of batchIds) {
      const krat = existingKrats.find(r => r.id === batchId);
      if (krat) batchWeights.push(parseFloat(krat.currentWeight));
    }
    
    const newKgs = batchWeights.reduce((a,b) => a + b, 0);
    const newKrats = batchWeights.length;
    const pricePerKg = parseFloat(targetItem.pricePerKg || "0");
    const newSubtotal = Math.round(newKgs * pricePerKg);
    
    await db.update(purchaseItemsTable).set({
      batchWeightsJson: JSON.stringify(batchWeights),
      kgs: String(newKgs),
      krats: String(newKrats),
      subtotal: String(newSubtotal)
    } as any).where(eq(purchaseItemsTable.id, targetItem.id));
    
    await syncPurchaseTotals(targetItem.purchaseId, true);
  } catch (e) { console.error("syncPurchaseItemForSpecificKrat error:", e); }
}

router.get("/products", async (req, res): Promise<void> => {
  const { categoryId, search, lowStock } = req.query;
  const conditions = [];
  if (categoryId) conditions.push(eq(productsTable.categoryId, parseInt(categoryId as string)));
  if (search) conditions.push(ilike(productsTable.name, `%${search}%`));

  const products = await db
    .select({
      id: productsTable.id,
      name: productsTable.name,
      categoryId: productsTable.categoryId,
      categoryName: categoriesTable.name,
      barcode: productsTable.barcode,
      primaryUnit: productsTable.primaryUnit,
      secondaryUnit: productsTable.secondaryUnit,
      lotNumber: productsTable.lotNumber,
      rackLocation: productsTable.rackLocation,
      imageUrl: productsTable.imageUrl,
      description: productsTable.description,
      costPricePerKg: productsTable.costPricePerKg,
      costPricePerKrat: productsTable.costPricePerKrat,
      pricePerKg: productsTable.pricePerKg,
      pricePerKrat: productsTable.pricePerKrat,
      kratStock: productsTable.kratStock,
      kgStock: productsTable.kgStock,
      minStock: productsTable.minStock,
      createdAt: productsTable.createdAt,
    })
    .from(productsTable)
    .leftJoin(categoriesTable, eq(productsTable.categoryId, categoriesTable.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(productsTable.name);

  const result = products.map(p => ({
    ...p,
    costPricePerKg: parseFloat(p.costPricePerKg ?? "0"),
    costPricePerKrat: p.costPricePerKrat ? parseFloat(p.costPricePerKrat) : null,
    pricePerKg: parseFloat(p.pricePerKg ?? "0"),
    pricePerKrat: p.pricePerKrat ? parseFloat(p.pricePerKrat) : null,
    kratStock: parseFloat(p.kratStock ?? "0"),
    kgStock: parseFloat(p.kgStock ?? "0"),
    minStock: parseFloat(p.minStock ?? "0"),
    isLowStock: parseFloat(p.kratStock ?? "0") <= parseFloat(p.minStock ?? "0"),
  }));

  if (lowStock === "true") { res.json(result.filter(p => p.isLowStock)); return; }
  res.json(result);
});

// ─── GET /products/export ─────────────────────────────────────────────────────
router.get("/products/export", async (req, res): Promise<void> => {
  try {
    const products = await db
      .select({
        id: productsTable.id,
        name: productsTable.name,
        barcode: productsTable.barcode,
        categoryName: categoriesTable.name,
        primaryUnit: productsTable.primaryUnit,
        secondaryUnit: productsTable.secondaryUnit,
        costPricePerKg: productsTable.costPricePerKg,
        pricePerKg: productsTable.pricePerKg,
        costPricePerKrat: productsTable.costPricePerKrat,
        pricePerKrat: productsTable.pricePerKrat,
        kratStock: productsTable.kratStock,
        kgStock: productsTable.kgStock,
        minStock: productsTable.minStock,
        description: productsTable.description,
      })
      .from(productsTable)
      .leftJoin(categoriesTable, eq(productsTable.categoryId, categoriesTable.id))
      .orderBy(productsTable.name);

    // Get available krats to populate Krat columns
    const allAvailableKrats = await db.select().from(productBatchesTable).where(eq(productBatchesTable.status, "available"));
    const kratsByProductId = new Map<number, any[]>();
    for (const r of allAvailableKrats) {
      if (!kratsByProductId.has(r.productId)) kratsByProductId.set(r.productId, []);
      kratsByProductId.get(r.productId)!.push(r);
    }

    let maxKrats = 0;
    for (const [_, krats] of kratsByProductId) {
      if (krats.length > maxKrats) maxKrats = krats.length;
    }

    const rows: any[] = [];
    let rowNo = 1;

    for (const p of products) {
      const row: any = {
        "No": rowNo++,
        "Barcode": p.barcode || "",
        "Nama Barang": p.name || "",
        "Kategori": p.categoryName || "",
        "Unit 1": p.primaryUnit || "",
        "Unit 2": p.secondaryUnit || "",
        "Stok (Krat)": parseFloat(p.kratStock || "0"),
        "Stok (Kg)": parseFloat(p.kgStock || "0"),
        "Min Stok": parseFloat(p.minStock || "0"),
      };

      const productBatchs = kratsByProductId.get(p.id) || [];
      for (let i = 1; i <= maxKrats; i++) {
        row[`Krat ${i}`] = productBatchs[i - 1] ? parseFloat(productBatchs[i - 1].currentWeight) : "";
      }

      row["Harga Beli (M)"] = parseFloat(p.costPricePerKg || "0");
      row["Harga Jual (M)"] = parseFloat(p.pricePerKg || "0");
      row["Harga Beli (R)"] = parseFloat(p.costPricePerKrat || "0");
      row["Harga Jual (R)"] = parseFloat(p.pricePerKrat || "0");
      row["Deskripsi"] = p.description || "";

      rows.push(row);
    }

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Barang");
    const filename = `Data_Barang.xlsx`;
    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.send(buffer);
  } catch (err: any) {
    console.error("Export products error:", err);
    res.status(500).json({ error: err.message || "Export gagal" });
  }
});

// ─── POST /products/import ────────────────────────────────────────────────────
router.post("/products/import", async (req, res): Promise<void> => {
  try {
    const contentType = req.headers["content-type"] || "";
    if (!contentType.includes("multipart/form-data")) {
      res.status(400).json({ error: "Content-Type harus multipart/form-data" }); return;
    }

    const busboy = (await import("busboy")).default;
    const bb = busboy({ headers: req.headers, limits: { fileSize: 10 * 1024 * 1024 } });
    const chunks: Buffer[] = [];
    let fileReceived = false;

    await new Promise<void>((resolve, reject) => {
      bb.on("file", (_f, file) => {
        fileReceived = true;
        file.on("data", (c: Buffer) => chunks.push(c));
        file.on("end", () => {});
        file.on("error", reject);
      });
      bb.on("finish", resolve);
      bb.on("error", reject);
      req.pipe(bb);
    });

    if (!fileReceived || chunks.length === 0) {
      res.status(400).json({ error: "File Excel tidak ditemukan" }); return;
    }

    const buffer = Buffer.concat(chunks);
    const wb = XLSX.read(buffer, { type: "buffer" });
    
    // Cari sheet yang tepat (prioritaskan yang namanya mengandung "Barang")
    let ws = wb.Sheets[wb.SheetNames[0]];
    for (const name of wb.SheetNames) {
      if (name.toLowerCase().includes("barang")) {
        ws = wb.Sheets[name];
        break;
      }
    }
    
    let rawRows: any[] = XLSX.utils.sheet_to_json(ws, { defval: "" });

    // Jika tidak ada kolom "Nama Barang", coba cari di sheet lain
    if (rawRows.length > 0 && !Object.keys(rawRows[0]).some(k => k.toLowerCase().includes("nama barang"))) {
      for (const name of wb.SheetNames) {
        const tempWs = wb.Sheets[name];
        const tempRows: any[] = XLSX.utils.sheet_to_json(tempWs, { defval: "" });
        if (tempRows.length > 0 && Object.keys(tempRows[0]).some(k => k.toLowerCase().includes("nama barang"))) {
          ws = tempWs;
          rawRows = tempRows;
          break;
        }
      }
    }

    if (rawRows.length === 0) {
      res.json({ success: 0, failed: 0, message: "File kosong" }); return;
    }

    const allCategories = await db.select().from(categoriesTable);
    const findCategory = (name: string) => allCategories.find(c => c.name.toLowerCase() === name?.trim().toLowerCase());

    let successCount = 0;
    const errors: string[] = [];

    for (const row of rawRows) {
      try {
        const name = String(row["Nama Barang"] || "").trim();
        if (!name) continue; // Skip empty rows

        let categoryId: number | null = null;
        const catName = String(row["Kategori"] || "").trim();
        if (catName) {
          let cat = findCategory(catName);
          if (!cat) {
            const [newCat] = await db.insert(categoriesTable).values({ name: catName }).returning();
            allCategories.push(newCat);
            cat = newCat;
          }
          categoryId = cat.id;
        }

        const barcode = String(row["Barcode"] || "").trim() || `PRD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        
        let existingProd = null;
        if (row["Barcode"]) {
           const bc = String(row["Barcode"]).trim();
           existingProd = (await db.select().from(productsTable).where(eq(productsTable.barcode, bc)))[0];
        } else {
           // Hanya fallback ke Nama jika Barcode kosong di file Excel
           existingProd = (await db.select().from(productsTable).where(eq(productsTable.name, name)))[0];
        }

        // Parse krats
        const batchWeights: number[] = [];
        for (const key of Object.keys(row)) {
          if (key.startsWith("Krat ") && key !== "Krat") {
            const val = parseFloat(String(row[key]).replace(",", "."));
            if (!isNaN(val) && val > 0) {
               const kratIndexStr = key.replace("Krat ", "").trim();
               const kratIndex = parseInt(kratIndexStr, 10);
               if (!isNaN(kratIndex) && kratIndex > 0) {
                   batchWeights[kratIndex - 1] = val;
               }
            }
          }
        }
        const cleanKratLengths = batchWeights.filter(r => r !== undefined);
        const kgStock = cleanKratLengths.reduce((a, b) => a + b, 0);
        const kratStock = cleanKratLengths.length;

        const hasKratColumns = Object.keys(row).some(key => key.startsWith("Krat ") && key !== "Krat");

        // Base Data
        const prodData: any = {
          name, barcode, categoryId,
          primaryUnit: String(row["Unit 1"] || "KG").trim(),
          secondaryUnit: String(row["Unit 2"] || "KRAT").trim(),
          costPricePerKg: String(parseFloat(String(row["Harga Beli (M)"] || "0").replace(",", ".")) || 0),
          pricePerKg: String(parseFloat(String(row["Harga Jual (M)"] || "0").replace(",", ".")) || 0),
          costPricePerKrat: String(parseFloat(String(row["Harga Beli (R)"] || "0").replace(",", ".")) || 0),
          pricePerKrat: String(parseFloat(String(row["Harga Jual (R)"] || "0").replace(",", ".")) || 0),
          minStock: String(parseFloat(String(row["Min Stok"] || "0").replace(",", ".")) || 0),
          description: String(row["Deskripsi"] || "").trim(),
        };

        if (hasKratColumns) {
          prodData.kratStock = String(kratStock);
          prodData.kgStock = String(kgStock);
        }

        let prodId;
        if (existingProd) {
          await db.update(productsTable).set({ ...prodData, updatedAt: new Date() }).where(eq(productsTable.id, existingProd.id));
          prodId = existingProd.id;
        } else {
          if (!hasKratColumns) {
            prodData.kratStock = "0";
            prodData.kgStock = "0";
          }
          const [newProd] = await db.insert(productsTable).values(prodData as any).returning();
          prodId = newProd.id;
        }

        // Hapus & re-insert krat hanya jika Excel memang berisi data Krat
        if (hasKratColumns) {
          try {
            await db.delete(productBatchesTable).where(and(eq(productBatchesTable.productId, prodId), eq(productBatchesTable.status, "available")));
          } catch (e) {
            // Ignore FK errors if we can't delete krats tied to purchases
          }

          if (kratStock > 0) {
             const ts = Date.now();
             const kratsToInsert = cleanKratLengths.map((len, i) => ({
               productId: prodId,
               barcode: `${barcode}-R${ts}-${i + 1}-${Math.floor(Math.random() * 9999)}`,
               originalWeight: String(len),
               currentWeight: String(len),
               status: "available"
             }));
             await db.insert(productBatchesTable).values(kratsToInsert as any);
          }
          
          // Sinkronisasi ulang stok di productsTable agar sesuai dengan jumlah krat sebenarnya yang ada di database
          // (karena mungkin ada krat dari nota pembelian yang gagal dihapus)
          const actualKrats = await db.select().from(productBatchesTable).where(and(eq(productBatchesTable.productId, prodId), eq(productBatchesTable.status, "available")));
          const actualKratCount = actualKrats.length;
          const actualKgCount = actualKrats.reduce((a, b) => a + (parseFloat(b.currentWeight) || 0), 0);
          
          await db.update(productsTable)
            .set({ kratStock: String(actualKratCount), kgStock: String(actualKgCount) })
            .where(eq(productsTable.id, prodId));
        }

        successCount++;
      } catch (err: any) {
        errors.push(`Gagal memproses baris: ${err.message}`);
      }
    }

    res.json({ success: successCount, failed: errors.length, errors, message: "Import selesai" });
  } catch (err: any) {
    console.error("Import products error:", err);
    res.status(500).json({ error: err.message || "Import gagal" });
  }
});

router.post("/products", async (req, res): Promise<void> => {
  const parsed = CreateProductBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const d = parsed.data;
  const barcodeToSave = d.barcode ? d.barcode : `PRD-${Date.now()}`;
  const { batchWeights: createKratLengths, ...productData } = d;
  const [prod] = await db.insert(productsTable).values({
    ...productData,
    barcode: barcodeToSave,
    primaryUnit: d.primaryUnit || "KG",
    secondaryUnit: d.secondaryUnit || "KRAT",
    costPricePerKg: String(d.costPricePerKg ?? 0),
    costPricePerKrat: d.costPricePerKrat != null ? String(d.costPricePerKrat) : null,
    pricePerKg: String(d.pricePerKg ?? 0),
    pricePerKrat: d.pricePerKrat != null ? String(d.pricePerKrat) : null,
    kratStock: String(d.kratStock ?? 0),
    kgStock: String(d.kgStock ?? 0),
    minStock: String(d.minStock ?? 0),
  }).returning();
    
    const kratStockNum = Math.floor(d.kratStock ?? 0);
    const kgStockNum = d.kgStock ?? 0;
    if (kratStockNum > 0) {
      const kratsToInsert = Array.from({ length: kratStockNum }).map((_, i) => {
      const lengthToUse = (createKratLengths && createKratLengths[i] != null && createKratLengths[i] > 0)
        ? createKratLengths[i]
        : (kgStockNum / kratStockNum);
        return {
          productId: prod.id,
          barcode: `${prod.barcode}-R${Date.now()}-${i + 1}`,
          originalWeight: String(lengthToUse),
          currentWeight: String(lengthToUse),
          status: "available",
        };
      });
      await db.insert(productBatchesTable).values(kratsToInsert);
    }
    
  res.status(201).json({
    ...prod,
    costPricePerKg: parseFloat(prod.costPricePerKg ?? "0"),
    costPricePerKrat: prod.costPricePerKrat ? parseFloat(prod.costPricePerKrat) : null,
    pricePerKg: parseFloat(prod.pricePerKg ?? "0"),
    pricePerKrat: prod.pricePerKrat ? parseFloat(prod.pricePerKrat) : null,
    kratStock: parseFloat(prod.kratStock ?? "0"),
    kgStock: parseFloat(prod.kgStock ?? "0"),
    minStock: parseFloat(prod.minStock ?? "0"),
    isLowStock: false,
    categoryName: null,
  });
});

router.get("/products/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const [prod] = await db
    .select({
      id: productsTable.id,
      name: productsTable.name,
      categoryId: productsTable.categoryId,
      categoryName: categoriesTable.name,
      barcode: productsTable.barcode,
      primaryUnit: productsTable.primaryUnit,
      secondaryUnit: productsTable.secondaryUnit,
      lotNumber: productsTable.lotNumber,
      rackLocation: productsTable.rackLocation,
      imageUrl: productsTable.imageUrl,
      description: productsTable.description,
      costPricePerKg: productsTable.costPricePerKg,
      costPricePerKrat: productsTable.costPricePerKrat,
      pricePerKg: productsTable.pricePerKg,
      pricePerKrat: productsTable.pricePerKrat,
      kratStock: productsTable.kratStock,
      kgStock: productsTable.kgStock,
      minStock: productsTable.minStock,
      createdAt: productsTable.createdAt,
    })
    .from(productsTable)
    .leftJoin(categoriesTable, eq(productsTable.categoryId, categoriesTable.id))
    .where(eq(productsTable.id, id));
  if (!prod) { res.status(404).json({ error: "Not found" }); return; }
  res.json({
    ...prod,
    costPricePerKg: parseFloat(prod.costPricePerKg ?? "0"),
    costPricePerKrat: prod.costPricePerKrat ? parseFloat(prod.costPricePerKrat) : null,
    pricePerKg: parseFloat(prod.pricePerKg ?? "0"),
    pricePerKrat: prod.pricePerKrat ? parseFloat(prod.pricePerKrat) : null,
    kratStock: parseFloat(prod.kratStock ?? "0"),
    kgStock: parseFloat(prod.kgStock ?? "0"),
    minStock: parseFloat(prod.minStock ?? "0"),
    isLowStock: parseFloat(prod.kratStock ?? "0") <= parseFloat(prod.minStock ?? "0"),
  });
});

router.get("/products/:id/krats", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const krats = await db
    .select()
    .from(productBatchesTable)
    .where(and(eq(productBatchesTable.productId, id), eq(productBatchesTable.status, "available")))
    .orderBy(productBatchesTable.createdAt);
  
  res.json(krats.map(r => ({
    ...r,
    originalWeight: parseFloat(r.originalWeight),
    currentWeight: parseFloat(r.currentWeight),
    createdAt: r.createdAt.toISOString()
  })));
});

router.patch("/products/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const parsed = UpdateProductBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const d = parsed.data;
  const updateData: Record<string, unknown> = { updatedAt: new Date() };
  if (d.name != null) updateData.name = d.name;
  if (d.categoryId != null) updateData.categoryId = d.categoryId;
  if (d.barcode != null) updateData.barcode = d.barcode;
  if (d.primaryUnit != null) updateData.primaryUnit = d.primaryUnit;
  if (d.secondaryUnit != null) updateData.secondaryUnit = d.secondaryUnit;
  if (d.lotNumber != null) updateData.lotNumber = d.lotNumber;
  if (d.rackLocation != null) updateData.rackLocation = d.rackLocation;
  if (d.imageUrl !== undefined) updateData.imageUrl = d.imageUrl;
  if (d.description !== undefined) updateData.description = d.description;
  if (d.costPricePerKg != null) updateData.costPricePerKg = String(d.costPricePerKg);
  if (d.costPricePerKrat != null) updateData.costPricePerKrat = String(d.costPricePerKrat);
  if (d.pricePerKg != null) updateData.pricePerKg = String(d.pricePerKg);
  if (d.pricePerKrat != null) updateData.pricePerKrat = String(d.pricePerKrat);
  if (d.minStock != null) updateData.minStock = String(d.minStock);
  if (d.kratStock != null) updateData.kratStock = String(d.kratStock);
  if (d.kgStock != null) updateData.kgStock = String(d.kgStock);
  const [prod] = await db.update(productsTable).set(updateData as any).where(eq(productsTable.id, id)).returning();
  if (!prod) { res.status(404).json({ error: "Not found" }); return; }
  
  // Sync krats
  const kratStockNum = Math.floor(parseFloat(prod.kratStock ?? "0"));
  const kgStockNum = parseFloat(prod.kgStock ?? "0");
  if (kratStockNum >= 0) {
    const existingKrats = await db.select().from(productBatchesTable).where(eq(productBatchesTable.productId, id));
    const currentKratCount = existingKrats.length;
    
    if (kratStockNum > currentKratCount) {
      const diff = kratStockNum - currentKratCount;
      const avgLength = kratStockNum > 0 ? (kgStockNum / kratStockNum) : 0;
      const updateKratLengths = d.batchWeights;
      const kratsToInsert = Array.from({ length: diff }).map((_, i) => {
        // i offset by currentKratCount so batchWeights index aligns with new krats
        const offsetIdx = currentKratCount + i;
        const lengthToUse = (updateKratLengths && updateKratLengths[offsetIdx] != null && updateKratLengths[offsetIdx] > 0)
          ? updateKratLengths[offsetIdx]
          : avgLength;
        return {
          productId: prod.id,
          barcode: `${prod.barcode || `PRD-${prod.id}`}-R${Date.now()}-${i + 1}`,
          originalWeight: String(lengthToUse),
          currentWeight: String(lengthToUse),
          status: "available",
        };
      });
      if (kratsToInsert.length > 0) {
        await db.insert(productBatchesTable).values(kratsToInsert);
      }
    } else if (kratStockNum < currentKratCount) {
      const diff = currentKratCount - kratStockNum;
      const availableKrats = existingKrats.filter(r => r.status === "available").sort((a, b) => b.id - a.id);
      const kratsToDelete = availableKrats.slice(0, diff).map(r => r.id);
      if (kratsToDelete.length > 0) {
        await db.delete(productBatchesTable).where(inArray(productBatchesTable.id, kratsToDelete));
      }
    }
  }

  try {
    await pushService.sendNotificationToAdmins(
      "📝 Perubahan Data Barang",
      `Data barang "${prod.name}" baru saja diubah.`,
      `/barang`
    );
  } catch (err) {
    console.error("Failed to send push notification:", err);
  }

  res.json({
    ...prod,
    costPricePerKg: parseFloat(prod.costPricePerKg ?? "0"),
    costPricePerKrat: prod.costPricePerKrat ? parseFloat(prod.costPricePerKrat) : null,
    pricePerKg: parseFloat(prod.pricePerKg ?? "0"),
    pricePerKrat: prod.pricePerKrat ? parseFloat(prod.pricePerKrat) : null,
    kratStock: parseFloat(prod.kratStock ?? "0"),
    kgStock: parseFloat(prod.kgStock ?? "0"),
    minStock: parseFloat(prod.minStock ?? "0"),
    isLowStock: parseFloat(prod.kratStock ?? "0") <= parseFloat(prod.minStock ?? "0"),
    categoryName: null,
  });
});

router.delete("/products/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(productsTable).where(eq(productsTable.id, id));
    res.status(204).send();
  } catch (error: any) {
    res.status(400).json({ error: "Gagal menghapus barang. Pastikan barang tidak memiliki riwayat transaksi/mutasi." });
  }
});

router.post("/products/:id/krats", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const parsed = CreateProductBatchBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const d = parsed.data;
  
  const [prod] = await db.select().from(productsTable).where(eq(productsTable.id, id));
  if (!prod) { res.status(404).json({ error: "Product not found" }); return; }

  const barcodeToSave = d.barcode ? d.barcode : `${prod.barcode || `PRD-${prod.id}`}-R${Date.now()}`;
  const [newKrat] = await db.insert(productBatchesTable).values({
    productId: id,
    barcode: barcodeToSave,
    originalWeight: String(d.originalWeight),
    currentWeight: String(d.currentWeight),
    status: "available",
  }).returning();
  
  await syncProductStockFromKrats(id);
  
  res.status(201).json({
    ...newKrat,
    originalWeight: parseFloat(newKrat.originalWeight),
    currentWeight: parseFloat(newKrat.currentWeight),
    createdAt: newKrat.createdAt.toISOString()
  });
});

router.patch("/products/:id/krats/:batchId", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const batchId = parseInt(req.params.batchId);
  const parsed = UpdateProductBatchBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const d = parsed.data;

  const updateData: Record<string, unknown> = { updatedAt: new Date() };
  if (d.barcode != null) updateData.barcode = d.barcode;
  if (d.originalWeight != null) updateData.originalWeight = String(d.originalWeight);
  if (d.currentWeight != null) updateData.currentWeight = String(d.currentWeight);

  const [updatedKrat] = await db.update(productBatchesTable).set(updateData as any).where(and(eq(productBatchesTable.id, batchId), eq(productBatchesTable.productId, id))).returning();
  if (!updatedKrat) { res.status(404).json({ error: "Krat not found" }); return; }

  await syncProductStockFromKrats(id);
  await syncPurchaseItemForSpecificKrat(id, batchId);

  res.json({
    ...updatedKrat,
    originalWeight: parseFloat(updatedKrat.originalWeight),
    currentWeight: parseFloat(updatedKrat.currentWeight),
    createdAt: updatedKrat.createdAt.toISOString()
  });
});

router.delete("/products/:id/krats/:batchId", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const batchId = parseInt(req.params.batchId);

  try {
    // Find the purchase item this krat belongs to before nullifying its batchId
    const purchaseItems = await db.select().from(purchaseItemsTable).where(eq(purchaseItemsTable.productId, id));
    let targetPurchaseItemId = null;
    let originalKratCountForTarget = 0;
    for (const item of purchaseItems) {
      if (!item.batchId) continue;
      const startKratId = item.batchId as number;
      let count = Number(item.krats) || 0;
      if (item.batchWeightsJson) {
        try {
          const parsed = JSON.parse(item.batchWeightsJson);
          if (Array.isArray(parsed) && parsed.length > count) count = parsed.length;
        } catch(e){}
      }
      if (batchId >= startKratId && batchId < startKratId + count) {
        targetPurchaseItemId = item.id;
        originalKratCountForTarget = count;
        break;
      }
    }

    // Nullify batchId references in sale_items and purchase_items to avoid FK constraint
    await db.update(saleItemsTable).set({ batchId: null }).where(eq(saleItemsTable.batchId, batchId));
    // Soft nullify in purchaseItems by doing nothing, wait, if we nullify it, we can't find the range again.
    // Actually, purchaseItemsTable.batchId CAN be nullified because we already stored targetPurchaseItemId.
    await db.update(purchaseItemsTable).set({ batchId: null }).where(eq(purchaseItemsTable.batchId, batchId));

    await db.delete(productBatchesTable).where(and(eq(productBatchesTable.id, batchId), eq(productBatchesTable.productId, id)));

    await syncProductStockFromKrats(id);
    
    if (targetPurchaseItemId) {
      // Re-fetch the item because its batchId might have been nullified
      const [tItem] = await db.select().from(purchaseItemsTable).where(eq(purchaseItemsTable.id, targetPurchaseItemId));
      if (tItem) {
        // If its batchId was just nullified, we use the deleted batchId as the start
        const startKratId = (tItem.batchId as number) || batchId;
        const batchIds = Array.from({ length: originalKratCountForTarget }, (_, i) => startKratId + i);
        const existingKrats = await db.select().from(productBatchesTable).where(inArray(productBatchesTable.id, batchIds));
        const batchWeights: number[] = [];
        for (const rid of batchIds) {
          const r = existingKrats.find(x => x.id === rid);
          if (r) batchWeights.push(parseFloat(r.currentWeight));
        }
        const newKgs = batchWeights.reduce((a,b) => a + b, 0);
        const newKrats = batchWeights.length;
        const pricePerKg = parseFloat(tItem.pricePerKg || "0");
        const newSubtotal = Math.round(newKgs * pricePerKg);
        await db.update(purchaseItemsTable).set({
          batchWeightsJson: JSON.stringify(batchWeights),
          kgs: String(newKgs),
          krats: String(newKrats),
          subtotal: String(newSubtotal)
        } as any).where(eq(purchaseItemsTable.id, tItem.id));
        await syncPurchaseTotals(tItem.purchaseId, true);
      }
    }

    res.status(204).send();
  } catch (err: any) {
    console.error("Error deleting krat:", err);
    res.status(500).json({ error: err.message || "Gagal menghapus krat" });
  }
});

export default router;
