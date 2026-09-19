import { Router } from "express";
import { db } from "@workspace/db";
import { suppliersTable, payablesTable, paymentsTable, purchasesTable, purchaseItemsTable, productBatchesTable, productsTable, stockMutationsTable } from "@workspace/db";
import { eq, ilike, sql, and, inArray } from "drizzle-orm";
import { CreateSupplierBody, UpdateSupplierBody } from "@workspace/api-zod";
import { broadcastRefresh } from "../lib/websocket";

const router = Router();

async function getSupplierDebt(supplierId: number): Promise<number> {
  const [result] = await db
    .select({ total: sql<string>`coalesce(sum(${payablesTable.totalAmount} - ${payablesTable.paidAmount}), 0)` })
    .from(payablesTable)
    .where(eq(payablesTable.supplierId, supplierId));
  return parseFloat(result?.total ?? "0");
}

router.get("/suppliers", async (req, res) => {
  const { search } = req.query;
  const suppliers = await db
    .select()
    .from(suppliersTable)
    .where(search ? ilike(suppliersTable.name, `%${search}%`) : undefined)
    .orderBy(suppliersTable.name);

  const result = await Promise.all(suppliers.map(async s => ({
    ...s,
    currentDebt: await getSupplierDebt(s.id),
  })));
  res.json(result);
});

router.post("/suppliers", async (req, res): Promise<void> => {
  const parsed = CreateSupplierBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [supp] = await db.insert(suppliersTable).values(parsed.data).returning();
  res.status(201).json({ ...supp, currentDebt: 0 });
});

router.get("/suppliers/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const [supp] = await db.select().from(suppliersTable).where(eq(suppliersTable.id, id));
  if (!supp) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ ...supp, currentDebt: await getSupplierDebt(id) });
});

router.patch("/suppliers/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const parsed = UpdateSupplierBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [supp] = await db.update(suppliersTable).set({ ...parsed.data, updatedAt: new Date() }).where(eq(suppliersTable.id, id)).returning();
  if (!supp) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ ...supp, currentDebt: await getSupplierDebt(id) });
});

router.delete("/suppliers/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  try {
    // 1. Get all purchases for this supplier
    const purchases = await db.select().from(purchasesTable).where(eq(purchasesTable.supplierId, id));

    for (const purchase of purchases) {
      // 2. Get purchase items
      const items = await db.select().from(purchaseItemsTable).where(eq(purchaseItemsTable.purchaseId, purchase.id));

      // 3. Sync stock back (remove krats created by these purchases)
      for (const item of items) {
        const kratCount = Number(item.krats) || 0;
        if (kratCount > 0 && item.batchId) {
          const batchIds = Array.from({ length: kratCount }, (_, i) => (item.batchId as number) + i);
          const kratsToDelete = await db.select().from(productBatchesTable).where(
            and(eq(productBatchesTable.productId, item.productId), inArray(productBatchesTable.id, batchIds))
          );
          if (kratsToDelete.length > 0) {
            await db.delete(productBatchesTable).where(inArray(productBatchesTable.id, kratsToDelete.map(r => r.id)));
          }
        }
      }

      // 4. Delete purchase items
      await db.delete(purchaseItemsTable).where(eq(purchaseItemsTable.purchaseId, purchase.id));

      // 5. Delete payments linked to payables
      const relatedPayables = await db.select().from(payablesTable).where(eq(payablesTable.purchaseId, purchase.id));
      for (const payable of relatedPayables) {
        await db.delete(paymentsTable).where(eq(paymentsTable.payableId, payable.id));
      }
      await db.delete(payablesTable).where(eq(payablesTable.purchaseId, purchase.id));

      // 6. Delete the purchase
      await db.delete(purchasesTable).where(eq(purchasesTable.id, purchase.id));
    }

    // 7. Delete the supplier
    await db.delete(suppliersTable).where(eq(suppliersTable.id, id));

    broadcastRefresh();
    res.status(204).send();
  } catch (error: any) {
    console.error("Error deleting supplier:", error);
    res.status(500).json({ error: error.message || "Gagal menghapus supplier." });
  }
});

export default router;
