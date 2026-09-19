import { useState, useMemo } from "react";
import { useGetSalesSummaryReport, useGetStockSummaryReport, getGetSalesSummaryReportQueryKey, getGetStockSummaryReportQueryKey } from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, AreaChart, Area, ComposedChart, Line
} from "recharts";
import { TrendingUp, Package, Download, FileText, Receipt, BarChart2, Search, Printer, ArrowDownToLine } from "lucide-react";
import { formatRupiah, formatNumber } from "@/lib/utils";
import { PaginationControl } from "../components/PaginationControl";

const CHART_COLORS = ["#6366f1", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#f97316", "#ec4899"];
const BASE_URL = "/api";

// ─── Fetch helpers ────────────────────────────────────────────────────────────
async function fetchSalesDetail(startDate: string, endDate: string, status: string) {
  const params = new URLSearchParams({ startDate, endDate, ...(status !== "semua" ? { status } : {}) });
  const res = await fetch(`${BASE_URL}/reports/sales-detail?${params}`);
  if (!res.ok) throw new Error("Failed to fetch sales detail");
  return res.json();
}

async function fetchSalesTax(startDate: string, endDate: string) {
  const params = new URLSearchParams({ startDate, endDate });
  const res = await fetch(`${BASE_URL}/reports/sales-tax?${params}`);
  if (!res.ok) throw new Error("Failed to fetch tax report");
  return res.json();
}

async function fetchSalesTrend(startDate: string, endDate: string) {
  const params = new URLSearchParams({ startDate, endDate });
  const res = await fetch(`${BASE_URL}/reports/sales-trend?${params}`);
  if (!res.ok) throw new Error("Failed to fetch trend");
  return res.json();
}

async function fetchRefunds(startDate: string, endDate: string) {
  const params = new URLSearchParams({ startDate, endDate });
  const res = await fetch(`${BASE_URL}/reports/refunds?${params}`);
  if (!res.ok) throw new Error("Failed to fetch refunds report");
  return res.json();
}

// ─── CSV Export ───────────────────────────────────────────────────────────────
function exportCSV(data: any[], filename: string, headers?: Record<string, string>) {
  if (!data?.length) return;
  const keys = Object.keys(data[0]);
  const headerRow = headers ? keys.map(k => headers[k] ?? k) : keys;
  const csv = [
    headerRow.join(","),
    ...data.map(row => keys.map(k => {
      const val = row[k] ?? "";
      return typeof val === "string" && val.includes(",") ? `"${val}"` : val;
    }).join(","))
  ].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `${filename}.csv`; a.click();
  URL.revokeObjectURL(url);
}

function printSection(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(`
    <html><head><title>Laporan EnkaTextile</title>
    <style>
      body { font-family: Arial, sans-serif; font-size: 11px; color: #1e293b; }
      table { width: 100%; border-collapse: collapse; margin-top: 16px; }
      th { background: #f1f5f9; border: 1px solid #e2e8f0; padding: 6px 10px; text-align: left; font-size: 10px; }
      td { border: 1px solid #e2e8f0; padding: 6px 10px; }
      .total-row { background: #ede9fe; font-weight: bold; }
      .text-right { text-align: right; }
      h1 { font-size: 16px; margin-bottom: 4px; }
      .subtitle { color: #64748b; font-size: 11px; margin-bottom: 16px; }
    </style></head><body>
    ${el.innerHTML}
    </body></html>
  `);
  w.document.close();
  w.focus();
  setTimeout(() => { w.print(); w.close(); }, 300);
}

// ─── Status Badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    lunas: "bg-emerald-50 text-emerald-700 border border-emerald-200",
    tempo: "bg-rose-50 text-rose-700 border border-rose-200",
    piutang: "bg-rose-50 text-rose-700 border border-rose-200",
    partial: "bg-amber-50 text-amber-700 border border-amber-200",
  };
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${map[status] ?? "bg-slate-50 text-slate-600 border border-slate-200"}`}>
      {status}
    </span>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, color = "slate", icon }: { label: string; value: string; sub?: string; color?: string; icon?: React.ReactNode }) {
  const colors: Record<string, string> = {
    violet: "bg-violet-50 border-violet-100",
    emerald: "bg-emerald-50 border-emerald-100",
    rose: "bg-rose-50 border-rose-100",
    amber: "bg-amber-50 border-amber-100",
    slate: "bg-white border-slate-200",
    blue: "bg-blue-50 border-blue-100",
  };
  const textColors: Record<string, string> = {
    violet: "text-violet-600", emerald: "text-emerald-600", rose: "text-rose-600",
    amber: "text-amber-600", slate: "text-slate-500", blue: "text-blue-600",
  };
  const valColors: Record<string, string> = {
    violet: "text-violet-900", emerald: "text-emerald-900", rose: "text-rose-900",
    amber: "text-amber-900", slate: "text-slate-900", blue: "text-blue-900",
  };
  return (
    <div className={`rounded-2xl p-3.5 border flex flex-col gap-1.5 ${colors[color] ?? colors.slate}`}>
      <div className="flex items-center justify-between">
        <span className={`text-[9px] font-bold uppercase tracking-wider ${textColors[color]}`}>{label}</span>
        {icon && <span className={`opacity-60 ${textColors[color]}`}>{icon}</span>}
      </div>
      <span className={`text-lg font-black leading-tight ${valColors[color]}`}>{value}</span>
      {sub && <span className="text-[10px] text-slate-400 leading-tight">{sub}</span>}
    </div>
  );
}

// ─── Filter Bar (defined OUTSIDE Laporan to prevent remount on every keystroke) ─
interface LaporanFilterBarProps {
  startDate: string; setStartDate: (v: string) => void;
  endDate: string; setEndDate: (v: string) => void;
  showStatus?: boolean; statusFilter?: string; setStatusFilter?: (v: string) => void;
  showSearch?: boolean; search?: string; setSearch?: (v: string) => void;
}
function LaporanFilterBar({
  startDate, setStartDate, endDate, setEndDate,
  showStatus, statusFilter, setStatusFilter,
  showSearch, search, setSearch,
}: LaporanFilterBarProps) {
  return (
    <div className="flex gap-1.5 items-center flex-wrap">
      <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
        className="w-32 rounded-xl border-slate-200 h-8 text-xs bg-white focus-visible:ring-violet-500" />
      <span className="text-slate-300 text-xs">—</span>
      <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
        className="w-32 rounded-xl border-slate-200 h-8 text-xs bg-white focus-visible:ring-violet-500" />
      {showStatus && setStatusFilter && (
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-24 h-8 rounded-xl border-slate-200 bg-white text-xs">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="semua">Semua</SelectItem>
            <SelectItem value="lunas">Lunas</SelectItem>
            <SelectItem value="tempo">Tempo</SelectItem>
            <SelectItem value="partial">Partial</SelectItem>
          </SelectContent>
        </Select>
      )}
      {showSearch && setSearch !== undefined && (
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400" />
          <Input
            value={search ?? ""}
            onChange={e => setSearch!(e.target.value)}
            placeholder="Cari nota / pelanggan..."
            className="pl-7 w-44 h-8 rounded-xl border-slate-200 bg-white text-xs focus-visible:ring-violet-500"
          />
        </div>
      )}
    </div>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function Laporan() {
  const today = new Date();
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toLocaleDateString("en-CA");
  const todayStr = today.toLocaleDateString("en-CA");

  const [activeTab, setActiveTab] = useState("penjualan");
  const [startDate, setStartDate] = useState(firstOfMonth);
  const [endDate, setEndDate] = useState(todayStr);
  const [statusFilter, setStatusFilter] = useState("semua");
  const [search, setSearch] = useState("");
  const [currentSalesPage, setCurrentSalesPage] = useState(1);
  const [currentStockPage, setCurrentStockPage] = useState(1);
  const [currentRefundPage, setCurrentRefundPage] = useState(1);
  const [currentDetailPage, setCurrentDetailPage] = useState(1);
  const [currentTaxPage, setCurrentTaxPage] = useState(1);
  const PAGE_SIZE = 20;

  // — Queries —
  const { data: salesReport, isLoading: loadingSales } = useGetSalesSummaryReport(
    { startDate, endDate },
    { query: { queryKey: getGetSalesSummaryReportQueryKey({ startDate, endDate }) } }
  );
  const { data: stockReport, isLoading: loadingStock } = useGetStockSummaryReport(
    { query: { queryKey: getGetStockSummaryReportQueryKey() } }
  );
  const { data: detailReport, isLoading: loadingDetail } = useQuery({
    queryKey: ["reports/sales-detail", startDate, endDate, statusFilter],
    queryFn: () => fetchSalesDetail(startDate, endDate, statusFilter),
  });
  const { data: taxReport, isLoading: loadingTax } = useQuery({
    queryKey: ["reports/sales-tax", startDate, endDate],
    queryFn: () => fetchSalesTax(startDate, endDate),
  });
  const { data: trendData, isLoading: loadingTrend } = useQuery({
    queryKey: ['salesTrend', startDate, endDate],
    queryFn: () => fetchSalesTrend(startDate, endDate),
  });

  const { data: refundsData, isLoading: isRefundsLoading } = useQuery({
    queryKey: ['refundsReport', startDate, endDate],
    queryFn: () => fetchRefunds(startDate, endDate),
  });

  // — Filtered detail rows —
  const filteredTransactions = useMemo(() => {
    const rows: any[] = detailReport?.transactions ?? [];
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter((r: any) =>
      r.invoiceNumber?.toLowerCase().includes(q) ||
      r.customerName?.toLowerCase().includes(q)
    );
  }, [detailReport, search]);

  const filteredTaxRows = useMemo(() => {
    const rows: any[] = taxReport?.rows ?? [];
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter((r: any) =>
      r.invoiceNumber?.toLowerCase().includes(q) ||
      r.customerName?.toLowerCase().includes(q)
    );
  }, [taxReport, search]);

  // ─── Filtered summary (computed from filteredTransactions, not global) ──────
  const filteredSummary = useMemo(() => ({
    totalTransactions: filteredTransactions.length,
    totalGross: filteredTransactions.reduce((s: number, t: any) => s + (Number(t.totalAmount) || 0), 0),
    totalPaid: filteredTransactions.reduce((s: number, t: any) => s + (Number(t.paidAmount) || 0), 0),
    totalRemaining: filteredTransactions.reduce((s: number, t: any) => s + (Number(t.remainingAmount) || 0), 0),
  }), [filteredTransactions]);

  return (
    <div className="w-full">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        
        {/* HEADER */}
        <div className="flex-none pb-3 mb-2 border-b border-slate-100 space-y-2">

          {/* Row 1: Title + (desktop filter) */}
          <div className="flex items-center justify-between gap-3">
            <div className="shrink-0">
              <h1 className="text-xl font-bold tracking-tight text-slate-900 leading-tight">Laporan</h1>
              <p className="text-[11px] text-slate-400">Analisa performa bisnis</p>
            </div>
            {/* Filter bar — desktop only inline */}
            <div className="hidden xl:block">
              {activeTab !== "stok" && activeTab !== "refunds" && (
                <LaporanFilterBar
                  startDate={startDate} setStartDate={setStartDate}
                  endDate={endDate} setEndDate={setEndDate}
                  showStatus={activeTab === "detail"}
                  statusFilter={statusFilter} setStatusFilter={setStatusFilter}
                  showSearch={activeTab === "detail" || activeTab === "pajak"}
                  search={search} setSearch={setSearch}
                />
              )}
            </div>
          </div>

          {/* Row 2: Tab bar — scrollable horizontal */}
          <div className="overflow-x-auto pb-0.5 -mx-3 px-3 md:-mx-4 md:px-4" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            <TabsList className="inline-flex h-9 w-max min-w-full justify-start rounded-xl bg-slate-100 p-1 gap-0.5">
              <TabsTrigger value="penjualan" className="flex items-center gap-1.5 rounded-lg px-3 data-[state=active]:bg-white data-[state=active]:text-violet-700 data-[state=active]:shadow-sm text-xs font-semibold text-slate-500 h-7 whitespace-nowrap shrink-0">
                <TrendingUp className="h-3.5 w-3.5" /> Ringkasan
              </TabsTrigger>
              <TabsTrigger value="detail" className="flex items-center gap-1.5 rounded-lg px-3 data-[state=active]:bg-white data-[state=active]:text-violet-700 data-[state=active]:shadow-sm text-xs font-semibold text-slate-500 h-7 whitespace-nowrap shrink-0">
                <FileText className="h-3.5 w-3.5" /> Detail Transaksi
              </TabsTrigger>
              <TabsTrigger value="pajak" className="flex items-center gap-1.5 rounded-lg px-3 data-[state=active]:bg-white data-[state=active]:text-violet-700 data-[state=active]:shadow-sm text-xs font-semibold text-slate-500 h-7 whitespace-nowrap shrink-0">
                <Receipt className="h-3.5 w-3.5" /> Laporan PPN
              </TabsTrigger>
              <TabsTrigger value="stok" className="flex items-center gap-1.5 rounded-lg px-3 data-[state=active]:bg-white data-[state=active]:text-violet-700 data-[state=active]:shadow-sm text-xs font-semibold text-slate-500 h-7 whitespace-nowrap shrink-0">
                <Package className="h-3.5 w-3.5" /> Stok
              </TabsTrigger>
              <TabsTrigger value="refunds" className="flex items-center gap-1.5 rounded-lg px-3 data-[state=active]:bg-white data-[state=active]:text-emerald-700 data-[state=active]:shadow-sm text-xs font-semibold text-slate-500 h-7 whitespace-nowrap shrink-0">
                <ArrowDownToLine className="h-3.5 w-3.5" /> Refund
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Row 3: Filter bar — mobile (sembunyikan di desktop row 1) */}
          {activeTab !== "stok" && activeTab !== "refunds" && (
            <div className="xl:hidden">
              <LaporanFilterBar
                startDate={startDate} setStartDate={setStartDate}
                endDate={endDate} setEndDate={setEndDate}
                showStatus={activeTab === "detail"}
                statusFilter={statusFilter} setStatusFilter={setStatusFilter}
                showSearch={activeTab === "detail" || activeTab === "pajak"}
                search={search} setSearch={setSearch}
              />
            </div>
          )}
        </div>

        {/* ══════════════════════ TAB: RINGKASAN ══════════════════════ */}
        <TabsContent value="penjualan" className="space-y-4 outline-none pb-6">
          {loadingSales ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
            </div>
          ) : salesReport ? (
            <>
              {/* KPI Grid — 2x2 mobile, 4-col desktop */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                <KpiCard color="slate" label="Penjualan Kotor" value={formatRupiah((salesReport as any).totalRevenue || 0)} sub={`${(salesReport as any).totalTransactions} transaksi`} icon={<TrendingUp className="w-4 h-4" />} />
                <KpiCard color="violet" label="Pendapatan Bersih" value={formatRupiah((salesReport as any).netRevenue || 0)} icon={<Receipt className="w-4 h-4" />} />
                <KpiCard color="emerald" label="Rata-rata / Trx" value={formatRupiah((salesReport as any).averageTransaction || 0)} icon={<BarChart2 className="w-4 h-4" />} />
                <KpiCard color="amber" label="Dampak Retur" value={formatRupiah((salesReport as any).netReturnImpact || 0)}
                  sub={`Kembali: ${formatRupiah((salesReport as any).totalReturnDeposit || 0)}`} icon={<ArrowDownToLine className="w-4 h-4" />} />
              </div>

              {/* Tren Harian */}
              <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
                <div className="p-4 border-b border-slate-100">
                  <h3 className="font-bold text-slate-800">Tren Penjualan Harian</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Revenue dan jumlah transaksi per hari</p>
                </div>
                <div className="p-4">
                  {loadingTrend ? (
                    <Skeleton className="h-56 w-full rounded-xl" />
                  ) : trendData && trendData.length > 0 ? (
                    <div className="h-56">
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={trendData} margin={{ top: 4, right: 8, bottom: 0, left: -8 }}>
                          <defs>
                            <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#7c3aed" stopOpacity={0.25} />
                              <stop offset="100%" stopColor="#7c3aed" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis dataKey="date" fontSize={10} axisLine={false} tickLine={false} stroke="#94a3b8" />
                          <YAxis yAxisId="left" fontSize={10} axisLine={false} tickLine={false} stroke="#94a3b8" tickFormatter={v => `${(v / 1000000).toFixed(0)}M`} />
                          <YAxis yAxisId="right" orientation="right" fontSize={10} axisLine={false} tickLine={false} stroke="#94a3b8" />
                          <Tooltip
                            formatter={(value: any, name: string) => name === "revenue" ? [formatRupiah(value), "Revenue"] : [value, "Transaksi"]}
                            contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 4px 20px rgba(0,0,0,0.08)", fontSize: "12px" }}
                          />
                          <Area yAxisId="left" type="monotone" dataKey="revenue" fill="url(#revGrad)" stroke="#7c3aed" strokeWidth={2.5} dot={false} />
                          <Line yAxisId="right" type="monotone" dataKey="transactions" stroke="#f59e0b" strokeWidth={2} dot={false} />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="h-40 flex items-center justify-center text-slate-400 text-sm">Tidak ada data tren</div>
                  )}
                </div>
              </div>

              {/* Per Produk */}
              {(salesReport as any).byProduct?.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
                  <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-slate-800">Penjualan per Produk</h3>
                      <p className="text-xs text-slate-400 mt-0.5">Top produk dalam periode ini</p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => exportCSV((salesReport as any).byProduct, "laporan-produk", { productName: "Produk", totalKgs: "Total Kg", totalRevenue: "Revenue" })}
                      className="rounded-xl h-8 text-xs font-semibold gap-1.5">
                      <Download className="h-3.5 w-3.5" /> Export CSV
                    </Button>
                  </div>
                  <div className="p-4 space-y-5">
                    <div className="h-[220px] bg-slate-50 rounded-xl p-2">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={(salesReport as any).byProduct?.slice(0, 8)} layout="vertical" margin={{ top: 0, right: 20, bottom: 0, left: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                          <XAxis type="number" tickFormatter={v => `${(v / 1000000).toFixed(0)}M`} fontSize={10} axisLine={false} tickLine={false} />
                          <YAxis type="category" dataKey="productName" fontSize={10} width={90} axisLine={false} tickLine={false} />
                          <Tooltip formatter={(v: number) => formatRupiah(v)} cursor={{ fill: "#f8fafc" }}
                            contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.08)", fontSize: "12px" }} />
                          <Bar dataKey="totalRevenue" fill="#7c3aed" radius={[0, 4, 4, 0]} barSize={18} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader className="bg-slate-50">
                          <TableRow className="border-slate-100">
                            <TableHead className="font-semibold text-slate-600 h-10 whitespace-nowrap">Produk</TableHead>
                            <TableHead className="text-right font-semibold text-slate-600 h-10 whitespace-nowrap">Qty (Kg)</TableHead>
                            <TableHead className="text-right font-semibold text-slate-600 h-10 whitespace-nowrap">Revenue</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(salesReport as any).byProduct?.slice((currentSalesPage - 1) * PAGE_SIZE, currentSalesPage * PAGE_SIZE).map((p: any) => (
                            <TableRow key={p.productId} className="border-slate-50 hover:bg-slate-50/50">
                              <TableCell className="font-medium text-slate-800 text-sm whitespace-nowrap">{p.productName}</TableCell>
                              <TableCell className="text-right text-sm text-slate-600 whitespace-nowrap">{formatNumber(p.totalKgs)} m</TableCell>
                              <TableCell className="text-right font-bold text-slate-900 text-sm whitespace-nowrap">{formatRupiah(p.totalRevenue)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    {(salesReport as any).byProduct?.length > PAGE_SIZE && (
                      <div className="flex justify-center pt-3">
                        <PaginationControl currentPage={currentSalesPage} totalPages={Math.ceil((salesReport as any).byProduct.length / PAGE_SIZE)} onPageChange={setCurrentSalesPage} />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Per Kategori */}
              {(salesReport as any).byCategory?.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
                  <div className="p-4 border-b border-slate-100">
                    <h3 className="font-bold text-slate-800">Penjualan per Kategori</h3>
                    <p className="text-xs text-slate-400 mt-0.5">Kontribusi setiap kategori</p>
                  </div>
                  <div className="p-4">
                    <div className="h-[260px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={(salesReport as any).byCategory} dataKey="totalRevenue" nameKey="categoryName" cx="50%" cy="50%"
                            innerRadius={60} outerRadius={90} labelLine={false}
                            label={({ categoryName, percent }: any) => percent > 0.05 ? `${categoryName} ${(percent * 100).toFixed(0)}%` : ""}>
                            {(salesReport as any).byCategory?.map((_: any, i: number) => (
                              <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} stroke="rgba(255,255,255,0.5)" strokeWidth={2} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(v: number) => formatRupiah(v)} contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.08)", fontSize: "12px" }} />
                          <Legend iconType="circle" wrapperStyle={{ fontSize: "11px", fontWeight: "500", color: "#475569" }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-20 bg-white rounded-2xl border border-slate-100 shadow-sm">
              <BarChart2 className="mx-auto mb-3 h-12 w-12 text-slate-200" strokeWidth={1.5} />
              <p className="text-slate-500 font-medium">Tidak ada data penjualan untuk periode ini</p>
            </div>
          )}
        </TabsContent>

        {/* ══════════════════════ TAB: DETAIL TRANSAKSI ══════════════════════ */}
        <TabsContent value="detail" className="space-y-3 outline-none pb-6">
          {loadingDetail ? (
            <div className="space-y-2">{Array(6).fill(0).map((_, i) => <Skeleton key={i} className="h-12 rounded-xl" />)}</div>
          ) : detailReport ? (
            <>
              {/* Summary strip — ultra compact 2x2 mobile */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <div className="bg-white border border-slate-100 rounded-xl px-3 py-2 flex flex-col justify-center">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Transaksi</span>
                  <span className="text-base font-black text-slate-900 leading-tight">{filteredSummary.totalTransactions}</span>
                </div>
                <div className="bg-violet-50 border border-violet-100 rounded-xl px-3 py-2 flex flex-col justify-center">
                  <span className="text-[9px] font-bold text-violet-500 uppercase tracking-wider">Total Penjualan</span>
                  <span className="text-xs font-black text-violet-900 leading-tight">{formatRupiah(filteredSummary.totalGross)}</span>
                </div>
                <div className="bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2 flex flex-col justify-center">
                  <span className="text-[9px] font-bold text-emerald-500 uppercase tracking-wider">Total Dibayar</span>
                  <span className="text-xs font-black text-emerald-900 leading-tight">{formatRupiah(filteredSummary.totalPaid)}</span>
                </div>
                <div className="bg-rose-50 border border-rose-100 rounded-xl px-3 py-2 flex flex-col justify-center">
                  <span className="text-[9px] font-bold text-rose-400 uppercase tracking-wider">Sisa Piutang</span>
                  <span className="text-xs font-black text-rose-700 leading-tight">{formatRupiah(filteredSummary.totalRemaining)}</span>
                </div>
              </div>

              {/* Table */}
              <div id="detail-print-area" className="relative bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden flex flex-col flex-1 min-h-0">
                <div className="p-2 px-3 border-b border-slate-100 flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-slate-800 text-sm">Transaksi</h3>
                    <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-md">{filteredTransactions.length} baris</span>
                  </div>
                  <div className="flex gap-1.5">
                    <Button variant="outline" size="sm" onClick={() => printSection("detail-print-area")}
                      className="rounded-lg h-7 px-2 text-[11px] font-semibold gap-1">
                      <Printer className="h-3 w-3" /> Print
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => exportCSV(filteredTransactions, `detail-penjualan-${startDate}-${endDate}`, {
                      invoiceNumber: "No. Nota", createdAt: "Tanggal", customerName: "Pelanggan",
                      paymentType: "Jenis Bayar", status: "Status", totalAmount: "Total",
                      paidAmount: "Dibayar", remainingAmount: "Sisa"
                    })}
                      className="rounded-lg h-7 px-2 text-[11px] font-semibold gap-1">
                      <Download className="h-3 w-3" /> Export
                    </Button>
                  </div>
                </div>
                <div className="overflow-x-auto overflow-y-auto flex-1">
                  <Table>
                    <TableHeader className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                      <TableRow className="border-slate-100">
                        <TableHead className="h-8 font-semibold text-slate-600 text-[11px] whitespace-nowrap">No. Nota</TableHead>
                        <TableHead className="h-8 font-semibold text-slate-600 text-[11px] whitespace-nowrap">Tanggal</TableHead>
                        <TableHead className="h-8 font-semibold text-slate-600 text-[11px] whitespace-nowrap">Pelanggan</TableHead>
                        <TableHead className="h-8 font-semibold text-slate-600 text-[11px] whitespace-nowrap">Jenis</TableHead>
                        <TableHead className="h-8 font-semibold text-slate-600 text-[11px] text-center whitespace-nowrap">Status</TableHead>
                        <TableHead className="h-8 font-semibold text-slate-600 text-[11px] text-right whitespace-nowrap">Total</TableHead>
                        <TableHead className="h-8 font-semibold text-slate-600 text-[11px] text-right whitespace-nowrap">Dibayar</TableHead>
                        <TableHead className="h-8 font-semibold text-slate-600 text-[11px] text-right whitespace-nowrap">Sisa</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredTransactions.slice((currentDetailPage - 1) * PAGE_SIZE, currentDetailPage * PAGE_SIZE).map((t: any) => (
                        <TableRow key={t.id} className="border-slate-50 hover:bg-violet-50/20">
                          <TableCell className="py-1.5 font-mono text-xs text-violet-700 font-semibold whitespace-nowrap">{t.invoiceNumber}</TableCell>
                          <TableCell className="py-1.5 text-xs text-slate-500 whitespace-nowrap">
                            {new Date(t.createdAt).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}
                          </TableCell>
                          <TableCell className="py-1.5 text-xs font-medium text-slate-800 max-w-[150px] truncate">{t.customerName}</TableCell>
                          <TableCell className="py-1.5 text-xs text-slate-500 capitalize whitespace-nowrap">{t.paymentType}</TableCell>
                          <TableCell className="py-1.5 text-center whitespace-nowrap">
                            <StatusBadge status={t.status} />
                            {t.hasReturns && (
                              <span className="ml-1 text-[9px] font-bold px-1 py-0.5 rounded border border-amber-200 text-amber-600 bg-amber-50 uppercase">Retur</span>
                            )}
                          </TableCell>
                          <TableCell className="py-1.5 text-right font-semibold text-slate-900 text-xs whitespace-nowrap">{formatRupiah(t.totalAmount)}</TableCell>
                          <TableCell className="py-1.5 text-right text-xs text-emerald-700 font-semibold whitespace-nowrap">{formatRupiah(t.paidAmount)}</TableCell>
                          <TableCell className="py-1.5 text-right text-xs whitespace-nowrap">
                            <span className={t.remainingAmount > 0 ? "text-rose-600 font-bold" : "text-slate-400"}>
                              {formatRupiah(t.remainingAmount)}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Footer Total — reflects search/filter */}
                <div className="border-t border-slate-200 bg-violet-50 p-2 px-4 flex flex-wrap justify-end gap-4 shrink-0 z-10 sticky bottom-0 items-center">
                  {search.trim() && (
                    <div className="mr-auto flex items-center gap-1.5 text-[11px] text-violet-600 font-semibold">
                      <Search className="h-3 w-3" />
                      Filter: "{search}" — {filteredSummary.totalTransactions} transaksi
                    </div>
                  )}
                  <div className="text-right flex items-center gap-2">
                    <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Penjualan:</p>
                    <p className="text-sm font-black text-slate-900">{formatRupiah(filteredSummary.totalGross)}</p>
                  </div>
                  <div className="text-right flex items-center gap-2">
                    <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Dibayar:</p>
                    <p className="text-sm font-black text-emerald-700">{formatRupiah(filteredSummary.totalPaid)}</p>
                  </div>
                  <div className="text-right flex items-center gap-2">
                    <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Piutang:</p>
                    <p className="text-sm font-black text-rose-600">{formatRupiah(filteredSummary.totalRemaining)}</p>
                  </div>
                </div>

                {filteredTransactions.length > PAGE_SIZE && (
                  <div className="flex justify-center py-3">
                    <PaginationControl currentPage={currentDetailPage} totalPages={Math.ceil(filteredTransactions.length / PAGE_SIZE)} onPageChange={setCurrentDetailPage} />
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="text-center py-20 bg-white rounded-2xl border border-slate-100">
              <FileText className="mx-auto mb-3 h-10 w-10 text-slate-200" />
              <p className="text-slate-400">Tidak ada transaksi ditemukan</p>
            </div>
          )}
        </TabsContent>

        {/* ══════════════════════ TAB: LAPORAN PPN ══════════════════════ */}
        <TabsContent value="pajak" className="space-y-5 outline-none pb-6">
          {loadingTax ? (
            <div className="space-y-2">{Array(6).fill(0).map((_, i) => <Skeleton key={i} className="h-12 rounded-xl" />)}</div>
          ) : taxReport ? (
            <>
              {/* Summary PPN */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
                <KpiCard color="slate" label="Total Transaksi" value={String(taxReport.summary.totalTransactions)} icon={<Receipt className="w-4 h-4" />} />
                <KpiCard color="violet" label={`DPP (Harga sebelum PPN ${taxReport.ppnRate}%)`} value={formatRupiah(taxReport.summary.totalDPP)} icon={<FileText className="w-4 h-4" />} />
                <KpiCard color="blue" label={`Total PPN ${taxReport.ppnRate}%`} value={formatRupiah(taxReport.summary.totalPPN)} icon={<TrendingUp className="w-4 h-4" />} />
              </div>

              {/* Accurate POS-style Tax Table */}
              <div id="tax-print-area" className="relative bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col flex-1 min-h-0">
                <div className="p-4 border-b border-slate-100 flex items-center justify-between gap-2 flex-wrap">
                  <div>
                    <h3 className="font-bold text-slate-800">Laporan Pajak Pertambahan Nilai (PPN)</h3>
                    <p className="text-xs text-slate-400 mt-0.5">Periode: {startDate} s.d. {endDate} — Tarif PPN: {taxReport.ppnRate}%</p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => printSection("tax-print-area")}
                      className="rounded-xl h-8 text-xs font-semibold gap-1.5">
                      <Printer className="h-3.5 w-3.5" /> Print
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => exportCSV(filteredTaxRows, `laporan-ppn-${startDate}-${endDate}`, {
                      no: "No", invoiceNumber: "No. Faktur", tanggal: "Tanggal", customerName: "Pembeli",
                      dpp: "DPP", ppn: `PPN ${taxReport.ppnRate}%`, total: "Total Tagihan"
                    })}
                      className="rounded-xl h-8 text-xs font-semibold gap-1.5">
                      <Download className="h-3.5 w-3.5" /> Export CSV
                    </Button>
                  </div>
                </div>

                <div className="overflow-x-auto flex-1">
                  <Table>
                    <TableHeader className="bg-slate-50 sticky top-0 z-10">
                      <TableRow className="border-slate-100">
                        <TableHead className="h-10 w-10 font-semibold text-slate-600 text-xs text-center whitespace-nowrap">No</TableHead>
                        <TableHead className="h-10 font-semibold text-slate-600 text-xs whitespace-nowrap">No. Faktur</TableHead>
                        <TableHead className="h-10 font-semibold text-slate-600 text-xs whitespace-nowrap">Tanggal</TableHead>
                        <TableHead className="h-10 font-semibold text-slate-600 text-xs whitespace-nowrap">Nama Pembeli</TableHead>
                        <TableHead className="h-10 font-semibold text-slate-600 text-xs text-center whitespace-nowrap">Status</TableHead>
                        <TableHead className="h-10 font-semibold text-slate-600 text-xs text-right whitespace-nowrap">DPP</TableHead>
                        <TableHead className="h-10 font-semibold text-slate-600 text-xs text-right whitespace-nowrap">PPN {taxReport.ppnRate}%</TableHead>
                        <TableHead className="h-10 font-semibold text-slate-600 text-xs text-right whitespace-nowrap">Total Tagihan</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredTaxRows.slice((currentTaxPage - 1) * PAGE_SIZE, currentTaxPage * PAGE_SIZE).map((r: any) => (
                        <TableRow key={r.id} className="border-slate-50 hover:bg-slate-50/50">
                          <TableCell className="text-center text-xs text-slate-400 whitespace-nowrap">{r.no}</TableCell>
                          <TableCell className="font-mono text-xs text-violet-700 font-semibold whitespace-nowrap">{r.invoiceNumber}</TableCell>
                          <TableCell className="text-xs text-slate-500 whitespace-nowrap">
                            {new Date(r.tanggal).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}
                          </TableCell>
                          <TableCell className="text-sm font-medium text-slate-800 max-w-[160px] truncate">{r.customerName}</TableCell>
                          <TableCell className="text-center whitespace-nowrap"><StatusBadge status={r.status} /></TableCell>
                          <TableCell className="text-right text-sm text-slate-700 whitespace-nowrap">{formatRupiah(r.dpp)}</TableCell>
                          <TableCell className="text-right text-sm text-blue-700 font-semibold whitespace-nowrap">{formatRupiah(r.ppn)}</TableCell>
                          <TableCell className="text-right text-sm font-black text-slate-900 whitespace-nowrap">{formatRupiah(r.total)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Footer Total */}
                <div className="border-t-2 border-slate-300 bg-slate-800 text-white p-4 flex flex-wrap justify-end gap-8">
                  <div className="text-right">
                    <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Total DPP</p>
                    <p className="text-lg font-black">{formatRupiah(taxReport.summary.totalDPP)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Total PPN {taxReport.ppnRate}%</p>
                    <p className="text-lg font-black text-blue-300">{formatRupiah(taxReport.summary.totalPPN)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Grand Total</p>
                    <p className="text-lg font-black text-violet-300">{formatRupiah(taxReport.summary.totalBruto)}</p>
                  </div>
                </div>

                {filteredTaxRows.length > PAGE_SIZE && (
                  <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
                    <div className="bg-white/80 backdrop-blur-md shadow-lg border border-white/50 rounded-full px-2 py-0.5 flex items-center justify-center pointer-events-auto">
                      <PaginationControl currentPage={currentTaxPage} totalPages={Math.ceil(filteredTaxRows.length / PAGE_SIZE)} onPageChange={setCurrentTaxPage} />
                    </div>
                  </div>
                )}
              </div>

              {/* PPN Pie Breakdown */}
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-100">
                  <h3 className="font-bold text-slate-800 text-sm">Komposisi DPP vs PPN</h3>
                </div>
                <div className="p-4 h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={[
                        { name: "DPP (Harga Pokok)", value: taxReport.summary.totalDPP },
                        { name: `PPN ${taxReport.ppnRate}%`, value: taxReport.summary.totalPPN }
                      ]} dataKey="value" cx="50%" cy="50%" innerRadius={45} outerRadius={75} labelLine={false}
                        label={({ name, percent }: any) => `${name} ${(percent * 100).toFixed(1)}%`}>
                        <Cell fill="#6366f1" />
                        <Cell fill="#3b82f6" />
                      </Pie>
                      <Tooltip formatter={(v: number) => formatRupiah(v)} contentStyle={{ borderRadius: "10px", border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.08)", fontSize: "12px" }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-20 bg-white rounded-2xl border border-slate-100">
              <Receipt className="mx-auto mb-3 h-10 w-10 text-slate-200" />
              <p className="text-slate-400">Tidak ada data untuk laporan PPN</p>
            </div>
          )}
        </TabsContent>

        {/* ══════════════════════ TAB: STOK ══════════════════════ */}
        <TabsContent value="stok" className="space-y-5 outline-none flex-1 overflow-y-auto min-h-0 data-[state=inactive]:hidden pb-10">
          {loadingStock ? (
            <div className="space-y-2">{Array(6).fill(0).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
          ) : stockReport ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <KpiCard label="Total Produk" value={String((stockReport as any).totalProducts)} />
                <KpiCard color="violet" label="Total Nilai Stok" value={formatRupiah((stockReport as any).totalValue)} />
                <KpiCard color="rose" label="Stok Rendah" value={`${(stockReport as any).lowStockCount} Produk`} />
              </div>

              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-slate-800">Ringkasan Stok per Produk</h3>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => exportCSV((stockReport as any).products, "laporan-stok", {
                    name: "Nama Barang", categoryName: "Kategori", kgStock: "Stok Kg", kratStock: "Stok Krat", stockValue: "Nilai Stok"
                  })}
                    className="rounded-xl h-8 text-xs font-semibold gap-1.5">
                    <Download className="h-3.5 w-3.5" /> Export CSV
                  </Button>
                </div>

                {/* Mobile Card View */}
                <div className="md:hidden flex flex-col divide-y divide-slate-100">
                  {(stockReport as any).products?.slice((currentStockPage - 1) * PAGE_SIZE, currentStockPage * PAGE_SIZE).map((p: any) => (
                    <div key={p.id} className={`p-4 flex flex-col gap-2 ${p.isLowStock ? "bg-red-50/40" : ""}`}>
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-bold text-slate-800 text-sm">{p.name}</h4>
                          <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full inline-block mt-1">{p.categoryName || "Tanpa Kategori"}</span>
                        </div>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${p.isLowStock ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
                          {p.isLowStock ? "Rendah" : "OK"}
                        </span>
                      </div>
                      <div className="flex justify-between items-end mt-1 pt-2 border-t border-slate-100/60">
                        <div className="flex gap-4">
                          <div>
                            <span className="text-[10px] text-slate-400 block">Stok Kg</span>
                            <span className="text-xs font-bold text-slate-700">{formatNumber(p.kgStock)} m</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 block">Stok Krat</span>
                            <span className="text-xs font-semibold text-slate-600">{formatNumber(p.kratStock)}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-slate-400 block">Nilai</span>
                          <span className="text-xs font-bold text-slate-900">{formatRupiah(p.stockValue)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop Table */}
                <div className="hidden md:block overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-slate-50">
                      <TableRow className="border-slate-100">
                        <TableHead className="h-10 font-semibold text-slate-600 text-xs whitespace-nowrap">Nama Barang</TableHead>
                        <TableHead className="h-10 font-semibold text-slate-600 text-xs whitespace-nowrap">Kategori</TableHead>
                        <TableHead className="h-10 font-semibold text-slate-600 text-xs text-right whitespace-nowrap">Stok Kg</TableHead>
                        <TableHead className="h-10 font-semibold text-slate-600 text-xs text-right whitespace-nowrap">Stok Krat</TableHead>
                        <TableHead className="h-10 font-semibold text-slate-600 text-xs text-right whitespace-nowrap">Nilai Stok</TableHead>
                        <TableHead className="h-10 font-semibold text-slate-600 text-xs text-center whitespace-nowrap">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(stockReport as any).products?.slice((currentStockPage - 1) * PAGE_SIZE, currentStockPage * PAGE_SIZE).map((p: any) => (
                        <TableRow key={p.id} className={`border-slate-50 hover:bg-slate-50/50 ${p.isLowStock ? "bg-red-50/20" : ""}`}>
                          <TableCell className="font-medium text-slate-800 text-sm whitespace-nowrap">{p.name}</TableCell>
                          <TableCell className="text-slate-500 text-sm whitespace-nowrap">{p.categoryName || "—"}</TableCell>
                          <TableCell className="text-right font-semibold text-slate-800 text-sm whitespace-nowrap">{formatNumber(p.kgStock)} m</TableCell>
                          <TableCell className="text-right text-slate-600 text-sm whitespace-nowrap">{formatNumber(p.kratStock)}</TableCell>
                          <TableCell className="text-right font-bold text-slate-900 text-sm whitespace-nowrap">{formatRupiah(p.stockValue)}</TableCell>
                          <TableCell className="text-center whitespace-nowrap">
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${p.isLowStock ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
                              {p.isLowStock ? "Rendah" : "OK"}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {((stockReport as any).products?.length || 0) > PAGE_SIZE && (
                  <div className="flex justify-center pt-2 pb-4">
                    <div className="bg-white/80 backdrop-blur-md shadow-lg border border-white/50 rounded-full px-2 py-0.5">
                      <PaginationControl currentPage={currentStockPage} totalPages={Math.ceil(((stockReport as any).products?.length || 0) / PAGE_SIZE)} onPageChange={setCurrentStockPage} />
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="text-center py-20 bg-white rounded-2xl border border-slate-100">
              <Package className="mx-auto mb-3 h-10 w-10 text-slate-200" />
              <p className="text-slate-400">Tidak ada data stok</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="refunds" className="mt-0 outline-none flex-1 overflow-y-auto min-h-0 data-[state=inactive]:hidden pb-10">
          {isRefundsLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-40 w-full" />
            </div>
          ) : refundsData ? (
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-4 sm:p-6 border-b border-slate-100 flex flex-col sm:flex-row justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    <ArrowDownToLine className="w-5 h-5 text-emerald-600" /> Refund / Transfer Balik
                  </h2>
                  <p className="text-sm text-slate-500">Daftar retur dengan pengembalian dana ke pelanggan</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => exportCSV(refundsData?.rows, "laporan_refund", { no: "No", returnNumber: "No. Retur", invoiceNumber: "No. Invoice", tanggal: "Tanggal", customerName: "Pelanggan", totalRefund: "Total Refund", cashRefunded: "Ditransfer/Tunai", statusRefund: "Status" })}
                  className="rounded-xl h-8 text-xs font-semibold gap-1.5 self-start sm:self-center">
                  <Download className="h-3.5 w-3.5" /> Export CSV
                </Button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-0 border-b border-slate-100">
                <div className="p-4 sm:p-6 border-b sm:border-b-0 sm:border-r border-slate-100">
                  <span className="text-xs font-semibold text-slate-500 uppercase">Total Transaksi</span>
                  <p className="text-2xl font-black text-slate-800 mt-1">{refundsData?.summary?.totalTransactions || 0}</p>
                </div>
                <div className="p-4 sm:p-6 border-b sm:border-b-0 sm:border-r border-slate-100">
                  <span className="text-xs font-semibold text-slate-500 uppercase">Total Tagihan Refund</span>
                  <p className="text-2xl font-black text-rose-600 mt-1">{formatRupiah(refundsData?.summary?.totalRefund || 0)}</p>
                </div>
                <div className="p-4 sm:p-6 bg-emerald-50/50">
                  <span className="text-xs font-semibold text-emerald-700 uppercase">Sudah Ditransfer/Tunai</span>
                  <p className="text-2xl font-black text-emerald-700 mt-1">{formatRupiah(refundsData?.summary?.totalCashRefunded || 0)}</p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow className="border-slate-100">
                      <TableHead className="h-10 font-semibold text-slate-600 text-xs whitespace-nowrap">No. Retur</TableHead>
                      <TableHead className="h-10 font-semibold text-slate-600 text-xs whitespace-nowrap">Tanggal</TableHead>
                      <TableHead className="h-10 font-semibold text-slate-600 text-xs whitespace-nowrap">Pelanggan</TableHead>
                      <TableHead className="h-10 font-semibold text-slate-600 text-xs text-right whitespace-nowrap">Nilai Refund</TableHead>
                      <TableHead className="h-10 font-semibold text-slate-600 text-xs text-right whitespace-nowrap">Ditransfer/Tunai</TableHead>
                      <TableHead className="h-10 font-semibold text-slate-600 text-xs text-center whitespace-nowrap">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {refundsData?.rows?.slice((currentRefundPage - 1) * PAGE_SIZE, currentRefundPage * PAGE_SIZE).map((r: any) => (
                      <TableRow key={r.id} className="border-slate-50 hover:bg-emerald-50/20">
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-mono text-xs text-emerald-700 font-bold">{r.returnNumber}</span>
                            <span className="text-[10px] text-slate-400">Inv: {r.invoiceNumber}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-slate-500 whitespace-nowrap">
                          {new Date(r.tanggal).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}
                        </TableCell>
                        <TableCell className="text-sm font-medium text-slate-800 whitespace-nowrap">{r.customerName}</TableCell>
                        <TableCell className="text-right font-semibold text-rose-600 text-sm whitespace-nowrap">{formatRupiah(r.totalRefund)}</TableCell>
                        <TableCell className="text-right text-sm text-emerald-700 font-bold whitespace-nowrap">{formatRupiah(r.cashRefunded)}</TableCell>
                        <TableCell className="text-center whitespace-nowrap">
                          <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase ${r.cashRefunded > 0 ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                            {r.statusRefund}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                    {refundsData?.rows?.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-10 text-slate-400">
                          Tidak ada data refund/transfer balik.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              {(refundsData?.rows?.length || 0) > PAGE_SIZE && (
                <div className="flex justify-center py-4 border-t border-slate-100">
                  <PaginationControl currentPage={currentRefundPage} totalPages={Math.ceil((refundsData?.rows?.length || 0) / PAGE_SIZE)} onPageChange={setCurrentRefundPage} />
                </div>
              )}
            </div>
          ) : null}
        </TabsContent>
      </Tabs>
    </div>
  );
}
