import { useGetDashboardSummary, useGetDashboardSalesChart, useGetDashboardRecentTransactions, useGetDashboardTopProducts, useGetDashboardReceivablesSummary, getGetDashboardSummaryQueryKey, getGetDashboardSalesChartQueryKey, getGetDashboardRecentTransactionsQueryKey, getGetDashboardTopProductsQueryKey, getGetDashboardReceivablesSummaryQueryKey } from "@workspace/api-client-react";
import { PageHeader } from "../components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { cn, formatRupiah } from "@/lib/utils";
import { AlertTriangle, ArrowDownRight, ArrowUpRight, Clock, CreditCard, DollarSign, Package2, Receipt, ShoppingCart, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Badge } from "@/components/ui/badge";

const VIOLET = "#8b5cf6";
const INDIGO = "#6366f1";

export default function Dashboard() {
  const { data: summary, isLoading: loadingSummary } = useGetDashboardSummary({ query: { queryKey: getGetDashboardSummaryQueryKey() } });
  const { data: chartData, isLoading: loadingChart } = useGetDashboardSalesChart({}, { query: { queryKey: getGetDashboardSalesChartQueryKey({}) } });
  const { data: recent, isLoading: loadingRecent } = useGetDashboardRecentTransactions({ query: { queryKey: getGetDashboardRecentTransactionsQueryKey() } });
  const { data: topProducts, isLoading: loadingTop } = useGetDashboardTopProducts({ query: { queryKey: getGetDashboardTopProductsQueryKey() } });
  const { data: receivables, isLoading: loadingReceivables } = useGetDashboardReceivablesSummary({ query: { queryKey: getGetDashboardReceivablesSummaryQueryKey() } });

  return (
    <div className="space-y-7 max-w-[2400px] mx-auto w-full">

      {/* Page header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Ringkasan performa bisnis tekstil Anda hari ini.</p>
        </div>
      </div>

      {/* Top KPI row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Pendapatan Hari Ini"
          value={summary?.todayRevenue ? formatRupiah(summary.todayRevenue) : "Rp 0"}
          icon={DollarSign}
          loading={loadingSummary}
          gradient="from-violet-500/15 via-violet-500/8 to-transparent"
          iconBg="bg-violet-500/15 text-violet-600 dark:text-violet-400"
          trend="up"
        />
        <KpiCard
          label="Transaksi Hari Ini"
          value={summary?.todayTransactions?.toString() ?? "0"}
          icon={ShoppingCart}
          loading={loadingSummary}
          gradient="from-indigo-500/15 via-indigo-500/8 to-transparent"
          iconBg="bg-indigo-500/15 text-indigo-600 dark:text-indigo-400"
        />
        <KpiCard
          label="Saldo Kas"
          value={summary?.cashBalance ? formatRupiah(summary.cashBalance) : "Rp 0"}
          icon={Wallet}
          loading={loadingSummary}
          gradient="from-emerald-500/15 via-emerald-500/8 to-transparent"
          iconBg="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
          trend="up"
        />
        <KpiCard
          label="Total Piutang"
          value={summary?.totalReceivables ? formatRupiah(summary.totalReceivables) : "Rp 0"}
          icon={TrendingUp}
          loading={loadingSummary}
          gradient="from-blue-500/15 via-blue-500/8 to-transparent"
          iconBg="bg-blue-500/15 text-blue-600 dark:text-blue-400"
        />
      </div>

      {/* Alert row */}
      <div className="grid gap-4 sm:grid-cols-3">
        <AlertCard
          label="Piutang Jatuh Tempo"
          value={`${summary?.overdueReceivables ?? 0} Invoice`}
          sub={receivables?.overdueAmount ? `Senilai ${formatRupiah(receivables.overdueAmount)}` : "Semua lancar"}
          icon={Clock}
          variant="danger"
          loading={loadingSummary || loadingReceivables}
        />
        <AlertCard
          label="Stok Hampir Habis"
          value={`${summary?.lowStockCount ?? 0} Barang`}
          sub={summary?.lowStockCount ? "Perlu segera direstock" : "Stok aman"}
          icon={AlertTriangle}
          variant="warning"
          loading={loadingSummary}
        />
        <AlertCard
          label="Total Hutang"
          value={summary?.totalPayables ? formatRupiah(summary.totalPayables) : "Rp 0"}
          sub="Outstanding payables"
          icon={CreditCard}
          variant="neutral"
          loading={loadingSummary}
        />
      </div>

      {/* Charts row */}
      <div className="grid gap-5 lg:grid-cols-7">
        <Card className="lg:col-span-4 overflow-hidden">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold">Revenue Overview</CardTitle>
                <CardDescription className="text-xs mt-0.5">Performa penjualan bulan ini</CardDescription>
              </div>
              <div className="text-xs text-muted-foreground bg-muted px-2.5 py-1 rounded-lg font-medium">
                {new Date().toLocaleDateString("id-ID", { month: "long", year: "numeric" })}
              </div>
            </div>
          </CardHeader>
          <CardContent className="h-[260px] px-2">
            {loadingChart ? (
              <Skeleton className="h-full w-full rounded-lg" />
            ) : chartData && chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 5, right: 16, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={VIOLET} stopOpacity={0.25} />
                      <stop offset="100%" stopColor={VIOLET} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => `${v / 1000000}M`}
                    width={40}
                  />
                  <Tooltip
                    formatter={(value: number) => [formatRupiah(value), "Revenue"]}
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      borderColor: "hsl(var(--border))",
                      borderRadius: "12px",
                      fontSize: 12,
                      boxShadow: "0 8px 32px rgba(0,0,0,0.12)"
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke={VIOLET}
                    strokeWidth={2.5}
                    fill="url(#revenueGrad)"
                    dot={{ r: 3, fill: VIOLET, strokeWidth: 0 }}
                    activeDot={{ r: 5, fill: VIOLET, strokeWidth: 2, stroke: "#fff" }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-2">
                <TrendingDown size={32} className="opacity-30" />
                <p className="text-sm">Belum ada data penjualan</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Top Produk</CardTitle>
            <CardDescription className="text-xs mt-0.5">Revenue tertinggi bulan ini</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingTop ? (
              <div className="space-y-4">
                {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-11 w-full rounded-lg" />)}
              </div>
            ) : topProducts && topProducts.length > 0 ? (
              <div className="space-y-2">
                {topProducts.slice(0, 5).map((product, idx) => (
                  <div key={product.productId} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-muted/60 transition-colors">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white shrink-0"
                      style={{
                        background: idx === 0
                          ? "linear-gradient(135deg, #f59e0b, #d97706)"
                          : idx === 1
                          ? "linear-gradient(135deg, #94a3b8, #64748b)"
                          : idx === 2
                          ? "linear-gradient(135deg, #cd7c3a, #b45309)"
                          : "linear-gradient(135deg, #8b5cf6, #6366f1)"
                      }}
                    >
                      {idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{product.productName}</div>
                      <div className="text-xs text-muted-foreground">
                        {product.totalKrats} krat · {product.totalKgs} m
                      </div>
                    </div>
                    <div className="text-sm font-bold text-right shrink-0">
                      {formatRupiah(product.totalRevenue)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
                <Package2 size={32} className="opacity-30" />
                <p className="text-sm">Belum ada data produk</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent transactions */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold">Transaksi Terbaru</CardTitle>
              <CardDescription className="text-xs mt-0.5">10 aktivitas transaksi terakhir</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loadingRecent ? (
            <div className="space-y-3">
              {[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
            </div>
          ) : recent && recent.length > 0 ? (
            <div className="space-y-2">
              {recent.map((tx) => {
                const isIncome = tx.type === "sale" || tx.type === "PAYMENT_IN";
                return (
                  <div
                    key={`${tx.type}-${tx.id}`}
                    className="flex items-center gap-4 p-3.5 rounded-xl border border-border/60 hover:border-border hover:bg-muted/30 transition-all"
                  >
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                      isIncome ? "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400" : "bg-violet-500/12 text-violet-600 dark:text-violet-400"
                    )}>
                      {isIncome ? <ArrowUpRight size={18} /> : <ArrowDownRight size={18} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold truncate">{tx.description}</span>
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0 capitalize">
                          {String(tx.type).toLowerCase()}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <div className="text-xs text-muted-foreground truncate">
                          {tx.customerName ? `${tx.customerName} · ` : ""}
                          {new Date(tx.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                        </div>
                        {(tx as any).hasReturns && (
                          <div className="flex items-center gap-1">
                            <Badge variant="outline" className="text-[8px] h-3 py-0 px-1 border-amber-200 text-amber-700 bg-amber-50 uppercase tracking-widest font-bold">
                              Retur/Tukar
                            </Badge>
                            {((tx as any).returnDifference !== undefined && (tx as any).returnDifference !== 0) && (
                              <span className={`text-[9px] font-bold ${(tx as any).returnDifference > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                                {(tx as any).returnDifference > 0 
                                  ? `(+Rp ${new Intl.NumberFormat('id-ID').format((tx as any).returnDifference)})` 
                                  : `(-Rp ${new Intl.NumberFormat('id-ID').format(Math.abs((tx as any).returnDifference))})`}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className={cn(
                      "font-bold text-sm text-right shrink-0",
                      isIncome ? "text-emerald-600 dark:text-emerald-400" : "text-foreground"
                    )}>
                      {isIncome ? "+" : "-"}{formatRupiah(tx.amount)}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
              <Receipt size={32} className="opacity-30" />
              <p className="text-sm">Belum ada transaksi</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function KpiCard({
  label, value, icon: Icon, loading, gradient, iconBg, trend
}: {
  label: string; value: string; icon: any; loading?: boolean;
  gradient: string; iconBg: string; trend?: "up" | "down";
}) {
  return (
    <Card className="relative overflow-hidden border-border/70 hover:border-border transition-colors hover:shadow-md">
      <div className={cn("absolute inset-0 bg-linear-to-br", gradient)} />
      <CardHeader className="relative flex flex-row items-start justify-between space-y-0 pb-2 pt-5 px-5">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</p>
        <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center shrink-0", iconBg)}>
          <Icon size={16} />
        </div>
      </CardHeader>
      <CardContent className="relative px-5 pb-5">
        {loading ? (
          <Skeleton className="h-8 w-[130px] mt-1" />
        ) : (
          <div className="flex items-end gap-2">
            <div className="text-2xl font-bold tracking-tight">{value}</div>
            {trend && (
              <div className={cn(
                "flex items-center gap-0.5 text-xs font-semibold mb-0.5",
                trend === "up" ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"
              )}>
                {trend === "up" ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AlertCard({
  label, value, sub, icon: Icon, variant, loading
}: {
  label: string; value: string; sub: string; icon: any;
  variant: "danger" | "warning" | "neutral"; loading?: boolean;
}) {
  const styles = {
    danger:  { card: "border-red-200/70 dark:border-red-500/20",   bg: "bg-red-500/8",    icon: "bg-red-500/12 text-red-600 dark:text-red-400",   text: "text-red-600 dark:text-red-400" },
    warning: { card: "border-amber-200/70 dark:border-amber-500/20", bg: "bg-amber-500/8", icon: "bg-amber-500/12 text-amber-600 dark:text-amber-400", text: "text-amber-600 dark:text-amber-400" },
    neutral: { card: "border-border/70",   bg: "",                   icon: "bg-muted text-muted-foreground",  text: "text-foreground" },
  }[variant];

  return (
    <Card className={cn("relative overflow-hidden", styles.card)}>
      <div className={cn("absolute inset-0", styles.bg)} />
      <CardContent className="relative p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</p>
          <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center", styles.icon)}>
            <Icon size={14} />
          </div>
        </div>
        {loading ? (
          <Skeleton className="h-7 w-[100px]" />
        ) : (
          <>
            <div className={cn("text-xl font-bold tracking-tight", styles.text)}>{value}</div>
            <p className="text-xs text-muted-foreground mt-1">{sub}</p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
