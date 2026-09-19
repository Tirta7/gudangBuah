import { Router } from "express";
import { db } from "@workspace/db";
import { productsTable, categoriesTable, productBatchesTable } from "@workspace/db";
import { eq, and, gt } from "drizzle-orm";

const router = Router();

// GET /api/shop/categories — daftar kategori yang memiliki produk
router.get("/shop/categories", async (req, res): Promise<void> => {
  const categories = await db
    .selectDistinct({
      id: categoriesTable.id,
      name: categoriesTable.name,
      description: categoriesTable.description,
    })
    .from(categoriesTable)
    .innerJoin(productsTable, eq(productsTable.categoryId, categoriesTable.id))
    .orderBy(categoriesTable.name);
  res.json(categories);
});

// GET /api/shop/products — daftar produk publik (tidak butuh auth)
router.get("/shop/products", async (req, res): Promise<void> => {
  const { categoryId, search } = req.query;

  const baseProducts = await db
    .select({
      id: productsTable.id,
      name: productsTable.name,
      categoryId: productsTable.categoryId,
      categoryName: categoriesTable.name,
      imageUrl: productsTable.imageUrl,
      description: productsTable.description,
      primaryUnit: productsTable.primaryUnit,
      secondaryUnit: productsTable.secondaryUnit,
      pricePerKg: productsTable.pricePerKg,
      pricePerKrat: productsTable.pricePerKrat,
      kratStock: productsTable.kratStock,
      kgStock: productsTable.kgStock,
    })
    .from(productsTable)
    .leftJoin(categoriesTable, eq(productsTable.categoryId, categoriesTable.id))
    .orderBy(productsTable.name);

  let result = baseProducts.map(p => ({
    ...p,
    pricePerKg: parseFloat(p.pricePerKg ?? "0"),
    pricePerKrat: p.pricePerKrat ? parseFloat(p.pricePerKrat) : null,
    kratStock: parseFloat(p.kratStock ?? "0"),
    kgStock: parseFloat(p.kgStock ?? "0"),
    inStock: parseFloat(p.kratStock ?? "0") > 0,
  }));

  if (categoryId) {
    result = result.filter(p => p.categoryId === parseInt(categoryId as string));
  }
  if (search) {
    const q = (search as string).toLowerCase();
    result = result.filter(p => p.name.toLowerCase().includes(q));
  }

  res.json(result);
});

// GET /api/shop/products/:id — detail produk publik
router.get("/shop/products/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);

  const [prod] = await db
    .select({
      id: productsTable.id,
      name: productsTable.name,
      categoryId: productsTable.categoryId,
      categoryName: categoriesTable.name,
      imageUrl: productsTable.imageUrl,
      description: productsTable.description,
      primaryUnit: productsTable.primaryUnit,
      secondaryUnit: productsTable.secondaryUnit,
      pricePerKg: productsTable.pricePerKg,
      pricePerKrat: productsTable.pricePerKrat,
      kratStock: productsTable.kratStock,
      kgStock: productsTable.kgStock,
    })
    .from(productsTable)
    .leftJoin(categoriesTable, eq(productsTable.categoryId, categoriesTable.id))
    .where(eq(productsTable.id, id));

  if (!prod) { res.status(404).json({ error: "Not found" }); return; }

  // Ambil available krats untuk ditampilkan sebagai variasi ukuran
  const krats = await db
    .select({
      id: productBatchesTable.id,
      currentWeight: productBatchesTable.currentWeight,
      barcode: productBatchesTable.barcode,
    })
    .from(productBatchesTable)
    .where(and(eq(productBatchesTable.productId, id), eq(productBatchesTable.status, "available")))
    .orderBy(productBatchesTable.currentWeight);

  // Kelompokkan ukuran yang tersedia
  const availableSizes: { length: number; count: number }[] = [];
  const sizeMap: Record<string, number> = {};
  krats.forEach(r => {
    const len = parseFloat(r.currentWeight).toFixed(1);
    sizeMap[len] = (sizeMap[len] || 0) + 1;
  });
  Object.entries(sizeMap).forEach(([len, count]) => {
    availableSizes.push({ length: parseFloat(len), count });
  });
  availableSizes.sort((a, b) => a.length - b.length);

  res.json({
    ...prod,
    pricePerKg: parseFloat(prod.pricePerKg ?? "0"),
    pricePerKrat: prod.pricePerKrat ? parseFloat(prod.pricePerKrat) : null,
    kratStock: parseFloat(prod.kratStock ?? "0"),
    kgStock: parseFloat(prod.kgStock ?? "0"),
    inStock: parseFloat(prod.kratStock ?? "0") > 0,
    availableSizes,
    totalKrats: krats.length,
  });
});

export default router;
