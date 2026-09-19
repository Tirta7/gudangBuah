import React, { useState, useMemo, useRef, useEffect } from "react";
import { PageHeader } from "../components/PageHeader";
import { PaginationControl } from "../components/PaginationControl";
import { useListSales, useCreateSale, useListCustomers, useListProducts, useListPaymentMethods, useGetProductBatchs, useListCategories, useGetSale, getListSalesQueryKey, getListCustomersQueryKey, getListProductsQueryKey, getListPaymentMethodsQueryKey, getGetProductBatchsQueryKey, getListCategoriesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from "@/components/ui/select";
import { Combobox, ComboboxItem } from "@/components/ui/combobox";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerFooter } from "@/components/ui/drawer";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Trash2, Search, ShoppingCart, PlusCircle, Printer, CheckCircle2, Clock, XCircle, AlertCircle, Receipt as ReceiptIcon, User as UserIcon, ChevronDown, CreditCard, Pencil, Ban, DollarSign, Download, Upload, FileSpreadsheet, X as XIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatRupiah, formatDate } from "@/lib/utils";
import { DateRangeFilter, filterByDateRange } from "@/components/DateRangeFilter";
import { InvoicePreviewModal, InvoicePreviewData } from "@/components/InvoicePreviewModal";
import { OtpDialog } from "@/components/OtpDialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";

// ─── API Helpers ─────────────────────────────────────────────────────────────
const API_BASE = window.location.origin;

type SaleItem = { categoryId?: number; productId: number; productName: string; batchId?: number; selectedKrats?: {id: number, currentWeight: number}[]; unit: "kg" | "krat"; krats: number | ""; kgs: number | ""; pricePerUnit: number | ""; subtotal: number; primaryUnit?: string; secondaryUnit?: string; targetLength?: number; };

const STATUS_COLORS: Record<string, string> = {
  lunas: "bg-green-100 text-green-700 border-green-200",
  partial: "bg-amber-100 text-amber-700 border-amber-200",
  kredit: "bg-blue-100 text-blue-700 border-blue-200",
  draft: "bg-slate-100 text-slate-600 border-slate-200",
  cancelled: "bg-red-50 text-red-500 border-red-200",
};

function SaleItemRow({ item, index, products, categories, updateItem, updateItemFields, removeItem, allItems }: any) {
  if (!products || !categories) {
    return <div className="h-24 w-full flex items-center justify-center bg-slate-50 animate-pulse rounded-lg border border-slate-100 mb-2"><div className="text-sm font-medium text-slate-400">Memuat baris...</div></div>;
  }

  const getCatIdStr = () => {
    if (!item.categoryId || item.categoryId === 0 || item.categoryId === "0") return "all";
    return item.categoryId.toString();
  };

  const [selectedCategoryId, setSelectedCategoryId] = useState<string>(getCatIdStr());
  
  // Sync selectedCategoryId if item.categoryId changes from parent (e.g. during Edit load)
  useEffect(() => {
    setSelectedCategoryId(getCatIdStr());
  }, [item.categoryId]);

  // Self-heal categoryId and units if products loaded late
  useEffect(() => {
    if (item.productId && products?.length > 0) {
      const prod = products.find((p: any) => p.id?.toString() === item.productId?.toString());
      if (prod) {
        if (!item.categoryId || item.categoryId === 0 || item.categoryId === "0") {
          if (prod.categoryId) updateItem(index, "categoryId", prod.categoryId);
        }
        if (!item.primaryUnit) {
          updateItem(index, "primaryUnit", prod.primaryUnit);
        }
        if (!item.secondaryUnit) {
          updateItem(index, "secondaryUnit", prod.secondaryUnit);
        }
      }
    }
  }, [item.productId, item.categoryId, item.primaryUnit, item.secondaryUnit, products, index, updateItem]);
  const [isKratModalOpen, setIsKratModalOpen] = useState(false);
  const [kratSearch, setKratSearch] = useState("");
  const [kratPage, setKratPage] = useState(1);
  const itemsPerPage = 100; // Increased to 100 for grid layout
  
  const { data: kratsData } = useGetProductBatchs(item.productId, {
    query: { queryKey: getGetProductBatchsQueryKey(item.productId), enabled: !!item.productId }
  });
  
  const krats = Array.isArray(kratsData) ? kratsData : (kratsData as any)?.krats ?? [];
  
  const drawerContainer = typeof document !== 'undefined' ? document.getElementById("drawer-portal-target") : null;

  // Kumpulkan semua krat ID yang sudah dipilih di baris lain (mode Pilih Spesifik Barcode)
  const usedKratIds = new Set<number>(
    (allItems as any[] || []).flatMap((otherItem: any, i: number) => {
      if (i === index) return []; // skip baris ini sendiri
      return (otherItem.selectedKrats || []).map((sr: any) => sr.id);
    })
  );

  // Kumpulkan berapa krat per panjang yang sudah dikonsumsi baris lain (mode Pilih Otomatis Per Ukuran)
  const usedLengthCounts: Record<string, number> = {};
  (allItems as any[] || []).forEach((otherItem: any, i: number) => {
    if (i === index) return; // skip baris ini sendiri
    if (otherItem.targetLength && typeof otherItem.krats === "number" && otherItem.krats > 0) {
      const key = otherItem.targetLength.toString();
      usedLengthCounts[key] = (usedLengthCounts[key] || 0) + otherItem.krats;
    }
  });

  // Reservasi virtual: krat yang diklaim mode Otomatis di baris lain → sembunyikan juga dari Barcode Spesifik
  const reservedKratIds = new Set<number>();
  if (krats) {
    // Kelompokkan krat berdasarkan panjang (kecuali yang sudah dipakai selectedKrats)
    const kratsByLength: Record<string, any[]> = {};
    krats.filter((r: any) => r.status === 'available' && !usedKratIds.has(r.id)).forEach((r: any) => {
      const len = r.currentWeight.toString();
      if (!kratsByLength[len]) kratsByLength[len] = [];
      kratsByLength[len].push(r);
    });
    // Tandai N krat pertama per panjang sebagai "reserved" sesuai klaim baris lain
    Object.entries(usedLengthCounts).forEach(([len, count]) => {
      (kratsByLength[len] || []).slice(0, count).forEach((r: any) => reservedKratIds.add(r.id));
    });
  }

  // Krat yang tersedia = tidak dipakai barcode spesifik DAN tidak direservasi mode Otomatis
  const availableKrats = krats?.filter((r: any) => r.status === 'available' && !usedKratIds.has(r.id) && !reservedKratIds.has(r.id)) || [];
  const lengthGroups: Record<string, number> = {};
  availableKrats.forEach((r: any) => {
    const len = r.currentWeight.toString();
    lengthGroups[len] = (lengthGroups[len] || 0) + 1;
  });

  const maxKrats = item.unit === "krat" && item.targetLength ? lengthGroups[item.targetLength.toString()] ?? 0 : undefined;

  // Auto-zero subtotal saat stok habis diklaim baris lain (mode Pilih Otomatis)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (item.targetLength !== undefined && maxKrats === 0) {
      // Reset ke 0 agar subtotal tidak terhitung ke total
      if (typeof item.krats === "number" && item.krats > 0) {
        updateItem(index, "krats", 0);
      }
      if (typeof item.kgs === "number" && item.kgs > 0) {
        updateItem(index, "kgs", 0);
      }
    }
  }, [maxKrats, item.targetLength]); // eslint-disable-line react-hooks/exhaustive-deps

  const filteredProducts = selectedCategoryId === "all" ? products : products?.filter((p: any) => p.categoryId.toString() === selectedCategoryId);

  // Filter available krats by search (currentWeight)
  const searchFilteredKrats = availableKrats.filter((r: any) => 
    r.currentWeight.toString().includes(kratSearch)
  );
  
  const paginatedKrats = searchFilteredKrats.slice((kratPage - 1) * itemsPerPage, kratPage * itemsPerPage);
  const totalPages = Math.ceil(searchFilteredKrats.length / itemsPerPage);

  return (
    <div className="flex flex-col md:grid md:grid-cols-12 gap-2 md:items-end p-3 bg-muted/30 rounded-lg">
      <div className="md:col-span-2">
        <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Kategori</label>
        <Combobox 
          items={[
            { value: "all", label: "Semua Kategori" },
            ...(categories?.map((c: any) => ({ value: c.id.toString(), label: c.name })) || [])
          ]}
          value={selectedCategoryId}
          onValueChange={setSelectedCategoryId}
          placeholder="Semua"
          searchPlaceholder="Cari kategori..."
          className="h-12"
        />
      </div>
      <div className="md:col-span-2">
        <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Barang</label>
        <Combobox
          items={filteredProducts?.map((p: any) => ({ 
            value: p.id.toString(), 
            label: `${p.name} (Stok: ${Number(p.kratStock || 0)} Krat / ${Number(p.kgStock || 0)} ${p.primaryUnit || 'M'})`
          })) || []}
          value={item.productId ? item.productId.toString() : undefined}
          onValueChange={(v) => updateItem(index, "productId", parseInt(v))}
          placeholder="Pilih barang"
          searchPlaceholder="Cari barang..."
          className="h-12"
        />
      </div>
      <div className="md:col-span-2">
        <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Krat (Stiker)</label>
        <Dialog open={isKratModalOpen} onOpenChange={setIsKratModalOpen}>
          <DialogTrigger asChild>
              <Button 
                type="button" 
                variant="outline" 
                className="w-full h-12 justify-between font-normal px-3 bg-white" 
                disabled={!item.productId}
              >
              <span className="truncate">
                {item.selectedKrats && item.selectedKrats.length > 0 
                   ? `${item.selectedKrats.length} Krat Terpilih`
                   : item.targetLength 
                     ? `${String(item.targetLength).replace('.', ',')} ${item.primaryUnit || 'unit'} (Auto)`
                     : "Potong Bebas / Manual"}
              </span>
              <ChevronDown className="h-4 w-4 opacity-50 shrink-0" />
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden bg-slate-50 border-0 rounded-2xl shadow-2xl" onInteractOutside={(e) => { e.preventDefault(); }}>
            <DialogHeader className="pb-2 border-b bg-white p-4">
              <DialogTitle className="text-center font-bold text-lg">
                {item.productName || "Pilih Krat / Potongan"}
              </DialogTitle>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-5 min-h-0">
              
              <div className="flex flex-col">
                <label className="flex items-center gap-3 rounded-md px-4 py-3 border hover:bg-slate-50 cursor-pointer w-full sm:w-1/2 mx-auto justify-center bg-white shadow-sm">
                  <Checkbox 
                    checked={!item.targetLength && (!item.selectedKrats || item.selectedKrats.length === 0)}
                    className="h-5 w-5"
                    onCheckedChange={() => {
                      updateItemFields(index, {
                        selectedKrats: [],
                        targetLength: undefined
                      });
                    }}
                  />
                  <span className="text-base font-medium">Potong Bebas</span>
                </label>
              </div>
              
              {Object.keys(lengthGroups).length > 0 && (
                <div className="space-y-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                  <div className="text-sm font-semibold text-slate-700 text-center mb-1">Pilih Otomatis (Per Ukuran)</div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                    {Object.entries(lengthGroups).map(([len, count]) => (
                      <label key={`len_${len}`} className="flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 bg-slate-50 border hover:border-primary/50 hover:bg-primary/5 cursor-pointer text-center transition-colors">
                        <Checkbox 
                          checked={item.targetLength === parseFloat(len)}
                          className="h-4 w-4"
                          onCheckedChange={() => {
                            updateItemFields(index, {
                              selectedKrats: [],
                              targetLength: parseFloat(len),
                              unit: "krat",
                              krats: 1,
                              kgs: parseFloat(len)
                            });
                          }}
                        />
                        <span className="text-sm font-medium">{String(len).replace('.', ',')} <span className="text-[10px] text-slate-500 font-normal ml-0.5">({count})</span></span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {availableKrats.length > 0 && (
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-slate-700">Pilih Spesifik Barcode</div>
                    <div className="relative w-full sm:w-64">
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                      <Input 
                        placeholder="Cari barcode..." 
                        className="pl-8 h-9 text-sm bg-slate-50" 
                        value={kratSearch}
                        onChange={e => { setKratSearch(e.target.value); setKratPage(1); }}
                      />
                    </div>
                  </div>
                  
                  <div className="border rounded-lg p-3 bg-slate-50">
                    {paginatedKrats.length === 0 ? (
                      <div className="text-center py-6 text-sm text-slate-500">Tidak ada krat ditemukan</div>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                        {paginatedKrats.map((r: any) => {
                          const isChecked = !!item.selectedKrats?.some((sr: any) => sr.id === r.id);
                          return (
                            <label key={r.id} className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 border cursor-pointer transition-colors shadow-sm ${isChecked ? 'bg-primary/10 border-primary' : 'bg-white hover:border-primary/50'}`} title={r.barcode || r.id}>
                              <Checkbox 
                                checked={isChecked}
                                className="h-4 w-4 shrink-0"
                                onCheckedChange={(checked) => {
                                  let newSelected = [...(item.selectedKrats || [])];
                                  if (checked) {
                                    newSelected.push({ id: r.id, currentWeight: parseFloat(r.currentWeight as unknown as string) });
                                  } else {
                                    newSelected = newSelected.filter((sr: any) => sr.id !== r.id);
                                  }
                                  if (newSelected.length > 0) {
                                    const sumKgs = newSelected.reduce((sum, sr) => sum + sr.currentWeight, 0);
                                    updateItemFields(index, {
                                      targetLength: undefined,
                                      selectedKrats: newSelected,
                                      unit: "krat",
                                      krats: newSelected.length,
                                      kgs: sumKgs
                                    });
                                  } else {
                                    updateItemFields(index, {
                                      targetLength: undefined,
                                      selectedKrats: newSelected,
                                      krats: "",
                                      kgs: ""
                                    });
                                  }
                                }}
                              />
                              <span className="text-sm font-semibold text-slate-700">{String(r.currentWeight).replace('.', ',')}</span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between pt-4 mt-1">
                      <Button 
                        type="button"
                        variant="outline" 
                        size="sm" 
                        disabled={kratPage === 1} 
                        onClick={(e) => { e.preventDefault(); setKratPage(p => Math.max(1, p - 1)); }}
                      >
                        Sebelumnya
                      </Button>
                      <span className="text-sm text-slate-500 font-medium">
                        Halaman {kratPage} dari {totalPages}
                      </span>
                      <Button 
                        type="button"
                        variant="outline" 
                        size="sm" 
                        disabled={kratPage === totalPages} 
                        onClick={(e) => { e.preventDefault(); setKratPage(p => Math.min(totalPages, p + 1)); }}
                      >
                        Selanjutnya
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="flex justify-end p-4 border-t bg-slate-50">
              <Button type="button" onClick={() => setIsKratModalOpen(false)} className="w-full sm:w-auto px-8">Selesai</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <div className="md:col-span-1">
        <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Satuan</label>
        <Combobox
          items={[
            {
              value: "kg",
              label: (item.primaryUnit?.trim() || "Satuan Utama") + (item.primaryUnit && item.secondaryUnit && item.primaryUnit === item.secondaryUnit ? " (Potongan)" : "")
            },
            {
              value: "krat",
              label: (item.secondaryUnit?.trim() || "Satuan Grosir") + (item.primaryUnit && item.secondaryUnit && item.primaryUnit === item.secondaryUnit ? " (Gulungan)" : "")
            }
          ]}
          value={item.unit}
          onValueChange={(v) => updateItem(index, "unit", v)}
          disabled={!!item.batchId}
          placeholder="Pilih"
          searchPlaceholder="Cari satuan..."
          className="h-12 font-medium"
        />
      </div>
      <div className="md:col-span-1">
        <label className="text-xs font-semibold text-muted-foreground mb-1.5 block truncate">{item.unit === "kg" ? `Jml (${item.primaryUnit?.toLowerCase() || "satuan"})` : `Jml (${item.secondaryUnit?.toLowerCase() || "satuan"})`}</label>
        <Input 
          className={`h-12 text-center text-lg font-medium ${item.unit === "krat" && item.targetLength && maxKrats === 0 ? "border-destructive bg-destructive/10 text-destructive" : ""} ${item.selectedKrats && item.selectedKrats.length > 0 ? "bg-muted/50 cursor-not-allowed" : ""}`} 
          type="number" step="any" min={0} max={maxKrats} 
          value={
            // Saat Pilih Spesifik Barcode aktif → tampilkan total panjang (kgs), bukan jumlah krat
            (item.selectedKrats && item.selectedKrats.length > 0)
              ? item.kgs
              : item.unit === "kg" ? item.kgs : item.krats
          }
          onChange={e => {
            // Jika selectedKrats aktif, input terkunci — tolak perubahan
            if (item.selectedKrats && item.selectedKrats.length > 0) return;
            let val: number | "" = e.target.value === "" ? "" : parseFloat(e.target.value);
            if (item.unit === "krat" && maxKrats !== undefined && typeof val === "number" && val > maxKrats) {
              val = maxKrats;
            }
            updateItem(index, item.unit === "kg" ? "kgs" : "krats", val);
          }} 
          readOnly={!!(item.selectedKrats && item.selectedKrats.length > 0)}
          disabled={(item.unit === "kg" && !!item.batchId) || (item.unit === "krat" && !!item.batchId) || (item.unit === "krat" && !!item.targetLength && maxKrats === 0)} 
        />
        {item.selectedKrats && item.selectedKrats.length > 0 && (
          <p className="text-[10px] text-slate-400 mt-1">{item.selectedKrats.length} krat • {item.kgs} {item.primaryUnit || 'unit'} total</p>
        )}
        {item.unit === "krat" && item.targetLength && maxKrats === 0 && (
          <p className="text-[10px] text-destructive mt-1">Stok habis dipakai baris lain</p>
        )}
      </div>
      <div className="md:col-span-2">
        <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Harga/satuan</label>
        <Input className="h-12 font-medium text-base" type="number" step="any" min={0} value={item.pricePerUnit} onChange={e => updateItem(index, "pricePerUnit", e.target.value === "" ? "" : parseFloat(e.target.value))} />
      </div>
      <div className="md:col-span-1">
        <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Subtotal</label>
        <div className="h-12 flex items-center text-base font-bold bg-muted/50 px-3 rounded-md border border-transparent">{formatRupiah(item.subtotal)}</div>
      </div>
      <div className="md:col-span-1 flex justify-end md:justify-center mt-2 md:mt-0">
        <Button type="button" variant="ghost" size="icon" className="h-12 w-12 hover:bg-destructive/10 hover:text-destructive transition-colors" onClick={() => removeItem(index)}><Trash2 className="h-5 w-5 text-destructive" /></Button>
      </div>
    </div>
  );
}

export default function Penjualan() {
  const [currentPage, setCurrentPage] = useState(1);
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  // ─── Import state ───────────────────────────────────────────
  const [importOpen, setImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<any | null>(null);
  const importFileRef = useRef<HTMLInputElement>(null);
  const [editingSaleId, setEditingSaleId] = useState<number | null>(null);
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [items, setItems] = useState<SaleItem[]>([]);
  const [customerId, setCustomerId] = useState<string>("");
  const [paymentType, setPaymentType] = useState<string>("tunai");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [dpAmount, setDpAmount] = useState<string>("");
  const [payDialogSaleId, setPayDialogSaleId] = useState<number | null>(null);
  const [payPaymentType, setPayPaymentType] = useState<string>("tunai");
  const [payAmount, setPayAmount] = useState<string>("");
  const [payProcessing, setPayProcessing] = useState(false);
  const [cancelProcessing, setCancelProcessing] = useState<number | null>(null);
  // ── Cicilan langsung dari Penjualan ──
  const [cicilanOpen, setCicilanOpen] = useState(false);
  const [cicilanSaleData, setCicilanSaleData] = useState<any>(null);
  const [cicilanRecId, setCicilanRecId] = useState<number | null>(null);
  const [cicilanAmount, setCicilanAmount] = useState("");
  const [cicilanMethod, setCicilanMethod] = useState("tunai");
  const [cicilanNotes, setCicilanNotes] = useState("");
  const [cicilanProcessing, setCicilanProcessing] = useState(false);
  
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState<InvoicePreviewData | null>(null);
  const [previewSaleId, setPreviewSaleId] = useState<number | undefined>();
  const [activeTab, setActiveTab] = useState<string>("Semua");

  const [otpDialogOpen, setOtpDialogOpen] = useState(false);
  const [otpAction, setOtpAction] = useState<"edit" | "cancel" | null>(null);
  const [otpTargetId, setOtpTargetId] = useState<number | null>(null);

  const { data: sales, isLoading } = useListSales({}, { query: { queryKey: getListSalesQueryKey({}) } });
  const { data: customers } = useListCustomers({}, { query: { queryKey: getListCustomersQueryKey({}) } });
  const { data: categories } = useListCategories({ query: { queryKey: getListCategoriesQueryKey() } });
  const { data: products } = useListProducts({}, { query: { queryKey: getListProductsQueryKey() } });
  const { data: paymentMethods = [] } = useListPaymentMethods({ query: { queryKey: getListPaymentMethodsQueryKey() } });
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const createMutation = useCreateSale({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListSalesQueryKey({}) });
        setIsOpen(false);
        resetForm();
        toast({ title: editingSaleId ? "Penjualan berhasil diperbarui" : "Penjualan berhasil dicatat" });
      }
    }
  });

  const resetForm = () => {
    setInvoiceNumber("");
    setItems([]);
    setCustomerId("");
    setPaymentType("tunai");
    setDueDate("");
    setNotes("");
    setDpAmount("");
    setEditingSaleId(null);
  };

  const handleEditClick = (saleId: number) => {
    setOtpTargetId(saleId);
    setOtpAction("edit");
    setOtpDialogOpen(true);
  };

  const openEditMode = async (saleId: number) => {
    try {
      const res = await fetch(`${API_BASE}/api/sales/${saleId}`);
      const data = await res.json();
      
      let currentProducts = products;
      if (!currentProducts || currentProducts.length === 0) {
        try {
          const prodRes = await fetch(`${API_BASE}/api/products`);
          if (prodRes.ok) currentProducts = await prodRes.json();
        } catch (e) {
          console.error("Failed to fetch products fallback", e);
        }
      }

      setEditingSaleId(saleId);
      setInvoiceNumber(data.invoiceNumber || "");
      setCustomerId(data.customerId ? String(data.customerId) : "");
      setPaymentType(data.paymentType || "tunai");
      setDueDate(data.dueDate ? data.dueDate.split("T")[0] : "");
      setNotes(data.notes || "");
      setDpAmount(data.status === "partial" || data.status === "held" ? (data.paidAmount ? data.paidAmount.toString() : "") : "");
      // Convert API items back to SaleItem format and GROUP them!
      const mergedItems: SaleItem[] = [];
      const dataItems = data.items || [];
      
      dataItems.forEach((i: any) => {
        const prod = currentProducts?.find((p: any) => p.id?.toString() === i.productId?.toString());
        
        if (i.batchId) {
          // Find existing merged item for this product that is ALSO using selectedKrats
          const existing = mergedItems.find(m => m.productId === i.productId && m.pricePerUnit === i.pricePerKg && m.selectedKrats);
          if (existing && existing.selectedKrats) {
            existing.selectedKrats.push({ id: i.batchId, currentWeight: parseFloat(i.kgs) });
            existing.krats = (typeof existing.krats === "number" ? existing.krats : 0) + (i.krats || 1);
            existing.kgs = (typeof existing.kgs === "number" ? existing.kgs : 0) + parseFloat(i.kgs || 0);
            existing.subtotal += parseFloat(i.subtotal || 0);
            return;
          }
          
          // Create new merged item
          mergedItems.push({
            categoryId: i.categoryId || prod?.categoryId || 0,
            productId: i.productId,
            productName: i.productName || prod?.name || "",
            selectedKrats: [{ id: i.batchId, currentWeight: parseFloat(i.kgs) }],
            unit: "krat",
            krats: i.krats || 1,
            kgs: parseFloat(i.kgs || 0),
            pricePerUnit: parseFloat(i.pricePerKg || 0),
            subtotal: parseFloat(i.subtotal || 0),
            primaryUnit: i.primaryUnit || prod?.primaryUnit,
            secondaryUnit: i.secondaryUnit || prod?.secondaryUnit,
          });
        } else {
          // Regular item without specific krat (bisa Potong Bebas atau Auto Krat)
          const isAutoKrat = i.krats > 0 && i.kgs > 0;
          const targetLen = isAutoKrat ? (parseFloat(i.kgs) / parseFloat(i.krats)) : undefined;
          
          mergedItems.push({
            categoryId: i.categoryId || prod?.categoryId || 0,
            productId: i.productId,
            productName: i.productName || prod?.name || "",
            unit: i.krats > 0 ? "krat" : "kg",
            krats: parseFloat(i.krats || 0),
            kgs: parseFloat(i.kgs || 0),
            pricePerUnit: parseFloat(i.pricePerKg || 0),
            subtotal: parseFloat(i.subtotal || 0),
            targetLength: targetLen,
            primaryUnit: i.primaryUnit || prod?.primaryUnit,
            secondaryUnit: i.secondaryUnit || prod?.secondaryUnit,
          });
        }
      });
      
      setItems(mergedItems);
      setIsOpen(true);
    } catch {
      toast({ title: "Gagal memuat data nota", variant: "destructive" });
    }
  };

  // Pay a draft sale
  const handlePay = async (saleId: number) => {
    setPayProcessing(true);
    try {
      const res = await fetch(`${API_BASE}/api/sales/${saleId}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentType: payPaymentType }),
      });
      if (!res.ok) throw new Error(await res.text());
      queryClient.invalidateQueries({ queryKey: getListSalesQueryKey({}) });
      setPayDialogSaleId(null);
      toast({ title: "✅ Pembayaran berhasil diterima!" });
    } catch (e: any) {
      toast({ title: "Gagal memproses pembayaran", variant: "destructive" });
    } finally {
      setPayProcessing(false);
    }
  };

  // Cancel a sale
  const handleCancelClick = (saleId: number) => {
    if (!confirm("Yakin ingin membatalkan nota ini? Stok akan dikembalikan jika sudah dibayar.")) return;
    setOtpTargetId(saleId);
    setOtpAction("cancel");
    setOtpDialogOpen(true);
  };

  const handleCancel = async (saleId: number) => {
    setCancelProcessing(saleId);
    try {
      const res = await fetch(`${API_BASE}/api/sales/${saleId}/cancel`, { method: "POST" });
      if (!res.ok) throw new Error(await res.text());
      queryClient.invalidateQueries({ queryKey: getListSalesQueryKey({}) });
      toast({ title: "Nota berhasil dibatalkan" });
    } catch {
      toast({ title: "Gagal membatalkan nota", variant: "destructive" });
    } finally {
      setCancelProcessing(null);
    }
  };


  // ── Buka drawer cicilan dari card Penjualan ──
  const handleOpenCicilan = async (saleId: number) => {
    try {
      const saleRes = await fetch(`${API_BASE}/api/sales/${saleId}`, { credentials: "include" });
      const saleData = await saleRes.json();
      const recRes = await fetch(`${API_BASE}/api/receivables`, { credentials: "include" });
      const recList = await recRes.json();
      const rec = Array.isArray(recList) ? recList.find((r: any) => r.saleId === saleId) : null;
      setCicilanSaleData(saleData);
      setCicilanRecId(rec?.id ?? null);
      setCicilanAmount("");
      setCicilanMethod("tunai");
      setCicilanNotes("");
      setCicilanOpen(true);
    } catch {
      toast({ title: "Gagal memuat data piutang", variant: "destructive" });
    }
  };

  const handleCicilanPay = async () => {
    if (!cicilanRecId) {
      toast({ title: "Data piutang tidak ditemukan. Invoice belum punya receivable.", variant: "destructive" }); return;
    }
    const amount = parseFloat(cicilanAmount) || 0;
    const remaining = cicilanSaleData?.remainingAmount || 0;
    if (amount <= 0) { toast({ title: "Jumlah harus lebih dari 0", variant: "destructive" }); return; }
    if (amount > remaining) { toast({ title: `Melebihi sisa piutang (${formatRupiah(remaining)})`, variant: "destructive" }); return; }
    setCicilanProcessing(true);
    try {
      const res = await fetch(`${API_BASE}/api/receivables/${cicilanRecId}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ amount, paymentMethod: cicilanMethod, notes: cicilanNotes || undefined }),
      });
      if (!res.ok) throw new Error(await res.text());
      queryClient.invalidateQueries({ queryKey: getListSalesQueryKey({}) });
      setCicilanOpen(false);
      toast({ title: "✅ Cicilan berhasil dicatat!", description: `Dibayar: ${formatRupiah(amount)}` });
    } catch {
      toast({ title: "Gagal mencatat cicilan", variant: "destructive" });
    } finally {
      setCicilanProcessing(false);
    }
  };

  const addItem = () => {
    setItems(prev => [...prev, { productId: 0, productName: "", unit: "kg", krats: "", kgs: "", pricePerUnit: "", subtotal: 0 }]);
  };

  const removeItem = (index: number) => setItems(prev => prev.filter((_, i) => i !== index));

  const updateItemFields = (index: number, fields: Partial<SaleItem>) => {
    setItems(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], ...fields };
      const item = updated[index];
      
      // Calculate derived state
      if (item.unit === "krat" && item.targetLength && !item.batchId) {
        item.kgs = (typeof item.krats === "number" ? item.krats : 0) * item.targetLength;
      }
      item.subtotal = Math.round((typeof item.kgs === "number" ? item.kgs : 0) * (typeof item.pricePerUnit === "number" ? item.pricePerUnit : 0));
      
      return updated;
    });
  };

  const updateItem = (index: number, field: keyof SaleItem, value: any) => {
    updateItemFields(index, { [field]: value });
    
    // Auto populate productName etc when productId changes
    if (field === "productId") {
      const prod = products?.find(p => p.id === parseInt(value));
      if (prod) {
        updateItemFields(index, {
          productName: prod.name,
          pricePerUnit: parseFloat(String(prod.pricePerKg)),
          primaryUnit: prod.primaryUnit || undefined,
          secondaryUnit: prod.secondaryUnit || undefined,
          categoryId: prod.categoryId
        });
      }
    }
  };

  const totalAmount = Math.round(items.reduce((sum, i) => sum + i.subtotal, 0));

  const handlePreview = () => {
    let customerName = "Umum";
    if (customerId) {
      const cust = customers?.find(c => c.id.toString() === customerId);
      if (cust) customerName = cust.name;
    }
    const paidAmount = (paymentType !== "kredit" && paymentType !== "tempo") ? totalAmount : (dpAmount ? parseFloat(dpAmount) : 0);
    
    setPreviewSaleId(undefined);
    setPreviewData({
      invoiceNumber,
      customerName,
      createdAt: new Date().toISOString(),
      totalAmount,
      paidAmount,
      remainingAmount: totalAmount - paidAmount,
      status: 'draft',
      items: items.map(i => {
        const prod = products?.find(p => p.id === i.productId);
        const cat = categories?.find(c => c.id === prod?.categoryId);
        return {
          productId: i.productId,
          batchId: i.batchId,
          categoryName: cat?.name,
          productName: i.productName,
          kgs: typeof i.kgs === "number" ? i.kgs : 0,
          krats: typeof i.krats === "number" ? i.krats : 0,
          pricePerKg: typeof i.pricePerUnit === "number" ? i.pricePerUnit : 0,
          subtotal: i.subtotal,
          primaryUnit: i.primaryUnit || prod?.primaryUnit,
          secondaryUnit: i.secondaryUnit || prod?.secondaryUnit,
        };
      })
    });
    setPreviewOpen(true);
  };

  const buildItemsPayload = () => items.flatMap(i => {
    if (i.selectedKrats && i.selectedKrats.length > 0) {
      return i.selectedKrats.map(r => {
        const kgsNum = typeof r.currentWeight === "string" ? parseFloat(r.currentWeight) : (r.currentWeight || 0);
        const priceNum = typeof i.pricePerUnit === "number" ? i.pricePerUnit : (typeof i.pricePerUnit === "string" ? parseFloat(i.pricePerUnit) || 0 : 0);
        return { productId: i.productId, batchId: r.id, krats: 1, kgs: kgsNum || 0, pricePerKg: priceNum, subtotal: (kgsNum || 0) * priceNum };
      });
    }
    const kgsNum = typeof i.kgs === "number" ? i.kgs : (typeof i.kgs === "string" ? parseFloat(i.kgs) : 0);
    const kratsNum = typeof i.krats === "number" ? i.krats : (typeof i.krats === "string" ? parseFloat(i.krats) : 0);
    const priceNum = typeof i.pricePerUnit === "number" ? i.pricePerUnit : (typeof i.pricePerUnit === "string" ? parseFloat(i.pricePerUnit) || 0 : 0);
    const fallbackSubtotal = (typeof i.subtotal === "number" ? i.subtotal : (kgsNum * priceNum));
    return [{ productId: i.productId, batchId: i.batchId || undefined, krats: kratsNum || 0, kgs: kgsNum || 0, pricePerKg: priceNum, subtotal: fallbackSubtotal }];
  });

  const handleSubmit = async (isDraft = false) => {
    if (items.length === 0) { toast({ title: "Tambahkan minimal 1 item", variant: "destructive" }); return; }
    if (items.some(i => !i.productId || (typeof i.kgs === "number" ? i.kgs : 0) <= 0)) { toast({ title: "Mohon lengkapi data barang", variant: "destructive" }); return; }

    const payload = {
      invoiceNumber: editingSaleId ? invoiceNumber : undefined,
      isDraft,
      customerId: (customerId && customerId !== "0") ? parseInt(customerId) : undefined,
      paymentType: paymentType as any,
      dueDate: dueDate || undefined,
      notes: notes || undefined,
      dpAmount: dpAmount ? parseFloat(dpAmount) : undefined,
      items: buildItemsPayload(),
    };

    if (editingSaleId) {
      // Edit mode: call PUT
      try {
        const res = await fetch(`${API_BASE}/api/sales/${editingSaleId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error(await res.text());
        queryClient.invalidateQueries({ queryKey: getListSalesQueryKey({}) });
        setIsOpen(false);
        resetForm();
        toast({ title: "Nota berhasil diperbarui" });
      } catch {
        toast({ title: "Gagal menyimpan perubahan", variant: "destructive" });
      }
    } else {
      createMutation.mutate({ data: payload });
    }
  };


  const baseFiltered = filterByDateRange(
    sales?.filter(s => {
      const q = search.toLowerCase();
      return s.invoiceNumber?.toLowerCase().includes(q) || (s as any).customerName?.toLowerCase().includes(q);
    }) ?? [],
    dateFrom,
    dateTo,
  );

  const filtered = useMemo(() => {
    if (activeTab === "Semua") return baseFiltered.filter(s => s.status !== 'cancelled');
    if (activeTab === "Draft") return baseFiltered.filter(s => s.status === 'draft');
    if (activeTab === "Kredit") return baseFiltered.filter(s => s.status?.toLowerCase() === "unpaid" || s.status === 'tempo');
    if (activeTab === "Dibatalkan") return baseFiltered.filter(s => s.status === 'cancelled');
    return baseFiltered.filter(s => s.status?.toLowerCase() === activeTab.toLowerCase());
  }, [baseFiltered, activeTab]);

  const summaryData = useMemo(() => {
    if (!filtered) return { subTotal: 0, diBayar: 0, sisaBayar: 0, kembalian: 0, totalRefund: 0 };
    // Exclude draft and cancelled from financial summary
    return filtered.filter(s => s.status !== 'draft' && s.status !== 'cancelled').reduce((acc, s: any) => {
      const baseTotal = parseFloat(s.totalAmount || "0");
      const diffTotal = s.returnDifference ? parseFloat(s.returnDifference) : 0;
      const grandTotal = baseTotal + diffTotal;
      
      const basePaid = parseFloat(s.paidAmount || "0");
      const diffPaid = (s as any).returnDifferencePaid ? parseFloat((s as any).returnDifferencePaid) : 0;
      const actualPaid = basePaid + diffPaid;
      
      const rem = grandTotal - actualPaid;
      
      acc.subTotal += grandTotal;
      acc.diBayar += actualPaid;
      
      if (rem > 0) {
        acc.sisaBayar += rem;
      } else if (rem < 0) {
        acc.kembalian += Math.abs(rem);
      }
      const refundAmt = s.returnDifference ? parseFloat(s.returnDifference) : 0;
      if (refundAmt < 0) {
        acc.totalRefund += Math.abs(refundAmt);
      }
      
      return acc;
    }, { subTotal: 0, diBayar: 0, sisaBayar: 0, kembalian: 0, totalRefund: 0 });
  }, [filtered]);

  return (
    <div className="flex flex-col h-full w-full relative">
      
      {/* ── Static Top Strip: judul + tab + filter + summary ── */}
      <div className="flex-none space-y-2 pb-2">
        {/* SINGLE ROW HEADER */}
        <div className="flex flex-col xl:flex-row xl:items-center gap-3 justify-between border-b border-slate-100 pb-2">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="shrink-0 mr-2">
              <h1 className="text-xl font-bold tracking-tight text-slate-900 leading-tight">Aktivitas</h1>
              <p className="text-[11px] text-slate-400">Riwayat penjualan</p>
            </div>
            
            <div className="flex h-9 w-fit justify-start rounded-xl bg-slate-100 p-1 gap-1 overflow-x-auto hide-scrollbar">
              {["Semua", "Lunas", "Kredit", "Partial", "Draft", "Dibatalkan"].map(tab => {
                const isActive = activeTab === tab;
                let activeColor = "text-violet-700";
                if (tab === "Draft") activeColor = "text-slate-700";
                if (tab === "Dibatalkan") activeColor = "text-red-700";
                
                return (
                  <button 
                    key={tab}
                    onClick={() => { setActiveTab(tab); setCurrentPage(1); }}
                    className={`flex items-center rounded-lg px-3 text-xs font-semibold h-7 whitespace-nowrap transition-all ${
                      isActive ? `bg-white shadow-sm ${activeColor}` : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {tab}
                  </button>
                )
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
            <DateRangeFilter onFilter={(from, to) => { setDateFrom(from); setDateTo(to); }} />
            <Button
              variant="outline"
              className="h-8 rounded-lg text-xs font-semibold px-3 border-emerald-200 text-emerald-700 hover:bg-emerald-50"
              disabled={isExporting}
              onClick={async () => {
                setIsExporting(true);
                try {
                  const params = new URLSearchParams();
                  if (dateFrom) params.set("startDate", dateFrom);
                  if (dateTo) params.set("endDate", dateTo);
                  const url = `/api/sales/export${params.toString() ? '?' + params.toString() : ''}`;
                  const res = await fetch(url, { credentials: "include" });
                  if (!res.ok) throw new Error("Export gagal");
                  const blob = await res.blob();
                  const a = document.createElement("a");
                  a.href = URL.createObjectURL(blob);
                  const cd = res.headers.get("Content-Disposition") || "";
                  const match = cd.match(/filename="?([^"]+)"?/);
                  a.download = match ? match[1] : "Penjualan.xlsx";
                  a.click();
                  URL.revokeObjectURL(a.href);
                } catch {
                  alert("Gagal mengexport data penjualan");
                } finally {
                  setIsExporting(false);
                }
              }}
            >
              {isExporting
                ? <span className="h-3.5 w-3.5 mr-1.5 rounded-full border-2 border-emerald-600 border-t-transparent animate-spin inline-block" />
                : <Download className="mr-1.5 h-3.5 w-3.5" />}
              Export Excel
            </Button>
            <Button
              variant="outline"
              className="h-8 rounded-lg text-xs font-semibold px-3 border-blue-200 text-blue-700 hover:bg-blue-50"
              onClick={() => { setImportResult(null); setImportFile(null); setImportOpen(true); }}
            >
              <Upload className="mr-1.5 h-3.5 w-3.5" /> Import Excel
            </Button>
            <Button onClick={() => { resetForm(); setIsOpen(true); }} className="h-8 rounded-lg shadow-sm bg-violet-600 hover:bg-violet-700 text-xs font-semibold px-3">
              <Plus className="mr-1.5 h-3.5 w-3.5" /> Buat Nota
            </Button>
          </div>
        </div>

      {/* Rekap Summary (Ultra Compact Strip) */}
      {filtered && filtered.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-2 pb-2">
          <div className="bg-white border border-slate-100 rounded-lg px-3 py-1.5 flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-slate-50 flex items-center justify-center text-slate-600 shrink-0">
              <ReceiptIcon className="w-3 h-3" />
            </div>
            <div className="flex flex-col justify-center">
              <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider">Transaksi</span>
              <span className="text-xs font-black text-slate-900 leading-tight">{filtered.length} nota</span>
            </div>
          </div>
          <div className="bg-violet-50 border border-violet-100 rounded-lg px-3 py-1.5 flex flex-col justify-center">
            <span className="text-[9px] font-semibold text-violet-400 uppercase tracking-wider">Sub Total</span>
            <span className="text-xs font-black text-violet-900 leading-tight">{formatRupiah(summaryData.subTotal)}</span>
          </div>
          <div className="bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-1.5 flex flex-col justify-center">
            <span className="text-[9px] font-semibold text-emerald-500 uppercase tracking-wider">Di Bayar</span>
            <span className="text-xs font-black text-emerald-900 leading-tight">{formatRupiah(summaryData.diBayar)}</span>
          </div>
          <div className="bg-rose-50 border border-rose-100 rounded-lg px-3 py-1.5 flex flex-col justify-center">
            <span className="text-[9px] font-semibold text-rose-400 uppercase tracking-wider">Sisa Bayar</span>
            <span className="text-xs font-black text-rose-700 leading-tight">{formatRupiah(summaryData.sisaBayar)}</span>
          </div>
          {summaryData.totalRefund > 0 ? (
            <div className="bg-amber-50 border border-amber-100 rounded-lg px-3 py-1.5 flex flex-col justify-center">
              <span className="text-[9px] font-semibold text-amber-500 uppercase tracking-wider">Total Refund</span>
              <span className="text-xs font-black text-amber-700 leading-tight">{formatRupiah(summaryData.totalRefund)}</span>
            </div>
          ) : (
            <div className="bg-slate-50 border border-slate-100 rounded-lg px-3 py-1.5 flex flex-col justify-center">
              <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider">Status</span>
              <span className="text-[10px] font-semibold text-slate-500 leading-tight mt-0.5">Semua data termuat</span>
            </div>
          )}
          {summaryData.kembalian > 0 && (
            <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-1.5 flex flex-col justify-center">
              <span className="text-[9px] font-semibold text-blue-500 uppercase tracking-wider">Lebih Bayar</span>
              <span className="text-xs font-black text-blue-700 leading-tight">{formatRupiah(summaryData.kembalian)}</span>
            </div>
          )}
        </div>
      )}
      </div> {/* end static top strip */}

      {/* ── scrollable Table Container ── */}
      <div className="flex-1 overflow-auto min-h-0">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden min-w-0">
        {isLoading ? (
          <div className="p-6 space-y-3">
            {Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-10 w-full rounded-lg" />)}
          </div>
        ) : filtered?.length === 0 ? (
          <div className="text-center py-16">
            <ReceiptIcon className="mx-auto mb-4 h-12 w-12 text-slate-300" strokeWidth={1.5} />
            <h3 className="text-lg font-bold text-slate-700">Belum ada aktivitas</h3>
            <p className="text-sm text-slate-500 mt-1">Transaksi penjualan Anda akan muncul di sini.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left py-2.5 px-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap w-8">#</th>
                  <th className="text-left py-2.5 px-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Tanggal</th>
                  <th className="text-left py-2.5 px-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Invoice</th>
                  <th className="text-left py-2.5 px-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Pelanggan</th>
                  <th className="text-left py-2.5 px-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Status</th>
                  <th className="text-right py-2.5 px-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Total</th>
                  <th className="text-right py-2.5 px-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">DP / Terbayar</th>
                  <th className="text-right py-2.5 px-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Sisa</th>
                  <th className="text-center py-2.5 px-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered?.slice((currentPage - 1) * 20, currentPage * 20).map((s, idx) => {
                  const isLunas = s.status === 'lunas';
                  const isPartial = s.status === 'partial';
                  const isHeld = s.status === 'held' || s.status === 'draft';
                  const isCancelled = s.status === 'cancelled';
                  const customerName = (s as any).customerName || "Umum";
                  const total = Math.round(parseFloat(String(s.totalAmount || 0)));
                  const paid = Math.round(parseFloat(String(s.paidAmount || 0)));
                  const sisa = Math.round(total - paid);
                  const hasDP = paid > 0 && !isLunas;
                  const hasRetur = (s as any).hasReturns;

                  // Status badge config
                  let badgeCls = "bg-slate-100 text-slate-600";
                  let badgeLabel = s.status || "-";
                  if (isLunas) { badgeCls = "bg-green-100 text-green-700"; badgeLabel = "Lunas"; }
                  else if (isPartial) { badgeCls = "bg-blue-100 text-blue-700"; badgeLabel = "Partial"; }
                  else if (s.status === 'held') { badgeCls = "bg-amber-100 text-amber-700"; badgeLabel = "Hold"; }
                  else if (s.status === 'draft') { badgeCls = "bg-slate-100 text-slate-600"; badgeLabel = "Draft"; }
                  else if (s.status === 'kredit') { badgeCls = "bg-orange-100 text-orange-700"; badgeLabel = "Kredit"; }
                  else if (isCancelled) { badgeCls = "bg-red-100 text-red-600"; badgeLabel = "Batal"; }

                  return (
                    <React.Fragment key={s.id}>
                      <tr
                        className={`hover:bg-slate-50/80 transition-colors ${isCancelled ? 'opacity-50' : ''}`}
                      >
                        {/* No */}
                        <td className="py-2.5 px-3 text-xs text-slate-400 font-mono whitespace-nowrap">
                          {(currentPage - 1) * 20 + idx + 1}
                        </td>
                        {/* Tanggal */}
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span className="text-xs font-medium text-slate-600">{formatDate(s.createdAt)}</span>
                        </td>
                        {/* Invoice */}
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <div className="flex flex-col gap-0.5">
                            <span className="text-[11px] font-mono text-slate-700 leading-tight">{s.invoiceNumber}</span>
                            <span className="text-[10px] text-slate-400 capitalize">{s.paymentType}</span>
                          </div>
                        </td>
                        {/* Pelanggan */}
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span className="text-sm font-semibold text-slate-800">{customerName}</span>
                          {hasRetur && (
                            <span className="ml-1.5 text-[9px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full uppercase">Retur</span>
                          )}
                        </td>
                        {/* Status */}
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${badgeCls}`}>
                            {badgeLabel}
                          </span>
                        </td>
                        {/* Total */}
                        <td className="py-2.5 px-3 text-right whitespace-nowrap">
                          <span className="text-sm font-bold text-slate-800">{formatRupiah(total)}</span>
                        </td>
                        {/* DP / Terbayar */}
                        <td className="py-2.5 px-3 text-right whitespace-nowrap">
                          {paid > 0 ? (
                            <span className="text-sm font-semibold text-emerald-600">{formatRupiah(paid)}</span>
                          ) : (
                            <span className="text-xs text-slate-300">—</span>
                          )}
                        </td>
                        {/* Sisa */}
                        <td className="py-2.5 px-3 text-right whitespace-nowrap">
                          {sisa > 0 ? (
                            <span className="text-sm font-bold text-rose-600">{formatRupiah(sisa)}</span>
                          ) : (
                            <span className="text-xs text-slate-300">—</span>
                          )}
                        </td>
                        {/* Aksi */}
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <div className="flex items-center gap-1 justify-center">
                            {isCancelled ? (
                              <span className="text-[10px] text-red-400 font-semibold px-2 py-1 bg-red-50 rounded-full">Dibatalkan</span>
                            ) : (
                              <>
                                {/* Cetak */}
                                {!isHeld && (
                                  <button
                                    title="Cetak"
                                    className="w-7 h-7 rounded-lg bg-green-50 hover:bg-green-100 text-green-700 flex items-center justify-center transition-colors"
                                    onClick={() => { setPreviewData(null); setPreviewSaleId(s.id); setPreviewOpen(true); }}
                                  >
                                    <Printer className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                {/* Bayar (draft) */}
                                {s.status === 'draft' && (
                                  <button
                                    title="Bayar"
                                    className="w-7 h-7 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 flex items-center justify-center transition-colors"
                                    onClick={() => { setPayPaymentType("tunai"); setPayDialogSaleId(s.id); }}
                                  >
                                    <CreditCard className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                {/* Bayar Cicilan (partial / held) */}
                                {(isPartial || s.status === 'held') && sisa > 0 && (
                                  <button
                                    title="Bayar Cicilan"
                                    className="w-7 h-7 rounded-lg bg-violet-50 hover:bg-violet-100 text-violet-700 flex items-center justify-center transition-colors"
                                    onClick={() => handleOpenCicilan(s.id)}
                                  >
                                    <DollarSign className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                {/* Edit */}
                                <button
                                  title="Edit"
                                  className="w-7 h-7 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-600 flex items-center justify-center transition-colors"
                                  onClick={() => handleEditClick(s.id)}
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                {/* Hapus */}
                                <button
                                  title="Hapus"
                                  className={`w-7 h-7 rounded-lg bg-red-50 hover:bg-red-100 text-red-500 flex items-center justify-center transition-colors ${cancelProcessing === s.id ? 'opacity-50 pointer-events-none' : ''}`}
                                  onClick={() => handleCancelClick(s.id)}
                                >
                                  <Ban className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                      {/* Sub-row: DP / Retur info */}
                      {(hasDP || hasRetur) && (
                        <tr key={`${s.id}-sub`} className="bg-slate-50/60 border-t-0">
                          <td colSpan={2}></td>
                          <td colSpan={7} className="py-1 px-3 pb-2">
                            <div className="flex flex-wrap gap-x-4 gap-y-0.5">
                              {hasDP && (
                                <span className="text-[10px] text-slate-500">
                                  <span className="font-semibold text-indigo-600">DP/Cicilan:</span>{" "}
                                  {formatRupiah(paid)} dibayar · Sisa <span className="font-bold text-rose-600">{formatRupiah(sisa)}</span>
                                </span>
                              )}
                              {hasRetur && (s as any).totalReturnedValue > 0 && (
                                <span className="text-[10px] text-slate-500">
                                  <span className="font-semibold text-amber-600">Retur:</span>{" "}
                                  -{formatRupiah((s as any).totalReturnedValue || 0)}
                                  {(s as any).totalExchangedValue > 0 && ` · Tukar: +${formatRupiah((s as any).totalExchangedValue)}`}
                                </span>
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
        )}
      </div>
      </div> {/* end scrollable table container */}

      {/* ── Pagination Bar (Floating Bubble) ── */}
      {filtered && filtered.length > 20 && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
          <div className="bg-white/90 backdrop-blur-md shadow-[0_4px_20px_rgba(0,0,0,0.12)] border border-slate-200/60 rounded-full px-3 py-0.5 flex items-center justify-center gap-3 pointer-events-auto">
            <span className="text-[10px] font-medium text-slate-400 hidden sm:inline">
              {filtered.length} transaksi
            </span>
            <PaginationControl currentPage={currentPage} totalPages={Math.ceil(filtered.length / 20)} onPageChange={setCurrentPage} />
          </div>
        </div>
      )}

      {/* Pay Dialog */}
      {payDialogSaleId !== null && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40" onClick={() => setPayDialogSaleId(null)}>
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm mx-4 shadow-2xl" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-slate-900 mb-1">Proses Pembayaran</h2>
            <p className="text-sm text-slate-500 mb-4">Pilih metode pembayaran untuk nota ini</p>
            <Select value={payPaymentType} onValueChange={setPayPaymentType}>
              <SelectTrigger className="mb-4"><SelectValue /></SelectTrigger>
              <SelectContent>
                {paymentMethods.filter(m => m.isActive).length > 0
                  ? paymentMethods.filter(m => m.isActive).map(m => <SelectItem key={m.code} value={m.code}>{m.name}</SelectItem>)
                  : <><SelectItem value="tunai">Tunai</SelectItem><SelectItem value="transfer">Transfer</SelectItem><SelectItem value="kredit">Kredit</SelectItem></>
                }
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              <Button variant="ghost" className="flex-1" onClick={() => setPayDialogSaleId(null)}>Batal</Button>
              <Button className="flex-1 bg-blue-600 hover:bg-blue-700" disabled={payProcessing} onClick={() => handlePay(payDialogSaleId!)}>
                {payProcessing ? "Memproses..." : "✅ Konfirmasi Bayar"}
              </Button>
            </div>
          </div>
        </div>
      )}

      <Drawer open={isOpen} onOpenChange={(open) => { if (!open) { setIsOpen(false); resetForm(); } }}>
        <DrawerContent className="mx-auto w-full max-w-[95vw] xl:max-w-7xl px-4 sm:px-6 pb-[max(1.5rem,env(safe-area-inset-bottom,0px))] pt-2 flex flex-col" style={{ maxHeight: "calc(95dvh - env(safe-area-inset-top, 0px))" }}>
          <DrawerTitle className="sr-only">{editingSaleId ? `Edit Nota — ${invoiceNumber}` : "Buat Penjualan Baru"}</DrawerTitle>
          <DrawerDescription className="sr-only">Form for adding or editing a sale</DrawerDescription>

          <DrawerHeader className="pb-3 px-0 shrink-0">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-violet-100 flex items-center justify-center shrink-0">
                  <ShoppingCart className="w-5 h-5 text-violet-600" strokeWidth={1.5} />
                </div>
                <div>
                  <h2 className="text-[15px] font-bold text-slate-800 leading-tight">
                    {editingSaleId ? `Edit Nota — ${invoiceNumber}` : "Buat Penjualan Baru"}
                  </h2>
                  <p className="text-xs text-slate-400">
                    {editingSaleId ? "Perbarui data transaksi penjualan" : "Catat transaksi penjualan baru"}
                  </p>
                </div>
              </div>
              {/* Invoice number badge */}
              <div className="hidden sm:block text-right shrink-0">
                {editingSaleId ? (
                  <span className="font-mono text-xs font-bold text-violet-700 bg-violet-100 px-2.5 py-1 rounded-lg">{invoiceNumber}</span>
                ) : (
                  <span className="text-[10px] text-slate-400 italic">No. invoice ditetapkan saat bayar</span>
                )}
              </div>
            </div>
          </DrawerHeader>

          <div id="drawer-portal-target" />

          {/* ── scrollable Body ── */}
          <div className="overflow-y-auto flex-1 divide-y divide-slate-100">

            {/* Section: Info Transaksi */}
            <div className="px-6 py-4 space-y-3">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-5 rounded-full bg-violet-500 inline-block"></span>
                <h3 className="text-xs font-bold tracking-widest uppercase text-slate-500">Info Transaksi</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-600">Pelanggan</label>
                  <Combobox
                    items={[
                      { value: "0", label: "Pelanggan Umum" },
                      ...(customers?.map((c: any) => ({ value: c.id.toString(), label: c.name })) || [])
                    ]}
                    value={customerId}
                    onValueChange={setCustomerId}
                    placeholder="Pilih pelanggan (opsional)"
                    searchPlaceholder="Cari pelanggan..."
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-600">Metode Pembayaran</label>
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
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-600">Jatuh Tempo</label>
                    <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
                      className="h-10 bg-white border-slate-200 rounded-xl focus-visible:ring-violet-500" />
                  </div>
                )}
                <div className={`space-y-1.5 ${paymentType === "kredit" ? "" : "md:col-span-2"}`}>
                  <label className="text-xs font-semibold text-slate-600">Catatan</label>
                  <Input placeholder="Catatan opsional" value={notes} onChange={e => setNotes(e.target.value)}
                    className="h-10 bg-white border-slate-200 rounded-xl focus-visible:ring-violet-500" />
                </div>
              </div>
            </div>

            {/* Section: Item Barang */}
            <div className="px-6 py-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-5 rounded-full bg-emerald-500 inline-block"></span>
                  <h3 className="text-xs font-bold tracking-widest uppercase text-slate-500">Item Barang</h3>
                  {items.length > 0 && (
                    <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">{items.length} item</span>
                  )}
                </div>
                <Button type="button" size="sm" onClick={addItem}
                  className="h-8 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white text-xs font-bold px-3 shadow-sm">
                  <PlusCircle className="mr-1.5 h-3.5 w-3.5" /> Tambah Item
                </Button>
              </div>

              {items.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/60">
                  <ShoppingCart className="w-8 h-8 text-slate-300 mb-2" strokeWidth={1.5} />
                  <p className="text-sm text-slate-400 font-medium">Belum ada item</p>
                  <p className="text-xs text-slate-300 mt-0.5">Klik "Tambah Item" untuk memulai</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {items.map((item, index) => (
                    <SaleItemRow
                      key={`item-${index}`}
                      item={item}
                      index={index}
                      products={products}
                      categories={categories}
                      updateItem={updateItem}
                      updateItemFields={updateItemFields}
                      removeItem={removeItem}
                      allItems={items}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Section: Summary Total */}
            {items.length > 0 && (
              <div className="px-6 py-4">
                <div className="bg-gradient-to-r from-slate-50 to-indigo-50/40 border border-slate-200 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-600">Total</span>
                    <span className="text-2xl font-black text-slate-900 tabular-nums">{formatRupiah(totalAmount)}</span>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                    <span className="text-xs font-semibold text-indigo-600">DP / Uang Muka <span className="font-normal text-slate-400">(Opsional)</span></span>
                    <input
                      type="number"
                      value={dpAmount}
                      onChange={e => setDpAmount(e.target.value)}
                      placeholder="0"
                      className="w-40 text-right font-bold h-9 border border-indigo-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 px-3 text-indigo-700 placeholder:text-indigo-200 bg-white text-sm"
                    />
                  </div>
                  {dpAmount && parseFloat(dpAmount) > 0 && (
                    <div className="flex items-center justify-between bg-rose-50 border border-rose-100 rounded-xl px-3 py-2">
                      <span className="text-xs font-bold text-rose-600">Sisa Pembayaran</span>
                      <span className="font-black text-rose-600 text-lg tabular-nums">
                        {formatRupiah(totalAmount - parseFloat(dpAmount))}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ── Sticky Footer ── */}
          <div className="shrink-0 bg-white border-t border-slate-100 px-6 py-3 flex items-center gap-2">
            <Button type="button" variant="outline" size="icon"
              className="h-11 w-11 rounded-xl border-slate-200 text-slate-500 hover:bg-slate-50 shrink-0"
              onClick={handlePreview} title="Preview & Cetak Nota">
              <Printer className="h-4 w-4" />
            </Button>
            <Button type="button" variant="ghost"
              className="h-11 rounded-xl flex-1 border border-slate-200 text-slate-600 hover:bg-slate-50"
              onClick={() => { setIsOpen(false); resetForm(); }}>
              Batal
            </Button>
            {editingSaleId ? (
              <Button
                className="h-11 rounded-xl flex-[2] bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white font-bold shadow-sm"
                onClick={() => handleSubmit(false)}
                disabled={createMutation.isPending || items.length === 0}>
                ✓ Simpan Perubahan
              </Button>
            ) : (
              <Button
                className="h-11 rounded-xl flex-[2] bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-bold shadow-sm"
                onClick={() => handleSubmit(false)}
                disabled={createMutation.isPending || items.length === 0}>
                💳 Simpan & Bayar
              </Button>
            )}
          </div>

        </DrawerContent>
      </Drawer>
       
      {/* ── Drawer: Bayar Cicilan dari Penjualan ── */}
      <Drawer open={cicilanOpen} onOpenChange={(open) => { if (!open) setCicilanOpen(false); }}>
        <DrawerContent className="mx-auto w-full max-w-2xl px-4 sm:px-6 pb-[max(1.5rem,env(safe-area-inset-bottom,0px))] pt-2 flex flex-col" style={{ maxHeight: "calc(95dvh - env(safe-area-inset-top, 0px))" }}>
          <DrawerHeader>
            <DrawerTitle className="flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-violet-600" /> Bayar Cicilan Piutang
            </DrawerTitle>
          </DrawerHeader>
          <div className="overflow-y-auto flex-1 space-y-4 px-1">
            {cicilanSaleData && (
              <>
                <div className="p-3 bg-slate-50 rounded-xl text-sm space-y-2 border border-slate-100">
                  <div className="flex justify-between"><span className="text-slate-500">Pelanggan:</span><span className="font-semibold">{cicilanSaleData.customerName || "-"}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Invoice:</span><span className="font-mono text-[11px] bg-slate-100 px-2 py-0.5 rounded">{cicilanSaleData.invoiceNumber}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Grand Total:</span><span className="font-semibold">{formatRupiah(cicilanSaleData.totalAmount)}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Sudah Dibayar:</span><span className="font-semibold text-emerald-600">{formatRupiah(cicilanSaleData.paidAmount)}</span></div>
                  <div className="flex justify-between border-t border-slate-200 pt-2">
                    <span className="font-bold text-slate-700">Sisa Piutang:</span>
                    <span className="font-bold text-violet-700 cursor-pointer hover:underline" onClick={() => setCicilanAmount(String(cicilanSaleData.remainingAmount))} title="Klik untuk bayar lunas">
                      {formatRupiah(cicilanSaleData.remainingAmount)}
                    </span>
                  </div>
                </div>

                {!cicilanRecId && (
                  <div className="p-3 bg-amber-50 rounded-xl text-sm text-amber-700 border border-amber-200">
                    ⚠️ Invoice ini belum memiliki data piutang. Pastikan telah tersimpan dengan DP terlebih dahulu.
                  </div>
                )}

                {cicilanSaleData.paymentHistory && cicilanSaleData.paymentHistory.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Cicilan Sebelumnya</p>
                    {cicilanSaleData.paymentHistory.map((p: any) => (
                      <div key={p.id} className="flex items-center justify-between bg-slate-50 rounded-xl px-3 py-2 border border-slate-100">
                        <div>
                          <span className="text-[11px] font-semibold text-slate-600 capitalize">{p.paymentMethod}</span>
                          <span className="text-[10px] text-slate-400 ml-1.5">
                            {new Date(p.paidAt).toLocaleDateString('id-ID', {day:'2-digit',month:'short'})} {new Date(p.paidAt).toLocaleTimeString('id-ID', {hour:'2-digit',minute:'2-digit'})}
                          </span>
                        </div>
                        <span className="font-bold text-emerald-700 text-sm">{formatRupiah(p.amount)}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div>
                  <label className="text-sm font-medium mb-1 block">Jumlah Bayar Cicilan (Rp)</label>
                  <Input type="number" min={0} placeholder="0" value={cicilanAmount} onChange={e => setCicilanAmount(e.target.value)} />
                  {cicilanAmount && (
                    <span className="text-xs font-semibold text-violet-600 block bg-violet-50 px-2 py-1 rounded-md border border-violet-100 mt-1.5">
                      Preview: {formatRupiah(parseFloat(cicilanAmount) || 0)}
                    </span>
                  )}
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Metode Pembayaran</label>
                  <Select value={cicilanMethod} onValueChange={setCicilanMethod}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="tunai">Tunai</SelectItem>
                      <SelectItem value="transfer">Transfer</SelectItem>
                      <SelectItem value="cashless">Cashless/QRIS</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Catatan</label>
                  <Input placeholder="Catatan opsional" value={cicilanNotes} onChange={e => setCicilanNotes(e.target.value)} />
                </div>
              </>
            )}
          </div>
          <DrawerFooter className="px-0 pt-4 flex-row gap-2">
            <Button type="button" variant="ghost" className="flex-1 bg-slate-100 text-slate-600 hover:bg-slate-200" onClick={() => setCicilanOpen(false)}>Batal</Button>
            <Button className="flex-1 bg-violet-600 hover:bg-violet-700" onClick={handleCicilanPay} disabled={!cicilanAmount || !cicilanRecId || cicilanProcessing}>
              {cicilanProcessing ? "Menyimpan..." : "Simpan Cicilan"}
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      <InvoicePreviewModal 
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        data={previewData}
        saleId={previewSaleId}
      />
      <OtpDialog
        open={otpDialogOpen}
        onOpenChange={setOtpDialogOpen}
        onSuccess={(token) => {
          setOtpDialogOpen(false);
          if (otpAction === "edit" && otpTargetId) {
            openEditMode(otpTargetId);
          } else if (otpAction === "cancel" && otpTargetId) {
            handleCancel(otpTargetId);
          }
        }}
      />

      {/* ─── Import Excel Modal ─────────────────────────────────────── */}
      <Dialog open={importOpen} onOpenChange={(o) => { if (!isImporting) { setImportOpen(o); if (!o) { setImportFile(null); setImportResult(null); } } }}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-blue-600" />
              Import Penjualan dari Excel
            </DialogTitle>
          </DialogHeader>

          {!importResult ? (
            <div className="space-y-4">
              {/* Info format */}
              <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-blue-800 space-y-1">
                <p className="font-semibold">📋 Format Excel yang dibutuhkan:</p>
                <p>Gunakan file hasil <strong>Export Excel</strong> sebagai template, atau buat file dengan kolom:</p>
                <ul className="list-disc ml-4 space-y-0.5 mt-1">
                  <li><strong>No Invoice</strong> — kunci pengelompokan (wajib)</li>
                  <li><strong>Tanggal</strong> — format dd/mm/yyyy</li>
                  <li><strong>Pelanggan</strong> — nama pelanggan (atau kosong untuk Umum)</li>
                  <li><strong>Produk / Barang</strong> — nama barang sesuai di sistem (wajib)</li>
                  <li><strong>Krat</strong>, <strong>Kg/Yard</strong>, <strong>Harga / Kg</strong>, <strong>Subtotal</strong></li>
                  <li><strong>Metode Bayar</strong> — tunai / kredit / transfer</li>
                </ul>
                <p className="text-blue-600 mt-1">⚠️ Invoice yang sudah ada di sistem akan dilewati otomatis.</p>
              </div>

              {/* Upload area */}
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
                  ref={importFileRef}
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) setImportFile(f);
                    e.target.value = "";
                  }}
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
                      const res = await fetch("/api/sales/import", {
                        method: "POST",
                        body: form,
                        credentials: "include",
                      });
                      const data = await res.json();
                      if (!res.ok) throw new Error(data.error || "Import gagal");
                      setImportResult(data);
                      queryClient.invalidateQueries({ queryKey: getListSalesQueryKey({}) });
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
            /* Hasil import */
            <div className="space-y-4">
              {/* Ringkasan */}
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

              {/* Detail per invoice */}
              <div className="max-h-60 overflow-y-auto border border-slate-100 rounded-lg divide-y divide-slate-100">
                {importResult.details?.map((d: any, i: number) => (
                  <div key={i} className="flex items-start gap-2 px-3 py-2 text-xs">
                    <span className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${
                      d.status === "ok" ? "bg-emerald-500" : d.status === "skip" ? "bg-amber-400" : "bg-rose-500"
                    }`} />
                    <div className="min-w-0">
                      <p className="font-mono font-semibold text-slate-700 truncate">{d.invoice}</p>
                      <p className={`${d.status === "error" ? "text-rose-600" : "text-slate-500"}`}>{d.message}</p>
                    </div>
                  </div>
                ))}
              </div>

              <Button className="w-full" onClick={() => { setImportOpen(false); setImportFile(null); setImportResult(null); }}>
                Tutup
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>

  );
}












