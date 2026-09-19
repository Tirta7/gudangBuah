import { useState, useMemo } from "react";
import { PageHeader } from "../components/PageHeader";
import { PaginationControl } from "../components/PaginationControl";
import { useListPayables, useAddPayablePayment, getListPayablesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter, DrawerDescription } from "@/components/ui/drawer";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Receipt, Plus, AlertTriangle, CheckCircle2, AlertCircle, ArrowRightCircle, DollarSign } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatRupiah, formatDate } from "@/lib/utils";
import { DateRangeFilter, filterByDateRange } from "@/components/DateRangeFilter";

const STATUS_COLORS: Record<string, string> = {
  lunas: "bg-green-100 text-green-700 border-green-200",
  partial: "bg-amber-100 text-amber-700 border-amber-200",
  belum_bayar: "bg-red-100 text-red-700 border-red-200",
};

export default function Hutang() {
  const [currentPage, setCurrentPage] = useState(1);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"semua" | "belum_bayar" | "partial" | "lunas">("semua");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("tunai");
  const [payNotes, setPayNotes] = useState("");

  const { data: payables, isLoading } = useListPayables({}, { query: { queryKey: getListPayablesQueryKey({}) } });
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const payMutation = useAddPayablePayment({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListPayablesQueryKey({}) });
        setIsOpen(false);
        setSelectedId(null);
        setPayAmount("");
        toast({ title: "Pembayaran hutang berhasil dicatat" });
      }
    }
  });

  const openPayment = (id: number) => { setSelectedId(id); setIsOpen(true); };
  const selectedPay = payables?.find(p => p.id === selectedId);

  const handlePay = () => {
    if (!selectedId || !selectedPay) return;
    const amount = parseFloat(payAmount) || 0;
    const remaining = (selectedPay as any).remainingAmount || 0;
    
    if (amount <= 0) {
      toast({ title: "Jumlah tidak valid", description: "Jumlah bayar harus lebih dari 0", variant: "destructive" });
      return;
    }
    
    if (amount > remaining) {
      toast({ title: "Jumlah terlalu besar", description: `Maksimal pembayaran adalah ${formatRupiah(remaining)}`, variant: "destructive" });
      return;
    }
    
    payMutation.mutate({ id: selectedId, data: { amount, paymentMethod: payMethod as any, notes: payNotes || undefined } });
  };

  const filtered = filterByDateRange(
    payables?.filter(p => {
      const q = search.toLowerCase();
      const matchSearch = (p as any).supplierName?.toLowerCase().includes(q) || (p as any).invoiceNumber?.toLowerCase().includes(q);
      const matchStatus = activeTab === "semua" || p.status === activeTab || (activeTab === "belum_bayar" && p.status === "unpaid");
      return matchSearch && matchStatus;
    }) ?? [],
    dateFrom,
    dateTo,
  );

  const groupedFiltered = useMemo(() => {
    const groups: Record<number, any[]> = {};
    filtered.forEach(p => {
      const sid = p.supplierId || 0;
      if (!groups[sid]) groups[sid] = [];
      groups[sid].push(p);
    });
    return Object.values(groups);
  }, [filtered]);

  const totalHutang = payables?.filter(p => p.status !== "lunas").reduce((sum, p) => sum + ((p as any).remainingAmount ?? 0), 0) ?? 0;
  const overdueCount = payables?.filter(p => (p as any).isOverdue).length ?? 0;

  return (
    <div className="flex flex-col h-full w-full">
      {/* Static Top Strip */}
      {/* Static Top Strip */}
      <div className="flex-none space-y-3 pb-3 relative z-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 leading-none">Hutang</h1>
            <p className="text-xs font-medium text-slate-500 mt-1">Kelola tagihan dari supplier</p>
          </div>
          
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400" />
              <Input 
                placeholder="Cari supplier atau invoice..." 
                className="pl-7 w-48 h-8 rounded-lg border-slate-200 bg-slate-50 text-xs focus-visible:ring-violet-500"
                value={search} 
                onChange={e => { setSearch(e.target.value); setCurrentPage(1); }} 
              />
            </div>
            <div className="shrink-0 h-8">
              <DateRangeFilter onFilter={(from, to) => { setDateFrom(from); setDateTo(to); setCurrentPage(1); }} />
            </div>
          </div>
        </div>

        {/* Tabs Filter */}
        <div className="flex items-center gap-1.5 overflow-x-auto hide-scrollbar">
          {(['semua', 'belum_bayar', 'partial', 'lunas'] as const).map((tab) => {
            const label = tab === 'belum_bayar' ? 'Belum Bayar' : tab === 'partial' ? 'Sebagian' : tab === 'lunas' ? 'Lunas' : 'Semua';
            const isActive = activeTab === tab;
            return (
              <button key={tab} onClick={() => { setActiveTab(tab); setCurrentPage(1); }}
                className={`shrink-0 flex items-center justify-center h-7 px-3.5 rounded-[8px] text-[11px] font-bold transition-all border ${isActive ? "bg-violet-600 text-white border-violet-600 shadow-sm" : "bg-white text-slate-500 border-slate-200 hover:bg-violet-50 hover:text-violet-600 hover:border-violet-200"}`}>
                {label}
              </button>
            );
          })}
        </div>

        {/* Rekap Summary (Ultra Compact Strip) */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <div className="bg-rose-50 border border-rose-100 rounded-lg px-3 py-1.5 flex flex-col justify-center">
              <span className="text-[9px] font-semibold text-rose-500 uppercase tracking-wider">Total Aktif</span>
              <span className="text-xs font-black text-rose-700 leading-tight">{formatRupiah(totalHutang)}</span>
            </div>
            <div className="bg-white border border-slate-100 rounded-lg px-3 py-1.5 flex flex-col justify-center">
              <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider">Tagihan Aktif</span>
              <span className="text-xs font-black text-slate-900 leading-tight">{payables?.filter(p => p.status !== "lunas").length ?? 0} Tagihan</span>
            </div>
            <div className={`border rounded-lg px-3 py-1.5 flex flex-col justify-center ${overdueCount > 0 ? 'bg-amber-50 border-amber-100' : 'bg-slate-50 border-slate-100'}`}>
              <span className={`text-[9px] font-semibold uppercase tracking-wider ${overdueCount > 0 ? 'text-amber-500' : 'text-slate-400'}`}>Jatuh Tempo</span>
              <span className={`text-xs font-black leading-tight ${overdueCount > 0 ? 'text-amber-700' : 'text-slate-500'}`}>{overdueCount} Tagihan</span>
            </div>
        </div>
      </div>

      {/* scrollable List */}
      <div className="flex-1 overflow-auto min-h-0 pb-10">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden min-w-0">
          {isLoading ? (
            <div className="p-6 space-y-3">{Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-10 w-full rounded-lg" />)}</div>
          ) : filtered?.length === 0 ? (
            <div className="text-center py-16"><Receipt className="mx-auto mb-4 h-12 w-12 text-slate-300" strokeWidth={1.5} /><h3 className="text-lg font-bold text-slate-700">Tidak ada hutang</h3></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                  <tr>
                    <th className="h-8 px-4 text-left align-middle font-semibold text-slate-600 text-[11px] whitespace-nowrap border-b border-slate-100 w-10">#</th>
                    <th className="h-8 px-4 text-left align-middle font-semibold text-slate-600 text-[11px] whitespace-nowrap border-b border-slate-100">Supplier & Dokumen</th>
                    <th className="h-8 px-4 text-right align-middle font-semibold text-slate-600 text-[11px] whitespace-nowrap border-b border-slate-100">Total Tagihan</th>
                    <th className="h-8 px-4 text-right align-middle font-semibold text-slate-600 text-[11px] whitespace-nowrap border-b border-slate-100">Terbayar</th>
                    <th className="h-8 px-4 text-right align-middle font-semibold text-slate-600 text-[11px] whitespace-nowrap border-b border-slate-100">Sisa Hutang</th>
                    <th className="h-8 px-4 text-left align-middle font-semibold text-slate-600 text-[11px] whitespace-nowrap border-b border-slate-100">Jatuh Tempo</th>
                    <th className="h-8 px-4 text-center align-middle font-semibold text-slate-600 text-[11px] whitespace-nowrap border-b border-slate-100">Status</th>
                    <th className="h-8 px-4 text-center align-middle font-semibold text-slate-600 text-[11px] whitespace-nowrap border-b border-slate-100">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered?.slice((currentPage - 1) * 20, currentPage * 20).map((p, idx) => {
                    const isOverdue = (p as any).isOverdue && p.status !== "lunas";
                    let badgeClass = "bg-rose-50 text-rose-600 border-rose-200";
                    if (p.status === "lunas") badgeClass = "bg-emerald-50 text-emerald-600 border-emerald-200";
                    else if (p.status === "partial") badgeClass = "bg-blue-50 text-blue-600 border-blue-200";
                    
                    return (
                      <tr key={p.id} className="hover:bg-slate-50/50 transition-colors group">
                        <td className="py-2 px-4 border-b border-slate-50 align-middle text-[11px] text-slate-400 font-medium whitespace-nowrap">{(currentPage - 1) * 20 + idx + 1}</td>
                        <td className="py-2 px-4 border-b border-slate-50 align-middle whitespace-nowrap">
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-800 text-[12px]">{(p as any).supplierName || "—"}</span>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-[10px] text-slate-400 font-mono">{(p as any).invoiceNumber || `#${p.id}`}</span>
                              <span className="text-[10px] text-slate-300">•</span>
                              <span className="text-[10px] text-slate-400">{formatDate((p as any).createdAt)}</span>
                            </div>
                          </div>
                        </td>
                        <td className="py-2 px-4 border-b border-slate-50 align-middle whitespace-nowrap text-right">
                          <span className="font-semibold text-slate-700 text-xs">{formatRupiah((p as any).totalAmount ?? 0)}</span>
                        </td>
                        <td className="py-2 px-4 border-b border-slate-50 align-middle whitespace-nowrap text-right">
                          <span className="font-semibold text-emerald-600 text-xs">{formatRupiah((p as any).paidAmount ?? 0)}</span>
                        </td>
                        <td className="py-2 px-4 border-b border-slate-50 align-middle whitespace-nowrap text-right">
                          <span className={`font-bold text-xs ${((p as any).remainingAmount > 0) ? 'text-rose-600' : 'text-slate-400'}`}>
                            {((p as any).remainingAmount > 0) ? formatRupiah((p as any).remainingAmount) : 'LUNAS'}
                          </span>
                        </td>
                        <td className="py-2 px-4 border-b border-slate-50 align-middle whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            {isOverdue && <AlertCircle className="w-3.5 h-3.5 text-rose-500" />}
                            <span className={`text-[11px] font-semibold ${isOverdue ? 'text-rose-600' : 'text-slate-500'}`}>{formatDate((p as any).dueDate)}</span>
                          </div>
                        </td>
                        <td className="py-2 px-4 border-b border-slate-50 align-middle whitespace-nowrap text-center">
                          <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider border ${badgeClass}`}>
                            {p.status?.replace("_", " ")}
                          </span>
                        </td>
                        <td className="py-2 px-4 border-b border-slate-50 align-middle whitespace-nowrap text-center">
                          {p.status !== "lunas" ? (
                            <Button variant="ghost" size="sm" className="h-7 px-3 text-[11px] rounded-lg bg-violet-50 text-violet-700 hover:bg-violet-100 hover:text-violet-800 font-bold" onClick={() => openPayment(p.id)}>
                              <Plus className="w-3 h-3 mr-1" /> Bayar
                            </Button>
                          ) : (
                            <span className="text-[10px] font-medium text-slate-300">-</span>
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
      {filtered && filtered.length > 20 && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
          <div className="bg-white/90 backdrop-blur-md shadow-[0_4px_20px_rgba(0,0,0,0.12)] border border-slate-200/60 rounded-full px-3 py-0.5 flex items-center justify-center gap-3 pointer-events-auto">
            <span className="text-[10px] font-medium text-slate-400 hidden sm:inline">
              {filtered.length} hutang
            </span>
            <PaginationControl currentPage={currentPage} totalPages={Math.ceil(filtered.length / 20)} onPageChange={setCurrentPage} />
          </div>
        </div>
      )}

      <Drawer open={isOpen} onOpenChange={(open) => { 
        if (!open) { 
          if (document.activeElement instanceof HTMLElement) {
            document.activeElement.blur();
          }
          window.scrollTo(0, 0);
          setTimeout(() => { setIsOpen(false); setSelectedId(null); }, 150);
        } else {
          setIsOpen(true);
        }
      }}>
        <DrawerContent className="mx-auto w-full max-w-2xl px-4 sm:px-6 pb-[max(1.5rem,env(safe-area-inset-bottom,0px))] pt-2 flex flex-col" style={{ maxHeight: "calc(95dvh - env(safe-area-inset-top, 0px))" }}>
          <DrawerTitle className="sr-only">Bayar Hutang</DrawerTitle>
          <DrawerDescription className="sr-only">Form to pay debt to supplier</DrawerDescription>
          
          <div className="flex flex-col h-full" style={{ maxHeight: 'calc(95vh - 5rem)' }}>
            {/* Gradient Header */}
            <div className="bg-gradient-to-r from-violet-600 via-violet-500 to-indigo-600 px-6 py-4 flex items-center gap-3 shrink-0">
              <div className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-white" strokeWidth={1.5} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white leading-tight">Bayar Hutang</h2>
                <p className="text-violet-200 text-xs">Isi formulir untuk mencatat pembayaran hutang</p>
              </div>
            </div>
            
            <div className="overflow-y-auto flex-1 p-5 bg-slate-50/50">
            {selectedPay && (
              <div className="space-y-5 pb-6">
                <div className="p-4 bg-white rounded-[16px] border border-slate-100 shadow-sm text-sm flex flex-col gap-3">
                  <div className="flex justify-between items-center"><span className="text-slate-500 font-medium">Supplier:</span><span className="font-bold text-slate-800">{(selectedPay as any).supplierName}</span></div>
                  <div className="flex justify-between items-center pt-2 border-t border-slate-100 border-dashed">
                    <span className="text-slate-500 font-medium">Sisa Hutang:</span>
                    <span 
                      className="font-bold text-rose-600 text-base cursor-pointer hover:underline hover:text-rose-700 transition-colors bg-rose-50 px-2 py-0.5 rounded-md"
                      onClick={() => setPayAmount(String(Math.round(Number((selectedPay as any).remainingAmount || 0))))}
                      title="Klik untuk bayar lunas"
                    >
                      {formatRupiah((selectedPay as any).remainingAmount)}
                    </span>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-slate-600 mb-1.5 block">Jumlah Bayar (Rp)</label>
                    <Input type="number" min={0} placeholder="0" value={payAmount} onChange={e => setPayAmount(e.target.value)} className={`h-11 bg-white border-slate-200 rounded-xl focus-visible:ring-violet-500 text-base font-semibold ${parseFloat(payAmount) > ((selectedPay as any).remainingAmount || 0) ? "border-rose-500 focus-visible:ring-rose-500 bg-rose-50" : ""}`} />
                    
                    {/* Real-time Validation and Formatting Preview */}
                    {payAmount && (
                      <div className="mt-2 flex flex-col gap-1.5">
                        <span className="text-[11px] font-bold text-violet-700 block bg-violet-100/50 px-2.5 py-1.5 rounded-lg border border-violet-100">
                          Preview: {formatRupiah(parseFloat(payAmount) || 0)}
                        </span>
                        {parseFloat(payAmount) <= 0 && (
                          <span className="text-[10px] font-bold text-rose-500 flex items-center gap-1 uppercase tracking-wider"><AlertTriangle className="h-3 w-3" /> Harus lebih dari 0</span>
                        )}
                        {parseFloat(payAmount) > ((selectedPay as any).remainingAmount || 0) && (
                          <span className="text-[10px] font-bold text-rose-500 flex items-center gap-1 uppercase tracking-wider"><AlertTriangle className="h-3 w-3" /> Melebihi sisa hutang</span>
                        )}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-600 mb-1.5 block">Metode Pembayaran</label>
                    <Select value={payMethod} onValueChange={setPayMethod}>
                      <SelectTrigger className="h-11 bg-white border-slate-200 rounded-xl focus-visible:ring-violet-500 font-medium text-slate-700"><SelectValue /></SelectTrigger>
                      <SelectContent className="rounded-xl border-slate-100 shadow-xl">
                        <SelectItem value="tunai" className="font-medium">Tunai</SelectItem>
                        <SelectItem value="transfer" className="font-medium">Transfer</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-600 mb-1.5 block">Catatan</label>
                    <Input placeholder="Catatan opsional..." value={payNotes} onChange={e => setPayNotes(e.target.value)} className="h-11 bg-white border-slate-200 rounded-xl focus-visible:ring-violet-500" />
                  </div>
                </div>
              </div>
            )}
            </div>

            {/* Fixed Footer */}
            <div className="flex-none bg-white border-t border-slate-100 px-5 py-4 flex gap-3 z-10 shrink-0 shadow-[0_-4px_10px_rgba(0,0,0,0.03)]">
              <Button type="button" variant="ghost" className="flex-1 h-12 rounded-[14px] font-bold border border-slate-200 text-slate-600 hover:bg-slate-50" 
                onClick={() => { 
                  if (document.activeElement instanceof HTMLElement) { document.activeElement.blur(); }
                  window.scrollTo(0, 0);
                  setTimeout(() => { setIsOpen(false); setSelectedId(null); }, 150);
                }}>
                Batal
              </Button>
              <Button className="flex-[2] h-12 rounded-[14px] font-bold bg-violet-600 hover:bg-violet-700 text-white shadow-sm" onClick={handlePay} disabled={!payAmount || payMutation.isPending}>
                {payMutation.isPending ? "Memproses..." : "Simpan Pembayaran"}
              </Button>
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
