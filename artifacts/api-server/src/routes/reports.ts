import { Router } from "express";
import { db } from "@workspace/db";
import { salesTable, saleItemsTable, productsTable, categoriesTable, returnsTable, customersTable } from "@workspace/db";
import { and, gte, lte, eq, sql, desc } from "drizzle-orm";

const router = Router();

function numStr(v: string | null | undefined) { return parseFloat(v ?? "0"); }

// ─── 1. SALES SUMMARY ────────────────────────────────────────────────────────
router.get("/reports/sales-summary", async (req, res) => {
  const { startDate, endDate } = req.query;
  // Exclude draft and cancelled from all reports
  const conditions: any[] = [
    sql`${salesTable.status} NOT IN ('draft', 'cancelled')`,
  ];
  if (startDate) {
    const start = new Date(`${startDate}T00:00:00`);
    conditions.push(gte(salesTable.createdAt, start));
  }
  if (endDate) {
    const end = new Date(`${endDate}T23:59:59.999`);
    conditions.push(lte(salesTable.createdAt, end));
  }

  const [summary] = await db
    .select({
      totalRevenue: sql<string>`coalesce(sum(${salesTable.totalAmount}), 0)`,
      totalTransactions: sql<number>`count(*)`,
      cashRevenue: sql<string>`coalesce(sum(case when ${salesTable.paymentType} = 'tunai' then ${salesTable.totalAmount} else 0 end), 0)`,
      tempoRevenue: sql<string>`coalesce(sum(case when ${salesTable.paymentType} = 'tempo' then ${salesTable.totalAmount} else 0 end), 0)`,
    })
    .from(salesTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined);

  const [itemsSummary] = await db
    .select({
      totalKrats: sql<string>`coalesce(sum(${saleItemsTable.krats}), 0)`,
      totalKgs: sql<string>`coalesce(sum(${saleItemsTable.kgs}), 0)`,
    })
    .from(saleItemsTable)
    .leftJoin(salesTable, eq(saleItemsTable.saleId, salesTable.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined);

  const byProduct = await db
    .select({
      productId: saleItemsTable.productId,
      productName: productsTable.name,
      totalKgs: sql<string>`coalesce(sum(${saleItemsTable.kgs}), 0)`,
      totalRevenue: sql<string>`coalesce(sum(${saleItemsTable.subtotal}), 0)`,
    })
    .from(saleItemsTable)
    .leftJoin(salesTable, eq(saleItemsTable.saleId, salesTable.id))
    .leftJoin(productsTable, eq(saleItemsTable.productId, productsTable.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .groupBy(saleItemsTable.productId, productsTable.name)
    .orderBy(sql`sum(${saleItemsTable.subtotal}) DESC`);

  const byCategory = await db
    .select({
      categoryName: categoriesTable.name,
      totalRevenue: sql<string>`coalesce(sum(${saleItemsTable.subtotal}), 0)`,
    })
    .from(saleItemsTable)
    .leftJoin(salesTable, eq(saleItemsTable.saleId, salesTable.id))
    .leftJoin(productsTable, eq(saleItemsTable.productId, productsTable.id))
    .leftJoin(categoriesTable, eq(productsTable.categoryId, categoriesTable.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .groupBy(categoriesTable.name)
    .orderBy(sql`sum(${saleItemsTable.subtotal}) DESC`);

  const totalRev = numStr(summary?.totalRevenue);
  const totalTx = Number(summary?.totalTransactions ?? 0);

  const returnConditions: any[] = [eq(returnsTable.type, 'penjualan')];
  if (startDate) {
    const start = new Date(`${startDate}T00:00:00`);
    returnConditions.push(gte(returnsTable.createdAt, start));
  }
  if (endDate) {
    const end = new Date(`${endDate}T23:59:59.999`);
    returnConditions.push(lte(returnsTable.createdAt, end));
  }

  const [returnSummary] = await db
    .select({
      totalReturnDeposit: sql<string>`coalesce(sum(${returnsTable.totalReturnedValue}), 0)`,
      totalReturnExchanged: sql<string>`coalesce(sum(${returnsTable.totalExchangedValue}), 0)`,
      netReturnImpact: sql<string>`coalesce(sum(${returnsTable.differenceAmount}), 0)`,
    })
    .from(returnsTable)
    .where(returnConditions.length > 0 ? and(...returnConditions) : undefined);

  const totalReturnDeposit = numStr(returnSummary?.totalReturnDeposit);
  const totalReturnExchanged = numStr(returnSummary?.totalReturnExchanged);
  const netReturnImpact = numStr(returnSummary?.netReturnImpact);
  const netRevenue = totalRev + netReturnImpact;
  const averageTransaction = totalTx > 0 ? netRevenue / totalTx : 0;

  res.json({
    totalRevenue: totalRev,
    netRevenue,
    totalReturnDeposit,
    totalReturnExchanged,
    netReturnImpact,
    totalTransactions: totalTx,
    averageTransaction: totalTx > 0 ? totalRev / totalTx : 0,
    totalKrats: numStr(itemsSummary?.totalKrats),
    totalKgs: numStr(itemsSummary?.totalKgs),
    cashRevenue: numStr(summary?.cashRevenue),
    tempoRevenue: numStr(summary?.tempoRevenue),
    byProduct: byProduct.map(p => ({
      productId: p.productId,
      productName: p.productName ?? "Unknown",
      totalKgs: numStr(p.totalKgs),
      totalRevenue: numStr(p.totalRevenue)
    })),
    byCategory: byCategory.map(c => ({
      categoryName: c.categoryName ?? "Tanpa Kategori",
      totalRevenue: numStr(c.totalRevenue)
    }))
  });
});

// ─── 2. SALES DETAIL ─────────────────────────────────────────────────────────
router.get("/reports/sales-detail", async (req, res) => {
  const { startDate, endDate, status } = req.query;
  // Exclude draft and cancelled
  const conditions: any[] = [
    sql`${salesTable.status} NOT IN ('draft', 'cancelled')`,
  ];
  if (startDate) {
    const start = new Date(`${startDate}T00:00:00`);
    conditions.push(gte(salesTable.createdAt, start));
  }
  if (endDate) {
    const end = new Date(`${endDate}T23:59:59.999`);
    conditions.push(lte(salesTable.createdAt, end));
  }
  if (status && status !== 'semua') conditions.push(eq(salesTable.status, status as string));

  const sales = await db
    .select({
      id: salesTable.id,
      invoiceNumber: salesTable.invoiceNumber,
      customerName: customersTable.name,
      paymentType: salesTable.paymentType,
      totalAmount: salesTable.totalAmount,
      paidAmount: salesTable.paidAmount,
      status: salesTable.status,
      notes: salesTable.notes,
      createdAt: salesTable.createdAt,
      hasReturns: sql<boolean>`EXISTS(SELECT 1 FROM ${returnsTable} WHERE ${returnsTable.saleId} = ${salesTable.id})`,
      returnDifference: sql<string>`COALESCE((SELECT sum(${returnsTable.differenceAmount}) FROM ${returnsTable} WHERE ${returnsTable.saleId} = ${salesTable.id}), 0)`,
      returnDifferencePaid: sql<string>`COALESCE((SELECT sum(${returnsTable.differenceAmount}) FROM ${returnsTable} WHERE ${returnsTable.saleId} = ${salesTable.id} AND ${returnsTable.paymentStatus} = 'lunas'), 0)`,
    })
    .from(salesTable)
    .leftJoin(customersTable, eq(salesTable.customerId, customersTable.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(salesTable.createdAt));

  const totalGross = sales.reduce((s, r) => s + numStr(r.totalAmount) + numStr(r.returnDifference as any), 0);
  const totalPaid = sales.reduce((s, r) => s + numStr(r.paidAmount) + numStr((r as any).returnDifferencePaid), 0);
  const totalReturnAdj = sales.reduce((s, r) => s + numStr(r.returnDifference as any), 0);

  res.json({
    summary: {
      totalTransactions: sales.length,
      totalGross,
      totalPaid,
      totalRemaining: totalGross - totalPaid,
      totalReturnAdj,
      netRevenue: totalGross,
    },
    transactions: sales.map(s => {
      const saleGross = numStr(s.totalAmount) + numStr(s.returnDifference as any);
      const salePaid = numStr(s.paidAmount) + numStr((s as any).returnDifferencePaid);
      return {
        id: s.id,
        invoiceNumber: s.invoiceNumber,
        customerName: s.customerName ?? "Pelanggan Umum",
        paymentType: s.paymentType,
        totalAmount: saleGross,
        paidAmount: salePaid,
        remainingAmount: saleGross - salePaid,
        status: s.status,
        notes: s.notes,
        createdAt: s.createdAt.toISOString(),
        hasReturns: Boolean(s.hasReturns),
        returnDifference: numStr(s.returnDifference as any),
      };
    })
  });
});

// ─── 3. SALES TAX / PPN ──────────────────────────────────────────────────────
const PPN_RATE = 0.11;

router.get("/reports/sales-tax", async (req, res) => {
  const { startDate, endDate, ppnRate } = req.query;
  const rate = ppnRate ? parseFloat(ppnRate as string) / 100 : PPN_RATE;

  const conditions: any[] = [
    sql`${salesTable.status} NOT IN ('draft', 'cancelled')`,
  ];
  if (startDate) {
    const start = new Date(`${startDate}T00:00:00`);
    conditions.push(gte(salesTable.createdAt, start));
  }
  if (endDate) {
    const end = new Date(`${endDate}T23:59:59.999`);
    conditions.push(lte(salesTable.createdAt, end));
  }

  const sales = await db
    .select({
      id: salesTable.id,
      invoiceNumber: salesTable.invoiceNumber,
      customerName: customersTable.name,
      paymentType: salesTable.paymentType,
      totalAmount: salesTable.totalAmount,
      status: salesTable.status,
      createdAt: salesTable.createdAt,
    })
    .from(salesTable)
    .leftJoin(customersTable, eq(salesTable.customerId, customersTable.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(salesTable.createdAt));

  const taxRows = sales.map((s, idx) => {
    const total = numStr(s.totalAmount);
    const dpp = Math.round(total / (1 + rate));
    const ppn = total - dpp;
    return {
      no: idx + 1,
      id: s.id,
      invoiceNumber: s.invoiceNumber,
      tanggal: s.createdAt.toISOString(),
      customerName: s.customerName ?? "Pelanggan Umum",
      paymentType: s.paymentType,
      status: s.status,
      totalBruto: total,
      dpp,
      ppn,
      total,
    };
  });

  res.json({
    ppnRate: rate * 100,
    summary: {
      totalTransactions: taxRows.length,
      totalBruto: taxRows.reduce((s, r) => s + r.totalBruto, 0),
      totalDPP: taxRows.reduce((s, r) => s + r.dpp, 0),
      totalPPN: taxRows.reduce((s, r) => s + r.ppn, 0),
    },
    rows: taxRows,
  });
});

// ─── 4. SALES TREND DAILY ────────────────────────────────────────────────────
router.get("/reports/sales-trend", async (req, res) => {
  const { startDate, endDate } = req.query;
  const conditions: any[] = [
    sql`${salesTable.status} NOT IN ('draft', 'cancelled')`,
  ];
  if (startDate) {
    const start = new Date(`${startDate}T00:00:00`);
    conditions.push(gte(salesTable.createdAt, start));
  }
  if (endDate) {
    const end = new Date(`${endDate}T23:59:59.999`);
    conditions.push(lte(salesTable.createdAt, end));
  }

  const trend = await db
    .select({
      date: sql<string>`DATE(${salesTable.createdAt})`,
      revenue: sql<string>`coalesce(sum(${salesTable.totalAmount}), 0)`,
      transactions: sql<number>`count(*)`,
    })
    .from(salesTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .groupBy(sql`DATE(${salesTable.createdAt})`)
    .orderBy(sql`DATE(${salesTable.createdAt})`);

  res.json(trend.map(t => ({
    date: t.date,
    revenue: numStr(t.revenue),
    transactions: Number(t.transactions),
  })));
});

// ─── 5. STOCK SUMMARY ────────────────────────────────────────────────────────
router.get("/reports/stock-summary", async (req, res) => {
  const products = await db
    .select({
      productId: productsTable.id,
      productName: productsTable.name,
      categoryName: categoriesTable.name,
      rackLocation: productsTable.rackLocation,
      kratStock: productsTable.kratStock,
      kgStock: productsTable.kgStock,
      pricePerKg: productsTable.pricePerKg,
      minStock: productsTable.minStock,
    })
    .from(productsTable)
    .leftJoin(categoriesTable, eq(productsTable.categoryId, categoriesTable.id))
    .orderBy(productsTable.name);

  const formattedProducts = products.map(p => ({
    id: p.productId,
    name: p.productName,
    categoryName: p.categoryName ?? null,
    rackLocation: p.rackLocation,
    kratStock: numStr(p.kratStock),
    kgStock: numStr(p.kgStock),
    minStock: numStr(p.minStock),
    stockValue: numStr(p.kgStock) * numStr(p.pricePerKg),
    isLowStock: numStr(p.kratStock) <= numStr(p.minStock),
  }));

  res.json({
    totalProducts: formattedProducts.length,
    totalValue: formattedProducts.reduce((acc, p) => acc + p.stockValue, 0),
    lowStockCount: formattedProducts.filter(p => p.isLowStock).length,
    products: formattedProducts
  });
});

// ─── 6. REFUND / TRANSFER BALIK ─────────────────────────────────────────────
router.get("/reports/refunds", async (req, res) => {
  const { startDate, endDate } = req.query;
  const conditions: any[] = [
    sql`${returnsTable.differenceAmount} < 0`
  ];
  if (startDate) {
    const start = new Date(`${startDate}T00:00:00`);
    conditions.push(gte(returnsTable.createdAt, start));
  }
  if (endDate) {
    const end = new Date(`${endDate}T23:59:59.999`);
    conditions.push(lte(returnsTable.createdAt, end));
  }

  const refunds = await db
    .select({
      id: returnsTable.id,
      returnNumber: returnsTable.returnNumber,
      type: returnsTable.type,
      paymentStatus: returnsTable.paymentStatus,
      differenceAmount: returnsTable.differenceAmount,
      cashRefunded: returnsTable.cashRefunded,
      createdAt: returnsTable.createdAt,
      customerName: customersTable.name,
      invoiceNumber: salesTable.invoiceNumber,
    })
    .from(returnsTable)
    .leftJoin(salesTable, eq(returnsTable.saleId, salesTable.id))
    .leftJoin(customersTable, eq(returnsTable.customerId, customersTable.id))
    .where(and(...conditions))
    .orderBy(desc(returnsTable.createdAt));

  const formattedRefunds = refunds.map((r, idx) => {
    const diff = Math.abs(numStr(r.differenceAmount));
    const cash = numStr(r.cashRefunded);
    return {
      no: idx + 1,
      id: r.id,
      returnNumber: r.returnNumber,
      invoiceNumber: r.invoiceNumber ?? "-",
      tanggal: r.createdAt.toISOString(),
      customerName: r.customerName ?? "Pelanggan Umum",
      type: r.type,
      paymentStatus: r.paymentStatus,
      totalRefund: diff,
      cashRefunded: cash,
      statusRefund: cash > 0 ? "SELESAI (DITRANSFER/TUNAI)" : "MASUK SALDO KREDIT / PIUTANG",
    };
  });

  res.json({
    summary: {
      totalTransactions: formattedRefunds.length,
      totalRefund: formattedRefunds.reduce((s, r) => s + r.totalRefund, 0),
      totalCashRefunded: formattedRefunds.reduce((s, r) => s + r.cashRefunded, 0),
    },
    rows: formattedRefunds,
  });
});


export default router;
