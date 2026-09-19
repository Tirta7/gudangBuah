import { useMemo } from "react";
import { useSettings } from "@/hooks/useSettings";
import { useLocation, Link } from "wouter";
import { 
  Tags, Package2, UserCircle2, Building2, Receipt, ShoppingBasket, 
  ArrowLeftRight, Landmark, CreditCard, BookMarked, BarChart3, TrendingDown,
  Search, Bell, Wallet, ArrowUpRight, Plus, MoreHorizontal, ChevronRight,
  TrendingUp, Store, RefreshCcw, Settings, Users
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useGetDashboardSalesChart, getGetDashboardSalesChartQueryKey, useListSales, getListSalesQueryKey } from "@workspace/api-client-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { formatRupiah } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";

const VIOLET = "#8b5cf6";

export default function Home() {
  const { data: settings } = useSettings();
  const [, setLocation] = useLocation();

  const appName = settings?.["app_name"] || "Gudang Buah";
  const appAddress = settings?.["app_address"] || "Alamat belum diatur (Ubah di Pengaturan)";

  const { data: chartData, isLoading: loadingChart } = useGetDashboardSalesChart({}, { query: { queryKey: getGetDashboardSalesChartQueryKey({}) } });

  // Determine today's sales for the wallet card mock
  const todaySales = chartData && chartData.length > 0 ? chartData[chartData.length - 1].revenue : 0;

  // Fetch real recent sales
  const { data: salesList } = useListSales({}, { query: { queryKey: getListSalesQueryKey({}) } });
  const recentSales = salesList?.slice(0, 5) || [];

  const summaryData = useMemo(() => {
    if (!salesList) return { subTotal: 0, diBayar: 0, sisaBayar: 0, count: 0, totalRefund: 0 };
    return salesList.reduce((acc, s: any) => {
      const baseTotal = parseFloat(s.totalAmount || "0");
      const diffTotal = s.returnDifference ? parseFloat(s.returnDifference) : 0;
      const grandTotal = baseTotal + diffTotal;
      
      const basePaid = parseFloat(s.paidAmount || "0");
      const diffPaid = (s as any).returnDifferencePaid ? parseFloat((s as any).returnDifferencePaid) : 0;
      const actualPaid = basePaid + diffPaid;
      
      const rem = grandTotal - actualPaid;

      const refundAmount = s.returnDifference ? parseFloat(s.returnDifference) : 0;
      const refundVal = refundAmount < 0 ? Math.abs(refundAmount) : 0;
      
      acc.subTotal += grandTotal;
      acc.diBayar += actualPaid;
      acc.sisaBayar += (rem > 0 ? rem : 0);
      acc.totalRefund += refundVal;
      acc.count += 1;
      return acc;
    }, { subTotal: 0, diBayar: 0, sisaBayar: 0, count: 0, totalRefund: 0 });
  }, [salesList]);

  const allMenuItems = [
    { name: "Kategori", href: "/kategori", icon: Tags, color: "text-blue-600", bg: "bg-blue-100", badge: "" },
    { name: "Barang", href: "/barang", icon: Package2, color: "text-amber-600", bg: "bg-amber-100", badge: "UPDATE" },
    { name: "Pelanggan", href: "/pelanggan", icon: UserCircle2, color: "text-emerald-600", bg: "bg-emerald-100", badge: "" },
    { name: "Supplier", href: "/supplier", icon: Building2, color: "text-orange-600", bg: "bg-orange-100", badge: "" },
    { name: "Penjualan", href: "/penjualan", icon: Receipt, color: "text-violet-600", bg: "bg-violet-100", badge: "HOT" },
    { name: "Pembelian", href: "/pembelian", icon: ShoppingBasket, color: "text-pink-600", bg: "bg-pink-100", badge: "" },
    { name: "Mutasi", href: "/mutasi", icon: ArrowLeftRight, color: "text-cyan-600", bg: "bg-cyan-100", badge: "" },
    { name: "Piutang", href: "/piutang", icon: Landmark, color: "text-red-600", bg: "bg-red-100", badge: "" },
    { name: "Hutang", href: "/hutang", icon: CreditCard, color: "text-rose-600", bg: "bg-rose-100", badge: "" },
    { name: "Buku Kas", href: "/buku-kas", icon: BookMarked, color: "text-amber-700", bg: "bg-amber-200", badge: "" },
    { name: "Retur", href: "/retur", icon: RefreshCcw, color: "text-teal-600", bg: "bg-teal-100", badge: "NEW" },
    { name: "Laporan", href: "/laporan", icon: BarChart3, color: "text-indigo-600", bg: "bg-indigo-100", badge: "" },
    { name: "Karyawan", href: "/karyawan", icon: Users, color: "text-sky-600", bg: "bg-sky-100", badge: "" },
    { name: "Pengaturan", href: "/pengaturan", icon: Settings, color: "text-slate-600", bg: "bg-slate-200", badge: "" },
  ];

  const primaryMenuItems = allMenuItems.filter(item => item.name !== "Mutasi").slice(0, 7);

  return (
    <div className="bg-slate-50 min-h-screen pb-14 -mt-[max(0.75rem,env(safe-area-inset-top))] md:-mt-4 lg:-mt-5 -mx-3 md:-mx-4 lg:-mx-5 overflow-x-hidden">
      
      {/* Gojek-style Top Banner */}
      <div 
        className="w-full px-4 md:px-8 pt-[max(1.5rem,env(safe-area-inset-top))] md:pt-12 pb-24 md:pb-32 relative overflow-hidden rounded-b-[2.5rem] md:rounded-b-[4rem] z-10"
        style={{ background: "linear-gradient(135deg, #4f46e5, #9333ea, #c026d3)" }}
      >
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
        
        <div className="max-w-7xl mx-auto">
          {/* Search & Profile Row */}
          <div className="flex items-center gap-3 relative z-20 mb-6">
            <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input 
              placeholder={`Cari di ${appName}...`} 
              className="w-full pl-10 h-10 rounded-full border-none shadow-inner bg-white/95 focus-visible:ring-2 focus-visible:ring-white/50 text-sm"
            />
          </div>
          <Button size="icon" variant="ghost" className="rounded-full bg-white/20 hover:bg-white/30 text-white shrink-0 h-10 w-10">
            <UserCircle2 className="h-6 w-6" />
          </Button>
        </div>

          {/* Hero Text */}
          <div className="relative z-20 px-1">
            <h1 className="text-2xl md:text-4xl font-extrabold text-white mb-1 md:mb-2 drop-shadow-md">Halo, Admin! 👋</h1>
            <p className="text-white/80 text-xs md:text-sm font-medium max-w-[80%] line-clamp-1">{appAddress}</p>
          </div>
        </div>
      </div>

      {/* Floating Summary Card (Wallet style) */}
      <div className="px-4 md:px-8 -mt-14 md:-mt-20 relative z-20 max-w-7xl mx-auto">
        <Card className="rounded-2xl border-none shadow-[0_8px_30px_rgb(0,0,0,0.08)] bg-white overflow-hidden">
          <CardContent className="p-0">
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-violet-100 flex items-center justify-center text-violet-600">
                  <Wallet className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-medium mb-0.5">Penjualan Hari Ini</p>
                  <h3 className="font-bold text-lg text-slate-800 leading-none">
                    {loadingChart ? <Skeleton className="h-5 w-24" /> : formatRupiah(todaySales)}
                  </h3>
                </div>
              </div>
            </div>
            
            {/* Quick Actions in Wallet */}
            <div className="grid grid-cols-3 divide-x divide-slate-100 bg-slate-50/50">
              <Link href="/penjualan">
                <div className="flex flex-col items-center justify-center py-3 gap-1.5 cursor-pointer hover:bg-slate-100 transition-colors">
                  <div className="h-6 w-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center"><ArrowUpRight className="h-3.5 w-3.5" /></div>
                  <span className="text-[10px] font-semibold text-slate-600">Buat Nota</span>
                </div>
              </Link>
              <Link href="/barang">
                <div className="flex flex-col items-center justify-center py-3 gap-1.5 cursor-pointer hover:bg-slate-100 transition-colors">
                  <div className="h-6 w-6 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center"><Plus className="h-3.5 w-3.5" /></div>
                  <span className="text-[10px] font-semibold text-slate-600">Stok Baru</span>
                </div>
              </Link>
              <Link href="/laporan">
                <div className="flex flex-col items-center justify-center py-3 gap-1.5 cursor-pointer hover:bg-slate-100 transition-colors">
                  <div className="h-6 w-6 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center"><TrendingUp className="h-3.5 w-3.5" /></div>
                  <span className="text-[10px] font-semibold text-slate-600">Laporan</span>
                </div>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Grid Icons */}
      <div className="px-4 md:px-8 py-6 mt-2 max-w-7xl mx-auto">
        {/* Desktop: Show all items without drawer */}
        <div className="hidden md:grid grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-y-8 gap-x-4">
          {allMenuItems.map((item) => (
            <Link key={item.name} href={item.href}>
              <div className="flex flex-col items-center gap-2 cursor-pointer group relative">
                {item.badge && (
                  <span className="absolute -top-2 -right-2 z-10 bg-red-500 text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded-full shadow-sm border-2 border-white">
                    {item.badge}
                  </span>
                )}
                <div className={`w-[70px] h-[70px] rounded-2xl flex items-center justify-center ${item.bg} group-hover:scale-105 transition-transform relative overflow-hidden shadow-sm`}>
                  <item.icon className={`w-8 h-8 ${item.color} relative z-10`} strokeWidth={2} />
                </div>
                <span className="text-xs font-semibold text-slate-700 text-center tracking-tight leading-tight w-full truncate px-1">
                  {item.name}
                </span>
              </div>
            </Link>
          ))}
        </div>

        {/* Mobile: Show limited items + Lainnya */}
        <div className="grid md:hidden grid-cols-4 gap-y-6 gap-x-2">
          {primaryMenuItems.map((item) => (
            <Link key={item.name} href={item.href}>
              <div className="flex flex-col items-center gap-2 cursor-pointer group relative">
                {item.badge && (
                  <span className="absolute -top-2 -right-1 z-10 bg-red-500 text-white text-[8px] font-extrabold px-1.5 py-0.5 rounded-full shadow-sm border-2 border-white">
                    {item.badge}
                  </span>
                )}
                <div className={`w-[60px] h-[60px] rounded-[18px] flex items-center justify-center ${item.bg} group-active:scale-95 transition-transform relative overflow-hidden shadow-sm`}>
                  <item.icon className={`w-7 h-7 ${item.color} relative z-10`} strokeWidth={2} />
                </div>
                <span className="text-[11px] font-medium text-slate-700 text-center tracking-tight leading-tight w-full truncate px-1">
                  {item.name}
                </span>
              </div>
            </Link>
          ))}
          
          {/* Lainnya Button with Drawer */}
          <Drawer>
            <DrawerTrigger asChild>
              <div className="flex flex-col items-center gap-2 cursor-pointer group relative">
                <div className="w-[60px] h-[60px] rounded-[18px] flex items-center justify-center bg-slate-100 group-active:scale-95 transition-transform relative overflow-hidden shadow-sm">
                  <MoreHorizontal className="w-7 h-7 text-slate-600 relative z-10" strokeWidth={2} />
                </div>
                <span className="text-[11px] font-medium text-slate-700 text-center tracking-tight leading-tight w-full truncate px-1">
                  Lainnya
                </span>
              </div>
            </DrawerTrigger>
            <DrawerContent
              className="mx-auto w-full max-w-2xl px-4 pb-[max(1.5rem,env(safe-area-inset-bottom,0px))] pt-2"
              style={{ maxHeight: 'calc(95dvh - env(safe-area-inset-top, 0px))' }}
            >
              <DrawerHeader className="text-left border-b pb-3 px-0">
                <DrawerTitle className="text-[15px] font-bold text-slate-800">Semua Fitur</DrawerTitle>
              </DrawerHeader>
              <div className="overflow-y-auto flex-1 py-4 grid grid-cols-4 gap-y-6 gap-x-2">
                {allMenuItems.map((item) => (
                  <Link key={item.name} href={item.href}>
                    <div className="flex flex-col items-center gap-2 cursor-pointer group relative">
                      {item.badge && (
                        <span className="absolute -top-2 -right-1 z-10 bg-red-500 text-white text-[8px] font-extrabold px-1.5 py-0.5 rounded-full shadow-sm border-2 border-white">
                          {item.badge}
                        </span>
                      )}
                      <div className={`w-[60px] h-[60px] rounded-[18px] flex items-center justify-center ${item.bg} group-active:scale-95 transition-transform relative overflow-hidden shadow-sm`}>
                        <item.icon className={`w-7 h-7 ${item.color} relative z-10`} strokeWidth={2} />
                      </div>
                      <span className="text-[11px] font-medium text-slate-700 text-center tracking-tight leading-tight w-full truncate px-1">
                        {item.name}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </DrawerContent>
          </Drawer>
        </div>
      </div>

      {/* Promo Banner / Info Section */}
      <div className="px-4 md:px-8 mb-6 max-w-7xl mx-auto">
        <div className="rounded-2xl bg-linear-to-r from-emerald-400 to-teal-500 p-4 md:p-6 flex items-center justify-between shadow-md text-white relative overflow-hidden">
          <div className="absolute right-0 top-0 opacity-10"><Store className="h-32 w-32 -mt-4 -mr-4" /></div>
          <div className="relative z-10">
            <h4 className="font-bold text-sm mb-0.5">Kelola Toko Lebih Mudah</h4>
            <p className="text-xs text-white/90">Cek laporan penjualan harian Anda sekarang.</p>
          </div>
          <Link href="/laporan">
            <Button size="sm" variant="secondary" className="rounded-full text-xs font-bold px-4 h-8 relative z-10">Cek <ChevronRight className="h-3 w-3 ml-1" /></Button>
          </Link>
        </div>
      </div>
      
      {/* Rekap Summary on Home */}
      <div className="px-4 md:px-8 mb-6 max-w-7xl mx-auto">
        <div className="bg-white rounded-[24px] p-5 sm:p-6 shadow-sm border border-slate-100/60 relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
           
           <div className="flex items-center gap-4 relative z-10">
             <div className="w-12 h-12 rounded-[16px] bg-emerald-50 flex items-center justify-center text-emerald-600 border border-emerald-100 shrink-0">
               <Receipt className="w-6 h-6" strokeWidth={1.5} />
             </div>
             <div>
               <h2 className="font-bold text-slate-800 text-base">Rekap Semua Penjualan</h2>
               <p className="text-xs font-medium text-slate-400 mt-0.5">{summaryData.count} Transaksi Ditemukan</p>
             </div>
           </div>
           
           <div className="w-full md:w-auto grid grid-cols-2 gap-x-6 gap-y-4 sm:gap-x-10 relative z-10">
             <div className="flex flex-col">
               <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total Omset</span>
               <span className="font-bold text-slate-800 text-sm sm:text-base leading-none">{formatRupiah(summaryData.subTotal)}</span>
             </div>
             <div className="flex flex-col">
               <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Kas Diterima</span>
               <span className="font-bold text-emerald-600 text-sm sm:text-base leading-none">{formatRupiah(summaryData.diBayar)}</span>
             </div>
             <div className="flex flex-col pt-3 border-t border-slate-100 border-dashed">
               <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Refund Kas</span>
               <span className="font-bold text-amber-600 text-sm sm:text-base leading-none">{formatRupiah(summaryData.totalRefund)}</span>
             </div>
             <div className="flex flex-col pt-3 border-t border-slate-100 border-dashed">
               <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total Piutang</span>
               <span className="font-bold text-rose-600 text-sm sm:text-base leading-none">{formatRupiah(summaryData.sisaBayar)}</span>
             </div>
           </div>
        </div>
      </div>

      {/* Bottom Content Grid (Desktop) */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6 px-4 md:px-8 pb-8">
        
        {/* Horizontal scroll Cards (Recent Sales) */}
        <div>
          <div className="flex items-center justify-between pr-4 mb-3">
            <h3 className="font-bold text-slate-800 text-sm">Akses Cepat Transaksi</h3>
            <Link href="/penjualan">
              <span className="text-xs font-semibold text-violet-600 cursor-pointer">Lihat Semua</span>
            </Link>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-4 pr-4 snap-x [&::-webkit-scrollbar]:hidden">
            {recentSales.length > 0 ? recentSales.map((sale) => (
              <div key={sale.id} className="min-w-[200px] w-[200px] bg-white rounded-2xl p-3 border border-slate-100 shadow-sm snap-start shrink-0">
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-8 w-8 rounded-full bg-violet-100 flex items-center justify-center text-violet-700 font-bold text-xs uppercase">
                    {(sale.customerName && sale.customerName !== "Umum") ? sale.customerName.substring(0, 1) : "U"}
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-500 font-medium truncate w-28">
                      {sale.customerName || "Pelanggan Umum"}
                    </p>
                    <p className="text-xs font-bold text-slate-800 truncate">
                      {new Date(sale.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                    </p>
                  </div>
                </div>
                <div className="flex flex-col mt-3 pt-2 border-t border-dashed border-slate-200 gap-1.5">
                  <div className="flex items-center justify-between">
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-md ${
                      sale.status === 'lunas' ? 'text-emerald-600 bg-emerald-50' : 
                      sale.status === 'piutang' ? 'text-rose-600 bg-rose-50' : 
                      'text-slate-600 bg-slate-50'
                    }`}>
                      <span className="capitalize">{sale.status || 'lunas'}</span>
                    </span>
                    <span className="text-xs font-bold">{formatRupiah(sale.totalAmount)}</span>
                  </div>
                  {(sale as any).hasReturns && (
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded border border-amber-200 text-amber-700 bg-amber-50 uppercase tracking-widest">
                        Retur/Tukar
                      </span>
                      {((sale as any).returnDifference !== undefined && (sale as any).returnDifference !== 0) && (
                        <span className={`text-[9px] font-bold ${(sale as any).returnDifference > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                          {(sale as any).returnDifference > 0 
                            ? `(+Rp ${new Intl.NumberFormat('id-ID').format((sale as any).returnDifference)})` 
                            : `(-Rp ${new Intl.NumberFormat('id-ID').format(Math.abs((sale as any).returnDifference))})`}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )) : (
              <div className="text-xs text-muted-foreground italic px-2 py-4">Belum ada transaksi...</div>
            )}
          </div>
        </div>
        
        {/* Chart Section for Dashboard Context */}
        <div>
          <Card className="rounded-2xl border-none shadow-[0_4px_20px_rgb(0,0,0,0.05)] bg-white overflow-hidden h-full">
            <CardContent className="p-4 h-full flex flex-col">
              <h3 className="font-bold text-slate-800 text-sm mb-4">Grafik Penjualan Bulan Ini</h3>
              <div className="flex-1 min-h-[200px] w-full">
              {loadingChart ? (
                <Skeleton className="h-full w-full rounded-lg" />
              ) : chartData && chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 5, right: 0, bottom: 0, left: -20 }}>
                    <defs>
                      <linearGradient id="revenueGradHome" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={VIOLET} stopOpacity={0.3} />
                        <stop offset="100%" stopColor={VIOLET} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={10}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => `${v / 1000000}M`}
                    />
                    <Tooltip
                      formatter={(value: number) => [formatRupiah(value), "Pendapatan"]}
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                      labelStyle={{ fontWeight: 'bold', color: '#1e293b', marginBottom: '4px' }}
                    />
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      stroke={VIOLET}
                      strokeWidth={3}
                      fillOpacity={1}
                      fill="url(#revenueGradHome)"
                      activeDot={{ r: 6, fill: VIOLET, stroke: '#fff', strokeWidth: 2 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-slate-400 text-sm italic">Belum ada data penjualan</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
    </div>
  );
}
