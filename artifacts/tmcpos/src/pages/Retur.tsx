import { useState, useMemo, useEffect } from "react";
import { PageHeader } from "../components/PageHeader";
import { PaginationControl } from "../components/PaginationControl";
import { useListReturns, useCreateReturn, useListProducts, getListReturnsQueryKey, useListSales, useListPurchases, useGetSale, useGetPurchase, getGetSaleQueryKey, getGetPurchaseQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, RefreshCcw, Trash2, Search, Printer } from "lucide-react";
import { OtpDialog } from "../components/OtpDialog";
import { useToast } from "@/hooks/use-toast";
import { formatRupiah, formatDate } from "@/lib/utils";
import { DateRangeFilter, filterByDateRange } from "@/components/DateRangeFilter";
import { ReturnInvoiceModal } from "@/components/ReturnInvoiceModal";

type ReturnItemForm = { productId: number; productName: string; krats: number | ""; kgs: number | ""; pricePerKg: number | ""; subtotal: number; };

function ReturItemRow({ item, index, products, updateItem, removeItem, label }: any) {
  return (
    <div className="flex flex-col md:grid md:grid-cols-12 gap-3 md:items-end p-4 bg-white/50 dark:bg-slate-950/50 rounded-xl border border-border/50 shadow-sm mb-3">
      <div className="md:col-span-4">
        <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Pilih Barang {label}</label>
        <Select 
          key={item.productId ? `select-${item.productId}` : `select-empty`}
          value={item.productId ? item.productId.toString() : undefined} 
          onValueChange={(val: string) => {
            const p = products?.find((p: any) => p.id.toString() === val);
            if (p) {
              updateItem(index, { productId: p.id, productName: p.name, pricePerKg: p.pricePerKg || 0 });
            }
          }}
        >
          <SelectTrigger className="h-12 bg-white/80 dark:bg-slate-900/80">
            <SelectValue placeholder={item.productName || "Pilih barang..."} />
          </SelectTrigger>
          <SelectContent>
            {products?.map((p: any) => (
              <SelectItem key={p.id} value={p.id.toString()} className="py-2.5">{p.name}</SelectItem>
            ))}
            {item.productId && (!products || !products.some((p: any) => p.id.toString() === item.productId.toString())) && (
              <SelectItem value={item.productId.toString()} className="py-2.5">{item.productName || `Barang Tidak Diketahui`}</SelectItem>
            )}
          </SelectContent>
        </Select>
      </div>
      <div className="md:col-span-2">
        <label className="text-xs font-semibold text-muted-foreground mb-1.5 block truncate">Jml (Krat)</label>
        <Input type="number" value={item.krats} onChange={(e) => updateItem(index, { krats: e.target.value ? Number(e.target.value) : "" })} className="h-12 bg-white/80 dark:bg-slate-900/80 text-center font-medium" min="0" placeholder="0" />
      </div>
      <div className="md:col-span-2">
        <label className="text-xs font-semibold text-muted-foreground mb-1.5 block truncate">Jml (Kg)</label>
        <Input type="number" value={item.kgs} onChange={(e) => updateItem(index, { kgs: e.target.value ? Number(e.target.value) : "" })} className="h-12 bg-white/80 dark:bg-slate-900/80 text-center font-medium" min="0" step="0.1" placeholder="0" />
      </div>
      <div className="md:col-span-2">
        <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Harga/m</label>
        <Input type="number" value={item.pricePerKg} onChange={(e) => updateItem(index, { pricePerKg: e.target.value ? Number(e.target.value) : "" })} className="h-12 bg-white/80 dark:bg-slate-900/80 font-medium" min="0" />
      </div>
      <div className="md:col-span-2 flex items-center gap-2">
        <div className="flex-1">
          <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Subtotal</label>
          <div className="h-12 flex items-center px-3 text-base font-bold bg-muted/50 rounded-md border border-transparent">{formatRupiah(item.subtotal)}</div>
        </div>
        <div className="pt-5 shrink-0">
          <Button variant="destructive" size="icon" onClick={() => removeItem(index)} className="h-12 w-12 shrink-0 shadow-sm hover:shadow-md transition-all"><Trash2 className="w-5 h-5" /></Button>
        </div>
      </div>
    </div>
  );
}

export default function Retur() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const itemsPerPage = 10;
  
  const { data: returns, isLoading } = useListReturns();
  const { data: products } = useListProducts();
  const { data: sales } = useListSales();
  const { data: purchases } = useListPurchases();
  
  const createReturn = useCreateReturn();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [previewReturnId, setPreviewReturnId] = useState<number | null>(null);
  
  // Form State
  const [type, setType] = useState<"penjualan" | "pembelian">("penjualan");
  const [paymentStatus, setPaymentStatus] = useState<"lunas" | "tempo">("lunas");
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>("");
  const [returnedItems, setReturnedItems] = useState<ReturnItemForm[]>([]);
  const [exchangedItems, setExchangedItems] = useState<ReturnItemForm[]>([]);
  const [otpDialogOpen, setOtpDialogOpen] = useState(false);
  const [returnOtpToken, setReturnOtpToken] = useState("");
  
  const saleQuery = useGetSale(parseInt(selectedInvoiceId || "0"), {
    query: { 
      enabled: type === 'penjualan' && !!selectedInvoiceId && isDrawerOpen,
      queryKey: getGetSaleQueryKey(parseInt(selectedInvoiceId || "0"))
    }
  });
  
  const purchaseQuery = useGetPurchase(parseInt(selectedInvoiceId || "0"), {
    query: { 
      enabled: type === 'pembelian' && !!selectedInvoiceId && isDrawerOpen,
      queryKey: getGetPurchaseQueryKey(parseInt(selectedInvoiceId || "0"))
    }
  });

  useEffect(() => {
    if (type === 'penjualan' && saleQuery.data && saleQuery.data.id.toString() === selectedInvoiceId) {
      if (returnedItems.length === 0) { 
        setReturnedItems(saleQuery.data.items.map((i: any) => ({
          productId: i.productId,
          productName: i.productName || "",
          krats: Number(i.krats) || "",
          kgs: Number(i.kgs) || "",
          pricePerKg: Number(i.pricePerKg) || 0,
          subtotal: Number(i.subtotal) || 0
        })));
      }
    }
  }, [type, selectedInvoiceId, saleQuery.data]);

  useEffect(() => {
    if (type === 'pembelian' && purchaseQuery.data && purchaseQuery.data.id.toString() === selectedInvoiceId) {
      if (returnedItems.length === 0) {
        setReturnedItems(purchaseQuery.data.items.map((i: any) => ({
          productId: i.productId,
          productName: i.productName || "",
          krats: Number(i.krats) || "",
          kgs: Number(i.kgs) || "",
          pricePerKg: Number(i.pricePerKg) || 0,
          subtotal: Number(i.subtotal) || 0
        })));
      }
    }
  }, [type, selectedInvoiceId, purchaseQuery.data]);
  
  const addReturnedItem = () => setReturnedItems([...returnedItems, { productId: 0, productName: "", krats: 0, kgs: 0, pricePerKg: 0, subtotal: 0 }]);
  const addExchangedItem = () => setExchangedItems([...exchangedItems, { productId: 0, productName: "", krats: 0, kgs: 0, pricePerKg: 0, subtotal: 0 }]);
  
  const updateItem = (list: any[], setList: any) => (index: number, changes: Partial<ReturnItemForm>) => {
    const newList = [...list];
    newList[index] = { ...newList[index], ...changes };
    const it = newList[index];
    it.subtotal = (Number(it.kgs) || 0) * (Number(it.pricePerKg) || 0); 
    setList(newList);
  };
  const removeItem = (list: any[], setList: any) => (index: number) => {
    setList(list.filter((_, i) => i !== index));
  };

  const totalReturned = returnedItems.reduce((sum, item) => sum + item.subtotal, 0);
  const totalExchanged = exchangedItems.reduce((sum, item) => sum + item.subtotal, 0);
  const difference = totalExchanged - totalReturned;

  const handleOpenOtp = () => {
    if (returnedItems.length === 0 && exchangedItems.length === 0) {
      toast({ title: "Error", description: "Tambahkan setidaknya 1 barang retur/tukar", variant: "destructive" });
      return;
    }
    setOtpDialogOpen(true);
  };

  const filteredReturns = useMemo(() => {
    let result = (returns || []) as any[];
    
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((r) => r.returnNumber?.toLowerCase().includes(q) || r.customerName?.toLowerCase().includes(q) || r.supplierName?.toLowerCase().includes(q));
    }
    
    result = filterByDateRange(result, dateFrom, dateTo);
    return result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [returns, search, dateFrom, dateTo]);

  return (
    <div className="flex flex-col h-full w-full">
      {/* Static Top Strip */}
      <div className="flex-none space-y-4 pb-3">
        <div className="flex items-center justify-between">
          <div className="hidden md:block">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Retur Barang</h1>
            <p className="text-[13px] font-medium text-slate-500 mt-0.5">Kelola pengembalian dan penukaran barang</p>
          </div>
          <Button onClick={() => setIsDrawerOpen(true)} className="h-10 px-4 rounded-[12px] shadow-sm bg-violet-600 hover:bg-violet-700 text-white font-bold ml-auto w-full md:w-auto">
            <Plus className="h-4 w-4 mr-1.5" /> Catat Retur Baru
          </Button>
        </div>
        
        {/* Filter */}
        <div className="flex gap-2">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input placeholder="Cari nota..." className="pl-9 bg-white border-slate-200 rounded-xl h-10 shadow-sm w-full text-sm" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="shrink-0">
            <DateRangeFilter onFilter={(from, to) => { setDateFrom(from); setDateTo(to); setPage(1); }} />
          </div>
        </div>
      </div>

      {/* scrollable List (iOS Style Cards) */}
      <div className="flex-1 overflow-auto min-h-0 pb-4">
        {isLoading ? (
          <div className="space-y-3">{Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-2xl" />)}</div>
        ) : filteredReturns?.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-100 text-center py-20 shadow-sm"><RefreshCcw className="mx-auto mb-4 h-12 w-12 text-slate-300" strokeWidth={1.5} /><h3 className="text-lg font-bold text-slate-700">Tidak ada retur</h3></div>
        ) : (
          <div className="flex flex-col gap-3">
            {filteredReturns.slice((page - 1) * itemsPerPage, page * itemsPerPage).map((r, idx) => {
              const isPenjualan = r.type === 'penjualan';
              let badgeClass = "bg-slate-100 text-slate-700 border-slate-200";
              if (r.paymentStatus === "lunas") badgeClass = "bg-emerald-50 text-emerald-600 border-emerald-100";
              else if (r.paymentStatus === "tempo") badgeClass = "bg-amber-50 text-amber-600 border-amber-100";

              return (
                <div key={r.id} className="bg-white rounded-[20px] p-4 sm:p-5 border border-slate-100 shadow-sm flex flex-col gap-4">
                  {/* Top Section: Header */}
                  <div className="flex justify-between items-start gap-3">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${isPenjualan ? 'bg-indigo-50 text-indigo-600' : 'bg-fuchsia-50 text-fuchsia-600'}`}>{isPenjualan ? 'PENJUALAN' : 'PEMBELIAN'}</span>
                        <h3 className="font-bold text-slate-800 text-[15px] leading-tight">{r.returnNumber}</h3>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[11px] font-medium text-slate-500">{formatDate(r.createdAt)}</span>
                        <span className="text-[11px] text-slate-400">•</span>
                        <span className="text-[11px] font-medium text-slate-500 line-clamp-1">{isPenjualan ? r.customerName : r.supplierName}</span>
                      </div>
                    </div>
                    <div className={`px-2.5 py-1 rounded-full border text-[10px] font-bold uppercase tracking-wider shrink-0 ${badgeClass}`}>
                      {r.paymentStatus}
                    </div>
                  </div>

                  {/* Middle Section: Financial Summary */}
                  <div className="grid grid-cols-2 gap-3 bg-slate-50/50 rounded-xl p-3 border border-slate-100/50">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">Nilai Kembali</span>
                      <span className="font-semibold text-slate-700 text-sm">{formatRupiah(Number(r.totalReturnedValue))}</span>
                    </div>
                    <div className="flex flex-col items-end text-right">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">Nilai Pengganti</span>
                      <span className="font-semibold text-slate-700 text-sm">{formatRupiah(Number(r.totalExchangedValue))}</span>
                    </div>
                  </div>

                  {/* Bottom Section: Selisih & Action */}
                  <div className="flex items-center justify-between mt-1 pt-3 border-t border-slate-100 border-dashed">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">Selisih</span>
                      <span className="font-bold text-violet-600 text-sm">{formatRupiah(Number(r.differenceAmount))}</span>
                    </div>
                    <Button size="sm" variant="outline" className="h-8 gap-1.5 rounded-lg border-slate-200 hover:bg-slate-50" onClick={() => setPreviewReturnId(r.id)}>
                      <Printer className="w-3.5 h-3.5" /> Cetak
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Pagination Bar */}
      {filteredReturns && filteredReturns.length > itemsPerPage && (
        <div className="flex-none border-t border-slate-200 bg-white px-4 py-2.5 flex items-center justify-between rounded-b-2xl shadow-sm">
          <span className="text-[10px] sm:text-xs text-slate-400">Menampilkan {(page - 1) * itemsPerPage + 1}–{Math.min(page * itemsPerPage, filteredReturns.length)} dari {filteredReturns.length} retur</span>
          <PaginationControl 
            currentPage={page} 
            totalPages={Math.ceil(filteredReturns.length / itemsPerPage) || 1} 
            onPageChange={setPage} 
          />
        </div>
      )}

      <Drawer open={isDrawerOpen} onOpenChange={(open) => { 
        if (!open) { 
          if (document.activeElement instanceof HTMLElement) {
            document.activeElement.blur();
          }
          window.scrollTo(0, 0);
          setTimeout(() => setIsDrawerOpen(false), 150);
        } else {
          setIsDrawerOpen(true);
        }
      }}>
        <DrawerContent className="mx-auto w-full max-w-5xl px-4 sm:px-6 pb-[max(1.5rem,env(safe-area-inset-bottom,0px))] pt-2 flex flex-col" style={{ maxHeight: "calc(95dvh - env(safe-area-inset-top, 0px))" }}>
          <DrawerTitle className="sr-only">Form Retur / Tukar Barang</DrawerTitle>
          
          <div className="flex flex-col h-full" style={{ maxHeight: 'calc(95vh - 5rem)' }}>
            {/* Gradient Header */}
            <div className="bg-linear-to-r from-violet-600 to-indigo-600 px-6 py-4 flex items-center gap-3 shrink-0">
              <div className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
                <RefreshCcw className="w-5 h-5 text-white" strokeWidth={1.5} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white leading-tight">Form Retur / Tukar Barang</h2>
                <p className="text-violet-200 text-xs">Isi rincian barang yang dikembalikan dan penggantinya</p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-slate-50/50 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Tipe Retur</label>
                  <Select value={type} onValueChange={(val: any) => { setType(val); setSelectedInvoiceId(""); setReturnedItems([]); setExchangedItems([]); }}>
                    <SelectTrigger className="h-11 bg-white border-slate-200 rounded-xl focus-visible:ring-violet-500 font-medium"><SelectValue /></SelectTrigger>
                    <SelectContent className="rounded-xl border-slate-100 shadow-xl">
                      <SelectItem value="penjualan" className="font-medium">Retur Penjualan (Dari Pelanggan)</SelectItem>
                      <SelectItem value="pembelian" className="font-medium">Retur Pembelian (Ke Supplier)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">
                    Pilih {type === "penjualan" ? "Nota Penjualan" : "Nota Pembelian"} (Opsional)
                  </label>
                  <Select value={selectedInvoiceId} onValueChange={(val: string) => { setSelectedInvoiceId(val); setReturnedItems([]); setExchangedItems([]); }}>
                    <SelectTrigger className="h-11 bg-white border-slate-200 rounded-xl focus-visible:ring-violet-500 font-medium"><SelectValue placeholder="Tanpa Referensi" /></SelectTrigger>
                    <SelectContent className="rounded-xl border-slate-100 shadow-xl">
                      <SelectItem value="" className="font-medium">-- Tanpa Referensi --</SelectItem>
                      {type === "penjualan" ? (
                        sales?.map((s) => (
                          <SelectItem key={s.id} value={s.id.toString()} className="font-medium">{s.invoiceNumber} - {s.customerName || "Umum"}</SelectItem>
                        ))
                      ) : (
                        purchases?.map((p) => (
                          <SelectItem key={p.id} value={p.id.toString()} className="font-medium">{p.invoiceNumber} - {p.supplierName || "Umum"}</SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Penyelesaian Kas</label>
                  <Select value={paymentStatus} onValueChange={(val: any) => setPaymentStatus(val)}>
                    <SelectTrigger className="h-11 bg-white border-slate-200 rounded-xl focus-visible:ring-violet-500 font-medium"><SelectValue /></SelectTrigger>
                    <SelectContent className="rounded-xl border-slate-100 shadow-xl">
                      <SelectItem value="lunas" className="font-medium">Kas Tunai (Lunas/Uang Kembali)</SelectItem>
                      <SelectItem value="tempo" className="font-medium">Potong Saldo (Piutang/Hutang)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Bagian Kiri: Barang yang Dikembalikan */}
                <div className="bg-rose-50/50 p-4 rounded-2xl border border-rose-100 shadow-sm flex flex-col h-full">
                  <h3 className="font-bold text-[15px] text-rose-700 mb-4 flex justify-between items-center bg-white p-3 rounded-xl shadow-sm border border-rose-50">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
                      Barang Kembali (Masuk Toko)
                    </div>
                    <Badge variant="outline" className="bg-rose-100/50 text-rose-700 border-rose-200">Deposit: {formatRupiah(totalReturned)}</Badge>
                  </h3>
                  
                  <div className="flex-1 space-y-3">
                    {returnedItems.map((item, i) => (
                      <ReturItemRow key={i} item={item} index={i} products={products} updateItem={updateItem(returnedItems, setReturnedItems)} removeItem={removeItem(returnedItems, setReturnedItems)} label="Kembali" />
                    ))}
                  </div>
                  
                  <Button variant="outline" onClick={addReturnedItem} className="w-full mt-4 border-dashed border-rose-300 text-rose-600 hover:bg-rose-100 hover:text-rose-700 rounded-xl h-12 font-bold bg-white"><Plus className="w-4 h-4 mr-2"/> Tambah Barang Retur</Button>
                </div>

                {/* Bagian Kanan: Barang Pengganti */}
                <div className="bg-emerald-50/50 p-4 rounded-2xl border border-emerald-100 shadow-sm flex flex-col h-full">
                  <h3 className="font-bold text-[15px] text-emerald-700 mb-4 flex justify-between items-center bg-white p-3 rounded-xl shadow-sm border border-emerald-50">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                      Barang Pengganti (Keluar Toko)
                    </div>
                    <Badge variant="outline" className="bg-emerald-100/50 text-emerald-700 border-emerald-200">Tagihan: {formatRupiah(totalExchanged)}</Badge>
                  </h3>
                  
                  <div className="flex-1 space-y-3">
                    {exchangedItems.map((item, i) => (
                      <ReturItemRow key={i} item={item} index={i} products={products} updateItem={updateItem(exchangedItems, setExchangedItems)} removeItem={removeItem(exchangedItems, setExchangedItems)} label="Pengganti" />
                    ))}
                  </div>
                  
                  <Button variant="outline" onClick={addExchangedItem} className="w-full mt-4 border-dashed border-emerald-300 text-emerald-600 hover:bg-emerald-100 hover:text-emerald-700 rounded-xl h-12 font-bold bg-white"><Plus className="w-4 h-4 mr-2"/> Tambah Barang Pengganti</Button>
                </div>
              </div>
            </div>
            
            {/* Fixed Footer */}
            <div className="flex-none bg-white border-t border-slate-100 px-5 py-4 flex flex-col md:flex-row items-center justify-between gap-4 z-10 shrink-0 shadow-[0_-4px_10px_rgba(0,0,0,0.03)]">
              <div className="flex flex-col items-start w-full md:w-auto bg-slate-50 px-4 py-2 rounded-xl border border-slate-100">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Total Selisih</span>
                <span className={`font-black text-xl leading-none ${difference > 0 ? 'text-emerald-600' : difference < 0 ? 'text-rose-600' : 'text-slate-800'}`}>
                  {difference > 0 ? '+' : ''}{formatRupiah(difference)}
                </span>
              </div>
              <div className="flex w-full md:w-auto gap-3">
                <Button type="button" variant="ghost" className="flex-1 md:flex-none h-12 px-6 rounded-[14px] font-bold border border-slate-200 text-slate-600 hover:bg-slate-50" 
                  onClick={() => { 
                    if (document.activeElement instanceof HTMLElement) { document.activeElement.blur(); }
                    window.scrollTo(0, 0);
                    setTimeout(() => setIsDrawerOpen(false), 150);
                  }}>
                  Batal
                </Button>
                <Button className="flex-2 md:flex-none h-12 px-8 rounded-[14px] font-bold bg-violet-600 hover:bg-violet-700 text-white shadow-sm" onClick={handleOpenOtp} disabled={createReturn.isPending}>
                  {createReturn.isPending ? "Memproses..." : "Simpan Retur"}
                </Button>
              </div>
            </div>
          </div>
        </DrawerContent>
      </Drawer>

      <ReturnInvoiceModal 
        open={previewReturnId !== null} 
        onOpenChange={(open) => !open && setPreviewReturnId(null)} 
        returnId={previewReturnId || undefined} 
      />
    </div>
  );
}
