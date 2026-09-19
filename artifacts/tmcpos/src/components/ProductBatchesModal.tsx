import { useState } from "react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  useGetProductBatchs, 
  useCreateProductBatch, 
  useUpdateProductBatch, 
  useDeleteProductBatch,
  getGetProductBatchsQueryKey,
  getListProductsQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { PackageX, Pencil, Trash2, Plus, Check, X, ArrowUpDown, ArrowUp, ArrowDown, Filter } from "lucide-react";
import { formatNumber } from "@/lib/utils";


interface ProductBatchesModalProps {
  productId: number | null;
  productName: string;
  isOpen: boolean;
  onClose: () => void;
}

type Krat = {
  id: number;
  barcode: string;
  originalWeight: number;
  currentWeight: number;
  status: string;
  createdAt: string;
};

export function ProductBatchesModal({ productId, productName, isOpen, onClose }: ProductBatchesModalProps) {
  const queryClient = useQueryClient();
  const { data: krats, isLoading } = useGetProductBatchs(productId ?? 0, {
    query: {
      queryKey: getGetProductBatchsQueryKey(productId ?? 0),
      enabled: !!productId && isOpen,
    }
  });

  const createMutation = useCreateProductBatch({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetProductBatchsQueryKey(productId ?? 0) });
        queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
        setIsAdding(false);
        setNewBarcode("");
        setNewLengths([]);
      }
    }
  });

  const updateMutation = useUpdateProductBatch({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetProductBatchsQueryKey(productId ?? 0) });
        queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
        setEditingKratId(null);
      }
    }
  });

  const deleteMutation = useDeleteProductBatch({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetProductBatchsQueryKey(productId ?? 0) });
        queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
      }
    }
  });

  // State for inline editing (via detail panel)
  const [editingKratId, setEditingKratId] = useState<number | null>(null);
  const [editOriginalLength, setEditOriginalLength] = useState<string>("");
  const [editCurrentLength, setEditCurrentLength] = useState<string>("");

  const [isAdding, setIsAdding] = useState(false);
  const [newBarcode, setNewBarcode] = useState("");
  const [newLengths, setNewLengths] = useState<string[]>([]);
  const [newQty, setNewQty] = useState("1");
  const [isCreatingMultiple, setIsCreatingMultiple] = useState(false);

  // State for sort & filter
  type SortOrder = "default" | "asc" | "desc";
  type StatusFilter = "all" | "available" | "empty";
  const [sortOrder, setSortOrder] = useState<SortOrder>("default");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const [selectedKratIds, setSelectedKratIds] = useState<number[]>([]);
  const [isDeletingBulk, setIsDeletingBulk] = useState(false);


  const handleBulkDelete = async () => {
    if (!productId || selectedKratIds.length === 0) return;
    
    if (window.confirm(`Anda yakin ingin menghapus ${selectedKratIds.length} krat terpilih? Data yang dihapus tidak dapat dikembalikan.`)) {
      setIsDeletingBulk(true);
      try {
        for (const batchId of selectedKratIds) {
          await deleteMutation.mutateAsync({ id: productId, batchId });
        }
        setSelectedKratIds([]);
      } catch (error) {
        console.error("Gagal menghapus beberapa krat", error);
      } finally {
        setIsDeletingBulk(false);
      }
    }
  };
  const startEdit = (krat: Krat) => {
    setEditingKratId(krat.id);
    setEditOriginalLength(Number(krat.originalWeight).toString());
    setEditCurrentLength(Number(krat.currentWeight).toString());
  };

  const cancelEdit = () => setEditingKratId(null);

  const saveEdit = (batchId: number) => {
    if (!productId) return;
    updateMutation.mutate({
      id: productId,
      batchId: batchId,
      data: {
        originalWeight: parseFloat(editOriginalLength) || 0,
        currentWeight: parseFloat(editCurrentLength) || 0
      }
    });
  };

  const [isEditingBulk, setIsEditingBulk] = useState(false);
  const [bulkEditValues, setBulkEditValues] = useState<Record<number, { originalWeight: string, currentWeight: string }>>({});
  const [isSavingBulk, setIsSavingBulk] = useState(false);

  const startBulkEdit = () => {
    const initialValues: Record<number, { originalWeight: string, currentWeight: string }> = {};
    selectedKratIds.forEach(id => {
      const krat = krats?.find((r: Krat) => r.id === id);
      if (krat) {
         initialValues[id] = { originalWeight: String(krat.originalWeight), currentWeight: String(krat.currentWeight) };
      }
    });
    setBulkEditValues(initialValues);
    setIsEditingBulk(true);
    setIsAdding(false);
    setEditingKratId(null);
  };

  const saveBulkEdit = async () => {
    if (!productId) return;
    setIsSavingBulk(true);
    try {
      for (const [id, vals] of Object.entries(bulkEditValues)) {
        await updateMutation.mutateAsync({
          id: productId,
          batchId: parseInt(id),
          data: {
            originalWeight: parseFloat(vals.originalWeight) || 0,
            currentWeight: parseFloat(vals.currentWeight) || 0
          }
        });
      }
      setIsEditingBulk(false);
      setSelectedKratIds([]);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSavingBulk(false);
    }
  };

  const saveNew = async () => {
    if (!productId) return;
    const qty = parseInt(newQty) || 1;
    
    setIsCreatingMultiple(true);
    
    try {
      // Loop to create multiple krats if qty > 1
      for (let i = 0; i < qty; i++) {
        const rawLen = newLengths[i];
        const len = typeof rawLen === 'string' ? parseFloat(rawLen.replace(',', '.')) || 0 : (rawLen || 0);
        await createMutation.mutateAsync({
          id: productId,
          data: {
            barcode: qty === 1 ? (newBarcode || undefined) : undefined, // If multiple, ignore manual barcode to auto-generate
            originalWeight: len,
            currentWeight: len
          }
        });
      }
      setNewBarcode("");
      setNewLengths([]);
      setNewQty("1");
      setIsAdding(false);
    } catch (error) {
      console.error("Failed to create krats:", error);
    } finally {
      setIsCreatingMultiple(false);
    }
  };

  const editingKrat = krats?.find((r: Krat) => r.id === editingKratId);

  // Total & summary
  const totalYds = krats?.reduce((acc: number, r: Krat) => acc + (r.currentWeight || 0), 0) ?? 0;
  const totalKrats = krats?.length ?? 0;

  // Filtered + sorted krats
  const sortedKrats: Krat[] = (() => {
    if (!krats) return [];
    let result = [...krats] as Krat[];
    // filter status
    if (statusFilter === "available") result = result.filter(r => r.status === "available");
    else if (statusFilter === "empty") result = result.filter(r => r.status !== "available");
    // sort
    if (sortOrder === "asc") result.sort((a, b) => a.currentWeight - b.currentWeight);
    else if (sortOrder === "desc") result.sort((a, b) => b.currentWeight - a.currentWeight);
    return result;
  })();

  const cycleSortOrder = () => {
    setSortOrder(prev =>
      prev === "default" ? "asc" : prev === "asc" ? "desc" : "default"
    );
  };

  const sortLabel = sortOrder === "asc" ? "Terkecil → Terbesar" : sortOrder === "desc" ? "Terbesar → Terkecil" : "Urut Masuk";
  const SortIcon = sortOrder === "asc" ? ArrowUp : sortOrder === "desc" ? ArrowDown : ArrowUpDown;

  return (
    <Drawer open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DrawerContent
        className="flex flex-col mx-auto w-full max-w-[95vw] xl:max-w-5xl px-4 sm:px-6 pb-[max(1.5rem,env(safe-area-inset-bottom,0px))] pt-2"
        style={{ maxHeight: 'calc(95dvh - env(safe-area-inset-top, 0px))' }}
      >
        <DrawerHeader className="pb-2 shrink-0 px-0">
          {/* Title + Tambah */}
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <DrawerTitle className="text-[15px] font-bold leading-tight truncate">{productName}</DrawerTitle>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-xs text-slate-500">Krat: <span className="font-bold text-slate-700">{totalKrats}</span></span>
                <span className="text-slate-300">·</span>
                <span className="text-xs text-slate-500">Sisa: <span className="font-bold text-slate-700">{formatNumber(totalYds)} kg</span></span>
              </div>
            </div>
            <Button
              size="sm"
              onClick={() => { setIsAdding(true); setEditingKratId(null); }}
              className="h-8 text-xs px-3 rounded-xl bg-violet-600 hover:bg-violet-700 shrink-0"
              disabled={isAdding}
            >
              <Plus className="h-3.5 w-3.5 mr-1" /> Tambah
            </Button>
          </div>

          {/* Sort & Filter toolbar */}
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {selectedKratIds.length > 0 ? (
              <div className="flex items-center gap-2 w-full mb-1 bg-red-50 text-red-700 px-3 py-1.5 rounded-lg border border-red-200">
                <span className="text-xs font-semibold">{selectedKratIds.length} krat terpilih</span>
                <Button size="sm" variant="ghost" className="h-6 px-2 text-xs text-blue-700 hover:text-blue-800 hover:bg-blue-100 ml-auto" onClick={startBulkEdit} disabled={isDeletingBulk}>
                  <Pencil className="h-3 w-3 mr-1" /> Edit
                </Button>
                <Button size="sm" variant="ghost" className="h-6 px-2 text-xs text-red-700 hover:text-red-800 hover:bg-red-100" onClick={handleBulkDelete} disabled={isDeletingBulk}>
                  {isDeletingBulk ? <span className="h-3 w-3 rounded-full border-2 border-red-600 border-t-transparent animate-spin mr-1" /> : <Trash2 className="h-3 w-3 mr-1" />} Hapus
                </Button>
                <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => setSelectedKratIds([])} disabled={isDeletingBulk}>
                  Batal
                </Button>
              </div>
            ) : null}

            {/* Sort toggle */}
            <button
              onClick={cycleSortOrder}
              className={[
                "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-all",
                sortOrder !== "default"
                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                  : "bg-background text-muted-foreground border-border hover:border-primary/50 hover:text-primary",
              ].join(" ")}
            >
              <SortIcon className="h-3 w-3" />
              KG: {sortLabel}
            </button>

            {/* Status filter */}
            <div className="flex items-center gap-1">
              {(["all", "available", "empty"] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setStatusFilter(f)}
                  className={[
                    "px-2.5 py-1 rounded-full text-xs font-medium border transition-all",
                    statusFilter === f
                      ? f === "available"
                        ? "bg-green-500 text-white border-green-500"
                        : f === "empty"
                        ? "bg-gray-400 text-white border-gray-400"
                        : "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-muted-foreground border-border hover:border-primary/40 hover:text-primary",
                  ].join(" ")}
                >
                  {f === "all" ? "Semua" : f === "available" ? "Tersedia" : "Habis"}
                </button>
              ))}
            </div>

            {krats && krats.length > 0 && (
              <button
                onClick={() => setSelectedKratIds(
                  selectedKratIds.length === sortedKrats.length 
                    ? [] 
                    : sortedKrats.map(r => r.id)
                )}
                className="px-2.5 py-1 rounded-full text-xs font-medium border bg-background text-muted-foreground border-border hover:border-primary/40 hover:text-primary transition-all ml-1"
              >
                {selectedKratIds.length === sortedKrats.length && sortedKrats.length > 0 ? "Batal Pilih" : "Pilih Semua"}
              </button>
            )}

            {/* Tampilkan jumlah hasil filter */}
            {(sortOrder !== "default" || statusFilter !== "all") && (
              <span className="text-xs text-muted-foreground ml-auto">
                Menampilkan {sortedKrats.length} dari {totalKrats} krat
              </span>
            )}
          </div>
        </DrawerHeader>

        <div className="flex flex-col lg:flex-row gap-4 flex-1 min-h-0">
          
          {/* Sidebar for Add / Edit */}
          {(isAdding || editingKrat || isEditingBulk) && (
            <div className="w-full lg:w-[55%] xl:w-[60%] flex flex-col gap-3 shrink-0 min-h-0 overflow-y-auto pr-1">
              {/* Add new krat form */}
              {isAdding && (
                <div className="flex flex-col gap-3 p-4 rounded-xl border border-dashed border-primary/40 bg-primary/5">
                  <div className="flex items-center gap-3">
                    <Input
                      placeholder={parseInt(newQty) > 1 ? "Auto-generate (Multi)" : "Barcode (Auto)"}
                      value={newBarcode}
                      onChange={e => setNewBarcode(e.target.value)}
                      className="h-10 text-sm flex-1 min-w-20 bg-white"
                      disabled={parseInt(newQty) > 1 || isCreatingMultiple}
                    />
                    <div className="flex items-center gap-2 shrink-0 bg-white px-3 py-1 rounded-md border border-slate-200">
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Qty</span>
                      <Input
                        type="number"
                        min="1"
                        value={newQty}
                        onChange={e => {
                          const val = e.target.value;
                          setNewQty(val);
                          const parsed = parseInt(val) || 0;
                          const newArr = Array.from({ length: parsed }, (_, i) => newLengths[i] !== undefined ? newLengths[i] : "");
                          setNewLengths(newArr);
                        }}
                        className="h-8 text-sm w-16 border-none shadow-none focus-visible:ring-0 text-center font-bold"
                        disabled={isCreatingMultiple}
                      />
                    </div>
                    <Button size="icon" className="h-10 w-10 shrink-0 bg-green-600 hover:bg-green-700 text-white" onClick={saveNew} disabled={isCreatingMultiple || (parseInt(newQty) > 0 && newLengths.length === 0)}>
                      {isCreatingMultiple ? <span className="h-5 w-5 rounded-full border-2 border-white border-t-transparent animate-spin" /> : <Check className="h-5 w-5" />}
                    </Button>
                    <Button size="icon" variant="outline" className="h-10 w-10 shrink-0 text-muted-foreground bg-white" onClick={() => setIsAdding(false)} disabled={isCreatingMultiple}>
                      <X className="h-5 w-5" />
                    </Button>
                  </div>
                  
                  {parseInt(newQty) > 0 && (
                    <div className="bg-white p-4 rounded-xl border border-slate-200 mt-1 shadow-sm">
                      <label className="text-sm font-bold text-slate-800 block mb-3 border-b pb-2">Detail Berat Tiap Krat (kg)</label>
                      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3 max-h-[50vh] overflow-y-auto p-1">
                        {Array.from({ length: parseInt(newQty) || 0 }).map((_, i) => (
                          <div key={i} className="space-y-1.5 bg-slate-50 p-2 rounded-lg border border-slate-100 relative group">
                            <label className="text-[11px] font-bold text-slate-500 block text-center uppercase tracking-wider">Krat #{i + 1}</label>
                            <Input
                              type="text" inputMode="decimal"
                              placeholder="0.00"
                              className="h-8 text-sm font-semibold text-center border-slate-300 focus-visible:ring-primary focus-visible:border-primary"
                              value={newLengths[i] ?? ''}
                              onChange={e => {
                                const val = e.target.value;
                                const newArr = [...newLengths];
                                newArr[i] = val;
                                setNewLengths(newArr);
                              }}
                              disabled={isCreatingMultiple}
                            />
                            <button 
                              type="button" 
                              onClick={() => {
                                const newArr = [...newLengths];
                                newArr.splice(i, 1);
                                setNewLengths(newArr);
                                setNewQty(String(Math.max(0, parseInt(newQty) - 1)));
                              }}
                              className="absolute -top-1 -right-1 bg-red-100 hover:bg-red-200 text-red-600 rounded-full p-0.5 transition-opacity"
                              title="Hapus Krat Ini"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Edit panel (shown when a krat is selected) */}
              {editingKrat && (
                <div className="flex flex-col gap-3 p-4 rounded-xl border-2 border-blue-200 bg-blue-50/80 dark:bg-blue-900/20 shadow-sm relative overflow-hidden shrink-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-base font-bold text-blue-700 dark:text-blue-300">
                      ✏️ Edit Krat #{editingKrat.id}
                    </span>
                    <div className="flex items-center gap-2">
                      <Button size="sm" className="h-9 px-3 bg-green-600 hover:bg-green-700 text-white font-medium" onClick={() => saveEdit(editingKrat.id)} disabled={updateMutation.isPending}>
                        <Check className="h-4 w-4 mr-1.5" /> Simpan
                      </Button>
                      <Button size="sm" variant="outline" className="h-9 w-9 p-0 text-destructive hover:bg-red-50 hover:text-red-600 border-red-200" onClick={() => {
                        if (window.confirm("Apakah Anda yakin ingin menghapus krat ini? Data akan hilang secara permanen.")) {
                          deleteMutation.mutate({ id: productId!, batchId: editingKrat.id });
                          setEditingKratId(null);
                        }
                      }}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-9 w-9 p-0 text-muted-foreground hover:bg-slate-200 dark:hover:bg-slate-800" onClick={cancelEdit}>
                        <X className="h-5 w-5" />
                      </Button>
                    </div>
                  </div>
                  
                  <div className="flex gap-6">
                    <div className="flex-1">
                      <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2 block">
                        Berat Awal <span className="font-normal text-muted-foreground">(kg)</span>
                      </label>
                      <Input
                        type="number"
                        value={editOriginalLength}
                        onChange={e => setEditOriginalLength(e.target.value)}
                        className="h-11 text-base font-medium w-full text-right bg-white dark:bg-slate-950 border-slate-300"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2 block">
                        Sisa <span className="font-normal text-muted-foreground">(kg)</span>
                      </label>
                      <Input
                        type="number"
                        value={editCurrentLength}
                        onChange={e => setEditCurrentLength(e.target.value)}
                        className="h-11 text-base font-bold w-full text-right bg-white dark:bg-slate-950 border-blue-400 ring-offset-blue-50 focus-visible:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Bulk Edit panel */}
              {isEditingBulk && (
                <div className="flex flex-col gap-3 p-4 rounded-xl border-2 border-blue-300 bg-blue-50 shadow-sm relative overflow-hidden shrink-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-base font-bold text-blue-700">
                      ✏️ Edit Massal ({Object.keys(bulkEditValues).length} Krat)
                    </span>
                    <div className="flex items-center gap-2">
                      <Button size="sm" className="h-9 px-3 bg-blue-600 hover:bg-blue-700 text-white font-medium" onClick={saveBulkEdit} disabled={isSavingBulk}>
                        {isSavingBulk ? <span className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin mr-1.5" /> : <Check className="h-4 w-4 mr-1.5" />} Simpan
                      </Button>
                      <Button size="sm" variant="ghost" className="h-9 w-9 p-0 text-muted-foreground hover:bg-slate-200" onClick={() => setIsEditingBulk(false)} disabled={isSavingBulk}>
                        <X className="h-5 w-5" />
                      </Button>
                    </div>
                  </div>
                  
                  <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm max-h-[50vh] overflow-y-auto">
                    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
                      {Object.entries(bulkEditValues)
                        .sort(([idA], [idB]) => {
                          const idxA = krats?.findIndex((r: Krat) => r.id === parseInt(idA)) ?? 0;
                          const idxB = krats?.findIndex((r: Krat) => r.id === parseInt(idB)) ?? 0;
                          return idxA - idxB;
                        })
                        .map(([id, vals]) => {
                        const numericId = parseInt(id);
                        const batchIdx = krats?.findIndex((r: Krat) => r.id === numericId);
                        const displayNum = batchIdx !== undefined && batchIdx >= 0 ? batchIdx + 1 : id;
                        return (
                          <div key={id} className="space-y-1.5 bg-slate-50 p-2 rounded-lg border border-slate-100">
                            <label className="text-[11px] font-bold text-slate-500 block text-center uppercase tracking-wider">Krat #{displayNum}</label>
                            <div className="flex gap-1.5">
                              <div className="flex-1">
                                <span className="text-[9px] text-muted-foreground block mb-0.5">Awal</span>
                                <Input
                                  type="number"
                                  className="h-8 text-xs font-medium text-center border-slate-300 px-1"
                                  value={vals.originalWeight}
                                  onChange={e => {
                                    const val = e.target.value;
                                    setBulkEditValues(prev => ({ ...prev, [numericId]: { ...prev[numericId], originalWeight: val } }));
                                  }}
                                  disabled={isSavingBulk}
                                />
                              </div>
                              <div className="flex-1">
                                <span className="text-[9px] text-muted-foreground block mb-0.5">Sisa</span>
                                <Input
                                  type="number"
                                  className="h-8 text-xs font-bold text-center border-blue-300 bg-blue-50/50 text-blue-700 px-1"
                                  value={vals.currentWeight}
                                  onChange={e => {
                                    const val = e.target.value;
                                    setBulkEditValues(prev => ({ ...prev, [numericId]: { ...prev[numericId], currentWeight: val } }));
                                  }}
                                  disabled={isSavingBulk}
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Compact grid of krats */}
          <div className="flex-1 overflow-y-auto min-h-0 border border-primary/40 rounded-lg flex flex-col bg-slate-50/50">
            <div className="flex-1 overflow-y-auto p-1.5">
              {isLoading ? (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2 p-1">
                  {Array(12).fill(0).map((_, i) => (
                    <Skeleton key={i} className="h-24 rounded-xl" />
                  ))}
                </div>
              ) : !krats || krats.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground h-full">
                  <PackageX className="mb-2 h-10 w-10 opacity-25" />
                  <span className="text-sm">Tidak ada krat tersedia</span>
                </div>
              ) : (
                <div className={`grid gap-1.5 ${
                  isAdding || editingKrat || isEditingBulk
                    ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-3'
                    : 'grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7'
                }`}>
                    {sortedKrats.length === 0 ? (
                      <div className="col-span-full flex flex-col items-center justify-center py-10 text-muted-foreground h-full">
                        <Filter className="mb-2 h-6 w-6 opacity-30" />
                        <span className="text-xs">Tidak ada krat yang cocok dengan filter</span>
                      </div>
                    ) : sortedKrats.map((r: Krat, idx: number) => {
                      const isEditing = editingKratId === r.id;
                      const isAvailable = r.status === "available";
                      // Shorten barcode: show last 8 chars
                      const shortBarcode = r.barcode
                        ? r.barcode.length > 10
                          ? "…" + r.barcode.slice(-9)
                          : r.barcode
                        : "-";
                      const tglMasuk = r.createdAt
                        ? new Date(r.createdAt).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "2-digit" })
                        : "-";
                      const pemakaian = r.originalWeight > 0
                        ? Math.max(0, r.originalWeight - r.currentWeight)
                        : 0;
                      const persen = r.originalWeight > 0
                        ? Math.round((r.currentWeight / r.originalWeight) * 100)
                        : 100;

                      return (
                        <button
                          key={r.id}
                          onClick={() => {
                            if (isEditing) {
                              cancelEdit();
                            } else {
                              setIsAdding(false);
                              startEdit(r);
                            }
                          }}
                          className={[
                            "flex flex-col gap-1 text-left p-2.5 text-xs transition-all relative rounded-xl border",
                            "active:scale-95",
                            isEditing
                              ? "bg-blue-50 border-blue-300 ring-1 ring-blue-400"
                              : isAvailable
                              ? "bg-white border-slate-100 hover:border-violet-200 hover:bg-violet-50/30"
                              : "bg-slate-50 border-slate-100 opacity-60",
                            selectedKratIds.includes(r.id) ? "border-red-300 bg-red-50/60" : "",
                          ].join(" ")}
                        >
                          {/* Row 1: Nomor + Status badge */}
                          <div className="flex items-center justify-between w-full">
                            <div className="flex items-center gap-1.5">
                              <input
                                type="checkbox"
                                className="w-3 h-3 cursor-pointer accent-red-600"
                                checked={selectedKratIds.includes(r.id)}
                                onChange={() => {}}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedKratIds(prev => prev.includes(r.id) ? prev.filter(id => id !== r.id) : [...prev, r.id]);
                                }}
                              />
                              <span className={[
                                "font-bold text-[11px]",
                                isEditing ? "text-blue-600" : isAvailable ? "text-primary" : "text-muted-foreground",
                              ].join(" ")}>
                                Krat #{idx + 1}
                              </span>
                            </div>
                            <span className={[
                              "text-[9px] font-semibold px-1 py-0.5 rounded-full leading-none",
                              isAvailable
                                ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400"
                                : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
                            ].join(" ")}>
                              {isAvailable ? "Ada" : "Habis"}
                            </span>
                          </div>

                          {/* Row 2: Barcode */}
                          <div className="flex items-center gap-1 w-full mt-0.5">
                            <span className="text-[9px] text-muted-foreground shrink-0">Kode:</span>
                            <code className={[
                              "text-[9px] font-mono truncate max-w-full",
                              isAvailable ? "text-foreground" : "text-muted-foreground line-through",
                            ].join(" ")}>
                              {shortBarcode}
                            </code>
                          </div>

                          {/* Row 3: Panjang Awal */}
                          <div className="flex items-center justify-between w-full mt-0.5">
                            <span className="text-[9px] text-muted-foreground">Awal:</span>
                            <span className="text-[10px] font-medium text-foreground">
                              {formatNumber(r.originalWeight)} <span className="text-muted-foreground font-normal">kg</span>
                            </span>
                          </div>

                          {/* Row 4: Sisa saat ini — highlighted */}
                          <div className={[
                            "flex items-center justify-between w-full rounded px-1 -mx-1 mt-0.5",
                            isAvailable ? "bg-primary/8" : "",
                          ].join(" ")}>
                            <span className="text-[9px] text-muted-foreground">Sisa:</span>
                            <span className={[
                              "text-[11px] font-bold",
                              isAvailable ? "text-primary" : "text-muted-foreground line-through",
                            ].join(" ")}>
                              {formatNumber(r.currentWeight)} <span className="text-[9px] font-normal">kg</span>
                            </span>
                          </div>

                          {/* Row 5: Pemakaian & Tgl */}
                          <div className="flex items-center justify-between w-full mt-1">
                            <span className="text-[9px] text-orange-500 dark:text-orange-400 font-medium">
                              {pemakaian > 0 ? `Terpakai: ${formatNumber(pemakaian)} kg` : "Belum terpakai"}
                            </span>
                            <span className="text-[9px] text-muted-foreground">{tglMasuk}</span>
                          </div>

                          {/* Progress bar sisa */}
                          <div className="w-full h-1 rounded-full bg-muted mt-1 overflow-hidden">
                            <div
                              className={[
                                "h-full rounded-full transition-all",
                                persen > 60 ? "bg-green-500" : persen > 30 ? "bg-yellow-400" : "bg-red-400",
                              ].join(" ")}
                              style={{ width: `${persen}%` }}
                            />
                          </div>
                        </button>
                      );
                    })}
                  </div>
              )}
            </div>

            {/* Legend */}
            {krats && krats.length > 0 && (
              <div className="flex items-center flex-wrap gap-x-4 gap-y-1 p-2 bg-slate-50 border-t border-primary/20 text-xs text-muted-foreground shrink-0 mt-auto">
                <span className="flex items-center gap-1">
                  <span className="inline-block w-2.5 h-2.5 rounded-full bg-green-500" />
                  Sisa &gt; 60%
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block w-2.5 h-2.5 rounded-full bg-yellow-400" />
                  Sisa 30–60%
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-400" />
                  Sisa &lt; 30%
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block w-2.5 h-2.5 rounded-full bg-gray-300" />
                  Habis
                </span>
                <span className="ml-auto italic hidden sm:block">Klik card untuk edit / hapus</span>
              </div>
            )}
          </div>
        </div>
      </DrawerContent>


    </Drawer>
  );
}

