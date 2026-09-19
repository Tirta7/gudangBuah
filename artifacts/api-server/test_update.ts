import { db, productsTable, categoriesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

async function test() {
  try {
    const prods = await db.select().from(productsTable);
    console.log("Found", prods.length, "products");
    let success = 0, failed = 0;
    for (const p of prods) {
      try {
        const prodData: any = {
          name: p.name, barcode: p.barcode, categoryId: p.categoryId,
          primaryUnit: p.primaryUnit, secondaryUnit: p.secondaryUnit,
          costPricePerKg: String(p.costPricePerKg), pricePerKg: String(p.pricePerKg),
          costPricePerKrat: String(p.costPricePerKrat), pricePerKrat: String(p.pricePerKrat),
          minStock: String(p.minStock), description: p.description,
          kratStock: "0", kgStock: "0",
        };
        await db.update(productsTable).set({ ...prodData, updatedAt: new Date() }).where(eq(productsTable.id, p.id));
        success++;
      } catch (e) {
        failed++;
        console.error("Failed on id", p.id, e.message);
      }
    }
    console.log("Success:", success, "Failed:", failed);
  } catch (e) {
    console.error("Error:", e);
  }
  process.exit();
}
test();
