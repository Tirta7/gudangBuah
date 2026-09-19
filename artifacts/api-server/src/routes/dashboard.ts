import { Router } from "express";
import { db } from "@workspace/db";
import { salesTable, receivablesTable, payablesTable, productsTable, cashEntriesTable, saleItemsTable, customersTable, returnsTable } from "@workspace/db";
import { sql, gte, and, lte, eq } from "drizzle-orm";

const router = Router();

function numStr(v: string | null | undefined) { return parseFloat(v ?? "0"); }

router.get("/dashboard/summary", async (req, res) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const now = new Date();

  const [todaySales] = await db
    .select({
      revenue: sql<string>`coalesce(sum(${salesTable.totalAmount}), 0)`,
      count: sql<number>`count(*)`,
    })
    .from(salesTable)
    .where(and(
      gte(salesTable.createdAt, today),
      lte(salesTable.createdAt, tomorrow),
      sql`${salesTable.status} NOT IN ('draft', 'cancelled')`
    ));

  const [monthSales] = await db
    .select({ revenue: sql<string>`coalesce(sum(${salesTable.totalAmount}), 0)` })
    .from(salesTable)
    .where(and(
      gte(salesTable.createdAt, monthStart),
      sql`${salesTable.status} NOT IN ('draft', 'cancelled')`
    ));

  const [receivables] = await db
    .select({ total: sql<string>`coalesce(sum(${receivablesTable.totalAmount} - ${receivablesTable.paidAmount}), 0)` })
    .from(receivablesTable)
    .where(sql`${receivablesTable.status} != 'lunas'`);

  const [overdueRec] = await db
    .select({ count: sql<number>`count(*)` })
    .from(receivablesTable)
    .where(and(sql`${receivablesTable.status} != 'lunas'`, sql`${receivablesTable.dueDate} < NOW()` ));

  const [payables] = await db
    .select({ total: sql<string>`coalesce(sum(${payablesTable.totalAmount} - ${payablesTable.paidAmount}), 0)` })
    .from(payablesTable)
    .where(sql`${payablesTable.status} != 'lunas'`);

  const [cash] = await db
    .select({
      totalIn: sql<string>`coalesce(sum(case when type = 'masuk' then amount else 0 end), 0)`,
      totalOut: sql<string>`coalesce(sum(case when type = 'keluar' then amount else 0 end), 0)`,
    })
    .from(cashEntriesTable);

  const [lowStock] = await db
    .select({ count: sql<number>`count(*)` })
    .from(productsTable)
    .where(sql`${productsTable.kratStock} <= ${productsTable.minStock}`);

  res.json({
    todayRevenue: numStr(todaySales?.revenue),
    todayTransactions: Number(todaySales?.count ?? 0),
    totalReceivables: numStr(receivables?.total),
    totalPayables: numStr(payables?.total),
    lowStockCount: Number(lowStock?.count ?? 0),
    overdueReceivables: Number(overdueRec?.count ?? 0),
    monthRevenue: numStr(monthSales?.revenue),
    cashBalance: numStr(cash?.totalIn) - numStr(cash?.totalOut),
  });
});

router.get("/dashboard/sales-chart", async (req, res) => {
  const year = parseInt((req.query.year as string) ?? new Date().getFullYear().toString());
  const month = parseInt((req.query.month as string) ?? (new Date().getMonth() + 1).toString());

  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59);

  const data = await db
    .select({
      date: sql<string>`to_char(${salesTable.createdAt}, 'YYYY-MM-DD')`,
      revenue: sql<string>`coalesce(sum(${salesTable.totalAmount}), 0)`,
      transactions: sql<number>`count(*)`,
    })
    .from(salesTable)
    .where(and(gte(salesTable.createdAt, startDate), lte(salesTable.createdAt, endDate)))
    .groupBy(sql`to_char(${salesTable.createdAt}, 'YYYY-MM-DD')`)
    .orderBy(sql`to_char(${salesTable.createdAt}, 'YYYY-MM-DD')`);

  res.json(data.map(d => ({ date: d.date, revenue: numStr(d.revenue), transactions: Number(d.transactions) })));
});

router.get("/dashboard/recent-transactions", async (req, res) => {
  const sales = await db
    .select({
      id: salesTable.id,
      invoiceNumber: salesTable.invoiceNumber,
      customerName: customersTable.name,
      totalAmount: salesTable.totalAmount,
      paymentType: salesTable.paymentType,
      createdAt: salesTable.createdAt,
      hasReturns: sql<boolean>`EXISTS(SELECT 1 FROM ${returnsTable} WHERE ${returnsTable.saleId} = ${salesTable.id})`,
      returnDifference: sql<string>`(SELECT sum(${returnsTable.differenceAmount}) FROM ${returnsTable} WHERE ${returnsTable.saleId} = ${salesTable.id})`,
    })
    .from(salesTable)
    .leftJoin(customersTable, eq(salesTable.customerId, customersTable.id))
    .orderBy(sql`${salesTable.createdAt} DESC`)
    .limit(10);

  res.json(sales.map(s => ({
    id: s.id,
    type: "sale",
    description: s.invoiceNumber,
    amount: numStr(s.totalAmount),
    customerName: s.customerName ?? null,
    createdAt: s.createdAt.toISOString(),
    hasReturns: Boolean(s.hasReturns),
    returnDifference: numStr(s.returnDifference),
  })));
});

router.get("/dashboard/top-products", async (req, res) => {
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

  const result = await db
    .select({
      productId: saleItemsTable.productId,
      productName: productsTable.name,
      totalKrats: sql<string>`sum(${saleItemsTable.krats})`,
      totalKgs: sql<string>`sum(${saleItemsTable.kgs})`,
      totalRevenue: sql<string>`sum(${saleItemsTable.subtotal})`,
    })
    .from(saleItemsTable)
    .leftJoin(productsTable, eq(saleItemsTable.productId, productsTable.id))
    .leftJoin(salesTable, eq(saleItemsTable.saleId, salesTable.id))
    .where(gte(salesTable.createdAt, monthStart))
    .groupBy(saleItemsTable.productId, productsTable.name)
    .orderBy(sql`sum(${saleItemsTable.subtotal}) DESC`)
    .limit(5);

  res.json(result.map(r => ({
    productId: r.productId,
    productName: r.productName ?? "Unknown",
    totalKrats: numStr(r.totalKrats),
    totalKgs: numStr(r.totalKgs),
    totalRevenue: numStr(r.totalRevenue),
  })));
});

router.get("/dashboard/receivables-summary", async (req, res) => {
  const now = new Date();
  const [total] = await db
    .select({ amount: sql<string>`coalesce(sum(${receivablesTable.totalAmount} - ${receivablesTable.paidAmount}), 0)` })
    .from(receivablesTable)
    .where(sql`${receivablesTable.status} != 'lunas'`);

  const [overdue] = await db
    .select({
      amount: sql<string>`coalesce(sum(${receivablesTable.totalAmount} - ${receivablesTable.paidAmount}), 0)`,
      count: sql<number>`count(*)`,
    })
    .from(receivablesTable)
    .where(and(sql`${receivablesTable.status} != 'lunas'`, sql`${receivablesTable.dueDate} < NOW()`));

  res.json({
    totalAmount: numStr(total?.amount),
    overdueAmount: numStr(overdue?.amount),
    overdueCount: Number(overdue?.count ?? 0),
  });
});

export default router;
