import { db } from "@workspace/db";
import { salesTable, saleItemsTable, productsTable, productBatchesTable, stockMutationsTable, cashEntriesTable, receivablesTable } from "@workspace/db";
import { eq, sql, and } from "drizzle-orm";

async function run() {
  const invoiceNumber = `INV-${Date.now()}`;
  const customerId = undefined;
  const paymentType = "qris";
  const dueDate = undefined;
  const notes = undefined;
  
  const items = [
    {
      productId: 1, // assuming ROSE GOLD is id 1 or something
      batchId: 1,
      krats: 1,
      kgs: 382.98,
      pricePerKg: 14000,
      subtotal: 5361720
    }
  ];
  
  const totalAmount = items.reduce((sum, i) => sum + (i.subtotal ?? 0), 0);
  const paidAmount = (paymentType !== "kredit" && paymentType !== "tempo") ? totalAmount : 0;
  const status = paidAmount >= totalAmount ? "lunas" : paidAmount > 0 ? "partial" : "tempo";

  try {
    const [sale] = await db.insert(salesTable).values({
      invoiceNumber,
      customerId: customerId ?? null,
      paymentType,
      totalAmount: totalAmount.toString(),
      paidAmount: paidAmount.toString(),
      status,
      dueDate: dueDate ? new Date(dueDate) : null,
      notes: notes ?? null,
    }).returning();
    
    console.log("SALE CREATED:", sale);

    for (const item of items) {
      await db.insert(saleItemsTable).values({
        saleId: sale.id,
        productId: item.productId,
        batchId: item.batchId ?? null,
        krats: item.krats.toString(),
        kgs: item.kgs.toString(),
        pricePerKg: item.pricePerKg.toString(),
        subtotal: item.subtotal.toString(),
      });
      console.log("ITEM CREATED:", item.productId);

      if (item.batchId) {
        await db.execute(sql`
          UPDATE ${productBatchesTable}
          SET current_length = current_length - ${item.kgs}, 
              status = CASE WHEN current_length - ${item.kgs} <= 0.01 THEN 'empty' ELSE 'available' END,
              updated_at = NOW()
          WHERE id = ${item.batchId}
        `);
        console.log("KRAT DEDUCTED");
      }
    }
  } catch (err) {
    console.error("ERROR CREATING SALE:", err);
  }
  process.exit(0);
}
run();
