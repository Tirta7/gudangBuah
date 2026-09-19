import { Router } from "express";
import { db } from "@workspace/db";
import { purchasesTable, purchaseItemsTable, suppliersTable, productsTable, categoriesTable, payablesTable, paymentsTable, stockMutationsTable, productBatchesTable, saleItemsTable } from "@workspace/db";
import { eq, and, gte, lte, sql, desc, inArray } from "drizzle-orm";
import { CreatePurchaseBody } from "@workspace/api-zod";
import { broadcastRefresh } from "../lib/websocket";
import * as XLSX from "xlsx";

const router = Router();

function numStr(v: string | null | undefined) { return parseFloat(v ?? "0"); }

// ─── GET /purchases/export ─────────────────────────────────────────────────────
router.get("/purchases/export", async (req, res): Promise<void> => {
  try {
    const { startDate, endDate } = req.query;
    const conditions: any[] = [];
    if (startDate) conditions.push(gte(purchasesTable.createdAt, new Date(startDate as string)));
    if (endDate) {
      const endDt = new Date(endDate as string);
      endDt.setHours(23, 59, 59, 999);
      conditions.push(lte(purchasesTable.createdAt, endDt));
    }

    const purchases = await db
      .select({
        id: purchasesTable.id,
        invoiceNumber: purchasesTable.invoiceNumber,
        supplierId: purchasesTable.supplierId,
        supplierName: suppliersTable.name,
        paymentType: purchasesTable.paymentType,
        totalAmount: purchasesTable.totalAmount,
        paidAmount: purchasesTable.paidAmount,
        status: purchasesTable.status,
        dueDate: purchasesTable.dueDate,
        notes: purchasesTable.notes,
        createdAt: purchasesTable.createdAt,
      })
      .from(purchasesTable)
      .leftJoin(suppliersTable, eq(purchasesTable.supplierId, suppliersTable.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(purchasesTable.createdAt));

    const purchaseIds = purchases.map(p => p.id);
    let itemsData: any[] = [];
    if (purchaseIds.length > 0) {
      itemsData = await db
        .select({
          purchaseId: purchaseItemsTable.purchaseId,
          productName: productsTable.name,
          categoryName: categoriesTable.name,
          barcode: productsTable.barcode,
          krats: purchaseItemsTable.krats,
          kgs: purchaseItemsTable.kgs,
          pricePerKg: purchaseItemsTable.pricePerKg,
          subtotal: purchaseItemsTable.subtotal,
          batchWeightsJson: purchaseItemsTable.batchWeightsJson,
        })
        .from(purchaseItemsTable)
        .leftJoin(productsTable, eq(purchaseItemsTable.productId, productsTable.id))
        .leftJoin(categoriesTable, eq(productsTable.categoryId, categoriesTable.id))
        .where(inArray(purchaseItemsTable.purchaseId, purchaseIds));
    }

    const itemsByPurchaseId = new Map<number, any[]>();
    for (const item of itemsData) {
      if (!itemsByPurchaseId.has(item.purchaseId)) itemsByPurchaseId.set(item.purchaseId, []);
      itemsByPurchaseId.get(item.purchaseId)!.push(item);
    }

    // Calculate max krats for dynamic columns
    let maxKrats = 0;
    for (const item of itemsData) {
      if (item.batchWeightsJson) {
        const krats = JSON.parse(item.batchWeightsJson) as number[];
        if (krats.length > maxKrats) maxKrats = krats.length;
      }
    }

    const rows: any[] = [];
    let rowNo = 1;

    for (const p of purchases) {
      const items = itemsByPurchaseId.get(p.id) || [];
      const totalAmt = parseFloat(p.totalAmount as string) || 0;
      const paidAmt = parseFloat(p.paidAmount as string) || 0;
      const remaining = totalAmt - paidAmt;
      const tanggal = p.createdAt
        ? new Date(p.createdAt).toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit", year: "numeric" })
        : "";

      if (items.length === 0) {
        const row: any = {
          "No": rowNo++, "Tanggal": tanggal,
          "Barcode": "", "Kategori": "", "Produk / Barang": "",
          "Krat": 0, "Kg/Yard": 0
        };
        for (let i = 1; i <= maxKrats; i++) row[`Krat ${i}`] = "";
        row["Harga / Kg"] = 0;
        row["Subtotal"] = 0;
        row["Total Nota"] = totalAmt;
        row["Sudah Dibayar"] = paidAmt;
        row["Sisa Bayar"] = remaining > 0 ? remaining : 0;
        row["Metode Bayar"] = p.paymentType;
        row["Status"] = p.status;
        row["Catatan"] = p.notes || "";
        rows.push(row);
      } else {
        items.forEach((item, idx) => {
          const row: any = {
            "No": idx === 0 ? rowNo++ : "",
            "Tanggal": idx === 0 ? tanggal : "",
            "No Invoice": idx === 0 ? p.invoiceNumber : "",
            "Supplier": idx === 0 ? (p.supplierName || "") : "",
            "Barcode": item.barcode || "",
            "Kategori": item.categoryName || "",
            "Produk / Barang": item.productName || "",
            "Krat": parseFloat(item.krats) || 0,
            "Kg/Yard": parseFloat(item.kgs) || 0,
          };
          
          let batchWeights: number[] = [];
          if (item.batchWeightsJson) {
            batchWeights = JSON.parse(item.batchWeightsJson) as number[];
          }
          for (let i = 1; i <= maxKrats; i++) {
            row[`Krat ${i}`] = batchWeights[i - 1] !== undefined ? batchWeights[i - 1] : "";
          }

          row["Harga / Kg"] = parseFloat(item.pricePerKg) || 0;
          row["Subtotal"] = parseFloat(item.subtotal) || 0;
          row["Total Nota"] = idx === 0 ? totalAmt : "";
          row["Sudah Dibayar"] = idx === 0 ? paidAmt : "";
          row["Sisa Bayar"] = idx === 0 ? (remaining > 0 ? remaining : 0) : "";
          row["Metode Bayar"] = idx === 0 ? p.paymentType : "";
          row["Status"] = idx === 0 ? p.status : "";
          row["Catatan"] = idx === 0 ? (p.notes || "") : "";
          
          rows.push(row);
        });
      }
    }

    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [
      { wch: 5 }, { wch: 14 }, { wch: 24 }, { wch: 22 }, { wch: 24 }, { wch: 20 }, { wch: 24 },
      { wch: 8 }, { wch: 12 }, { wch: 40 }, { wch: 16 }, { wch: 18 }, { wch: 18 },
      { wch: 18 }, { wch: 18 }, { wch: 14 }, { wch: 12 }, { wch: 24 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Pembelian");

    const fromLabel = startDate ? (startDate as string).replace(/-/g, "") : "all";
    const toLabel = endDate ? (endDate as string).replace(/-/g, "") : "all";
    const filename = `Pembelian_${fromLabel}_sd_${toLabel}.xlsx`;
    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.send(buffer);
  } catch (err: any) {
    console.error("Export purchases error:", err);
    res.status(500).json({ error: err.message || "Export gagal" });
  }
});

// ─── POST /purchases/import ────────────────────────────────────────────────────
router.post("/purchases/import", async (req, res): Promise<void> => {
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
    
    // Cari sheet yang tepat (prioritaskan yang namanya mengandung "Pembelian")
    let ws = wb.Sheets[wb.SheetNames[0]];
    for (const name of wb.SheetNames) {
      if (name.toLowerCase().includes("pembelian")) {
        ws = wb.Sheets[name];
        break;
      }
    }
    
    let rawRows: any[] = XLSX.utils.sheet_to_json(ws, { defval: "" });

    // Jika tidak ada kolom "No Invoice" di sheet ini, coba cari di sheet lain
    if (rawRows.length > 0 && !Object.keys(rawRows[0]).some(k => k.toLowerCase().includes("invoice"))) {
      for (const name of wb.SheetNames) {
        const tempWs = wb.Sheets[name];
        const tempRows: any[] = XLSX.utils.sheet_to_json(tempWs, { defval: "" });
        if (tempRows.length > 0 && Object.keys(tempRows[0]).some(k => k.toLowerCase().includes("invoice"))) {
          ws = tempWs;
          rawRows = tempRows;
          break;
        }
      }
    }

    if (rawRows.length === 0) {
      res.json({ success: 0, failed: 0, skipped: 0, total: 0, details: [] }); return;
    }

    const allProducts = await db.select({ id: productsTable.id, name: productsTable.name, barcode: productsTable.barcode }).from(productsTable);
    const allSuppliers = await db.select({ id: suppliersTable.id, name: suppliersTable.name }).from(suppliersTable);

    const findProduct = (name: string) => {
      const n = name?.trim().toLowerCase();
      return allProducts.find(p => p.name.toLowerCase() === n);
    };
    const findSupplier = (name: string) => {
      const n = name?.trim().toLowerCase();
      return allSuppliers.find(s => s.name.toLowerCase() === n);
    };

    // Group rows by invoice number + supplier (carry over if blank)
    const invoiceMap = new Map<string, any[]>();
    let currentInvKey = "";
    
    for (const row of rawRows) {
      const inv = String(row["No Invoice"] || "").trim();
      const sup = String(row["Supplier"] || "").trim();
      
      if (inv) {
        currentInvKey = `${inv}___${sup}`;
        // Store original inv in the row if we want to use it later, but we can also just rely on the first row
        row["_ParsedInvoice"] = inv;
      }
      
      if (!currentInvKey) continue;
      
      // Jika baris ini memiliki invoice kosong, salin Supplier dan Tanggal dari currentInvKey agar tidak hilang
      if (!inv) {
        if (!row["Supplier"]) {
           const parentRows = invoiceMap.get(currentInvKey);
           if (parentRows && parentRows.length > 0) row["Supplier"] = parentRows[0]["Supplier"];
        }
        if (!row["Tanggal"]) {
           const parentRows = invoiceMap.get(currentInvKey);
           if (parentRows && parentRows.length > 0) row["Tanggal"] = parentRows[0]["Tanggal"];
        }
      }
      
      if (!invoiceMap.has(currentInvKey)) invoiceMap.set(currentInvKey, []);
      invoiceMap.get(currentInvKey)!.push(row);
    }

    const results: { invoice: string; status: "ok" | "skip" | "error"; message: string }[] = [];
    let successCount = 0;

    for (const [invKey, rows] of invoiceMap) {
      const firstRow = rows[0];
      const invoiceNumber = firstRow["_ParsedInvoice"] || String(firstRow["No Invoice"] || "").trim();
      try {
        // ── Parse common data from Excel rows ──
        const supplierName = String(firstRow["Supplier"] || "").trim();
        const paymentType = String(firstRow["Metode Bayar"] || "tunai").trim().toLowerCase();
        const notes = String(firstRow["Catatan"] || "").trim();
        const tanggalStr = String(firstRow["Tanggal"] || "").trim();

        let createdAt: Date | undefined;
        if (tanggalStr) {
          const parts = tanggalStr.includes("/") ? tanggalStr.split("/") : tanggalStr.split("-");
          if (parts.length === 3) {
            createdAt = tanggalStr.includes("/")
              ? new Date(`${parts[2]}-${parts[1].padStart(2,"0")}-${parts[0].padStart(2,"0")}`)
              : new Date(tanggalStr);
          }
        }

        if (!supplierName) {
          results.push({ invoice: invoiceNumber, status: "error", message: "Kolom Supplier kosong" }); continue;
        }
        const supplier = findSupplier(supplierName);
        if (!supplier) {
          results.push({ invoice: invoiceNumber, status: "error", message: `Supplier "${supplierName}" tidak ditemukan` }); continue;
        }

        const existingList = await db.select({ id: purchasesTable.id }).from(purchasesTable)
          .where(and(
             eq(purchasesTable.invoiceNumber, invoiceNumber),
             eq(purchasesTable.supplierId, supplier.id)
          ));

        // Parse items
        const items: { productId: number; krats: number; kgs: number; pricePerKg: number; subtotal: number; batchWeights: number[] }[] = [];
        const itemErrors: string[] = [];
        for (const row of rows) {
          const prodName = String(row["Produk / Barang"] || "").trim();
          if (!prodName) continue;
          const prod = findProduct(prodName);
          if (!prod) { itemErrors.push(`Produk "${prodName}" tidak ditemukan`); continue; }
          const kratsCount = parseFloat(String(row["Krat"]).replace(",", ".")) || 0;
          const kgs = parseFloat(String(row["Kg/Yard"]).replace(",", ".")) || 0;
          const pricePerKg = parseFloat(String(row["Harga / Kg"]).replace(",", ".")) || 0;
          const subtotal = parseFloat(String(row["Subtotal"]).replace(",", ".")) || Math.round(kgs * pricePerKg);
          const batchWeights: number[] = [];
          for (const key of Object.keys(row)) {
            if (key.startsWith("Krat ") && key !== "Krat") {
              const val = parseFloat(String(row[key]).replace(",", "."));
              if (!isNaN(val) && val > 0) {
                const kratIndex = parseInt(key.replace("Krat ", "").trim(), 10);
                if (!isNaN(kratIndex) && kratIndex > 0) batchWeights[kratIndex - 1] = val;
              }
            }
          }
          items.push({ productId: prod.id, krats: kratsCount, kgs, pricePerKg, subtotal, batchWeights: batchWeights.filter(r => r !== undefined) });
        }
        if (itemErrors.length > 0) { results.push({ invoice: invoiceNumber, status: "error", message: itemErrors.join("; ") }); continue; }
        if (items.length === 0) { results.push({ invoice: invoiceNumber, status: "skip", message: "Tidak ada item barang valid" }); continue; }

        const totalAmount = items.reduce((s, i) => s + i.subtotal, 0);
        const isKredit = paymentType === "kredit" || paymentType === "tempo";
        const paidAmount = isKredit ? 0 : totalAmount;
        const status = paidAmount >= totalAmount ? "lunas" : paidAmount > 0 ? "partial" : "tempo";

        let purchaseId: number;

        if (existingList.length > 0) {
          // SKIP existing invoice to prevent stock destruction and FK errors
          results.push({ invoice: invoiceNumber, status: "skip", message: "Invoice sudah ada, dilewati agar riwayat stok tidak rusak" });
          continue;
        } else {
          // ── INSERT: new invoice ──
          const [newPurchase] = await db.insert(purchasesTable).values({
            invoiceNumber, supplierId: supplier.id, paymentType,
            totalAmount: totalAmount.toString(), paidAmount: paidAmount.toString(),
            status, notes: notes || null,
            ...(createdAt && !isNaN(createdAt.getTime()) ? { createdAt } : {}),
          } as any).returning();
          purchaseId = newPurchase.id;
        }

        // ── Insert items + krats (same for both insert and upsert) ──
        for (const item of items) {
          const avgLength = item.krats > 0 ? item.kgs / item.krats : 0;
          const [prod] = await db.select().from(productsTable).where(eq(productsTable.id, item.productId));
          const baseBarcode = prod?.barcode || `PRD-${item.productId}`;
          let insertedKratId: number | null = null;
          
          const batchWeightsToUse = item.batchWeights || [];
          const ts = Date.now();

          for (let i = 0; i < item.krats; i++) {
            const barcodeToSave = `${baseBarcode}-R${ts}-${i}-${Math.floor(Math.random() * 9999)}`;
            const lengthToUse = batchWeightsToUse[i] !== undefined ? batchWeightsToUse[i] : avgLength;
            const [krat] = await db.insert(productBatchesTable).values({
              productId: item.productId, barcode: barcodeToSave,
              originalWeight: lengthToUse.toString(), currentWeight: lengthToUse.toString(), status: "available",
            }).returning();
            if (i === 0) insertedKratId = krat.id;
          }

          await db.insert(purchaseItemsTable).values({
            purchaseId: purchaseId, productId: item.productId,
            batchId: insertedKratId, krats: item.krats.toString(),
            kgs: item.kgs.toString(), pricePerKg: item.pricePerKg.toString(),
            subtotal: item.subtotal.toString(),
            batchWeightsJson: item.batchWeights && item.batchWeights.length > 0 ? JSON.stringify(item.batchWeights) : null,
          } as any);

          // Sync stock
          const krats = await db.select().from(productBatchesTable)
            .where(and(eq(productBatchesTable.productId, item.productId), eq(productBatchesTable.status, "available")));
          const newKratStock = krats.length;
          const newKgStock = krats.reduce((s, r) => s + parseFloat(r.currentWeight), 0);
          await db.execute(sql`UPDATE ${productsTable} SET krat_stock=${newKratStock}, kg_stock=${newKgStock}, updated_at=NOW() WHERE id=${item.productId}`);

          await db.insert(stockMutationsTable).values({
            productId: item.productId, type: "masuk",
            krats: item.krats.toString(), kgs: item.kgs.toString(),
            description: `Import Pembelian ${invoiceNumber}`, reference: invoiceNumber,
          });
        }

        if (status !== "lunas") {
          await db.insert(payablesTable).values({
            purchaseId: purchaseId, supplierId: supplier.id,
            totalAmount: totalAmount.toString(), paidAmount: paidAmount.toString(),
            status: status === "partial" ? "partial" : "unpaid",
          });
        }

        successCount++;
        results.push({ invoice: invoiceNumber, status: "ok", message: `${items.length} item berhasil diproses` });
      } catch (err: any) {
        results.push({ invoice: invoiceNumber, status: "error", message: err.message || "Error tidak diketahui" });
      }
    }

    broadcastRefresh();
    res.json({
      success: successCount,
      failed: results.filter(r => r.status === "error").length,
      skipped: results.filter(r => r.status === "skip").length,
      total: invoiceMap.size,
      details: results,
    });
  } catch (err: any) {
    console.error("Import purchases error:", err);
    res.status(500).json({ error: err.message || "Import gagal" });
  }
});


router.get("/purchases", async (req, res) => {
  const { supplierId, startDate, endDate } = req.query;
  const conditions: any[] = [];
  if (supplierId) conditions.push(eq(purchasesTable.supplierId, parseInt(supplierId as string)));
  if (startDate) conditions.push(gte(purchasesTable.createdAt, new Date(startDate as string)));
  if (endDate) conditions.push(lte(purchasesTable.createdAt, new Date(endDate as string)));

  const purchases = await db
    .select({
      id: purchasesTable.id,
      invoiceNumber: purchasesTable.invoiceNumber,
      supplierId: purchasesTable.supplierId,
      supplierName: suppliersTable.name,
      paymentType: purchasesTable.paymentType,
      totalAmount: purchasesTable.totalAmount,
      paidAmount: purchasesTable.paidAmount,
      status: purchasesTable.status,
      dueDate: purchasesTable.dueDate,
      notes: purchasesTable.notes,
      createdAt: purchasesTable.createdAt,
    })
    .from(purchasesTable)
    .leftJoin(suppliersTable, eq(purchasesTable.supplierId, suppliersTable.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(purchasesTable.createdAt));

  res.json(purchases.map(p => ({
    ...p,
    totalAmount: numStr(p.totalAmount),
    paidAmount: numStr(p.paidAmount),
    remainingAmount: numStr(p.totalAmount) - numStr(p.paidAmount),
    dueDate: p.dueDate?.toISOString() ?? null,
    createdAt: p.createdAt.toISOString(),
  })));
});

router.post("/purchases", async (req, res): Promise<void> => {
  const parsed = CreatePurchaseBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { supplierId, paymentType, dueDate, notes, items } = parsed.data;
  const totalAmount = items.reduce((sum, i) => sum + (i.subtotal ?? 0), 0);
  const paidAmount = (paymentType !== "kredit" && paymentType !== "tempo") ? totalAmount : 0;
  const status = paidAmount >= totalAmount ? "lunas" : paidAmount > 0 ? "partial" : "tempo";

  const invoiceNumber = parsed.data.invoiceNumber || `PO-${Date.now()}`;

  // ── Cek duplikat nomor nota ──
  if (parsed.data.invoiceNumber) {
    const [dup] = await db.select({ id: purchasesTable.id })
      .from(purchasesTable)
      .where(eq(purchasesTable.invoiceNumber, invoiceNumber));
    if (dup) {
      res.status(409).json({ error: `Nomor nota "${invoiceNumber}" sudah ada. Gunakan nomor nota yang berbeda.` });
      return;
    }
  }

  const [purchase] = await db.insert(purchasesTable).values({
    invoiceNumber,
    supplierId,
    paymentType,
    totalAmount: totalAmount.toString(),
    paidAmount: paidAmount.toString(),
    status,
    dueDate: dueDate ? new Date(dueDate) : null,
    notes: notes ?? null,
  }).returning();

  for (const item of items) {
    const kratCount = Number(item.krats) || 0;
    const totalKgs = Number(item.kgs) || 0;
    
    // Auto-generate krats if krat count > 0
    let insertedKratId: number | null = null;
    
    if (kratCount > 0) {
      const avgLength = totalKgs / kratCount;
      const [prod] = await db.select().from(productsTable).where(eq(productsTable.id, item.productId));
      const baseBarcode = prod?.barcode || `PRD-${item.productId}`;
      
      for (let i = 0; i < kratCount; i++) {
        // Auto-generate barcode unik untuk setiap krat (hindari constraint violation)
        const barcodeToSave = `${baseBarcode}-R${Date.now()}-${i}-${Math.floor(Math.random() * 9999)}`;
        
        // @ts-ignore - batchWeights exists on our updated schema
        const lengthToUse = (item.batchWeights && item.batchWeights[i]) ? item.batchWeights[i] : avgLength;
        
        const [krat] = await db.insert(productBatchesTable).values({
          productId: item.productId,
          barcode: barcodeToSave,
          originalWeight: lengthToUse.toString(),
          currentWeight: lengthToUse.toString(),
          status: "available",
        }).returning();
        
        if (i === 0) insertedKratId = krat.id;
      }
    }

    await db.insert(purchaseItemsTable).values({
      purchaseId: purchase.id,
      productId: item.productId,
      batchId: insertedKratId,
      krats: item.krats.toString(),
      kgs: item.kgs.toString(),
      pricePerKg: item.pricePerKg.toString(),
      subtotal: item.subtotal.toString(),
      // Simpan panjang tiap krat sebagai JSON agar bisa dipulihkan saat restore
      batchWeightsJson: (item.batchWeights && item.batchWeights.length > 0)
        ? JSON.stringify(item.batchWeights.map((l: any) => parseFloat(String(l).replace(',', '.')) || 0))
        : null,
    } as any);
    
    // Sync the product's kg_stock and krat_stock based on the productBatchesTable
    const krats = await db.select().from(productBatchesTable).where(and(eq(productBatchesTable.productId, item.productId), eq(productBatchesTable.status, "available")));
    const calculatedKratStock = krats.length;
    const calculatedKgStock = krats.reduce((sum, r) => sum + parseFloat(r.currentWeight), 0);

    await db.execute(sql`
      UPDATE ${productsTable} 
      SET krat_stock = ${calculatedKratStock}, kg_stock = ${calculatedKgStock}, updated_at = NOW()
      WHERE id = ${item.productId}
    `);
    
    await db.insert(stockMutationsTable).values({
      productId: item.productId,
      type: "masuk",
      krats: item.krats.toString(),
      kgs: item.kgs.toString(),
      description: `Pembelian ${invoiceNumber}`,
      reference: invoiceNumber,
    });
  }

  if (status !== "lunas") {
    await db.insert(payablesTable).values({
      purchaseId: purchase.id,
      supplierId,
      totalAmount: totalAmount.toString(),
      paidAmount: paidAmount.toString(),
      status: status === "partial" ? "partial" : "unpaid",
      dueDate: dueDate ? new Date(dueDate) : null,
    });
  }

  broadcastRefresh();
  res.status(201).json({
    ...purchase,
    totalAmount: numStr(purchase.totalAmount),
    paidAmount: numStr(purchase.paidAmount),
    remainingAmount: numStr(purchase.totalAmount) - numStr(purchase.paidAmount),
    dueDate: purchase.dueDate?.toISOString() ?? null,
    createdAt: purchase.createdAt.toISOString(),
    supplierName: null,
  });
});

// ────────── GET by invoice number (for restore cancelled purchase) ──────────
// MUST be registered BEFORE /purchases/:id to avoid Express matching "by-invoice" as an id
router.get("/purchases/by-invoice", async (req, res): Promise<void> => {
  const invoiceNumber = req.query.invoice as string;
  const [purchase] = await db
    .select({
      id: purchasesTable.id,
      invoiceNumber: purchasesTable.invoiceNumber,
      supplierId: purchasesTable.supplierId,
      supplierName: suppliersTable.name,
      paymentType: purchasesTable.paymentType,
      totalAmount: purchasesTable.totalAmount,
      paidAmount: purchasesTable.paidAmount,
      status: purchasesTable.status,
      dueDate: purchasesTable.dueDate,
      notes: purchasesTable.notes,
      createdAt: purchasesTable.createdAt,
    })
    .from(purchasesTable)
    .leftJoin(suppliersTable, eq(purchasesTable.supplierId, suppliersTable.id))
    .where(eq(purchasesTable.invoiceNumber, invoiceNumber));

  if (!purchase) { res.status(404).json({ error: "Not found" }); return; }

  const items = await db
    .select({
      productId: purchaseItemsTable.productId,
      productName: productsTable.name,
      categoryId: productsTable.categoryId,
      batchId: purchaseItemsTable.batchId,
      batchWeightsJson: purchaseItemsTable.batchWeightsJson,
      krats: purchaseItemsTable.krats,
      kgs: purchaseItemsTable.kgs,
      pricePerKg: purchaseItemsTable.pricePerKg,
      subtotal: purchaseItemsTable.subtotal,
      primaryUnit: productsTable.primaryUnit,
      secondaryUnit: productsTable.secondaryUnit,
      barcode: productsTable.barcode,
    })
    .from(purchaseItemsTable)
    .leftJoin(productsTable, eq(purchaseItemsTable.productId, productsTable.id))
    .where(eq(purchaseItemsTable.purchaseId, purchase.id));

  const itemsWithKrats = await Promise.all(items.map(async (i) => {
    const kratCount = Number(i.krats) || 0;
    let batchWeights: number[] = [];

    if (kratCount > 0) {
      // Priority 1: gunakan batchWeightsJson yang tersimpan saat pembelian dibuat
      if (i.batchWeightsJson) {
        try {
          const parsed = JSON.parse(i.batchWeightsJson);
          if (Array.isArray(parsed) && parsed.length > 0) {
            batchWeights = parsed.map(Number);
          }
        } catch {}
      }

      // Priority 2: coba ambil dari productBatchesTable jika batchId masih ada
      if (batchWeights.length === 0 && i.batchId) {
        const batchIds = Array.from({ length: kratCount }, (_, idx) => (i.batchId as number) + idx);
        const krats = await db
          .select({ id: productBatchesTable.id, length: productBatchesTable.originalWeight })
          .from(productBatchesTable)
          .where(inArray(productBatchesTable.id, batchIds));
        if (krats.length > 0) {
          batchWeights = krats.map(r => parseFloat(r.length));
        }
      }

      // Priority 3: fallback ke rata-rata
      if (batchWeights.length === 0) {
        const avg = Number(i.kgs) / kratCount;
        batchWeights = Array.from({ length: kratCount }, () => parseFloat(avg.toFixed(3)));
      }
    }
    return { ...i, batchWeights };
  }));

  res.json({
    ...purchase,
    totalAmount: numStr(purchase.totalAmount),
    paidAmount: numStr(purchase.paidAmount),
    remainingAmount: numStr(purchase.totalAmount) - numStr(purchase.paidAmount),
    dueDate: purchase.dueDate?.toISOString() ?? null,
    createdAt: purchase.createdAt.toISOString(),
    items: itemsWithKrats.map(i => ({
      ...i,
      batchId: i.batchId,
      krats: numStr(i.krats),
      kgs: numStr(i.kgs),
      pricePerKg: numStr(i.pricePerKg),
      subtotal: numStr(i.subtotal),
      batchWeights: i.batchWeights,
    })),
  });
});

router.get("/purchases/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const [purchase] = await db
    .select({
      id: purchasesTable.id,
      invoiceNumber: purchasesTable.invoiceNumber,
      supplierId: purchasesTable.supplierId,
      supplierName: suppliersTable.name,
      paymentType: purchasesTable.paymentType,
      totalAmount: purchasesTable.totalAmount,
      paidAmount: purchasesTable.paidAmount,
      status: purchasesTable.status,
      dueDate: purchasesTable.dueDate,
      notes: purchasesTable.notes,
      createdAt: purchasesTable.createdAt,
    })
    .from(purchasesTable)
    .leftJoin(suppliersTable, eq(purchasesTable.supplierId, suppliersTable.id))
    .where(eq(purchasesTable.id, id));

  if (!purchase) { res.status(404).json({ error: "Not found" }); return; }

  const items = await db
    .select({
      productId: purchaseItemsTable.productId,
      productName: productsTable.name,
      categoryId: productsTable.categoryId,
      categoryName: categoriesTable.name,
      batchId: purchaseItemsTable.batchId,
      krats: purchaseItemsTable.krats,
      kgs: purchaseItemsTable.kgs,
      pricePerKg: purchaseItemsTable.pricePerKg,
      subtotal: purchaseItemsTable.subtotal,
      batchWeightsJson: purchaseItemsTable.batchWeightsJson,
    })
    .from(purchaseItemsTable)
    .leftJoin(productsTable, eq(purchaseItemsTable.productId, productsTable.id))
    .leftJoin(categoriesTable, eq(productsTable.categoryId, categoriesTable.id))
    .where(eq(purchaseItemsTable.purchaseId, id));

  const itemsWithKrats = await Promise.all(items.map(async (i) => {
    const kratCount = Number(i.krats) || 0;
    let batchWeights: number[] = [];
    
    // Prioritaskan dari snapshot JSON (karena ini tetap ada meski krat dihapus/cancelled)
    if (i.batchWeightsJson) {
      try {
        batchWeights = JSON.parse(i.batchWeightsJson);
      } catch (e) {}
    } 
    // Fallback query ke productBatchesTable untuk data lama yang belum punya JSON
    else if (kratCount > 0 && i.batchId) {
      const batchIds = Array.from({ length: kratCount }, (_, idx) => (i.batchId as number) + idx);
      const krats = await db.select({ length: productBatchesTable.originalWeight }).from(productBatchesTable).where(inArray(productBatchesTable.id, batchIds));
      batchWeights = krats.map(r => parseFloat(r.length));
    }
    return { ...i, batchWeights };
  }));

  res.json({
    ...purchase,
    totalAmount: numStr(purchase.totalAmount),
    paidAmount: numStr(purchase.paidAmount),
    remainingAmount: numStr(purchase.totalAmount) - numStr(purchase.paidAmount),
    dueDate: purchase.dueDate?.toISOString() ?? null,
    createdAt: purchase.createdAt.toISOString(),
    items: itemsWithKrats.map(i => ({
      ...i,
      batchId: i.batchId,
      krats: numStr(i.krats),
      kgs: numStr(i.kgs),
      pricePerKg: numStr(i.pricePerKg),
      subtotal: numStr(i.subtotal),
      batchWeights: i.batchWeights,
    })),
  });

});

router.delete("/purchases/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const [purchase] = await db.select().from(purchasesTable).where(eq(purchasesTable.id, id));
  if (!purchase) { res.status(404).json({ error: "Not found" }); return; }

  try {
    // Get items into memory first (kept for stock kratback & mutations)
    const items = await db.select().from(purchaseItemsTable).where(eq(purchaseItemsTable.purchaseId, id));

    for (const item of items) {
      const kratCount = Number(item.krats) || 0;
      if (kratCount > 0 && item.batchId) {
        // Delete krats created for this purchase item using barcode pattern (PO invoice number)
        // Krats created by this purchase have IDs starting from item.batchId (first krat inserted)
        const batchIds = Array.from({ length: kratCount }, (_, i) => (item.batchId as number) + i);
        
        // Only delete krats that still belong to this product (safety check)
        const kratsToDelete = await db.select()
          .from(productBatchesTable)
          .where(
            and(
              eq(productBatchesTable.productId, item.productId),
              inArray(productBatchesTable.id, batchIds)
            )
          );

        if (kratsToDelete.length > 0) {
          const batchIdsToDelete = kratsToDelete.map(r => r.id);
          // Unlink from sale_items to avoid FK constraint
          await db.update(saleItemsTable).set({ batchId: null }).where(inArray(saleItemsTable.batchId, batchIdsToDelete));
          // Unlink from purchase_items to avoid FK constraint (soft delete keeps purchase_items)
          await db.update(purchaseItemsTable).set({ batchId: null }).where(inArray(purchaseItemsTable.batchId, batchIdsToDelete));
          await db.delete(productBatchesTable).where(inArray(productBatchesTable.id, batchIdsToDelete));
        }
      }

      // Record stock mutation
      await db.insert(stockMutationsTable).values({
        productId: item.productId,
        type: "keluar",
        krats: item.krats.toString(),
        kgs: item.kgs.toString(),
        description: `Batal Pembelian ${purchase.invoiceNumber}`,
        reference: purchase.invoiceNumber,
      });

      // Sync product stock
      const krats = await db.select().from(productBatchesTable).where(and(eq(productBatchesTable.productId, item.productId), eq(productBatchesTable.status, "available")));
      const calculatedKratStock = krats.length;
      const calculatedKgStock = krats.reduce((sum, r) => sum + parseFloat(r.currentWeight), 0);

      await db.execute(sql`
        UPDATE ${productsTable} 
        SET krat_stock = ${calculatedKratStock}, kg_stock = ${calculatedKgStock}, updated_at = NOW()
        WHERE id = ${item.productId}
      `);
    }

    // Find and delete payments linked to payables of this purchase
    const relatedPayables = await db.select().from(payablesTable).where(eq(payablesTable.purchaseId, id));
    if (relatedPayables.length > 0) {
      for (const payable of relatedPayables) {
        await db.delete(paymentsTable).where(eq(paymentsTable.payableId, payable.id));
      }
      await db.delete(payablesTable).where(eq(payablesTable.purchaseId, id));
    }

    // SOFT DELETE: mark purchase as cancelled instead of hard deleting
    // This preserves purchase_items so detail krat can be restored later
    await db.update(purchasesTable).set({ status: "cancelled" } as any).where(eq(purchasesTable.id, id));

    broadcastRefresh();
    res.json({ success: true });
  } catch (err: any) {
    console.error("Error deleting purchase:", err);
    res.status(500).json({ error: err.message || "Internal Server Error" });
  }
});

export default router;
