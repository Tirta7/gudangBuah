import { useState } from "react";
import { useLocation } from "wouter";
import { PageHeader } from "../components/PageHeader";
import { PaginationControl } from "../components/PaginationControl";
import { useListMutations, useCreateMutation, useListProducts, getListMutationsQueryKey, getListProductsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerFooter } from "@/components/ui/drawer";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Search, ArrowLeftRight, ArrowUpFromLine, ArrowDownToLine, CheckCircle2, Clock, AlertCircle, Package, RotateCcw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { formatDate, formatNumber } from "@/lib/utils";
import { DateRangeFilter, filterByDateRange } from "@/components/DateRangeFilter";

const schema = z.object({
  productId: z.number({ required_error: "Barang wajib dipilih" }),
  type: z.enum(["in", "out", "adjustment"]),
  krats: z.number().min(0),
  kgs: z.number().min(0),
  description: z.string().optional(),
  reference: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

const TYPE_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  masuk: { label: "Masuk", color: "bg-green-100 text-green-700 border-green-200", icon: ArrowDownToLine },
  keluar: { label: "Keluar", color: "bg-red-100 text-red-700 border-red-200", icon: ArrowUpFromLine },
  penyesuaian: { label: "Penyesuaian", color: "bg-blue-100 text-blue-700 border-blue-200", icon: ArrowLeftRight },
};

export default function Mutasi() {
  const [activeTab, setActiveTab] = useState<"semua" | "masuk" | "keluar" | "penyesuaian">("semua");
  const [currentPage, setCurrentPage] = useState(1);
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  const { data: mutations, isLoading } = useListMutations({}, { query: { queryKey: getListMutationsQueryKey({}) } });
  const { data: products } = useListProducts({}, { query: { queryKey: getListProductsQueryKey({}) } });
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { type: "in", krats: 0, kgs: 0, description: "", reference: "" },
  });

  const selectedProductId = form.watch("productId");
  const selectedProduct = products?.find(p => p.id === selectedProductId);
  const primaryUnit = selectedProduct?.primaryUnit || "Kg";
  const secondaryUnit = selectedProduct?.secondaryUnit || "Krat";

  const createMutation = useCreateMutation({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListMutationsQueryKey({}) });
        queryClient.invalidateQueries({ queryKey: getListProductsQueryKey({}) });
        setIsOpen(false);
        form.reset({ type: "in", krats: 0, kgs: 0, description: "", reference: "" });
        toast({ title: "Mutasi stok berhasil dicatat" });
      }
    }
  });

  const onSubmit = (data: FormData) => createMutation.mutate({ data: { ...data, description: data.description || "", reference: data.reference || "" } });

  const filtered = filterByDateRange(
    mutations?.filter(m => {
      const q = search.toLowerCase();
      return (m as any).productName?.toLowerCase().includes(q) || m.description?.toLowerCase().includes(q);
    }) ?? [],
    dateFrom,
    dateTo,
  );

  const tabFiltered = filtered.filter(m => {
    if (activeTab === "semua") return true;
    return m.type === activeTab;
  });

  return (
    <div className="flex flex-col h-full w-full">
      {/* Static Top Strip */}
      {/* Static Top Strip */}
      <div className="flex-none space-y-3 pb-3 relative z-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 leading-none">Mutasi Stok</h1>
            <p className="text-xs font-medium text-slate-500 mt-1">Riwayat barang masuk & keluar</p>
          </div>
          
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400" />
              <Input 
                placeholder="Cari barang atau referensi..." 
                className="pl-7 w-48 h-8 rounded-lg border-slate-200 bg-slate-50 text-xs focus-visible:ring-violet-500"
                value={search} 
                onChange={e => { setSearch(e.target.value); setCurrentPage(1); }} 
              />
            </div>
            <div className="shrink-0 h-8">
              <DateRangeFilter onFilter={(from, to) => { setDateFrom(from); setDateTo(to); setCurrentPage(1); }} />
            </div>
            
            <Button onClick={() => { form.reset({ type: "in", krats: 0, kgs: 0, description: "", reference: "" }); setIsOpen(true); }} className="h-8 px-3 rounded-lg bg-violet-600 hover:bg-violet-700 text-xs font-bold shadow-sm">
              <Plus className="mr-1.5 h-3 w-3" /> Baru
            </Button>
          </div>
        </div>

        {/* Tabs Filter */}
        <div className="flex items-center gap-1.5 overflow-x-auto hide-scrollbar">
          {(['semua', 'masuk', 'keluar', 'penyesuaian'] as const).map((tab) => {
            const label = tab === 'masuk' ? 'Masuk' : tab === 'keluar' ? 'Keluar' : tab === 'penyesuaian' ? 'Penyesuaian' : 'Semua';
            const isActive = activeTab === tab;
            return (
              <button key={tab} onClick={() => { setActiveTab(tab); setCurrentPage(1); }}
                className={`shrink-0 flex items-center justify-center h-7 px-3.5 rounded-[8px] text-[11px] font-bold transition-all border ${isActive ? "bg-violet-600 text-white border-violet-600 shadow-sm" : "bg-white text-slate-500 border-slate-200 hover:bg-violet-50 hover:text-violet-600 hover:border-violet-200"}`}>
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* scrollable Table */}
      <div className="flex-1 overflow-auto min-h-0">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="p-6 space-y-3">{Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-10 w-full rounded-lg" />)}</div>
          ) : tabFiltered?.length === 0 ? (
            <div className="text-center py-16"><ArrowLeftRight className="mx-auto mb-4 h-12 w-12 text-slate-300" strokeWidth={1.5} /><h3 className="text-lg font-bold text-slate-700">Belum ada mutasi</h3></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-slate-50 border-b border-slate-200 shadow-sm">
                    <th className="text-left py-2.5 px-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider w-8 whitespace-nowrap">#</th>
                    <th className="text-left py-2.5 px-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Tanggal</th>
                    <th className="text-left py-2.5 px-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Produk</th>
                    <th className="text-center py-2.5 px-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Tipe</th>
                    <th className="text-right py-2.5 px-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Kg/Yd</th>
                    <th className="text-right py-2.5 px-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Krat</th>
                    <th className="text-left py-2.5 px-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Keterangan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {tabFiltered?.slice((currentPage - 1) * 20, currentPage * 20).map((m, idx) => {
                    const cfg = TYPE_CONFIG[m.type ?? "masuk"];
                    let badgeCls = "bg-slate-100 text-slate-700";
                    if (m.type === 'masuk') badgeCls = "bg-green-100 text-green-700";
                    else if (m.type === 'keluar') badgeCls = "bg-red-100 text-red-700";
                    else badgeCls = "bg-blue-100 text-blue-700";
                    const sign = m.type === 'keluar' ? '-' : '+';
                    return (
                      <tr key={m.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-2.5 px-3 text-xs text-slate-400 font-mono whitespace-nowrap">{(currentPage - 1) * 20 + idx + 1}</td>
                        <td className="py-2.5 px-3 text-xs text-slate-600 whitespace-nowrap">{formatDate(m.createdAt)}</td>
                        <td className="py-2.5 px-3 font-semibold text-slate-800 whitespace-nowrap">{(m as any).productName || <span className="text-slate-400 italic">Dihapus</span>}</td>
                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${badgeCls}`}>{cfg?.label}</span>
                        </td>
                        <td className={`py-2.5 px-3 text-right font-bold text-sm ${m.type === 'keluar' ? 'text-rose-600' : 'text-emerald-600'}`}>{sign}{formatNumber(m.kgs)}</td>
                        <td className={`py-2.5 px-3 text-right text-xs font-medium ${m.type === 'keluar' ? 'text-rose-500' : 'text-emerald-500'}`}>{m.krats > 0 ? `${sign}${formatNumber(m.krats)}` : <span className="text-slate-300">—</span>}</td>
                        <td className="py-2.5 px-3 text-xs text-slate-500 italic whitespace-nowrap">
                          {m.description || <span className="text-slate-300">—</span>}
                          {/* Tombol Restore untuk Batal Pembelian */}
                          {m.description?.startsWith('Batal Pembelian') && m.reference && (
                            <button
                              onClick={() => { window.location.href = `/pos/pembelian?restoreInvoice=${encodeURIComponent(m.reference as string)}`; }}
                              className="ml-2 inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-1.5 py-0.5 rounded-full transition-colors"
                              title="Pulihkan & edit ulang pembelian ini"
                            >
                              <RotateCcw className="w-2.5 h-2.5" />
                              Restore
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Pagination Bar */}
      {tabFiltered && tabFiltered.length > 20 && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
          <div className="bg-white/90 backdrop-blur-md shadow-[0_4px_20px_rgba(0,0,0,0.12)] border border-slate-200/60 rounded-full px-3 py-0.5 flex items-center justify-center gap-3 pointer-events-auto">
            <span className="text-[10px] font-medium text-slate-400 hidden sm:inline">
              {tabFiltered.length} mutasi
            </span>
            <PaginationControl currentPage={currentPage} totalPages={Math.ceil(tabFiltered.length / 20)} onPageChange={setCurrentPage} />
          </div>
        </div>
      )}

      <Drawer open={isOpen} onOpenChange={(open) => { if (!open) { setIsOpen(false); } }}>
        <DrawerContent className="mx-auto w-full max-w-2xl px-4 sm:px-6 pb-[max(1.5rem,env(safe-area-inset-bottom,0px))] pt-2 flex flex-col" style={{ maxHeight: "calc(95dvh - env(safe-area-inset-top, 0px))" }}>
          <DrawerTitle className="sr-only">Catat Mutasi Stok</DrawerTitle>
          <DrawerDescription className="sr-only">Form pencatatan mutasi stok</DrawerDescription>
          <DrawerHeader className="pb-3 px-0">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-violet-100 flex items-center justify-center">
                <Package className="w-5 h-5 text-violet-600" strokeWidth={1.5} />
              </div>
              <div>
                <h2 className="text-[15px] font-bold text-slate-800 leading-tight">Catat Mutasi Stok</h2>
                <p className="text-xs text-slate-400">Isi formulir untuk mencatat mutasi stok barang</p>
              </div>
            </div>
          </DrawerHeader>
          <div className="overflow-y-auto flex-1">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pb-4">
              <FormField control={form.control} name="productId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Barang</FormLabel>
                  <Select onValueChange={(v: string) => field.onChange(parseInt(v))} value={field.value?.toString()}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Pilih barang" /></SelectTrigger></FormControl>
                    <SelectContent>{products?.map(p => <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>)}</SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="type" render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipe Mutasi</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="masuk">Masuk</SelectItem>
                      <SelectItem value="keluar">Keluar</SelectItem>
                      <SelectItem value="penyesuaian">Penyesuaian</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField control={form.control} name="krats" render={({ field }) => (
                  <FormItem><FormLabel>Qty ({secondaryUnit.toLowerCase()})</FormLabel><FormControl><Input type="number" step="any" min={0} {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="kgs" render={({ field }) => (
                  <FormItem><FormLabel>Qty ({primaryUnit.toLowerCase()})</FormLabel><FormControl><Input type="number" step="any" min={0} {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
              <FormField control={form.control} name="description" render={({ field }) => (
                <FormItem><FormLabel>Keterangan</FormLabel><FormControl><Input placeholder="Alasan mutasi" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="reference" render={({ field }) => (
                <FormItem><FormLabel>Referensi (Opsional)</FormLabel><FormControl><Input placeholder="No. dokumen" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <DrawerFooter className="px-0 pt-4 flex-row gap-2">
                <Button type="button" variant="ghost" className="flex-1 bg-muted text-muted-foreground hover:bg-muted/80" onClick={() => setIsOpen(false)}>Batal</Button>
                <Button type="submit" className="flex-1" disabled={createMutation.isPending}>Simpan</Button>
              </DrawerFooter>
            </form>
          </Form>
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
