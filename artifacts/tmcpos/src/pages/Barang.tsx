import { useState } from "react";
import { PageHeader } from "../components/PageHeader";
import { PaginationControl } from "../components/PaginationControl";
import { useListProducts, useListCategories, useListUnits, useCreateProduct, useUpdateProduct, useDeleteProduct, getListProductsQueryKey, getListCategoriesQueryKey, getListUnitsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter, DrawerDescription } from "@/components/ui/drawer";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Combobox } from "@/components/ui/combobox";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Pencil, Trash2, Search, Package, PlusCircle, LayoutGrid, Download, SlidersHorizontal, MoreVertical, AlertCircle, CheckCircle2, AlertTriangle, X, Ruler } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useForm } from "react-hook-form";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { formatRupiah, formatNumber } from "@/lib/utils";
import { ProductBatchesModal } from "@/components/ProductBatchesModal";

const API_BASE = window.location.origin;

const schema = z.object({
  name: z.string().min(1, "Nama wajib diisi"),
  categoryId: z.number({ required_error: "Kategori wajib dipilih" }),
  barcode: z.string().optional(),
  primaryUnit: z.string().optional(),
  secondaryUnit: z.string().optional(),
  lotNumber: z.string().optional(),
  rackLocation: z.string().optional(),
  costPricePerKg: z.number().min(0, "Harga beli tidak boleh negatif"),
  costPricePerKrat: z.number().optional(),
  pricePerKg: z.number().min(0, "Harga jual tidak boleh negatif"),
  pricePerKrat: z.number().optional(),
  kratStock: z.number().min(0).optional(),
  kgStock: z.number().min(0).optional(),
  minStock: z.number().min(0),
  batchWeights: z.array(z.any()).optional(),
});

type FormData = z.infer<typeof schema>;

export default function Barang() {
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [showLowStock, setShowLowStock] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [viewKratsId, setViewKratsId] = useState<number | null>(null);
  const [viewKratsName, setViewKratsName] = useState<string>("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  const handleImageUpload = async (file: File) => {
    setUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append("image", file);
      const res = await fetch("/api/upload/product-image", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setImageUrl(data.url);
      }
    } catch (err) {
      console.error("Upload failed", err);
    } finally {
      setUploadingImage(false);
    }
  };

  const { data: products, isLoading } = useListProducts({}, { query: { queryKey: getListProductsQueryKey({}) } });
  const { data: categories } = useListCategories({ query: { queryKey: getListCategoriesQueryKey() } });
  const { data: units } = useListUnits({ query: { queryKey: getListUnitsQueryKey() } });
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", barcode: "", primaryUnit: "KG", secondaryUnit: "KRAT", lotNumber: "", rackLocation: "", costPricePerKg: 0, pricePerKg: 0, minStock: 0, kratStock: 0, kgStock: 0 },
  });

  const createMutation = useCreateProduct({
    mutation: {
      onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListProductsQueryKey({}) }); setIsOpen(false); toast({ title: "Barang berhasil ditambahkan" }); }
    }
  });

  const updateMutation = useUpdateProduct({
    mutation: {
      onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListProductsQueryKey({}) }); setIsOpen(false); setEditingId(null); toast({ title: "Barang berhasil diperbarui" }); }
    }
  });

  const deleteMutation = useDeleteProduct({
    mutation: {
      onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListProductsQueryKey({}) }); toast({ title: "Barang berhasil dihapus" }); },
      onError: (error: any) => { toast({ title: "Gagal menghapus", description: error.data?.error || "Terjadi kesalahan", variant: "destructive" }); }
    }
  });

  const onSubmit = async (data: FormData) => {
    try {
      const parsedKratLengths = data.batchWeights?.map(r => {
        if (typeof r === 'string') {
          return parseFloat(r.replace(',', '.')) || 0;
        }
        return r || 0;
      });
      const payload = { ...data, imageUrl: imageUrl ?? undefined, batchWeights: parsedKratLengths };
      if (editingId) {
        await updateMutation.mutateAsync({ id: editingId, data: payload });
      } else {
        await createMutation.mutateAsync({ data: payload });
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleExport = () => {
    window.location.href = `${API_BASE}/api/products/export`;
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    try {
      toast({ title: "Mengimpor data...", description: "Mohon tunggu sebentar." });
      const res = await fetch(`${API_BASE}/api/products/import`, {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        if (data.error) {
          toast({ title: "Gagal import", description: data.error, variant: "destructive" });
        } else {
          toast({ title: "Import selesai", description: `${data.success} berhasil, ${data.failed} gagal.` });
          queryClient.invalidateQueries({ queryKey: getListProductsQueryKey({}) });
        }
      } else {
        const errorData = await res.json().catch(() => ({}));
        toast({ title: "Gagal import", description: errorData.error || "Terjadi kesalahan pada server", variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Gagal import", description: err.message, variant: "destructive" });
    } finally {
      if (e.target) e.target.value = '';
    }
  };

  const openCreate = () => {
    form.reset({ name: "", barcode: "", primaryUnit: "KG", secondaryUnit: "KRAT", lotNumber: "", rackLocation: "", costPricePerKg: 0, pricePerKg: 0, minStock: 0, kratStock: 0, kgStock: 0, batchWeights: [] });
    setEditingId(null);
    setImageUrl(null);
    setIsOpen(true);
  };

  const openEdit = (p: any) => {
    form.reset({
      name: p.name,
      categoryId: p.categoryId,
      barcode: p.barcode || "",
      primaryUnit: p.primaryUnit || "KG",
      secondaryUnit: p.secondaryUnit || "KRAT",
      lotNumber: p.lotNumber || "",
      rackLocation: p.rackLocation || "",
      costPricePerKg: Number(p.costPricePerKg ?? 0),
      costPricePerKrat: p.costPricePerKrat != null ? Number(p.costPricePerKrat) : undefined,
      pricePerKg: Number(p.pricePerKg ?? 0),
      pricePerKrat: p.pricePerKrat != null ? Number(p.pricePerKrat) : undefined,
      kratStock: Number(p.kratStock ?? 0),
      kgStock: Number(p.kgStock ?? 0),
      minStock: Number(p.minStock ?? 0),
    });
    setEditingId(p.id);
    setImageUrl(p.imageUrl || null);
    setIsOpen(true);
  };

  const openViewKrats = (p: any) => {
    setViewKratsId(p.id);
    setViewKratsName(p.name);
  };

  const baseProducts = products?.filter(p => selectedCategoryId === null ? true : p.categoryId === selectedCategoryId) || [];
  
  const filtered = baseProducts.filter(p => {
    // If global and no filters applied, we return empty so the "Pilih Kategori" placeholder shows
    if (selectedCategoryId === null && !showLowStock && !search) return false;
    
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) || (p.lotNumber && p.lotNumber.toLowerCase().includes(search.toLowerCase()));
    const matchesLowStock = !showLowStock || p.isLowStock;
    return matchesSearch && matchesLowStock;
  });

  // Calculate summary based on current category (or global if null)
  const summaryProducts = (selectedCategoryId === null && !showLowStock && !search) ? baseProducts : filtered;
  const lowStockCount = baseProducts.filter(p => p.isLowStock).length;

  return (
    <div className="w-full">

      {/* ── TOP STRIP (mobile-first redesign) ── */}
      <div className="flex-none pb-3 space-y-2.5 relative z-10">

        {/* Row 1: Title + Action buttons */}
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h1 className="text-xl font-bold tracking-tight text-slate-900 leading-none">Barang</h1>
            <p className="text-[11px] font-medium text-slate-400 mt-0.5 hidden sm:block">Kelola inventaris dan stok gudang</p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Button onClick={handleExport} variant="outline" size="sm" className="h-8 px-2.5 rounded-xl text-xs font-semibold border-slate-200 text-slate-600">
              <Download className="h-3.5 w-3.5 sm:mr-1.5" />
              <span className="hidden sm:inline">Export</span>
            </Button>
            <Button onClick={() => document.getElementById("import-file-product")?.click()} variant="outline" size="sm" className="h-8 px-2.5 rounded-xl text-xs font-semibold border-slate-200 text-slate-600">
              <PlusCircle className="h-3.5 w-3.5 sm:mr-1.5" />
              <span className="hidden sm:inline">Import</span>
            </Button>
            <input type="file" id="import-file-product" accept=".xlsx,.xls" className="hidden" onChange={handleImport} />
            <Button onClick={openCreate} size="sm" className="h-8 px-3 rounded-xl bg-violet-600 hover:bg-violet-700 text-xs font-bold shadow-sm">
              <Plus className="h-3.5 w-3.5 mr-1" /> Tambah
            </Button>
          </div>
        </div>

        {/* Row 2: Search — full width on mobile */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <Input
            placeholder="Cari barang / lot..."
            className="pl-9 h-9 rounded-xl border-slate-200 bg-white text-xs shadow-sm focus-visible:ring-violet-500"
            value={search}
            onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
          />
        </div>

        {/* Row 3: Category filter + chip */}
        <div className="flex items-center gap-2 overflow-x-auto pb-0.5 [-webkit-overflow-scrolling:touch] [&::-webkit-scrollbar]:hidden">
          <button
            onClick={() => { setSelectedCategoryId(null); setCurrentPage(1); }}
            className={`h-7 px-3 rounded-full text-[11px] font-bold border transition-all whitespace-nowrap shrink-0 ${
              selectedCategoryId === null
                ? 'bg-violet-600 text-white border-violet-600 shadow-sm'
                : 'bg-white text-slate-500 border-slate-200'
            }`}
          >
            Semua ({products?.length || 0})
          </button>
          <Combobox
            items={(categories ?? [])
              .slice()
              .sort((a, b) => a.name.localeCompare(b.name))
              .map(c => ({ value: c.id.toString(), label: `${c.name} (${products?.filter(p => p.categoryId === c.id).length || 0})` }))}
            value={selectedCategoryId?.toString() ?? ""}
            onValueChange={(v) => { setSelectedCategoryId(v ? parseInt(v) : null); setCurrentPage(1); }}
            placeholder="Pilih Kategori..."
            searchPlaceholder="Cari kategori..."
            emptyText="Kategori tidak ditemukan"
            className="h-7 text-[11px] border-slate-200 rounded-full bg-white min-w-[160px] max-w-[200px] px-2.5 shrink-0"
          />
          {selectedCategoryId !== null && (() => {
            const activeCat = categories?.find(c => c.id === selectedCategoryId);
            const count = products?.filter(p => p.categoryId === selectedCategoryId).length || 0;
            return activeCat ? (
              <div className="flex items-center gap-1 px-2.5 h-7 bg-violet-50 text-violet-700 border border-violet-200 rounded-full text-[11px] font-bold shrink-0">
                <span className="truncate max-w-[100px]">{activeCat.name}</span>
                <span className="text-[9px] bg-violet-200 px-1 py-0.5 rounded-full">{count}</span>
                <button onClick={() => { setSelectedCategoryId(null); setCurrentPage(1); }} className="ml-0.5">
                  <X size={10} />
                </button>
              </div>
            ) : null;
          })()}
        </div>

        {/* Row 4: Summary strip — 4-col compact, no shadow */}
        <div className="grid grid-cols-4 gap-1.5">
          <div className="bg-white border border-slate-100 rounded-xl px-2.5 py-2 flex items-center gap-1.5">
            <Package className="w-3.5 h-3.5 text-slate-400 shrink-0" strokeWidth={1.5} />
            <div className="min-w-0">
              <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">Barang</p>
              <p className="text-xs font-black text-slate-800 leading-tight truncate">{summaryProducts?.length || 0} item</p>
            </div>
          </div>
          <button
            onClick={() => { setShowLowStock(!showLowStock); setCurrentPage(1); }}
            className={`border rounded-xl px-2.5 py-2 flex items-center gap-1.5 text-left transition-colors ${
              showLowStock ? 'bg-amber-50 border-amber-200' : lowStockCount > 0 ? 'bg-amber-50/50 border-amber-100' : 'bg-white border-slate-100'
            }`}
          >
            <AlertTriangle className={`w-3.5 h-3.5 shrink-0 ${lowStockCount > 0 ? 'text-amber-500' : 'text-slate-300'}`} strokeWidth={1.5} />
            <div className="min-w-0">
              <p className={`text-[8px] font-bold uppercase tracking-wider ${lowStockCount > 0 ? 'text-amber-500' : 'text-slate-400'}`}>Tipis</p>
              <p className={`text-xs font-black leading-tight ${lowStockCount > 0 ? 'text-amber-700' : 'text-slate-500'}`}>{lowStockCount} item</p>
            </div>
          </button>
          <div className="bg-white border border-slate-100 rounded-xl px-2.5 py-2 flex items-center gap-1.5">
            <LayoutGrid className="w-3.5 h-3.5 text-slate-400 shrink-0" strokeWidth={1.5} />
            <div className="min-w-0">
              <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">Krat</p>
              <p className="text-xs font-black text-slate-800 leading-tight truncate">
                {formatNumber(summaryProducts?.reduce((s, p) => s + (Number(p.kratStock) || 0), 0) ?? 0)}
              </p>
            </div>
          </div>
          <div className="bg-violet-50 border border-violet-100 rounded-xl px-2.5 py-2 flex items-center gap-1.5">
            <Ruler className="w-3.5 h-3.5 text-violet-400 shrink-0" strokeWidth={1.5} />
            <div className="min-w-0">
              <p className="text-[8px] font-bold text-violet-400 uppercase tracking-wider">KG</p>
              <p className="text-xs font-black text-violet-800 leading-tight truncate">
                {formatNumber(summaryProducts?.reduce((s, p) => s + (Number(p.kgStock) || 0), 0) ?? 0)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* List Area */}
      <div>
        {selectedCategoryId === null && !search && !showLowStock ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-12">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
              <Package className="h-8 w-8 text-slate-300" strokeWidth={1.5} />
            </div>
            <h3 className="text-base font-bold text-slate-700">Pilih Kategori</h3>
            <p className="text-sm text-slate-400 mt-1">Pilih kategori di atas untuk melihat barang.</p>
          </div>
        ) : isLoading ? (
          <div className="space-y-2 p-1">
            {Array(6).fill(0).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}
          </div>
        ) : filtered?.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-12">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
              <Package className="h-8 w-8 text-slate-300" strokeWidth={1.5} />
            </div>
            <h3 className="text-base font-bold text-slate-700">Tidak ada barang</h3>
            <p className="text-sm text-slate-400 mt-1">Kata kunci tidak cocok atau kategori kosong.</p>
          </div>
        ) : (
          <>
            {/* ─── MOBILE: Seamless list (divider style) ─── */}
            <div className="md:hidden bg-white rounded-2xl border border-slate-100">
              {filtered?.slice((currentPage - 1) * 20, currentPage * 20).map((p, idx) => {
                const isLowStock = p.isLowStock;
                return (
                  <div
                    key={p.id}
                    className={`px-3.5 py-3 flex items-center gap-3 ${
                      idx > 0 ? 'border-t border-slate-50' : ''
                    } ${
                      isLowStock ? 'bg-amber-50/30' : 'bg-white'
                    } active:bg-slate-50 transition-colors`}
                  >
                    {/* No */}
                    <span className="text-[10px] text-slate-300 font-bold w-5 shrink-0 text-center">
                      {(currentPage - 1) * 20 + idx + 1}
                    </span>

                    {/* Icon */}
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                      isLowStock ? 'bg-amber-50 border-amber-100 text-amber-400' : 'bg-slate-50 border-slate-100 text-slate-400'
                    }`}>
                      <Package className="w-5 h-5" strokeWidth={1.5} />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-slate-800 text-sm leading-tight truncate">{p.name}</span>
                        {isLowStock && (
                          <span className="shrink-0 text-[8px] font-black px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-600 uppercase tracking-wide">Tipis</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        <span className="text-[10px] text-slate-400 font-mono truncate max-w-[100px]">{p.barcode || p.lotNumber || '—'}</span>
                        <span className="text-[10px] text-slate-200">·</span>
                        <span className={`text-[10px] font-semibold ${
                          isLowStock ? 'text-amber-500' : 'text-slate-500'
                        }`}>{formatNumber(p.kratStock)} krat</span>
                        <span className="text-[10px] text-slate-200">·</span>
                        <span className="text-[11px] font-bold text-violet-700">
                          {formatRupiah(p.pricePerKg)}<span className="text-[9px] text-slate-300 font-normal">/yd</span>
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => openViewKrats(p)}
                        className="w-9 h-9 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center active:scale-95 transition-transform border border-violet-100"
                      >
                        <LayoutGrid className="h-4 w-4" />
                      </button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="w-9 h-9 rounded-xl bg-slate-50 text-slate-500 flex items-center justify-center active:scale-95 transition-transform border border-slate-100">
                            <MoreVertical className="h-4 w-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-36">
                          <DropdownMenuItem onClick={() => openEdit(p)} className="text-sm gap-2">
                            <Pencil className="h-3.5 w-3.5" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => { if (confirm('Hapus barang ini?')) deleteMutation.mutate({ id: p.id }); }}
                            className="text-sm gap-2 text-rose-600 focus:text-rose-600"
                          >
                            <Trash2 className="h-3.5 w-3.5" /> Hapus
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ─── DESKTOP: Full Table ─── */}
            <div className="hidden md:block bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead className="bg-slate-50 sticky top-0 z-10">
                    <tr>
                      <th className="h-9 px-4 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100 w-10">#</th>
                      <th className="h-9 px-4 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">Barang</th>
                      <th className="h-9 px-4 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">Harga Jual</th>
                      <th className="h-9 px-4 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">Harga Beli</th>
                      <th className="h-9 px-4 text-center text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">Stok</th>
                      <th className="h-9 px-4 text-center text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">Status</th>
                      <th className="h-9 px-4 text-center text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {filtered?.slice((currentPage - 1) * 20, currentPage * 20).map((p, idx) => {
                      const isLowStock = p.isLowStock;
                      return (
                        <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="py-2.5 px-4 text-[11px] text-slate-400 font-medium">{(currentPage - 1) * 20 + idx + 1}</td>
                          <td className="py-2.5 px-4">
                            <div className="flex items-center gap-2.5">
                              <div className={`w-7 h-7 rounded-lg flex items-center justify-center border shrink-0 ${isLowStock ? 'bg-amber-50 border-amber-100 text-amber-400' : 'bg-slate-50 border-slate-200 text-slate-400'}`}>
                                <Package className="w-3.5 h-3.5" strokeWidth={1.5} />
                              </div>
                              <div>
                                <div className="font-bold text-slate-800 text-xs">{p.name}</div>
                                <div className="text-[10px] text-slate-400">{p.barcode || p.lotNumber || '—'}</div>
                              </div>
                            </div>
                          </td>
                          <td className="py-2.5 px-4 whitespace-nowrap">
                            <span className="font-bold text-slate-800 text-xs">{formatRupiah(p.pricePerKg)}</span>
                            <span className="text-[9px] text-slate-400 ml-1">/{p.primaryUnit}</span>
                          </td>
                          <td className="py-2.5 px-4 whitespace-nowrap">
                            <span className="font-semibold text-slate-600 text-xs">{formatRupiah((p as any).costPricePerKg)}</span>
                          </td>
                          <td className="py-2.5 px-4 text-center">
                            <div className={`font-bold text-xs ${isLowStock ? 'text-amber-600' : 'text-slate-700'}`}>{formatNumber(p.kgStock)}</div>
                            <div className="text-[9px] text-slate-400">{formatNumber(p.kratStock)} Krat</div>
                          </td>
                          <td className="py-2.5 px-4 text-center">
                            <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider border ${isLowStock ? 'bg-amber-50 text-amber-600 border-amber-200' : 'bg-emerald-50 text-emerald-600 border-emerald-200'}`}>
                              {isLowStock ? 'Tipis' : 'Aman'}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <Button variant="ghost" size="icon" className="h-6 w-6 text-violet-600 hover:bg-violet-50 rounded-md" onClick={() => openViewKrats(p)}>
                                <LayoutGrid className="h-3 w-3" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-500 hover:bg-slate-100 rounded-md" onClick={() => openEdit(p)}>
                                <Pencil className="h-3 w-3" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-6 w-6 text-rose-500 hover:bg-rose-50 rounded-md" onClick={() => { if (confirm('Hapus barang ini?')) deleteMutation.mutate({ id: p.id }); }}>
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Pagination — inline, di bawah list */}
      {filtered && filtered.length > 20 && (
        <div className="flex items-center justify-center gap-2 pt-4 pb-2">
          <span className="text-[10px] text-slate-400 font-medium">
            {(currentPage - 1) * 20 + 1}–{Math.min(currentPage * 20, filtered.length)}
            <span className="text-slate-300 mx-1">/</span>
            {filtered.length}
          </span>
          <PaginationControl currentPage={currentPage} totalPages={Math.ceil(filtered.length / 20)} onPageChange={setCurrentPage} />
        </div>
      )}


      <Drawer 
        open={isOpen} 
        onOpenChange={(open) => { 
          if (!open) { 
            if (document.activeElement instanceof HTMLElement) {
              document.activeElement.blur();
            }
            window.scrollTo(0, 0);
            setTimeout(() => {
              setIsOpen(false); 
              setEditingId(null); 
            }, 150);
          } else {
            setIsOpen(true);
          }
        }}
      >
        <DrawerContent
          className="mx-auto w-full max-w-4xl px-4 sm:px-6 pb-[max(1.5rem,env(safe-area-inset-bottom,0px))] pt-2 flex flex-col"
          style={{ maxHeight: 'calc(95dvh - env(safe-area-inset-top, 0px))' }}
        >
          <DrawerTitle className="sr-only">{editingId ? "Edit Barang" : "Tambah Barang Baru"}</DrawerTitle>
          <DrawerDescription className="sr-only">Form for adding or editing a product</DrawerDescription>
          {/* iOS Style Header */}
          <div className="bg-white/90 backdrop-blur sticky top-0 z-10 px-6 py-4 flex items-center justify-between border-b border-slate-100 shrink-0">
            <div>
              <h2 className="text-[17px] font-bold text-slate-900 leading-tight">
                {editingId ? "Edit Barang" : "Tambah Barang Baru"}
              </h2>
              <p className="text-slate-500 text-[12px] mt-0.5">
                {editingId ? "Perbarui informasi produk" : "Lengkapi detail produk inventaris"}
              </p>
            </div>
            <div className="w-9 h-9 rounded-full bg-violet-50 flex items-center justify-center shrink-0">
              <Package className="w-4 h-4 text-violet-600" strokeWidth={2} />
            </div>
          </div>

          {/* Form Wrapper */}
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col overflow-hidden" style={{ maxHeight: 'calc(95vh - 5rem)' }}>
              
              {/* scrollable Body */}
              <div className="overflow-y-auto bg-slate-50/50 flex-1">
                <div className="pb-6">
              
              {/* —— INFORMASI DASAR —— */}
              <div className="px-5 pt-6 space-y-3">
                <h3 className="text-[11px] font-bold tracking-widest uppercase text-slate-500 ml-1">Informasi Dasar</h3>
                
                <div className="bg-white rounded-[20px] p-4 sm:p-5 border border-slate-100 shadow-sm space-y-5">
                  {/* Upload Foto */}
                  <div className="flex items-center gap-4 p-3.5 bg-linear-to-r from-slate-50 to-violet-50/30 border border-slate-200 rounded-2xl">
                    <div className="shrink-0">
                      {imageUrl ? (
                        <div className="relative w-16 h-16 rounded-xl overflow-hidden bg-slate-100 shadow-sm">
                          <img
                            src={imageUrl.startsWith("http") ? imageUrl : (imageUrl.startsWith("/uploads/") ? `${API_BASE}/api${imageUrl}` : `${API_BASE}${imageUrl}`)}
                            alt="Preview" className="w-full h-full object-cover"
                          />
                          <button type="button" onClick={() => setImageUrl(null)}
                            className="absolute top-1 right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center text-white shadow">
                            <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                        </div>
                      ) : (
                        <label className="w-16 h-16 rounded-xl bg-white border-2 border-dashed border-slate-300 flex flex-col items-center justify-center cursor-pointer hover:border-violet-400 hover:bg-violet-50 transition-colors gap-1 group">
                          {uploadingImage ? (
                            <svg className="w-5 h-5 text-violet-400 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                          ) : (
                            <svg className="w-6 h-6 text-slate-300 group-hover:text-violet-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                          )}
                          <span className="text-[9px] text-slate-400 font-semibold group-hover:text-violet-400">FOTO</span>
                          <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleImageUpload(f); }} disabled={uploadingImage} />
                        </label>
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-700">Foto Produk <span className="text-slate-400 font-normal">(opsional)</span></p>
                      <p className="text-xs text-slate-400 mt-0.5">Format JPG/PNG, maks 5MB</p>
                      {imageUrl && <p className="text-xs text-emerald-600 mt-1 font-semibold">✓ Berhasil diupload</p>}
                    </div>
                  </div>

                  {/* Nama Barang */}
                  <FormField control={form.control} name="name" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-semibold text-slate-600">Nama Barang <span className="text-slate-400 font-normal">(Beda Warna = Beda Barang)</span></FormLabel>
                      <FormControl>
                        <Input placeholder="Contoh: Rayon Twill Abu Tua" className="h-10 bg-white border-slate-200 rounded-xl focus-visible:ring-violet-500" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />

                  {/* Grid 2 kolom */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <FormField control={form.control} name="categoryId" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-semibold text-slate-600">Kategori <span className="text-red-400">*</span></FormLabel>
                        <Select onValueChange={(v: string) => field.onChange(parseInt(v))} value={field.value?.toString()}>
                          <FormControl><SelectTrigger className="h-10 bg-white border-slate-200 rounded-xl"><SelectValue placeholder="Pilih kategori" /></SelectTrigger></FormControl>
                          <SelectContent>
                            {categories?.map(c => <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="barcode" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-semibold text-slate-600">Kode / Barcode</FormLabel>
                        <FormControl><Input placeholder="Otomatis jika kosong" className="h-10 bg-white border-slate-200 rounded-xl focus-visible:ring-violet-500" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="lotNumber" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-semibold text-slate-600">No. Lot</FormLabel>
                        <FormControl><Input placeholder="Opsional" className="h-10 bg-white border-slate-200 rounded-xl focus-visible:ring-violet-500" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="rackLocation" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-semibold text-slate-600">Lokasi Rak</FormLabel>
                        <FormControl><Input placeholder="Contoh: A-12" className="h-10 bg-white border-slate-200 rounded-xl focus-visible:ring-violet-500" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                </div>
              </div>

              {/* —— SATUAN & HARGA —— */}
              <div className="px-5 pt-5 space-y-3">
                <h3 className="text-[11px] font-bold tracking-widest uppercase text-slate-500 ml-1">Satuan & Harga</h3>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Eceran */}
                  <div className="bg-linear-to-b from-violet-50 to-white border border-violet-100 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-widest bg-violet-600 text-white px-2 py-0.5 rounded-full">Eceran</span>
                      <span className="text-[10px] text-slate-400">(Per Potongan)</span>
                    </div>
                    <FormField control={form.control} name="primaryUnit" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-semibold text-slate-600">Satuan Utama</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl><SelectTrigger className="h-9 bg-white border-slate-200 rounded-xl text-sm"><SelectValue placeholder="Pilih satuan" /></SelectTrigger></FormControl>
                          <SelectContent>{units?.map(u => <SelectItem key={u.id} value={u.name}>{u.name}</SelectItem>)}</SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="costPricePerKg" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-semibold text-slate-600">Harga Beli (Rp)</FormLabel>
                        <FormControl><Input type="number" step="any" min={0} className="h-9 bg-white border-slate-200 rounded-xl text-sm" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="pricePerKg" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-semibold text-slate-600">Harga Jual (Rp)</FormLabel>
                        <FormControl><Input type="number" step="any" min={0} className="h-9 bg-white border-slate-200 rounded-xl text-sm" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>

                  {/* Grosir */}
                  <div className="bg-white border border-slate-100 shadow-sm rounded-[20px] p-4 sm:p-5 space-y-4">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-widest bg-indigo-600 text-white px-2 py-0.5 rounded-full">Grosir</span>
                      <span className="text-[10px] text-slate-400">(Gulungan Utuh)</span>
                    </div>
                    <FormField control={form.control} name="secondaryUnit" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-semibold text-slate-600">Satuan Tambahan</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl><SelectTrigger className="h-9 bg-white border-slate-200 rounded-xl text-sm"><SelectValue placeholder="Pilih satuan" /></SelectTrigger></FormControl>
                          <SelectContent>{units?.map(u => <SelectItem key={u.id} value={u.name}>{u.name}</SelectItem>)}</SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="costPricePerKrat" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-semibold text-slate-600">Harga Beli Grosir (Rp)</FormLabel>
                        <FormControl><Input type="number" step="any" min={0} placeholder="Opsional" className="h-9 bg-white border-slate-200 rounded-xl text-sm" {...field} value={field.value ?? ""} onChange={e => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="pricePerKrat" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-semibold text-slate-600">Harga Jual Grosir (Rp)</FormLabel>
                        <FormControl><Input type="number" step="any" min={0} placeholder="Opsional" className="h-9 bg-white border-slate-200 rounded-xl text-sm" {...field} value={field.value ?? ""} onChange={e => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                </div>
              </div>

              {/* —— STOK AWAL —— */}
              <div className="px-5 pt-5 space-y-3">
                <h3 className="text-[11px] font-bold tracking-widest uppercase text-slate-500 ml-1">Pengaturan Stok Awal</h3>
                
                <div className="bg-white rounded-[20px] p-4 sm:p-5 border border-slate-100 shadow-sm space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <FormField control={form.control} name="kratStock" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-semibold text-slate-600">Jumlah Krat Fisik</FormLabel>
                      <FormControl>
                        <Input type="number" step="1" min={0} className="h-10 bg-white border-slate-200 rounded-xl focus-visible:ring-violet-500"
                          {...field}
                          onChange={e => {
                            const val = parseInt(e.target.value) || 0;
                            field.onChange(val);
                            const currentWeights = form.getValues('batchWeights') || [];
                            const newLengths = Array.from({ length: val }, (_, i) => currentWeights[i] !== undefined ? currentWeights[i] : "");
                            form.setValue('batchWeights', newLengths);
                            const total = newLengths.reduce((a, b) => {
                              const bNum = typeof b === 'string' ? parseFloat(b.replace(',', '.')) : b;
                              return a + (bNum || 0);
                            }, 0);
                            form.setValue('kgStock', parseFloat(total.toFixed(3)));
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <FormField control={form.control} name="kgStock" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-semibold text-slate-600">Total Stok Ecer (KG)</FormLabel>
                      <FormControl>
                        <Input type="number" step="any" min={0} readOnly
                          className="h-10 bg-violet-50 border-violet-200 rounded-xl font-bold text-violet-700 cursor-not-allowed"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <FormField control={form.control} name="minStock" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-semibold text-slate-600">Min. Stok Peringatan (Krat)</FormLabel>
                      <FormControl>
                        <Input type="number" step="any" min={0} className="h-10 bg-white border-slate-200 rounded-xl focus-visible:ring-violet-500"
                          {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                {/* Krat lengths grid */}
                {(form.watch('kratStock') || 0) > 0 && !editingId && (() => {
                  const currentWeights = form.watch('batchWeights') || [];
                  return (
                    <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 flex flex-col gap-3">
                      <p className="text-[11px] font-bold text-amber-700 uppercase tracking-wider shrink-0">Detail Berat Tiap Krat (KG)</p>
                      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 max-h-45 overflow-y-auto pr-1.5">
                        {Array.from({ length: form.watch('kratStock') || 0 }).map((_, i) => (
                          <div key={i} className="space-y-1 relative group">
                            <label className="text-[10px] font-bold text-amber-600">Krat #{i + 1}</label>
                            <Input
                              type="text" inputMode="decimal" placeholder="0"
                              className="h-8 text-sm text-center bg-white border-amber-200 rounded-lg focus-visible:ring-amber-400"
                              value={currentWeights[i] !== undefined ? currentWeights[i] : ''}
                              onChange={e => {
                                const val = e.target.value;
                                const newLengths = [...(form.getValues('batchWeights') || [])];
                                newLengths[i] = val;
                                form.setValue('batchWeights', newLengths, { shouldValidate: true, shouldDirty: true });
                                const total = newLengths.reduce((a, b) => {
                                  const bNum = typeof b === 'string' ? parseFloat(b.replace(',', '.')) : b;
                                  return a + (bNum || 0);
                                }, 0);
                                form.setValue('kgStock', parseFloat(total.toFixed(3)), { shouldValidate: true, shouldDirty: true });
                              }}
                            />
                            <button 
                              type="button" 
                              onClick={() => {
                                const newLengths = [...(form.getValues('batchWeights') || [])];
                                newLengths.splice(i, 1);
                                form.setValue('batchWeights', newLengths, { shouldValidate: true, shouldDirty: true });
                                form.setValue('kratStock', newLengths.length, { shouldValidate: true, shouldDirty: true });
                                const total = newLengths.reduce((a, b) => {
                                  const bNum = typeof b === 'string' ? parseFloat(b.replace(',', '.')) : b;
                                  return a + (bNum || 0);
                                }, 0);
                                form.setValue('kgStock', parseFloat(total.toFixed(3)), { shouldValidate: true, shouldDirty: true });
                              }}
                              className="absolute -top-1 -right-1 bg-red-100 hover:bg-red-200 text-red-600 rounded-full p-0.5 transition-opacity"
                              title="Hapus Krat Ini"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
                </div>
              </div>
              {/* End of scrollable Body */}
              </div>
            </div>

              {/* Fixed Footer */}
              <div className="flex-none bg-white border-t border-slate-100 px-5 py-4 flex gap-3 z-10 shrink-0 shadow-[0_-4px_10px_rgba(0,0,0,0.03)]">
                <Button type="button" variant="ghost"
                  className="flex-1 h-12 rounded-[14px] font-bold border border-slate-200 text-slate-600 hover:bg-slate-50"
                  onClick={() => { 
                    if (document.activeElement instanceof HTMLElement) {
                      document.activeElement.blur();
                    }
                    window.scrollTo(0, 0);
                    setTimeout(() => {
                      setIsOpen(false); 
                      setEditingId(null);
                    }, 150);
                  }}>
                  Batal
                </Button>
                <Button type="submit"
                  className="flex-2 md:flex-none h-12 rounded-[14px] px-8 font-bold bg-violet-600 hover:bg-violet-700 text-white shadow-sm"
                  disabled={form.formState.isSubmitting || createMutation.isPending || updateMutation.isPending}>
                  {(form.formState.isSubmitting || createMutation.isPending || updateMutation.isPending)
                    ? <><svg className="animate-spin w-4 h-4 mr-2 inline" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Menyimpan...</>
                    : (editingId ? "Simpan Perubahan" : "Tambah Barang")}
                </Button>
              </div>
            </form>
          </Form>
        </DrawerContent>
      </Drawer>

      <ProductBatchesModal 
        productId={viewKratsId} 
        productName={viewKratsName} 
        isOpen={!!viewKratsId} 
        onClose={() => setViewKratsId(null)} 
      />
    </div>
  );
}

