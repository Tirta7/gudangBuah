import React, { useState } from "react";
import { PaginationControl } from "../components/PaginationControl";
import { useListReceivables, useGetReceivable, useAddReceivablePayment, getListReceivablesQueryKey, getGetReceivableQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter, DrawerDescription } from "@/components/ui/drawer";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Wallet, Plus, AlertTriangle, CheckCircle2, AlertCircle, DollarSign, ChevronDown, ChevronUp, Clock, CreditCard, Banknote, QrCode } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatRupiah, formatDate } from "@/lib/utils";
import { DateRangeFilter, filterByDateRange } from "@/components/DateRangeFilter";

export default function Piutang() {
  const [currentPage, setCurrentPage] = useState(1);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"semua" | "belum_bayar" | "partial">("semua");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("tunai");
  const [payNotes, setPayNotes] = useState("");
  const [payDate, setPayDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [expandedCustomerIds, setExpandedCustomerIds] = useState<Set<string>>(new Set());
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [expandedDetailMap, setExpandedDetailMap] = useState<Record<number, any>>({});

  const { data: receivables, isLoading } = useListReceivables({}, { query: { queryKey: getListReceivablesQueryKey({}) } });
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: selectedDetail } = useGetReceivable(selectedId || 0, {
    query: { queryKey: getGetReceivableQueryKey(selectedId || 0), enabled: !!selectedId && isOpen }
  });

  const refreshExpandedDetail = (recId: number) => {
    fetch(`/api/receivables/${recId}`, { credentials: "include" })
      .then(r => r.json())
      .then(data => setExpandedDetailMap(prev => ({ ...prev, [recId]: data })));
  };

  const toggleCustomerExpand = (name: string) => {
    setExpandedCustomerIds(prev => {
      const next = new Set(prev);
      if (next.has(name)) { next.delete(name); }
      else { next.add(name); }
      return next;
    });
  };

  const toggleExpand = (recId: number) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(recId)) { next.delete(recId); }
      else {
        next.add(recId);
        if (!expandedDetailMap[recId]) refreshExpandedDetail(recId);
      }
      return next;
    });
  };

  const payMutation = useAddReceivablePayment({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListReceivablesQueryKey({}) });
        if (selectedId) {
          queryClient.invalidateQueries({ queryKey: getGetReceivableQueryKey(selectedId) });
          refreshExpandedDetail(selectedId);
          setExpandedIds(prev => new Set([...prev, selectedId]));
        }
        setIsOpen(false); setSelectedId(null); setPayAmount(""); setPayNotes(""); setPayDate(new Date().toISOString().split("T")[0]);
        toast({ title: "Pembayaran cicilan berhasil dicatat" });
      }
    }
  });

  const openPayment = (id: number) => { setSelectedId(id); setIsOpen(true); };
  const selectedRec = receivables?.find(r => r.id === selectedId);

  const handlePay = () => {
    if (!selectedId || !selectedRec) return;
    const amount = parseFloat(payAmount) || 0;
    const remaining = (selectedRec as any).remainingAmount || 0;
    if (amount <= 0) { toast({ title: "Jumlah tidak valid", description: "Harus lebih dari 0", variant: "destructive" }); return; }
    if (amount > remaining) { toast({ title: "Jumlah terlalu besar", description: `Maks: ${formatRupiah(remaining)}`, variant: "destructive" }); return; }
    payMutation.mutate({ id: selectedId, data: { amount, paymentMethod: payMethod as any, notes: payNotes || undefined, paidAt: payDate ? new Date(payDate).toISOString() : undefined } });
  };

  const filtered = filterByDateRange(
    receivables?.filter(r => {
      if (r.status === "lunas") return false;
      const q = search.toLowerCase();
      const matchSearch = (r as any).customerName?.toLowerCase().includes(q) || (r as any).invoiceNumber?.toLowerCase().includes(q);
      const matchStatus = activeTab === "semua" || r.status === activeTab || (activeTab === "belum_bayar" && r.status === "unpaid");
      return matchSearch && matchStatus;
    }) ?? [], dateFrom, dateTo,
  );

  const groupedCustomers = React.useMemo(() => {
    const map = new Map<string, {
      customerName: string;
      invoices: typeof filtered;
      totalTagihan: number;
      totalSisa: number;
      isOverdue: boolean;
    }>();
    
    filtered.forEach(r => {
      const name = (r as any).customerName || "Anonim";
      if (!map.has(name)) {
        map.set(name, { customerName: name, invoices: [], totalTagihan: 0, totalSisa: 0, isOverdue: false });
      }
      const group = map.get(name)!;
      group.invoices.push(r);
      group.totalTagihan += (r as any).totalAmount || 0;
      group.totalSisa += (r as any).remainingAmount || 0;
      if ((r as any).isOverdue) group.isOverdue = true;
    });
    
    return Array.from(map.values()).sort((a, b) => a.customerName.localeCompare(b.customerName));
  }, [filtered]);

  const totalPiutang = filtered?.reduce((sum, r) => sum + ((r as any).remainingAmount ?? 0), 0) ?? 0;
  const overdueCount = filtered?.filter(r => (r as any).isOverdue).length ?? 0;
  const methodLabel: Record<string, string> = { tunai: "Tunai", transfer: "Transfer", cashless: "Cashless/QRIS" };
  const methodIcon = (m: string) => {
    if (m === "transfer") return <CreditCard className="w-3 h-3" />;
    if (m === "cashless") return <QrCode className="w-3 h-3" />;
    return <Banknote className="w-3 h-3" />;
  };

  return (
    <div className="flex flex-col h-full w-full relative">
      {/* ── Static Top Strip: judul + tab + filter + summary ── */}
      <div className="flex-none space-y-2 pb-2">
        {/* SINGLE ROW HEADER */}
        <div className="flex flex-col xl:flex-row xl:items-center gap-3 justify-between border-b border-slate-100 pb-2">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="shrink-0 mr-2">
              <h1 className="text-xl font-bold tracking-tight text-slate-900 leading-tight">Piutang</h1>
              <p className="text-[11px] text-slate-400">Kelola tagihan pelanggan</p>
            </div>
            
            <div className="flex h-9 w-fit justify-start rounded-xl bg-slate-100 p-1 gap-1 overflow-x-auto hide-scrollbar">
              {(["semua", "belum_bayar", "partial"] as const).map((tab) => {
                const labels: Record<string, string> = { semua: "Semua", belum_bayar: "Belum Lunas", partial: "Sebagian" };
                const isActive = activeTab === tab;
                let activeColor = "text-violet-700";
                if (tab === "belum_bayar") activeColor = "text-rose-700";
                
                return (
                  <button 
                    key={tab} 
                    onClick={() => { setActiveTab(tab); setCurrentPage(1); }}
                    className={`flex items-center rounded-lg px-3 text-xs font-semibold h-7 whitespace-nowrap transition-all ${
                      isActive ? `bg-white shadow-sm ${activeColor}` : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {labels[tab]}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400" />
              <Input 
                placeholder="Cari nota / pelanggan..." 
                className="pl-7 w-48 h-8 rounded-lg border-slate-200 bg-slate-50 text-xs focus-visible:ring-violet-500"
                value={search} 
                onChange={e => { setSearch(e.target.value); setCurrentPage(1); }} 
              />
            </div>
            <DateRangeFilter onFilter={(from, to) => { setDateFrom(from); setDateTo(to); setCurrentPage(1); }} />
          </div>
        </div>

        {/* Rekap Summary (Ultra Compact Strip) */}
        {filtered && filtered.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pb-2">
            <div className="bg-white border border-slate-100 rounded-lg px-3 py-1.5 flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-slate-50 flex items-center justify-center text-slate-600 shrink-0">
                <Wallet className="w-3 h-3" strokeWidth={1.5} />
              </div>
              <div className="flex flex-col justify-center">
                <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider">Total Data</span>
                <span className="text-xs font-black text-slate-900 leading-tight">{filtered.length} Piutang</span>
              </div>
            </div>
            <div className="bg-violet-50 border border-violet-100 rounded-lg px-3 py-1.5 flex flex-col justify-center">
              <span className="text-[9px] font-semibold text-violet-400 uppercase tracking-wider">Total Piutang Aktif</span>
              <span className="text-xs font-black text-violet-900 leading-tight">{formatRupiah(totalPiutang)}</span>
            </div>
            <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-1.5 flex flex-col justify-center">
              <span className="text-[9px] font-semibold text-blue-500 uppercase tracking-wider">Invoice Aktif</span>
              <span className="text-xs font-black text-blue-700 leading-tight">{filtered?.length ?? 0} Tagihan</span>
            </div>
            <div className={`border rounded-lg px-3 py-1.5 flex flex-col justify-center ${overdueCount > 0 ? 'bg-rose-50 border-rose-100' : 'bg-slate-50 border-slate-100'}`}>
              <span className={`text-[9px] font-semibold uppercase tracking-wider ${overdueCount > 0 ? 'text-rose-500' : 'text-slate-400'}`}>Jatuh Tempo</span>
              <span className={`text-xs font-black leading-tight ${overdueCount > 0 ? 'text-rose-700' : 'text-slate-500'}`}>{overdueCount} Tagihan</span>
            </div>
          </div>
        )}
      </div>

      {/* ── scrollable Table Container ── */}
      <div className="flex-1 overflow-auto min-h-0 pb-10">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden min-w-0">
          {isLoading ? (
            <div className="p-6 space-y-3">{Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-10 w-full rounded-lg" />)}</div>
          ) : groupedCustomers.length === 0 ? (
            <div className="text-center py-16"><Wallet className="mx-auto mb-4 h-12 w-12 text-slate-300" strokeWidth={1.5} /><h3 className="text-lg font-bold text-slate-700">Tidak ada piutang</h3></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                  <tr>
                    <th className="h-8 px-4 text-left align-middle font-semibold text-slate-600 text-[11px] whitespace-nowrap border-b border-slate-100">#</th>
                    <th className="h-8 px-4 text-left align-middle font-semibold text-slate-600 text-[11px] whitespace-nowrap border-b border-slate-100">Pelanggan</th>
                    <th className="h-8 px-4 text-left align-middle font-semibold text-slate-600 text-[11px] whitespace-nowrap border-b border-slate-100">Jml Tagihan Aktif</th>
                    <th className="h-8 px-4 text-right align-middle font-semibold text-slate-600 text-[11px] whitespace-nowrap border-b border-slate-100">Total Tagihan</th>
                    <th className="h-8 px-4 text-right align-middle font-semibold text-slate-600 text-[11px] whitespace-nowrap border-b border-slate-100">Total Sisa Piutang</th>
                    <th className="h-8 px-4 text-center align-middle font-semibold text-slate-600 text-[11px] whitespace-nowrap border-b border-slate-100">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {groupedCustomers.slice((currentPage - 1) * 20, currentPage * 20).map((group, idx) => {
                    const isCustomerExpanded = expandedCustomerIds.has(group.customerName);
                    
                    return (
                      <React.Fragment key={group.customerName}>
                        <tr className={`border-b border-slate-50 hover:bg-slate-50/50 group transition-colors cursor-pointer ${group.isOverdue ? 'bg-rose-50/20' : ''}`} onClick={() => toggleCustomerExpand(group.customerName)}>
                          <td className="py-3 px-4 text-[11px] text-slate-500 whitespace-nowrap">{(currentPage - 1) * 20 + idx + 1}</td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <div className="flex flex-col">
                              <span className="font-bold text-sm text-slate-800">{group.customerName}</span>
                              {group.isOverdue && <span className="text-[9px] font-bold text-rose-500 uppercase mt-0.5">Ada yg Jatuh Tempo</span>}
                            </div>
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className="font-semibold text-xs text-slate-700 bg-slate-100 px-2.5 py-1 rounded-full">{group.invoices.length} Nota</span>
                          </td>
                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            <span className="font-bold text-xs text-slate-800">{formatRupiah(group.totalTagihan)}</span>
                          </td>
                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            <span className="font-bold text-xs text-rose-600">{formatRupiah(group.totalSisa)}</span>
                          </td>
                          <td className="py-3 px-4 text-center whitespace-nowrap">
                            <Button variant="ghost" size="icon" className={`h-8 w-8 transition-transform ${isCustomerExpanded ? 'rotate-180' : ''}`}>
                              <ChevronDown className="h-4 w-4 text-slate-500" />
                            </Button>
                          </td>
                        </tr>
                        
                        {isCustomerExpanded && (
                          <tr className="bg-slate-50/80">
                            <td colSpan={6} className="py-4 px-6 border-b border-slate-200">
                              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                                <table className="w-full text-xs">
                                  <thead className="bg-slate-50/50 border-b border-slate-100">
                                    <tr>
                                      <th className="h-8 px-4 text-left font-semibold text-slate-600">Tanggal</th>
                                      <th className="h-8 px-4 text-left font-semibold text-slate-600">Invoice</th>
                                      <th className="h-8 px-4 text-left font-semibold text-slate-600">Status</th>
                                      <th className="h-8 px-4 text-right font-semibold text-slate-600">Total Tagihan</th>
                                      <th className="h-8 px-4 text-right font-semibold text-slate-600">Sisa Piutang</th>
                                      <th className="h-8 px-4 text-center font-semibold text-slate-600">Aksi</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100">
                                    {group.invoices.map(r => {
                                      const isOverdue = (r as any).isOverdue;
                                      const isExpanded = expandedIds.has(r.id);
                                      const detail = expandedDetailMap[r.id];
                                      let badgeClass = "bg-rose-50 text-rose-600 border-rose-100";
                                      if (r.status === "partial") badgeClass = "bg-blue-50 text-blue-600 border-blue-100";

                                      return (
                                        <React.Fragment key={r.id}>
                                          <tr className="hover:bg-slate-50/50 transition-colors">
                                            <td className="py-2.5 px-4 text-slate-500 whitespace-nowrap">{formatDate(r.createdAt)}</td>
                                            <td className="py-2.5 px-4"><span className="font-mono font-bold text-slate-700">{(r as any).invoiceNumber || `#${r.id}`}</span></td>
                                            <td className="py-2.5 px-4 whitespace-nowrap">
                                              <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider border ${badgeClass}`}>{r.status?.replace("_", " ")}</span>
                                              {isOverdue && <span className="ml-1 text-[9px] font-bold text-rose-500 uppercase">Jatuh Tempo</span>}
                                            </td>
                                            <td className="py-2.5 px-4 text-right"><span className="font-bold text-slate-800">{formatRupiah((r as any).totalAmount)}</span></td>
                                            <td className="py-2.5 px-4 text-right"><span className="font-bold text-rose-600">{formatRupiah((r as any).remainingAmount)}</span></td>
                                            <td className="py-2.5 px-4 text-center">
                                              <div className="flex items-center justify-center gap-1">
                                                {(r as any).paidAmount > 0 && (
                                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg" onClick={(e) => { e.stopPropagation(); toggleExpand(r.id); }} title="Riwayat Cicilan">
                                                    {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
                                                  </Button>
                                                )}
                                                <Button variant="ghost" size="icon" className="h-7 w-7 text-violet-600 hover:text-violet-700 hover:bg-violet-50 rounded-lg" onClick={(e) => { e.stopPropagation(); openPayment(r.id); }} title="Bayar Cicilan">
                                                  <Plus className="h-3.5 w-3.5" />
                                                </Button>
                                              </div>
                                            </td>
                                          </tr>
                                          {isExpanded && (
                                            <tr className="bg-slate-50/30">
                                              <td colSpan={6} className="py-3 px-4 border-b border-slate-100">
                                                <div className="flex flex-col gap-2 ml-auto w-full max-w-xl">
                                                  {!detail ? (
                                                    <div className="flex gap-2"><Skeleton className="h-8 w-full rounded-lg" /></div>
                                                  ) : (
                                                    <div className="flex flex-col gap-1.5">
                                                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Riwayat Cicilan:</span>
                                                      
                                                      {(() => {
                                                        const recordedTotal = detail.payments?.reduce((acc: number, p: any) => acc + parseFloat(p.amount), 0) || 0;
                                                        const dpAmount = Math.round(parseFloat((r as any).paidAmount || 0) - recordedTotal);
                                                        const hasDP = dpAmount > 0;
                                                        const hasPayments = detail.payments && detail.payments.length > 0;
                                                        
                                                        if (!hasDP && !hasPayments) {
                                                          return <p className="text-[11px] text-slate-400 font-medium py-2 text-center">Belum ada cicilan tercatat.</p>;
                                                        }

                                                        return (
                                                          <>
                                                            {hasDP && (
                                                              <div className="flex justify-between items-center bg-amber-50/50 border border-amber-100 shadow-sm p-2 rounded-lg">
                                                                <div className="flex items-center gap-3">
                                                                  <div className="w-6 h-6 rounded-md bg-amber-100 flex items-center justify-center text-amber-600 shrink-0">
                                                                    <Wallet className="w-3.5 h-3.5" />
                                                                  </div>
                                                                  <div className="flex flex-col">
                                                                    <span className="text-[10px] font-bold text-slate-700">{formatDate(r.createdAt)}</span>
                                                                    <span className="text-[9px] font-medium text-slate-400 capitalize">DP / Pembayaran Awal</span>
                                                                  </div>
                                                                </div>
                                                                <span className="font-bold text-amber-600 text-xs">{formatRupiah(dpAmount)}</span>
                                                              </div>
                                                            )}
                                                            
                                                            {detail.payments?.map((p: any) => {
                                                              const dt = new Date(p.paidAt);
                                                              return (
                                                                <div key={p.id} className="flex justify-between items-center bg-white border border-slate-100 shadow-sm p-2 rounded-lg">
                                                                  <div className="flex items-center gap-3">
                                                                    <div className="w-6 h-6 rounded-md bg-slate-50 flex items-center justify-center text-slate-400 shrink-0">
                                                                      {methodIcon(p.paymentMethod)}
                                                                    </div>
                                                                    <div className="flex flex-col">
                                                                      <span className="text-[10px] font-bold text-slate-700">{dt.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}</span>
                                                                      <span className="text-[9px] font-medium text-slate-400 capitalize">{methodLabel[p.paymentMethod] || p.paymentMethod} {p.notes ? `• ${p.notes}` : ''}</span>
                                                                    </div>
                                                                  </div>
                                                                  <span className="font-bold text-emerald-600 text-xs">{formatRupiah(parseFloat(p.amount))}</span>
                                                                </div>
                                                              );
                                                            })}
                                                          </>
                                                        );
                                                      })()}
                                                    </div>
                                                  )}
                                                </div>
                                              </td>
                                            </tr>
                                          )}
                                        </React.Fragment>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Pagination Bar */}
      {groupedCustomers && groupedCustomers.length > 20 && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
          <div className="bg-white/90 backdrop-blur-md shadow-[0_4px_20px_rgba(0,0,0,0.12)] border border-slate-200/60 rounded-full px-3 py-0.5 flex items-center justify-center gap-3 pointer-events-auto">
            <span className="text-[10px] font-medium text-slate-400 hidden sm:inline">
              {groupedCustomers.length} pelanggan
            </span>
            <PaginationControl currentPage={currentPage} totalPages={Math.ceil(groupedCustomers.length / 20)} onPageChange={setCurrentPage} />
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
        <DrawerContent className="max-h-[95vh] mx-auto w-full max-w-2xl p-0 overflow-hidden">
          <DrawerTitle className="sr-only">Catat Pembayaran Cicilan</DrawerTitle>
          <DrawerDescription className="sr-only">Form to record an installment payment</DrawerDescription>
          
          <div className="flex flex-col h-full" style={{ maxHeight: 'calc(95vh - 5rem)' }}>
            {/* Gradient Header */}
            <div className="bg-linear-to-r from-violet-600 via-violet-500 to-indigo-600 px-6 py-4 flex items-center gap-3 shrink-0">
              <div className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
                <Wallet className="w-5 h-5 text-white" strokeWidth={1.5} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white leading-tight">Catat Pembayaran Cicilan</h2>
                <p className="text-violet-200 text-xs">Isi formulir untuk mencatat pembayaran piutang pelanggan</p>
              </div>
            </div>
            
            <div className="overflow-y-auto flex-1 p-5 bg-slate-50/50">
            {selectedRec && (
              <div className="space-y-5 pb-6">
                <div className="p-4 bg-white rounded-[16px] border border-slate-100 shadow-sm text-sm flex flex-col gap-3">
                  <div className="flex justify-between items-center"><span className="text-slate-500 font-medium">Pelanggan:</span><span className="font-bold text-slate-800">{(selectedRec as any).customerName || "-"}</span></div>
                  <div className="flex justify-between items-center"><span className="text-slate-500 font-medium">Invoice:</span><span className="font-mono text-[11px] bg-slate-100 px-2 py-0.5 rounded border border-slate-200">{(selectedRec as any).invoiceNumber}</span></div>
                  <div className="flex justify-between items-center"><span className="text-slate-500 font-medium">Grand Total:</span><span className="font-semibold">{formatRupiah((selectedRec as any).totalAmount)}</span></div>
                  <div className="flex justify-between items-center"><span className="text-slate-500 font-medium">Sudah Dibayar:</span><span className="font-semibold text-emerald-600">{formatRupiah((selectedRec as any).paidAmount)}</span></div>
                  <div className="flex justify-between items-center pt-2 border-t border-slate-100 border-dashed">
                    <span className="text-slate-500 font-medium">Sisa Piutang:</span>
                    <span className="font-bold text-rose-600 text-base cursor-pointer hover:underline hover:text-rose-700 transition-colors bg-rose-50 px-2 py-0.5 rounded-md" 
                          onClick={() => setPayAmount(String(Math.round(Number((selectedRec as any).remainingAmount || 0))))} title="Klik untuk bayar lunas">
                      {formatRupiah((selectedRec as any).remainingAmount)}
                    </span>
                  </div>
                </div>

                {(() => {
                  const recordedTotal = selectedDetail?.payments?.reduce((acc: number, p: any) => acc + parseFloat(p.amount), 0) || 0;
                  const dpAmount = Math.round(parseFloat((selectedRec as any).paidAmount || 0) - recordedTotal);
                  const hasDP = dpAmount > 0;
                  const hasPayments = selectedDetail?.payments && (selectedDetail.payments as any[]).length > 0;

                  if (!hasDP && !hasPayments) return null;

                  return (
                    <div className="space-y-2">
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> Riwayat Pembayaran</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {hasDP && (
                          <div className="flex items-center justify-between bg-amber-50/50 rounded-[14px] px-3 py-2.5 border border-amber-100 shadow-sm">
                            <div className="flex items-center gap-2">
                              <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold flex items-center justify-center shrink-0"><Wallet className="w-3 h-3" /></span>
                              <div className="flex flex-col">
                                <span className="text-[11px] font-bold text-slate-700">DP / Awal</span>
                                <span className="text-[9px] text-slate-400">{formatDate((selectedRec as any).createdAt)}</span>
                              </div>
                            </div>
                            <span className="font-bold text-amber-600 text-xs">{formatRupiah(dpAmount)}</span>
                          </div>
                        )}
                        
                        {(selectedDetail?.payments as any[])?.map((p: any, idx: number) => {
                          const dt = new Date(p.paidAt);
                          return (
                            <div key={p.id} className="flex items-center justify-between bg-white rounded-[14px] px-3 py-2.5 border border-slate-100 shadow-sm">
                              <div className="flex items-center gap-2">
                                <span className="w-5 h-5 rounded-full bg-violet-100 text-violet-700 text-[10px] font-bold flex items-center justify-center shrink-0">{hasDP ? idx + 2 : idx + 1}</span>
                                <div className="flex flex-col">
                                  <span className="text-[11px] font-bold text-slate-700">{methodLabel[p.paymentMethod] || p.paymentMethod}</span>
                                  <span className="text-[9px] text-slate-400">{dt.toLocaleDateString("id-ID", { day: "2-digit", month: "short" })} {dt.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}</span>
                                </div>
                              </div>
                              <span className="font-bold text-emerald-600 text-xs">{formatRupiah(parseFloat(p.amount))}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-slate-600 mb-1.5 block">Tanggal Pembayaran</label>
                    <Input type="date" value={payDate} onChange={e => setPayDate(e.target.value)} max={new Date().toISOString().split("T")[0]} className="h-11 bg-white border-slate-200 rounded-xl focus-visible:ring-violet-500" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-600 mb-1.5 block">Jumlah Bayar Cicilan (Rp)</label>
                    <Input type="number" min={0} max={(selectedRec as any).remainingAmount} placeholder="0" value={payAmount} onChange={e => setPayAmount(e.target.value)} className={`h-11 bg-white border-slate-200 rounded-xl focus-visible:ring-violet-500 text-base font-semibold ${parseFloat(payAmount) > ((selectedRec as any).remainingAmount || 0) ? "border-rose-500 focus-visible:ring-rose-500 bg-rose-50" : ""}`} />
                    {payAmount && (
                      <div className="mt-2 flex flex-col gap-1.5">
                        <span className="text-[11px] font-bold text-violet-700 block bg-violet-100/50 px-2.5 py-1.5 rounded-lg border border-violet-100">
                          Preview: {formatRupiah(parseFloat(payAmount) || 0)}
                        </span>
                        {parseFloat(payAmount) <= 0 && <span className="text-[10px] font-bold text-rose-500 flex items-center gap-1 uppercase tracking-wider"><AlertTriangle className="h-3 w-3" /> Harus lebih dari 0</span>}
                        {parseFloat(payAmount) > ((selectedRec as any).remainingAmount || 0) && <span className="text-[10px] font-bold text-rose-500 flex items-center gap-1 uppercase tracking-wider"><AlertTriangle className="h-3 w-3" /> Melebihi sisa piutang</span>}
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
                        <SelectItem value="cashless" className="font-medium">Cashless/QRIS</SelectItem>
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
                {payMutation.isPending ? "Menyimpan..." : "Simpan Cicilan"}
              </Button>
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
