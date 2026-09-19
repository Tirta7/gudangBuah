import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { PageHeader } from "../components/PageHeader";
import { PaginationControl } from "../components/PaginationControl";
import { useListPurchases, useCreatePurchase, useListSuppliers, useListProducts, useListPaymentMethods, useListCategories, getListPurchasesQueryKey, getListSuppliersQueryKey, getListProductsQueryKey, getListPaymentMethodsQueryKey, getListCategoriesQueryKey } from "@workspace/api-client-react";
import { sessionExpiredEvent } from "@/hooks/useAuth";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PurchaseDetailModal } from "@/components/PurchaseDetailModal";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Combobox } from "@/components/ui/combobox";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerFooter } from "@/components/ui/drawer";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Trash2, Search, ShoppingBag, PlusCircle, CheckCircle2, Clock, AlertCircle, ArrowRightCircle, RotateCcw, Download, Upload, FileSpreadsheet, X as XIcon, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatRupiah, formatDate, generateSequentialInvoiceNumber } from "@/lib/utils";
import { DateRangeFilter, filterByDateRange } from "@/components/DateRangeFilter";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useRef } from "react";

type PurchaseItem = { categoryId?: number; productId: number; productName: string; krats: number | ""; kgs: number | ""; pricePerKg: number | ""; subtotal: number; primaryUnit?: string; secondaryUnit?: string; barcode?: string; batchWeights?: number[]; };

const STATUS_COLORS: Record<string, string> = {
  lunas: "bg-green-100 text-green-700 border-green-200",
  partial: "bg-amber-100 text-amber-700 border-amber-200",
  kredit: "bg-blue-100 text-blue-700 border-blue-200",
};

// Key localStorage untuk draft form pembelian
const DRAFT_KEY = "pembelian_draft_v1";

export default function Pembelian() {
  const [activeTab, setActiveTab] = useState<"semua" | "lunas" | "kredit" | "partial">("semua");
  const [currentPage, setCurrentPage] = useState(1);
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [viewDetailId, setViewDetailId] = useState<number | null>(null);
  const [items, setItems] = useState<PurchaseItem[]>([]);
  const [supplierId, setSupplierId] = useState<string>("");
  const [paymentType, setPaymentType] = useState<string>("tunai");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreSourceInvoice, setRestoreSourceInvoice] = useState("");
  const [draftSavedAt, setDraftSavedAt] = useState<Date | null>(null);
  const [hasDraftRestored, setHasDraftRestored] = useState(false);
  // ─── Export/Import state ───────────────────────────────────────
  const [isExporting, setIsExporting] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<any | null>(null);
  const importFileRef = useRef<HTMLInputElement>(null);

  const [location, navigate] = useLocation();

  const { data: purchases, isLoading } = useListPurchases({}, { query: { queryKey: getListPurchasesQueryKey({}) } });
  const { data: suppliers } = useListSuppliers({}, { query: { queryKey: getListSuppliersQueryKey({}) } });
  const { data: products } = useListProducts({}, { query: { queryKey: getListProductsQueryKey() } });
  const { data: categories } = useListCategories();
  const { data: paymentMethods = [] } = useListPaymentMethods({ query: { queryKey: getListPaymentMethodsQueryKey() } });
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const createMutation = useCreatePurchase({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListPurchasesQueryKey({}) });
        // Hapus draft setelah submit sukses
        try { localStorage.removeItem(DRAFT_KEY); } catch {}
        setIsOpen(false); resetForm();
        toast({ title: "Pembelian berhasil dicatat" });
      },
      onError: (error: any) => {
        const status = error?.response?.status || error?.status;
        const message = error?.response?.data?.error || error?.message || "";

        if (status === 401) {
          // Session expired — arahkan ke login
          toast({ title: "Sesi telah berakhir", description: "Silakan login kembali. Data Anda tidak hilang, coba submit ulang setelah login.", variant: "destructive" });
          window.dispatchEvent(new Event(sessionExpiredEvent));
          return;
        }
        if (status === 409) {
          // Duplicate invoice — generate ulang otomatis dan coba lagi
          toast({ title: "Nomor nota duplikat", description: message || "Nomor nota sudah ada, coba submit ulang.", variant: "destructive" });
          // Reset invoice number supaya generate ulang saat retry
          setInvoiceNumber("");
          return;
        }
        toast({ title: "Gagal menyimpan pembelian", description: message || "Terjadi kesalahan, silakan coba lagi.", variant: "destructive" });
      }
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/purchases/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Gagal menghapus pembelian");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getListPurchasesQueryKey({}) });
      queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
      toast({ title: "Pembelian berhasil dihapus" });
    },
    onError: () => {
      toast({ title: "Gagal menghapus pembelian", variant: "destructive" });
    }
  });

  // Reset state form saja — draft localStorage TIDAK dihapus
  // Dipakai saat drawer tutup tidak sengaja (backdrop, Escape, navigasi)
  const resetFormState = () => {
    setItems([]); setSupplierId(""); setPaymentType("tunai"); setDueDate(""); setNotes("");
    setIsRestoring(false); setRestoreSourceInvoice(""); setDraftSavedAt(null);
    // Reset hasDraftRestored supaya draft bisa di-restore lagi saat form dibuka kembali
    setHasDraftRestored(false);
  };

  // Reset penuh — reset state + hapus draft localStorage
  // Dipakai hanya saat: (1) tombol Batal ditekan eksplisit, (2) submit berhasil
  const resetForm = () => {
    resetFormState();
    try { localStorage.removeItem(DRAFT_KEY); } catch {}
  };

  // ── Restore dari URL param ──────────────────────────────────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const inv = params.get("restoreInvoice");
    if (!inv) return;

    // Hapus param dari URL supaya tidak loop saat refresh
    window.history.replaceState({}, '', '/pos/pembelian');

    const fetchAndRestore = async () => {
      try {
        const res = await fetch(`/api/purchases/by-invoice?invoice=${encodeURIComponent(inv)}`, { credentials: 'include' });
        if (!res.ok) throw new Error("Tidak ditemukan");
        const data = await res.json();

        // Isi form dengan data lama
        setSupplierId(data.supplierId?.toString() || "");
        setPaymentType(data.paymentType || "tunai");
        setNotes(`[Restore dari ${inv}] ${data.notes || ""}`.trim());
        setRestoreSourceInvoice(inv);
        setIsRestoring(true);

        const restoredItems: PurchaseItem[] = (data.items || []).map((i: any) => ({
          categoryId: i.categoryId || undefined,
          productId: i.productId,
          productName: i.productName || "",
          krats: Number(i.krats) || 0,
          kgs: Number(i.kgs) || 0,
          pricePerKg: Number(i.pricePerKg) || 0,
          subtotal: Number(i.subtotal) || 0,
          primaryUnit: i.primaryUnit || undefined,
          secondaryUnit: i.secondaryUnit || undefined,
          barcode: i.barcode || "",
          batchWeights: Array.isArray(i.batchWeights) ? i.batchWeights : [],
        }));
        setItems(restoredItems);

        // Auto-generate invoice number baru
        const existingInvoices = purchases?.map(p => p.invoiceNumber) || [];
        setInvoiceNumber(generateSequentialInvoiceNumber("INV-IN", existingInvoices));
        setIsOpen(true);
      } catch (e) {
        toast({ title: "Gagal memuat data pembelian yang dibatalkan", variant: "destructive" });
      }
    };

    fetchAndRestore();
  }, [location]);

  // ── Auto-save draft ke localStorage saat form terbuka & ada perubahan ──
  useEffect(() => {
    if (!isOpen || isRestoring) return;
    // Jangan save jika form kosong
    if (items.length === 0 && !supplierId) return;
    const draft = { items, supplierId, paymentType, dueDate, notes, savedAt: new Date().toISOString() };
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      setDraftSavedAt(new Date());
    } catch {}
  }, [isOpen, isRestoring, items, supplierId, paymentType, dueDate, notes]);

  // ── Restore draft dari localStorage saat form dibuka (jika ada) ──
  useEffect(() => {
    if (!isOpen || isRestoring || hasDraftRestored) return;
    setHasDraftRestored(true);
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw);
      // Abaikan draft lama (> 24 jam)
      if (draft.savedAt) {
        const age = Date.now() - new Date(draft.savedAt).getTime();
        if (age > 24 * 60 * 60 * 1000) { localStorage.removeItem(DRAFT_KEY); return; }
      }
      if (draft.items?.length > 0 || draft.supplierId) {
        setItems(draft.items || []);
        setSupplierId(draft.supplierId || "");
        setPaymentType(draft.paymentType || "tunai");
        setDueDate(draft.dueDate || "");
        setNotes(draft.notes || "");
        setDraftSavedAt(draft.savedAt ? new Date(draft.savedAt) : null);
        toast({
          title: "✅ Draft dipulihkan",
          description: `Data input terakhir berhasil dimuat kembali. Periksa & submit kembali jika sudah benar.`,
        });
      }
    } catch {}
  }, [isOpen, isRestoring, hasDraftRestored]);

  const addItem = () => setItems(prev => [...prev, { categoryId: undefined, productId: 0, productName: "", krats: "", kgs: "", pricePerKg: "", subtotal: 0, barcode: "", batchWeights: [] }]);
  const removeItem = (index: number) => setItems(prev => prev.filter((_, i) => i !== index));

  const removeKratLength = (itemIndex: number, kratIndex: number) => {
    setItems(prev => {
      const updated = [...prev];
      if (updated[itemIndex].batchWeights && updated[itemIndex].batchWeights!.length > kratIndex) {
        updated[itemIndex].batchWeights!.splice(kratIndex, 1);
        updated[itemIndex].krats = updated[itemIndex].batchWeights!.length;
        updated[itemIndex].kgs = parseFloat(updated[itemIndex].batchWeights!.reduce((a: number, b: any) => a + (parseFloat(String(b).replace(',', '.')) || 0), 0).toFixed(3));
        const item = updated[itemIndex];
        updated[itemIndex].subtotal = Math.round((typeof item.kgs === "number" ? item.kgs : 0) * (typeof item.pricePerKg === "number" ? item.pricePerKg : 0));
      }
      return updated;
    });
  };

  const updateItem = (index: number, field: keyof PurchaseItem | `batchWeights.${number}`, value: any) => {
    setItems(prev => {
      const updated = [...prev];
      
      if (typeof field === 'string' && field.startsWith('batchWeights.')) {
        const lengthIndex = parseInt(field.split('.')[1]);
        if (!updated[index].batchWeights) updated[index].batchWeights = [];
        updated[index].batchWeights![lengthIndex] = value;
        // Auto calculate kgs from batchWeights
        updated[index].kgs = parseFloat(updated[index].batchWeights!.reduce((a: number, b: any) => a + (parseFloat(String(b).replace(',', '.')) || 0), 0).toFixed(3));
      } else {
        (updated[index] as any)[field] = value;
      }
      
      if (field === "productId") {
        const prod = products?.find(p => p.id === parseInt(value));
        if (prod) { 
          updated[index].productName = prod.name; 
          updated[index].pricePerKg = (prod as any).costPricePerKg ?? (prod as any).pricePerKg ?? 0;
          updated[index].primaryUnit = prod.primaryUnit;
          updated[index].secondaryUnit = prod.secondaryUnit;
        }
      }
      
      if (field === "krats") {
        const val = parseInt(value) || 0;
        const currentWeights = updated[index].batchWeights || [];
        const newLengths = Array.from({ length: val }, (_, i) => currentWeights[i] || "");
        updated[index].batchWeights = newLengths as number[];
        updated[index].kgs = parseFloat((newLengths as any[]).reduce((a: number, b: any) => a + (parseFloat(String(b).replace(',', '.')) || 0), 0).toFixed(3));
      }
      
      const item = updated[index];
      updated[index].subtotal = Math.round((typeof item.kgs === "number" ? item.kgs : 0) * (typeof item.pricePerKg === "number" ? item.pricePerKg : 0));
      return updated;
    });
  };

  const totalAmount = Math.round(items.reduce((sum, i) => sum + i.subtotal, 0));

  const handleSubmit = useCallback(async () => {
    if (items.length === 0) { toast({ title: "Tambahkan minimal 1 item", variant: "destructive" }); return; }
    if (items.some(i => !i.productId || (typeof i.kgs === "number" ? i.kgs : 0) <= 0)) { toast({ title: "Mohon lengkapi data barang", variant: "destructive" }); return; }
    if (!supplierId) { toast({ title: "Pilih supplier", variant: "destructive" }); return; }

    // Selalu fetch daftar invoice terbaru langsung dari server
    // agar nomor nota tidak bertabrakan meskipun form sudah lama terbuka
    let finalInvoiceNumber = invoiceNumber;
    try {
      const freshRes = await fetch("/api/purchases?_t=" + Date.now(), { credentials: "include" });
      if (freshRes.status === 401) {
        toast({ title: "Sesi telah berakhir", description: "Silakan login kembali.", variant: "destructive" });
        window.dispatchEvent(new Event(sessionExpiredEvent));
        return;
      }
      if (freshRes.ok) {
        const freshData = await freshRes.json();
        const freshInvoices: string[] = freshData.map((p: any) => p.invoiceNumber);
        finalInvoiceNumber = generateSequentialInvoiceNumber("INV-IN", freshInvoices);
      } else {
        // Fallback ke data cache jika fetch gagal
        const existingInvoices = purchases?.map(p => p.invoiceNumber) || [];
        finalInvoiceNumber = generateSequentialInvoiceNumber("INV-IN", existingInvoices);
      }
    } catch {
      // Fallback ke data cache
      const existingInvoices = purchases?.map(p => p.invoiceNumber) || [];
      finalInvoiceNumber = generateSequentialInvoiceNumber("INV-IN", existingInvoices);
    }

    createMutation.mutate({
      data: {
        invoiceNumber: finalInvoiceNumber,
        supplierId: parseInt(supplierId),
        paymentType: paymentType as any,
        dueDate: dueDate || undefined,
        notes: notes || undefined,
        items: items.map(i => ({ 
          productId: i.productId, 
          krats: typeof i.krats === "number" ? i.krats : 0, 
          kgs: typeof i.kgs === "number" ? i.kgs : 0, 
          pricePerKg: typeof i.pricePerKg === "number" ? i.pricePerKg : 0, 
          subtotal: i.subtotal, 
          barcode: i.barcode || undefined,
          batchWeights: i.batchWeights || undefined
        }))
      }
    });
  }, [items, supplierId, invoiceNumber, paymentType, dueDate, notes, purchases, createMutation, toast]);

  const filtered = filterByDateRange(
    purchases?.filter(p => {
      const q = search.toLowerCase();
      return p.invoiceNumber?.toLowerCase().includes(q) || (p as any).supplierName?.toLowerCase().includes(q);
    }) ?? [],
    dateFrom,
    dateTo,
  );

  const tabFiltered = filtered.filter(p => {
    if (activeTab === "semua") return true;
    if (activeTab === "kredit") return p.status === "unpaid";
    return p.status === activeTab;
  });

  return (
    <div className="flex flex-col h-full w-full">
      {/* Static Top Strip */}
      <div className="flex-none space-y-2 pb-2">
        <div className="flex items-center justify-between pt-1 pb-2">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Pembelian</h1>
            <p className="text-sm text-slate-500">Riwayat kulakan dari supplier</p>
          </div>
          <Button onClick={() => {
            const existingInvoices = purchases?.map(p => p.invoiceNumber) || [];
            setInvoiceNumber(generateSequentialInvoiceNumber("INV-IN", existingInvoices));
            setIsOpen(true);
          }} className="rounded-full shadow-sm bg-violet-600 hover:bg-violet-700">
            <Plus className="mr-2 h-4 w-4" /> Baru
          </Button>
        </div>
        {/* Tabs */}
        <div className="flex gap-3 border-b border-slate-200">
          {(['semua', 'lunas', 'kredit', 'partial'] as const).map((tab) => (
            <button key={tab} onClick={() => { setActiveTab(tab); setCurrentPage(1); }}
              className={`pb-2.5 text-sm font-semibold whitespace-nowrap transition-colors relative ${activeTab === tab ? 'text-violet-700' : 'text-slate-500 hover:text-slate-800'}`}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
              {activeTab === tab && <div className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t-full bg-violet-600" />}
            </button>
          ))}
        </div>
        {/* Filter */}
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input placeholder="Cari no invoice atau supplier..." className="pl-9 bg-white border-slate-200 rounded-full h-10 shadow-sm" value={search} onChange={e => { setSearch(e.target.value); setCurrentPage(1); }} />
          </div>
          <DateRangeFilter onFilter={(from, to) => { setDateFrom(from); setDateTo(to); setCurrentPage(1); }} />
          {/* Export Excel */}
          <Button
            variant="outline"
            className="h-10 rounded-full text-xs font-semibold px-4 border-emerald-200 text-emerald-700 hover:bg-emerald-50 shadow-sm"
            disabled={isExporting}
            onClick={async () => {
              setIsExporting(true);
              try {
                const params = new URLSearchParams();
                if (dateFrom) params.set("startDate", dateFrom);
                if (dateTo) params.set("endDate", dateTo);
                const url = `/api/purchases/export${params.toString() ? '?' + params.toString() : ''}`;
                const res = await fetch(url, { credentials: "include" });
                if (!res.ok) throw new Error("Export gagal");
                const blob = await res.blob();
                const a = document.createElement("a");
                a.href = URL.createObjectURL(blob);
                const cd = res.headers.get("Content-Disposition") || "";
                const match = cd.match(/filename="?([^"]+)"?/);
                a.download = match ? match[1] : "Pembelian.xlsx";
                a.click();
                URL.revokeObjectURL(a.href);
              } catch { alert("Gagal export"); }
              finally { setIsExporting(false); }
            }}
          >
            {isExporting ? <span className="h-3.5 w-3.5 mr-1.5 rounded-full border-2 border-emerald-600 border-t-transparent animate-spin inline-block" /> : <Download className="mr-1.5 h-3.5 w-3.5" />}
            Export Excel
          </Button>
          {/* Import Excel */}
          <Button
            variant="outline"
            className="h-10 rounded-full text-xs font-semibold px-4 border-blue-200 text-blue-700 hover:bg-blue-50 shadow-sm"
            onClick={() => { setImportResult(null); setImportFile(null); setImportOpen(true); }}
          >
            <Upload className="mr-1.5 h-3.5 w-3.5" /> Import Excel
          </Button>
        </div>
      </div>

      {/* scrollable Table */}
      <div className="flex-1 overflow-auto min-h-0">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="p-6 space-y-3">{Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-10 w-full rounded-lg" />)}</div>
          ) : tabFiltered?.length === 0 ? (
            <div className="text-center py-16"><ShoppingBag className="mx-auto mb-4 h-12 w-12 text-slate-300" strokeWidth={1.5} /><h3 className="text-lg font-bold text-slate-700">Belum ada aktivitas pembelian</h3></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-slate-50 border-b border-slate-200 shadow-sm">
                    <th className="text-left py-2.5 px-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider w-8 whitespace-nowrap">#</th>
                    <th className="text-left py-2.5 px-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Tanggal</th>
                    <th className="text-left py-2.5 px-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Invoice</th>
                    <th className="text-left py-2.5 px-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Supplier</th>
                    <th className="text-center py-2.5 px-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Status</th>
                    <th className="text-right py-2.5 px-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Total</th>
                    <th className="text-right py-2.5 px-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Kekurangan</th>
                    <th className="text-center py-2.5 px-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider w-24 whitespace-nowrap">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {tabFiltered?.slice((currentPage - 1) * 20, currentPage * 20).map((p, idx) => {
                    let badgeBg = "bg-green-100 text-green-700";
                    if (p.status === 'kredit') badgeBg = "bg-amber-100 text-amber-700";
                    else if (p.status === 'partial') badgeBg = "bg-blue-100 text-blue-700";
                    else if (p.status === 'cancelled') badgeBg = "bg-rose-100 text-rose-700";
                    const kurang = p.totalAmount - (p.paidAmount || 0);
                    return (
                      <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-2.5 px-3 text-xs text-slate-400 font-mono whitespace-nowrap">{(currentPage - 1) * 20 + idx + 1}</td>
                        <td className="py-2.5 px-3 text-xs text-slate-600 whitespace-nowrap">{formatDate(p.createdAt)}</td>
                        <td className="py-2.5 px-3 text-xs font-mono text-slate-500 whitespace-nowrap">{p.invoiceNumber}</td>
                        <td className="py-2.5 px-3 font-semibold text-slate-800 whitespace-nowrap">{(p as any).supplierName || "Supplier Umum"}</td>
                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${badgeBg}`}>{p.status}</span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-slate-800 whitespace-nowrap">{formatRupiah(p.totalAmount)}</td>
                        <td className={`py-2.5 px-3 text-right font-bold ${kurang > 0 ? 'text-amber-600' : 'text-slate-300'}`}>{kurang > 0 ? formatRupiah(kurang) : '—'}</td>
                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1.5">
                            <button className="w-7 h-7 rounded-lg bg-violet-50 hover:bg-violet-100 text-violet-600 flex items-center justify-center transition-colors" title="Lihat Detail" onClick={() => setViewDetailId(p.id)}>
                              <ArrowRightCircle className="w-3.5 h-3.5" />
                            </button>
                            <button 
                              className="w-7 h-7 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 flex items-center justify-center transition-colors disabled:opacity-50" 
                              title="Hapus Pembelian" 
                              onClick={() => {
                                if (confirm("Apakah Anda yakin ingin menghapus pembelian ini? Semua krat yang ditambahkan akan ditarik kembali dari stok.")) {
                                  deleteMutation.mutate(p.id);
                                }
                              }}
                              disabled={deleteMutation.isPending}
                            >
                              {deleteMutation.isPending && deleteMutation.variables === p.id ? (
                                <span className="h-3.5 w-3.5 rounded-full border-2 border-red-600 border-t-transparent animate-spin" />
                              ) : (
                                <Trash2 className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
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
        <div className="flex-none border-t border-slate-200 bg-white px-4 py-2.5 flex items-center justify-between rounded-b-2xl shadow-sm">
          <span className="text-xs text-slate-400">Menampilkan {(currentPage - 1) * 20 + 1}–{Math.min(currentPage * 20, tabFiltered.length)} dari {tabFiltered.length} pembelian</span>
          <PaginationControl currentPage={currentPage} totalPages={Math.ceil(tabFiltered.length / 20)} onPageChange={setCurrentPage} />
        </div>
      )}

      <Drawer open={isOpen} onOpenChange={(open) => { if (!open) { setIsOpen(false); resetFormState(); } }}>
        <DrawerContent className="mx-auto w-full max-w-[95vw] xl:max-w-7xl px-4 sm:px-6 pb-[max(1.5rem,env(safe-area-inset-bottom,0px))] pt-2 flex flex-col" style={{ maxHeight: "calc(95dvh - env(safe-area-inset-top, 0px))" }}>
          <DrawerTitle className="sr-only">Buat Pembelian Baru</DrawerTitle>
          <DrawerDescription className="sr-only">Form to create a new purchase</DrawerDescription>
          
          {/* Gradient Header */}
          <div className="bg-gradient-to-r from-violet-600 via-violet-500 to-indigo-600 px-6 py-4 flex items-center gap-3 shrink-0">
            <div className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
              <ShoppingBag className="w-5 h-5 text-white" strokeWidth={1.5} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white leading-tight">
                {isRestoring ? `Restore Pembelian` : `Buat Pembelian Baru`}
              </h2>
              <p className="text-violet-200 text-xs">
                {isRestoring
                  ? `Mengedit ulang data dari nota ${restoreSourceInvoice}`
                  : `Catat transaksi pembelian barang dari supplier`}
              </p>
            </div>
          </div>
          
          <div className="overflow-y-auto max-h-[calc(90vh-5rem)] p-6">
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Supplier</label>
                <Select value={supplierId} onValueChange={setSupplierId}>
                  <SelectTrigger><SelectValue placeholder="Pilih supplier" /></SelectTrigger>
                  <SelectContent>
                    {suppliers?.map(s => <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Metode Pembayaran</label>
                <Combobox
                  items={paymentMethods.filter(m => m.isActive).length > 0
                    ? paymentMethods.filter(m => m.isActive).map(m => ({ value: m.code, label: m.name }))
                    : [
                        { value: "tunai", label: "Tunai" },
                        { value: "transfer", label: "Transfer" },
                        { value: "kredit", label: "Kredit" },
                      ]
                  }
                  value={paymentType}
                  onValueChange={setPaymentType}
                  placeholder="Pilih metode"
                  searchPlaceholder="Cari..."
                />
              </div>
              {paymentType === "kredit" && (
                <div>
                  <label className="text-sm font-medium mb-1 block">Jatuh Tempo</label>
                  <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
                </div>
              )}
              <div className={paymentType === "kredit" ? "" : "md:col-span-2"}>
                <label className="text-sm font-medium mb-1 block">Catatan</label>
                <Input placeholder="Catatan opsional" value={notes} onChange={e => setNotes(e.target.value)} />
              </div>
            </div>
            <Separator />
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-medium">Item Barang</span>
                <Button type="button" variant="outline" size="sm" onClick={addItem}><PlusCircle className="mr-2 h-4 w-4" /> Tambah Item</Button>
              </div>
              {items.length === 0 && (
                <div className="text-center py-6 border-2 border-dashed rounded-lg text-muted-foreground text-sm">Belum ada item. Klik "Tambah Item" untuk memulai.</div>
              )}
              {items.map((item, index) => (
                <div key={index} className="flex flex-col gap-2 p-3 bg-muted/30 rounded-lg">
                  <div className="flex flex-col md:grid md:grid-cols-12 gap-2 md:items-end">
                    <div className="md:col-span-2">
                      <label className="text-xs text-muted-foreground mb-1 block">Kategori</label>
                      <Combobox
                        items={[
                          { value: "0", label: "Semua" },
                          ...(categories?.map((c: any) => ({ value: c.id.toString(), label: c.name })) || [])
                        ]}
                        value={item.categoryId ? item.categoryId.toString() : undefined}
                        onValueChange={(v) => updateItem(index, "categoryId", parseInt(v))}
                        placeholder="Semua"
                        searchPlaceholder="Cari kategori..."
                        className="h-8"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="text-xs text-muted-foreground mb-1 block">Barang</label>
                      <Combobox
                        items={products
                          ?.filter((p: any) => !item.categoryId || item.categoryId === 0 || p.categoryId === item.categoryId)
                          .map((p: any) => ({ value: p.id.toString(), label: p.name })) || []}
                        value={item.productId ? item.productId.toString() : undefined}
                        onValueChange={(v) => updateItem(index, "productId", parseInt(v))}
                        placeholder="Pilih"
                        searchPlaceholder="Cari barang..."
                        className="h-8"
                      />
                    </div>
                    <div className="md:col-span-1">
                      <label className="text-xs text-muted-foreground mb-1 block truncate">Barcode</label>
                      <Input className="h-8 px-2 bg-slate-100 cursor-not-allowed" placeholder="Otomatis" value={item.barcode || ""} readOnly />
                    </div>
                    <div className="md:col-span-1">
                      <label className="text-xs text-muted-foreground mb-1 block truncate">Krat</label>
                      <Input className="h-8 px-2" type="number" step="1" min={0} value={item.krats} onChange={e => updateItem(index, "krats", e.target.value === "" ? "" : parseFloat(e.target.value))} />
                    </div>
                    <div className="md:col-span-2">
                      <label className="text-xs text-muted-foreground mb-1 block truncate">Qty ({item.primaryUnit || "KG"})</label>
                      <Input className="h-8 px-2 bg-slate-100 cursor-not-allowed font-medium" type="number" step="any" min={0} value={item.kgs} readOnly />
                    </div>
                    <div className="md:col-span-2">
                      <label className="text-xs text-muted-foreground mb-1 block truncate">Harga / {item.primaryUnit || "KG"}</label>
                      <Input className="h-8 px-2" type="number" step="any" min={0} value={item.pricePerKg} onChange={e => updateItem(index, "pricePerKg", e.target.value === "" ? "" : parseFloat(e.target.value))} />
                    </div>
                    <div className="md:col-span-1">
                      <label className="text-xs text-muted-foreground mb-1 block">Subtotal</label>
                      <div className="h-8 flex items-center text-xs font-medium px-1">{formatRupiah(item.subtotal)}</div>
                    </div>
                    <div className="md:col-span-1 flex justify-end md:justify-center mt-2 md:mt-0">
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeItem(index)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  </div>

                  {/* Dynamic inputs for krat lengths */}
                  {item.krats && (item.krats as number) > 0 && (
                    <div className="mt-2 bg-white p-3 rounded-lg border border-slate-200">
                      <label className="text-xs font-semibold text-slate-700 block mb-2 border-b pb-1">Detail Panjang Tiap Krat ({item.primaryUnit || "KG"})</label>
                      <div className="flex flex-wrap gap-3">
                        {Array.from({ length: item.krats as number }).map((_, i) => (
                          <div key={i} className="flex flex-col w-24 shrink-0 space-y-1 relative group">
                            <label className="text-[10px] font-medium text-slate-500 truncate">Krat #{i + 1}</label>
                            <Input
                              type="number" step="any" min={0}
                              placeholder="KG"
                              className="h-8 text-xs px-2"
                              value={item.batchWeights?.[i] || ''}
                              onChange={e => updateItem(index, `batchWeights.${i}` as any, e.target.value === "" ? "" : parseFloat(e.target.value))}
                            />
                            <button 
                              type="button" 
                              onClick={() => removeKratLength(index, i)} 
                              className="absolute -top-1 -right-1 bg-red-100 hover:bg-red-200 text-red-600 rounded-full p-0.5 transition-opacity"
                              title="Hapus Krat Ini"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
            {items.length > 0 && (
              <div className="flex justify-end pt-2">
                <div className="text-right">
                  <span className="text-muted-foreground mr-4">Total:</span>
                  <span className="text-xl font-bold">{formatRupiah(totalAmount)}</span>
                </div>
              </div>
            )}
          </div>
          </div>
          <DrawerFooter className="px-0 pt-3 mt-2 flex-col gap-2">
            {/* Indikator draft tersimpan */}
            {draftSavedAt && !isRestoring && (
              <div className="flex items-center justify-center gap-1.5 text-[11px] text-emerald-600 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-1.5">
                <Save className="w-3 h-3 shrink-0" />
                <span>Draft tersimpan otomatis — {draftSavedAt.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" })} · Aman jika terjadi gangguan</span>
              </div>
            )}
            <div className="flex gap-2">
              <Button type="button" variant="ghost" className="flex-1 bg-muted text-muted-foreground hover:bg-muted/80" onClick={() => { setIsOpen(false); resetForm(); }}>Batal</Button>
              <Button
                className={`flex-1 ${isRestoring ? "bg-emerald-600 hover:bg-emerald-700" : ""}`}
                onClick={handleSubmit}
                disabled={createMutation.isPending || items.length === 0}
              >
                {createMutation.isPending
                  ? <><span className="h-4 w-4 mr-2 rounded-full border-2 border-white border-t-transparent animate-spin inline-block" />Menyimpan...</>
                  : isRestoring ? <><RotateCcw className="mr-2 h-4 w-4" />Tambahkan ke Pembelian</> : "Simpan Pembelian"}
              </Button>
            </div>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      <PurchaseDetailModal 
        purchaseId={viewDetailId} 
        isOpen={!!viewDetailId} 
        onClose={() => setViewDetailId(null)} 
      />

      {/* ─── Import Excel Modal ─────────────────────────────────────── */}
      <Dialog open={importOpen} onOpenChange={(o) => { if (!isImporting) { setImportOpen(o); if (!o) { setImportFile(null); setImportResult(null); } } }}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-blue-600" />
              Import Pembelian dari Excel
            </DialogTitle>
          </DialogHeader>

          {!importResult ? (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-blue-800 space-y-1">
                <p className="font-semibold">📋 Format Excel yang dibutuhkan:</p>
                <p>Gunakan file hasil <strong>Export Excel</strong> sebagai template, atau buat file dengan kolom:</p>
                <ul className="list-disc ml-4 space-y-0.5 mt-1">
                  <li><strong>No Invoice</strong> — kunci pengelompokan (wajib)</li>
                  <li><strong>Tanggal</strong> — format dd/mm/yyyy</li>
                  <li><strong>Supplier</strong> — nama supplier sesuai di sistem (wajib)</li>
                  <li><strong>Produk / Barang</strong> — nama barang sesuai di sistem (wajib)</li>
                  <li><strong>Krat</strong>, <strong>Kg/KG</strong>, <strong>Harga / Kg</strong>, <strong>Subtotal</strong></li>
                  <li><strong>Metode Bayar</strong> — tunai / kredit / tempo</li>
                </ul>
                <p className="text-blue-600 mt-1">⚠️ Invoice yang sudah ada di sistem akan dilewati otomatis.</p>
              </div>

              <div
                className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center cursor-pointer hover:border-blue-300 hover:bg-blue-50/50 transition-colors"
                onClick={() => importFileRef.current?.click()}
              >
                {importFile ? (
                  <div className="flex items-center justify-center gap-2">
                    <FileSpreadsheet className="w-6 h-6 text-emerald-600" />
                    <div className="text-left">
                      <p className="text-sm font-semibold text-slate-800">{importFile.name}</p>
                      <p className="text-xs text-slate-500">{(importFile.size / 1024).toFixed(1)} KB</p>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); setImportFile(null); }} className="ml-2 text-slate-400 hover:text-red-500">
                      <XIcon className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div>
                    <Upload className="mx-auto w-8 h-8 text-slate-300 mb-2" />
                    <p className="text-sm font-medium text-slate-600">Klik untuk pilih file Excel</p>
                    <p className="text-xs text-slate-400">.xlsx, .xls — maks 10MB</p>
                  </div>
                )}
                <input
                  ref={importFileRef} type="file" accept=".xlsx,.xls" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) setImportFile(f); e.target.value = ""; }}
                />
              </div>

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setImportOpen(false)}>Batal</Button>
                <Button
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                  disabled={!importFile || isImporting}
                  onClick={async () => {
                    if (!importFile) return;
                    setIsImporting(true);
                    try {
                      const form = new FormData();
                      form.append("file", importFile);
                      const res = await fetch("/api/purchases/import", { method: "POST", body: form, credentials: "include" });
                      const data = await res.json();
                      if (!res.ok) throw new Error(data.error || "Import gagal");
                      setImportResult(data);
                      queryClient.invalidateQueries({ queryKey: getListPurchasesQueryKey({}) });
                    } catch (err: any) {
                      alert(err.message || "Gagal mengimport file");
                    } finally {
                      setIsImporting(false);
                    }
                  }}
                >
                  {isImporting
                    ? <><span className="h-3.5 w-3.5 mr-1.5 rounded-full border-2 border-white border-t-transparent animate-spin inline-block" />Mengimport...</>
                    : <><Upload className="mr-1.5 h-3.5 w-3.5" />Mulai Import</>}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-3 text-center">
                  <p className="text-2xl font-black text-emerald-700">{importResult.success}</p>
                  <p className="text-xs text-emerald-600 font-medium">Berhasil</p>
                </div>
                <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 text-center">
                  <p className="text-2xl font-black text-amber-700">{importResult.skipped}</p>
                  <p className="text-xs text-amber-600 font-medium">Dilewati</p>
                </div>
                <div className="bg-rose-50 border border-rose-100 rounded-lg p-3 text-center">
                  <p className="text-2xl font-black text-rose-700">{importResult.failed}</p>
                  <p className="text-xs text-rose-600 font-medium">Gagal</p>
                </div>
              </div>
              <div className="max-h-60 overflow-y-auto border border-slate-100 rounded-lg divide-y divide-slate-100">
                {importResult.details?.map((d: any, i: number) => (
                  <div key={i} className="flex items-start gap-2 px-3 py-2 text-xs">
                    <span className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${d.status === "ok" ? "bg-emerald-500" : d.status === "skip" ? "bg-amber-400" : "bg-rose-500"}`} />
                    <div className="min-w-0">
                      <p className="font-mono font-semibold text-slate-700 truncate">{d.invoice}</p>
                      <p className={d.status === "error" ? "text-rose-600" : "text-slate-500"}>{d.message}</p>
                    </div>
                  </div>
                ))}
              </div>
              <Button className="w-full" onClick={() => { setImportOpen(false); setImportFile(null); setImportResult(null); }}>Tutup</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>

  );
}
