import { useGetPurchase, getGetPurchaseQueryKey } from "@workspace/api-client-react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { formatRupiah, formatDate } from "@/lib/utils";
import { CheckCircle2, Clock, AlertCircle, ShoppingBag, Package, Calendar } from "lucide-react";

interface PurchaseDetailModalProps {
  purchaseId: number | null;
  isOpen: boolean;
  onClose: () => void;
}

export function PurchaseDetailModal({ purchaseId, isOpen, onClose }: PurchaseDetailModalProps) {
  const { data: purchase, isLoading } = useGetPurchase(purchaseId ?? 0, {
    query: {
      queryKey: getGetPurchaseQueryKey(purchaseId ?? 0),
      enabled: !!purchaseId && isOpen,
    }
  });

  if (!isOpen) return null;

  let StatusIcon = CheckCircle2;
  let iconColor = "text-green-500";
  let badgeBg = "bg-green-100 text-green-700";

  if (purchase?.status === 'kredit') {
    StatusIcon = Clock;
    iconColor = "text-amber-500";
    badgeBg = "bg-amber-100 text-amber-700";
  } else if (purchase?.status === 'partial') {
    StatusIcon = AlertCircle;
    iconColor = "text-blue-500";
    badgeBg = "bg-blue-100 text-blue-700";
  }

  return (
    <Drawer open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DrawerContent className="mx-auto w-full max-w-4xl px-4 sm:px-6 pb-[max(1.5rem,env(safe-area-inset-bottom,0px))] pt-2 flex flex-col" style={{ maxHeight: "calc(95dvh - env(safe-area-inset-top, 0px))" }}>
        <DrawerHeader className="px-0 pt-0 pb-4 border-b">
          <div className="flex items-center justify-between">
            <div>
              <DrawerTitle className="text-xl font-bold flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-violet-600" />
                Detail Pembelian
              </DrawerTitle>
              {purchase && (
                <div className="text-sm text-muted-foreground mt-1 font-mono">
                  {purchase.invoiceNumber}
                </div>
              )}
            </div>
            {purchase && (
              <Badge className={`${badgeBg} uppercase tracking-wider text-[10px] px-2 py-0.5 border-0 font-bold`}>
                {purchase.status}
              </Badge>
            )}
          </div>
        </DrawerHeader>

        <div className="flex-1 overflow-y-auto mt-4 px-1 custom-scrollbar">
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-64 w-full" />
            </div>
          ) : purchase ? (
            <div className="space-y-6">
              {/* Info Utama */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                <div>
                  <div className="text-xs text-slate-500 font-medium mb-1">Supplier</div>
                  <div className="font-bold text-slate-900">{purchase.supplierName || "Supplier Umum"}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500 font-medium mb-1 flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> Tanggal
                  </div>
                  <div className="font-medium text-slate-900">{formatDate(purchase.createdAt)}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500 font-medium mb-1">Pembayaran</div>
                  <div className="font-medium text-slate-900 capitalize">{purchase.paymentType}</div>
                </div>
                {purchase.dueDate && (
                  <div>
                    <div className="text-xs text-slate-500 font-medium mb-1">Jatuh Tempo</div>
                    <div className="font-medium text-slate-900">{formatDate(purchase.dueDate)}</div>
                  </div>
                )}
              </div>

              {/* Tabel Item */}
              <div>
                <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
                  <Package className="w-4 h-4 text-slate-400" /> Daftar Barang
                </h3>
                
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  {/* Table Header */}
                  <div className="hidden md:grid grid-cols-12 gap-2 bg-slate-100 p-3 text-xs font-semibold text-slate-600">
                    <div className="col-span-5">NAMA BARANG</div>
                    <div className="col-span-2 text-center">KRAT</div>
                    <div className="col-span-2 text-right">QTY / KG</div>
                    <div className="col-span-3 text-right">SUBTOTAL</div>
                  </div>

                  {/* Table Body */}
                  <div className="divide-y divide-slate-100">
                    {(purchase as any).items?.map((item: any, idx: number) => (
                      <div key={idx} className="p-3 bg-white hover:bg-slate-50 transition-colors">
                        <div className="grid grid-cols-12 gap-2 items-center">
                          <div className="col-span-12 md:col-span-5 flex flex-col mb-2 md:mb-0">
                            <span className="font-bold text-slate-900">{item.productName}</span>
                            {item.categoryName && (
                              <span className="inline-flex items-center mt-0.5 w-fit px-1.5 py-0.5 rounded text-[9px] font-semibold bg-violet-50 text-violet-600 border border-violet-100">
                                {item.categoryName}
                              </span>
                            )}
                            {item.barcode && <span className="text-[10px] text-slate-400 font-mono mt-0.5">Kode: {item.barcode}</span>}
                          </div>
                          
                          <div className="col-span-4 md:col-span-2 flex flex-col md:items-center">
                            <span className="text-[10px] text-slate-400 md:hidden uppercase font-semibold">Krat</span>
                            <span className="font-semibold text-slate-700">{Number(item.krats)}</span>
                          </div>
                          
                          <div className="col-span-4 md:col-span-2 flex flex-col text-right">
                            <span className="text-[10px] text-slate-400 md:hidden uppercase font-semibold">Qty</span>
                            <span className="font-semibold text-slate-700">{Number(item.kgs)}</span>
                            <span className="text-[10px] text-slate-500">@ {formatRupiah(item.pricePerKg)}</span>
                          </div>
                          
                          <div className="col-span-4 md:col-span-3 flex flex-col text-right">
                            <span className="text-[10px] text-slate-400 md:hidden uppercase font-semibold">Subtotal</span>
                            <span className="font-bold text-violet-700">{formatRupiah(item.subtotal)}</span>
                          </div>
                        </div>
                        
                        {item.batchWeights && item.batchWeights.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-slate-100">
                            <div className="text-[10px] text-slate-500 font-semibold mb-1 uppercase">Detail Krat</div>
                            <div className="flex flex-wrap gap-1.5">
                              {item.batchWeights.map((length: number, i: number) => (
                                <div key={i} className="text-[10px] bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded text-slate-600 font-medium">
                                  R#{i + 1}: {length}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Table Footer / Summary */}
                  <div className="bg-slate-50 p-4 border-t border-slate-200">
                    <div className="flex justify-between items-center text-sm mb-1">
                      <span className="text-slate-500 font-medium">Total Pembelian</span>
                      <span className="font-bold text-slate-900">{formatRupiah(purchase.totalAmount)}</span>
                    </div>
                    {purchase.status !== 'lunas' && (
                      <>
                        <div className="flex justify-between items-center text-sm mb-1">
                          <span className="text-slate-500">Sudah Dibayar</span>
                          <span className="font-medium text-slate-700">{formatRupiah(purchase.paidAmount || 0)}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm pt-2 border-t border-slate-200 mt-2">
                          <span className="text-red-600 font-bold">Kekurangan</span>
                          <span className="font-bold text-red-600 text-lg">{formatRupiah((purchase.totalAmount || 0) - (purchase.paidAmount || 0))}</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {purchase.notes && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-700 mb-1.5 block">Catatan</h3>
                  <div className="p-3 bg-yellow-50/50 rounded-lg border border-yellow-100 text-sm text-yellow-800">
                    {purchase.notes}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center text-slate-500 py-10">Data tidak ditemukan</div>
          )}
        </div>

        <DrawerFooter className="px-0 pt-4 mt-4 border-t border-border">
          <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={onClose}>
            Tutup
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
