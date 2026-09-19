import { Drawer, DrawerContent, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatRupiah, formatDate, formatDateTime } from "@/lib/utils";
import { useSettings } from "@/hooks/useSettings";
import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import * as htmlToImage from "html-to-image";
import { Printer, Loader2, QrCode, Download, RefreshCcw, CornerDownRight, ShieldCheck, Clock, Bell } from "lucide-react";
import React from "react";
import { useGetSale, getGetSaleQueryKey, useListProducts, getListProductsQueryKey, useGetProductBatchs, getGetProductBatchsQueryKey, useListCategories, getListCategoriesQueryKey, useCreateReturn, getListSalesQueryKey } from "@workspace/api-client-react";
import { OtpDialog } from "./OtpDialog";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

export type InvoicePreviewData = {
  invoiceNumber: string;
  customerName?: string | null;
  createdAt?: string;
  items: Array<{
    productId: number;
    batchId?: number;
    categoryName?: string;
    productName: string;
    primaryUnit?: string;
    secondaryUnit?: string;
    kgs: number | string;
    krats: number | string;
    pricePerKg: number | string;
    subtotal: number | string;
    isReturned?: boolean;
  }>;
  exchangedItems?: Array<{
    categoryName?: string;
    productName: string;
    primaryUnit?: string;
    secondaryUnit?: string;
    kgs: number | string;
    krats: number | string;
    pricePerKg: number | string;
    subtotal: number | string;
  }>;
  totalAmount: number | string;
  paidAmount: number | string;
  remainingAmount: number | string;
  status?: string;
};

interface InvoicePreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data?: InvoicePreviewData | null;
  saleId?: number;
}

export function InvoicePreviewModal({ open, onOpenChange, data, saleId }: InvoicePreviewModalProps) {
  const { data: settings } = useSettings();
  const { data: fetchedSale, isLoading } = useGetSale(saleId || 0, {
    query: { queryKey: getGetSaleQueryKey(saleId || 0), enabled: !!saleId && open }
  });

  const displayData = data || fetchedSale;
  
  const containerRef = useRef<HTMLDivElement>(null);
  const invoiceRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [scaledHeight, setScaledHeight] = useState<number | 'auto'>('auto');

  // Exchange Dialog State
  const [exchangeOpen, setExchangeOpen] = useState(false);
  const [itemToExchange, setItemToExchange] = useState<any>(null);

  // OTP Dialog State
  const [otpDialogOpen, setOtpDialogOpen] = useState(false);
  const [returnOtpToken, setReturnOtpToken] = useState("");
  const [pendingExchangeItem, setPendingExchangeItem] = useState<any>(null);

  const [replacementProductId, setReplacementProductId] = useState<string>("");
  const [replacementKratId, setReplacementKratId] = useState<string>("none");
  const [replacementKgs, setReplacementKgs] = useState<number | "">("");
  const [replacementKrats, setReplacementKrats] = useState<number | "">(1);
  const [replacementPrice, setReplacementPrice] = useState<number | "">("");
  const [exchangePaymentStatus, setExchangePaymentStatus] = useState<"lunas" | "tempo" | "">("");
  
  const { data: products } = useListProducts({}, { query: { queryKey: getListProductsQueryKey(), enabled: exchangeOpen } });
  const { data: categories } = useListCategories({ query: { queryKey: getListCategoriesQueryKey(), enabled: exchangeOpen } });
  const { data: krats } = useGetProductBatchs(parseInt(replacementProductId) || 0, {
    query: { queryKey: getGetProductBatchsQueryKey(parseInt(replacementProductId) || 0), enabled: !!replacementProductId && replacementProductId !== "none" && exchangeOpen }
  });

  const [replacementCategoryId, setReplacementCategoryId] = useState<string>("all");
  
  const filteredReplacementProducts = React.useMemo(() => {
    if (!products) return [];
    if (replacementCategoryId === "all") return products;
    return products.filter(p => p.categoryId === parseInt(replacementCategoryId));
  }, [products, replacementCategoryId]);

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const createReturnMutation = useCreateReturn({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetSaleQueryKey(saleId || 0) });
        queryClient.invalidateQueries({ queryKey: getListSalesQueryKey({}) });
        setExchangeOpen(false);
        toast({ title: "Retur / Tukar Barang Berhasil" });
      },
      onError: (err) => {
        toast({ title: "Gagal memproses retur", variant: "destructive" });
      }
    }
  });

  useEffect(() => {
    if (!open) return;
    
    const updateDimensions = () => {
      if (containerRef.current && invoiceRef.current) {
        const containerWidth = containerRef.current.clientWidth;
        const invoiceWidth = 800;
        if (containerWidth > 0 && containerWidth < invoiceWidth) {
          // Limit minimum scale so it stays readable on mobile and allows scrolling
          const minScale = window.innerWidth < 640 ? 0.8 : 0.5;
          const newScale = Math.max(containerWidth / invoiceWidth, minScale);
          setScale(newScale);
          setScaledHeight(invoiceRef.current.offsetHeight * newScale);
        } else {
          setScale(1);
          setScaledHeight('auto');
        }
      }
    };

    const timeoutId = setTimeout(updateDimensions, 50);
    const resizeObserver = new ResizeObserver(() => updateDimensions());
    
    if (invoiceRef.current) resizeObserver.observe(invoiceRef.current);
    if (containerRef.current) resizeObserver.observe(containerRef.current);
    
    window.addEventListener('resize', updateDimensions);
    
    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('resize', updateDimensions);
      resizeObserver.disconnect();
    };
  }, [open, displayData]);

  const appName = (settings?.["app_name"] || "GUDANG BUAH").replace(/ENKATEXTILE/gi, "GUDANG BUAH").replace(/Gudang Buah/gi, "GUDANG BUAH");
  const appAddress = settings?.["app_address"] || "Jl. Raya Jrebengkembang, Kedolon Gang Griya Azzahra, Karangdadap Kab. Pekalongan";
  const invoiceBankName = settings?.["invoice_bank_name"] || "A.n Spectra Jaya Fashion PT";
  const invoiceBankAccount = settings?.["invoice_bank_account"] || "BCA - 2384564444";
  const invoiceNotes = settings?.["invoice_notes"] || "";

  const handlePrint = () => {
    const printContent = document.getElementById("printable-invoice");
    if (!printContent) return;
    const printContainer = document.createElement("div");
    printContainer.id = "print-container-temp";
    printContainer.appendChild(printContent.cloneNode(true));
    document.body.appendChild(printContainer);
    
    const style = document.createElement("style");
    style.id = "print-style-temp";
    style.innerHTML = `
      @media print {
        body > *:not(#print-container-temp) { display: none !important; }
        body { background: white; }
        #print-container-temp {
          display: block !important; width: 100%; position: absolute; left: 0; top: 0; margin: 0; padding: 0.5cm;
          -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;
        }
        #print-container-temp * { color: #000 !important; background: transparent !important; box-shadow: none !important; border-radius: 0 !important; }
        #print-container-temp .border, #print-container-temp .border-[1.5px] { border: none !important; }
        #print-container-temp .border-b, #print-container-temp .border-b-2, #print-container-temp .border-t { border-color: #000 !important; }
        #print-container-temp .lunas-stamp { border: 2px solid #000 !important; }
        #print-container-temp .lunas-watermark { display: none !important; }
        #print-container-temp .no-print { display: none !important; }
        @page { margin: 0; }
      }
    `;
    document.head.appendChild(style);
    
    setTimeout(() => {
      window.print();
      document.body.removeChild(printContainer);
      document.head.removeChild(style);
    }, 100);
  };

  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownloadJPG = async () => {
    const element = document.getElementById("printable-invoice");
    if (!element) return;
    
    const hideBeforePrint = element.querySelectorAll('.no-print');
    hideBeforePrint.forEach(el => (el as HTMLElement).style.display = 'none');
    
    setIsDownloading(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 100));
      const dataUrl = await htmlToImage.toJpeg(element, {
        quality: 0.95,
        pixelRatio: 2,
        backgroundColor: "#ffffff",
        skipFonts: true,
        width: 800,
        height: element.offsetHeight,
        style: { transform: 'none', margin: '0' }
      });
      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = `Invoice-${displayData?.invoiceNumber || "Draft"}.jpg`;
      link.click();
    } catch (error) {
      console.error("Failed to generate image", error);
    } finally {
      setIsDownloading(false);
      hideBeforePrint.forEach(el => (el as HTMLElement).style.display = '');
    }
  };

  const handleExchangeSubmit = () => {
    if (!itemToExchange) return;
    if (!replacementProductId) {
      toast({ title: "Pilih barang pengganti", variant: "destructive" });
      return;
    }
    
    const returnedSubtotal = parseFloat(itemToExchange.subtotal as string || "0");
    const exchangeSubtotal = (typeof replacementKgs === "number" ? replacementKgs : 0) * (typeof replacementPrice === "number" ? replacementPrice : 0);
    
    const defaultPaymentStatus = displayData?.remainingAmount && parseFloat(displayData.remainingAmount as string) > 0 ? "tempo" : "lunas";
    const paymentStatus = exchangePaymentStatus || defaultPaymentStatus;
    
    createReturnMutation.mutate({
      data: {
        type: "penjualan",
        saleId: saleId,
        customerId: fetchedSale?.customerId || undefined,
        paymentStatus,
        otp_token: returnOtpToken,
        notes: "Tukar barang dari POS",
        returnedItems: [{
          productId: itemToExchange.productId,
          batchId: itemToExchange.batchId || undefined,
          krats: parseFloat(itemToExchange.krats as string || "0"),
          kgs: parseFloat(itemToExchange.kgs as string || "0"),
          pricePerKg: parseFloat(itemToExchange.pricePerKg as string || "0"),
          subtotal: returnedSubtotal
        }],
        exchangedItems: [{
          productId: parseInt(replacementProductId),
          batchId: replacementKratId !== "none" ? parseInt(replacementKratId.replace("r_", "")) : undefined,
          krats: typeof replacementKrats === "number" ? replacementKrats : 0,
          kgs: typeof replacementKgs === "number" ? replacementKgs : 0,
          pricePerKg: typeof replacementPrice === "number" ? replacementPrice : 0,
          subtotal: exchangeSubtotal
        }]
      }
    });
  };

  const handleOtpSuccess = (token: string) => {
    setReturnOtpToken(token);
    if (pendingExchangeItem) {
      setItemToExchange(pendingExchangeItem);
      setReplacementProductId("");
      setReplacementKratId("none");
      setReplacementKgs("");
      setReplacementKrats(1);
      setReplacementPrice("");
      setExchangeOpen(true);
      setPendingExchangeItem(null);
    }
  };

  const openExchangeWithOtpCheck = (item: any) => {
    setPendingExchangeItem(item);
    setOtpDialogOpen(true);
  };

  const activeItems = displayData?.items?.filter((i: any) => !i.isReturned) || [];
  const exchangedItemsArr = (displayData as any)?.exchangedItems || [];
  const allActiveItems = [...activeItems, ...exchangedItemsArr];
  const totalYds = allActiveItems.reduce((sum: number, item: any) => sum + parseFloat(item.kgs as string || "0"), 0) || 0;
  const totalKrats = allActiveItems.reduce((sum: number, item: any) => sum + parseFloat(item.krats as string || "0"), 0) || 0;
  
  const isPaid = parseFloat(displayData?.remainingAmount as string || "0") <= 0 && parseFloat(displayData?.totalAmount as string || "0") > 0 && displayData?.status !== "draft" && displayData?.status !== "held";
  const isDraft = displayData?.status === "draft" || displayData?.status === "held" || !displayData?.invoiceNumber;
  const availableKrats = krats?.filter(r => r.status === 'available') || [];

  const uniqueReturns = useMemo(() => {
    if (!displayData?.items) return [];
    const retMap = new Map();
    displayData.items.forEach((item: any) => {
      if (item.returns && item.returns.length > 0) {
        item.returns.forEach((r: any) => {
          retMap.set(r.id, r);
        });
      }
    });
    return Array.from(retMap.values());
  }, [displayData]);

  const groupedItems = useMemo(() => {
    if (!displayData?.items) return [];
    const groups: Record<string, any> = {};
    
    displayData.items.forEach((item: any) => {
      const key = `${item.productId}_${parseFloat(item.pricePerKg || item.pricePerUnit || "0")}`;
      if (!groups[key]) {
        groups[key] = {
          ...item,
          isGroup: true,
          groupedKrats: [{
             kgs: parseFloat(item.kgs as string || "0"),
             krats: parseFloat(item.krats as string || "0"),
             isReturned: item.isReturned,
             originalItem: item
          }],
          totalKgs: parseFloat(item.kgs as string || "0"),
          totalKrats: parseFloat(item.krats as string || "0"),
          totalSubtotal: parseFloat(item.subtotal as string || "0"),
          hasReturned: item.isReturned,
          allReturns: [...(item.returns || [])]
        };
      } else {
        groups[key].groupedKrats.push({
           kgs: parseFloat(item.kgs as string || "0"),
           krats: parseFloat(item.krats as string || "0"),
           isReturned: item.isReturned,
           originalItem: item
        });
        groups[key].totalKgs += parseFloat(item.kgs as string || "0");
        groups[key].totalKrats += parseFloat(item.krats as string || "0");
        groups[key].totalSubtotal += parseFloat(item.subtotal as string || "0");
        if (item.isReturned) groups[key].hasReturned = true;
        if (item.returns && item.returns.length > 0) {
          groups[key].allReturns.push(...item.returns);
        }
      }
    });
    
    // Deduplicate allReturns by return id
    return Object.values(groups).map((g: any) => {
      g.allReturns = Array.from(new Map(g.allReturns.map((r: any) => [r.id, r])).values());
      return g;
    });
  }, [displayData]);

  return (
    <>
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent
          className="max-w-4xl mx-auto w-full px-0 pb-[max(1rem,env(safe-area-inset-bottom,0px))] pt-0 flex flex-col bg-white"
          style={{ maxHeight: 'calc(95dvh - env(safe-area-inset-top, 0px))' }}
        >
          <DrawerTitle className="sr-only">Preview Invoice</DrawerTitle>
          <DrawerDescription className="sr-only">Preview of your invoice</DrawerDescription>
          {/* ── Gradient Header ── */}
          <div className="sticky top-0 z-50 bg-gradient-to-r from-violet-600 via-violet-500 to-indigo-600 px-5 py-3.5 flex flex-col sm:flex-row gap-3 sm:gap-0 justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center shrink-0">
                <Printer className="w-4 h-4 text-white" strokeWidth={1.5} />
              </div>
              <div>
                <h2 className="text-base font-bold text-white leading-tight">Preview Invoice</h2>
                {displayData?.invoiceNumber && (
                  <p className="text-[11px] text-violet-200 font-mono">{displayData.invoiceNumber}</p>
                )}
              </div>
            </div>
            <div className="flex gap-2 w-full sm:w-auto justify-end">
              <Button
                onClick={handleDownloadJPG}
                disabled={isDownloading}
                className="h-9 rounded-xl bg-white/20 hover:bg-white/30 text-white border border-white/30 backdrop-blur text-xs font-semibold px-3"
              >
                {isDownloading ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Download className="w-3.5 h-3.5 mr-1.5" />}
                Download JPG
              </Button>
              <Button
                onClick={handlePrint}
                autoFocus
                className="h-9 rounded-xl bg-white text-violet-700 hover:bg-violet-50 font-bold text-xs px-4 shadow-sm"
              >
                <Printer className="w-3.5 h-3.5 mr-1.5" /> Cetak Sekarang
              </Button>
            </div>
          </div>
          
          <div ref={containerRef} className="flex-1 p-2 overflow-y-auto overflow-x-auto w-full pb-24 flex justify-center">
            <div style={{ width: scale === 1 ? 'auto' : `${800 * scale}px`, height: scaledHeight === 'auto' ? 'auto' : `${scaledHeight}px`, flexShrink: 0 }}>
              <div id="printable-invoice" ref={invoiceRef} className="p-2 text-slate-800 bg-white origin-top-left" style={{ fontFamily: "'Inter', sans-serif", width: '800px', transform: `scale(${scale})` }}>
              {isLoading && !data ? (
              <div className="flex justify-center items-center h-full pt-12">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : !displayData ? (
              <div className="text-center pt-12 text-muted-foreground">Data tidak tersedia</div>
            ) : (
            <div className="mx-auto text-sm text-slate-800 font-sans leading-snug relative bg-white">
              {isPaid && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0 overflow-hidden">
                  <div className="lunas-watermark text-[150px] font-bold text-green-500/10 rotate-[-30deg] select-none border-8 border-green-500/10 p-8 rounded-3xl tracking-widest uppercase">LUNAS</div>
                </div>
              )}
              {isDraft && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0 overflow-hidden">
                  <div className="lunas-watermark text-[150px] font-bold text-slate-500/10 rotate-[-30deg] select-none border-8 border-slate-500/10 p-8 rounded-3xl tracking-widest uppercase">DRAFT</div>
                </div>
              )}

              {/* Header */}
              <div className="flex justify-between items-start mb-1 pb-1 relative z-10">
                <div className="flex-1 w-0 pr-4">
                  <h1 className="font-bold text-xl text-indigo-900 uppercase tracking-tight truncate">{appName}</h1>
                  <p className="whitespace-pre-line text-xs text-slate-500 uppercase leading-snug break-words">{appAddress.replace(/, /g, ",\n")}</p>
                </div>
                
                <div className="shrink-0 flex flex-col items-center justify-start px-2">
                  <div className="bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full font-bold text-xs uppercase tracking-widest shadow-xs mb-1">Nota Penjualan</div>
                  <div className="font-bold text-slate-900 text-sm tracking-tight flex items-center justify-center gap-1.5 whitespace-nowrap">
                    <QrCode className="w-4 h-4 text-indigo-400 no-print shrink-0" /> No. {displayData.invoiceNumber || "DRAFT"}
                  </div>
                  {isPaid && <div className="lunas-stamp mt-1 inline-block text-green-600 px-2 py-1 font-bold text-xs tracking-widest uppercase rounded">LUNAS</div>}
                  {isDraft && <div className="lunas-stamp mt-1 inline-block text-slate-500 px-2 py-1 font-bold text-xs tracking-widest uppercase rounded">DRAFT</div>}
                </div>
                
                <div className="flex-1 w-0 pl-4 text-right text-xs flex flex-col items-end">
                  <p className="mb-1 text-slate-500 break-words w-full">Pekalongan, <span className="font-semibold text-slate-900">{formatDateTime(displayData.createdAt || new Date().toISOString()).replace(/\./g, ":")}</span></p>
                  <p className="uppercase tracking-widest font-medium text-indigo-400 text-xs mt-1">Kepada Yth.</p>
                  <p className="font-medium uppercase text-sm text-slate-900 leading-none mt-0.5 truncate max-w-full">{displayData.customerName || "UMUM"}</p>
                </div>
              </div>
              
              {/* Table */}
              <div className="w-full rounded-lg overflow-hidden mb-2 relative z-10">
                <table className="w-full text-left border-collapse text-sm">
                  <thead className="bg-linear-to-r from-indigo-50 to-indigo-50/30 border-y-[1.5px] border-slate-800">
                    <tr>
                      <th className="py-1 px-2 font-bold text-indigo-800 uppercase tracking-widest w-8 text-center text-xs">No</th>
                      <th className="py-1 px-2 font-bold text-indigo-800 uppercase tracking-widest text-xs">Nama Barang</th>
                      <th className="py-1 px-2 font-bold text-indigo-800 uppercase tracking-widest text-right text-xs">Jumlah</th>
                      <th className="py-1 px-2 font-bold text-indigo-800 uppercase tracking-widest text-right text-xs">Harga</th>
                      <th className="py-1 px-2 font-bold text-indigo-800 uppercase tracking-widest text-right text-xs">Total</th>
                      {saleId && <th className="no-print w-8"></th>}
                    </tr>
                  </thead>
                <tbody>
                  {groupedItems.map((item: any, index: number) => {
                    const productName = item.productName?.toUpperCase() || "";
                    
                    return (
                      <React.Fragment key={index}>
                      <tr className="align-top border-0 hover:bg-slate-50/50 transition-colors">
                        <td className="py-1 px-2 text-center text-slate-500 font-medium">{index + 1}</td>
                        <td className="py-1 px-2">
                          <div className="flex flex-col gap-0.5">
                            <span className={`font-medium uppercase text-slate-800 ${item.hasReturned ? 'text-slate-500' : ''}`}>
                              {item.categoryName ? <span className="text-xs text-indigo-400 font-medium mr-1">{item.categoryName} /</span> : ''}{productName}
                            </span>
                            <div className="flex flex-wrap gap-1 mt-0 text-xs leading-none text-slate-700 items-center">
                              {item.groupedKrats.map((gr: any, gIdx: number) => (
                                 <span key={gIdx} className={`inline-flex items-center ${gr.isReturned ? 'italic text-slate-400' : ''}`}>
                                   [{Number(Number(gr.kgs).toFixed(2))}{gr.isReturned ? ' RETUR' : ''}]
                                   {!gr.isReturned && saleId && (
                                     <Button 
                                       variant="ghost" size="sm" className="h-4 w-4 ml-0.5 p-0 text-orange-400 hover:text-orange-600 no-print" 
                                       onClick={() => openExchangeWithOtpCheck(gr.originalItem)}
                                       title="Tukar Barang Ini"
                                     >
                                       <RefreshCcw className="h-3 w-3" />
                                     </Button>
                                   )}
                                 </span>
                              ))}
                            </div>
                          </div>
                        </td>
                        <td className="py-1 px-2 text-right whitespace-nowrap">
                          <span className="font-semibold text-slate-800">{Number(Number(item.totalKgs).toFixed(2))} {(item as any).primaryUnit || 'M'}</span>
                          <span className="text-slate-400 ml-1 text-xs">/ {item.totalKrats} {(item as any).secondaryUnit || 'Krat'}</span>
                        </td>
                        <td className="py-1 px-2 text-right font-semibold text-slate-600">
                          {new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(parseFloat(item.pricePerKg as string || item.pricePerUnit as string || "0"))}
                        </td>
                        <td className="py-1 px-2 text-right font-medium text-slate-900">
                          {new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(item.totalSubtotal)}
                        </td>
                        {saleId && <td className="no-print text-center px-1"></td>}
                      </tr>
                      {item.allReturns && item.allReturns.length > 0 && item.allReturns.map((ret: any, retIdx: number) => {
                        const diff = parseFloat(ret.differenceAmount || "0");
                        const pStatus = ret.paymentStatus === 'lunas' ? 'LUNAS' : ret.paymentStatus === 'tempo' ? 'MASUK PIUTANG' : '';
                        const statusTxt = pStatus ? ` [${pStatus}]` : '';
                        let diffText = "TIDAK ADA PENAMBAHAN HARGA";
                        let diffSign = "";
                        let diffColor = "text-slate-500";
                        if (diff > 0) {
                          diffText = `KURANG PEMBAYARAN${statusTxt}: RP ${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(diff)}`;
                          diffSign = "+";
                          diffColor = "text-rose-600";
                        } else if (diff < 0) {
                          diffText = `KEMBALIAN / REFUND${statusTxt}: RP ${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(Math.abs(diff))}`;
                          diffSign = "-";
                          diffColor = "text-emerald-600";
                        }

                        return (
                          <React.Fragment key={`ret_${index}_${retIdx}`}>
                            {ret.exchangedItems && ret.exchangedItems.length > 0 ? ret.exchangedItems.map((exc: any, excIdx: number) => (
                              <tr key={`exc_${index}_${retIdx}_${excIdx}`} className="align-top border-0 bg-green-50/30">
                                <td className="py-1 px-2"></td>
                                <td className="py-1 px-3">
                                  <div className="flex items-center gap-1.5">
                                    <CornerDownRight className="w-3 h-3 text-green-500" />
                                    <span className="text-[11px] font-bold text-green-700 uppercase mr-1 tracking-wider">TUKAR</span>
                                    <span className="font-medium uppercase text-xs text-slate-700">{exc.productName?.toUpperCase()}</span>
                                  </div>
                                </td>
                                <td className="py-1 px-3 text-right whitespace-nowrap">
                                  <span className="font-semibold text-slate-700">{Number(parseFloat(exc.kgs || "0").toFixed(2))} {(exc as any).primaryUnit || 'M'}</span>
                                  <span className="text-slate-400 ml-1 text-xs">/ {exc.krats} {(exc as any).secondaryUnit || 'Krat'}</span>
                                </td>
                                <td className="py-1 px-3 text-right font-semibold text-slate-600">
                                  {new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(parseFloat(exc.pricePerKg as string || "0"))}
                                </td>
                                <td className="py-1 px-3 text-right font-medium text-slate-800">
                                  {new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(parseFloat(exc.subtotal as string || "0"))}
                                </td>
                                {saleId && <td className="no-print"></td>}
                              </tr>
                            )) : (
                              <tr key={`exc_none_${index}_${retIdx}`} className="align-top border-0 bg-amber-50/30">
                                <td className="py-1 px-2"></td>
                                <td colSpan={saleId ? 5 : 4} className="py-1 px-3">
                                  <div className="flex items-center gap-1.5">
                                    <CornerDownRight className="w-3 h-3 text-amber-500" />
                                    <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">HANYA RETUR</span>
                                  </div>
                                </td>
                              </tr>
                            )}
                            
                            {diffText !== "TIDAK ADA PENAMBAHAN HARGA" && (
                              <tr className="align-top border-0 bg-slate-50/50">
                                <td className="py-1 px-2"></td>
                                <td colSpan={saleId ? 5 : 4} className="py-1 px-3">
                                  <div className="flex items-center gap-1.5 justify-end pt-1 mt-0.5">
                                    <span className={`text-[11px] font-bold uppercase tracking-wider ${diffColor}`}>{diffText}</span>
                                  </div>
                                </td>
                              </tr>
                            )}

                          </React.Fragment>
                        );
                      })}
                    </React.Fragment>
                  );
                })}
                </tbody>
                </table>
              </div>

              {/* Footer */}
              <div className="flex justify-between items-start w-full text-sm mt-2 relative z-10">
                <div className="w-[50%] flex flex-col justify-between">
                  <div className="bg-linear-to-br from-indigo-50 to-indigo-100/50 rounded-lg p-2 w-11/12 mb-2">
                    <div className="flex items-center gap-1.5 mb-1">
                      <div className="w-5 h-5 rounded bg-indigo-200 flex items-center justify-center text-indigo-700 font-medium text-xs">Rp</div>
                      <p className="text-indigo-900 font-medium text-xs uppercase tracking-wider">Informasi Transfer</p>
                    </div>
                    <p className="text-indigo-800 font-medium font-mono tracking-wider mt-0.5 text-xs">{invoiceBankAccount}</p>
                    <p className="text-indigo-600 text-xs font-medium leading-none mt-1">{invoiceBankName}</p>
                    {invoiceNotes && (
                      <p className="text-slate-600 text-xs mt-1 italic pt-1">Catatan: {invoiceNotes}</p>
                    )}
                  </div>

                  <div className="flex text-center w-full justify-between font-medium">
                    <div className="w-[45%] flex flex-col items-center">
                      <p className="mb-8 text-slate-500 text-xs">Tanda Terima,</p>
                      <div className="w-full mb-0.5"></div>
                      <p className="text-xs text-slate-400 uppercase tracking-widest">Pelanggan</p>
                    </div>
                    <div className="w-[45%] flex flex-col items-center">
                      <p className="mb-8 text-slate-500 text-xs">Hormat Kami,</p>
                      <div className="w-full mb-0.5"></div>
                      <p className="text-xs font-medium text-slate-800 uppercase tracking-tight">{appName}</p>
                    </div>
                  </div>
                </div>

                <div className="w-[45%] rounded-lg overflow-hidden bg-white shadow-xs">
                  <table className="w-full text-right text-sm border-collapse">
                    <tbody>
                      <tr className="bg-slate-50">
                        <td className="py-0 px-2 font-semibold text-slate-600 text-xs uppercase tracking-wider w-1/2">Total Kuantitas</td>
                        <td className="py-0 px-2 font-medium text-slate-800 text-left">
                          {totalYds.toFixed(2)} {(displayData.items?.[0] as any)?.primaryUnit || 'M'} / {totalKrats} Krat
                        </td>
                      </tr>
                      
                      {(() => {
                        const hasReturns = uniqueReturns.length > 0;
                        if (!hasReturns) return null;
                        const diffTotal = uniqueReturns.reduce((sum: number, ret: any) => sum + parseFloat(ret.differenceAmount || "0"), 0);
                        const baseTotal = parseFloat(displayData.totalAmount as string || "0") - diffTotal; // Backend now returns saleGross, so we subtract diff to get original
                        const totalRetVal = uniqueReturns.reduce((sum: number, ret: any) => sum + parseFloat(ret.totalReturnedValue || "0"), 0);
                        const totalExcVal = uniqueReturns.reduce((sum: number, ret: any) => sum + parseFloat(ret.totalExchangedValue || "0"), 0);
                        return (
                          <>
                            <tr className="">
                              <td className="py-0 px-2 font-medium text-slate-500 text-xs">Total Awal</td>
                              <td className="py-0 px-2 font-medium text-slate-800">Rp {new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(baseTotal)}</td>
                            </tr>
                            <tr className="">
                              <td className="py-0 px-2 font-medium text-rose-600 text-xs">Dikembalikan (Retur)</td>
                              <td className="py-0 px-2 font-medium text-rose-600">- Rp {new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(totalRetVal)}</td>
                            </tr>
                            <tr className="">
                              <td className="py-0 px-2 font-medium text-emerald-600 text-xs">Pengganti (Tukar)</td>
                              <td className="py-0 px-2 font-medium text-emerald-600">+ Rp {new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(totalExcVal)}</td>
                            </tr>
                            
                            {diffTotal < 0 && (
                              <tr className="bg-emerald-50/60">
                                <td className="py-0 px-2 font-bold text-emerald-700 text-xs uppercase tracking-wider">Kembalian / Refund</td>
                                <td className="py-0 px-2 font-bold text-emerald-700">Rp {new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(Math.abs(diffTotal))}</td>
                              </tr>
                            )}
                            {diffTotal > 0 && (
                              <tr className="bg-rose-50/60">
                                <td className="py-0 px-2 font-bold text-rose-700 text-xs uppercase tracking-wider">Kurang Bayar</td>
                                <td className="py-0 px-2 font-bold text-rose-700">Rp {new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(diffTotal)}</td>
                              </tr>
                            )}
                          </>
                        );
                      })()}

                      <tr className="bg-indigo-600 text-white">
                        <td className="py-0.5 px-2 font-bold text-xs uppercase tracking-widest text-indigo-100">Grand Total</td>
                        <td className="py-0.5 px-2 font-bold text-sm tracking-tight">
                          Rp {new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(parseFloat(displayData.totalAmount as string || "0"))}
                        </td>
                      </tr>
                      
                      <tr>
                        <td className="py-0 px-2 font-medium text-slate-500 text-xs">Di Bayar</td>
                        <td className="py-0 px-2 font-medium text-slate-800">
                          Rp {new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(parseFloat(displayData.paidAmount as string || "0"))}
                        </td>
                      </tr>
                      <tr className="">
                        <td className="py-0 px-2 font-medium text-slate-500 text-xs">Sisa Bayar</td>
                        <td className="py-0 px-2 font-medium text-rose-600">
                          Rp {new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(parseFloat(displayData.remainingAmount as string || "0"))}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* ─── Riwayat Cicilan / Tahapan Pembayaran ─────────────────── */}
              {(() => {
                const history = (displayData as any).paymentHistory;
                if (!history || history.length === 0) return null;
                return (
                  <div className="mt-3 relative z-10 pt-2">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <div className="w-4 h-4 rounded bg-indigo-100 flex items-center justify-center">
                        <Clock className="w-2.5 h-2.5 text-indigo-600" />
                      </div>
                      <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-widest">Riwayat Tahapan Pembayaran</span>
                    </div>
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr className="bg-indigo-50 border-y-[1.5px] border-slate-800">
                          <th className="py-0.5 px-2 text-left font-bold text-indigo-700 text-[10px] uppercase tracking-wider w-6">No</th>
                          <th className="py-0.5 px-2 text-left font-bold text-indigo-700 text-[10px] uppercase tracking-wider">Tanggal &amp; Waktu</th>
                          <th className="py-0.5 px-2 text-left font-bold text-indigo-700 text-[10px] uppercase tracking-wider">Metode</th>
                          <th className="py-0.5 px-2 text-right font-bold text-indigo-700 text-[10px] uppercase tracking-wider">Nominal</th>
                          <th className="py-0.5 px-2 text-left font-bold text-indigo-700 text-[10px] uppercase tracking-wider">Ket.</th>
                        </tr>
                      </thead>
                      <tbody>
                        {history.map((p: any, idx: number) => {
                          const dt = new Date(p.paidAt);
                          const dateStr = dt.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
                          const timeStr = dt.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
                          const methodLabel: Record<string, string> = {
                            tunai: 'Tunai', transfer: 'Transfer', cashless: 'Cashless/QRIS'
                          };
                          return (
                            <tr key={p.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                              <td className="py-0.5 px-2 text-slate-500 font-medium">{p.step}</td>
                              <td className="py-0.5 px-2 text-slate-700 font-medium whitespace-nowrap">{dateStr} <span className="text-indigo-500">{timeStr}</span></td>
                              <td className="py-0.5 px-2">
                                <span className="bg-indigo-50 text-indigo-700 px-1.5 py-0 rounded font-semibold text-[10px] uppercase">
                                  {methodLabel[p.paymentMethod] || p.paymentMethod}
                                </span>
                              </td>
                              <td className="py-0.5 px-2 text-right font-bold text-emerald-700">
                                Rp {new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(p.amount)}
                              </td>
                              <td className="py-0.5 px-2 text-slate-500 text-[10px] italic">{p.notes || '-'}</td>
                            </tr>
                          );
                        })}
                        <tr className="bg-emerald-50">
                          <td colSpan={3} className="py-0.5 px-2 text-right font-bold text-emerald-700 text-[10px] uppercase tracking-wider">Total Terbayar (Cicilan)</td>
                          <td className="py-0.5 px-2 text-right font-bold text-emerald-700">
                            Rp {new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(history.reduce((s: number, p: any) => s + p.amount, 0))}
                          </td>
                          <td></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                );
              })()}
              </div>
            )}
            </div>
          </div>
          </div>
        </DrawerContent>
      </Drawer>

      {/* Exchange / Retur Dialog */}
      <Dialog open={exchangeOpen} onOpenChange={setExchangeOpen}>
        <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden border-0 shadow-2xl" aria-describedby={undefined}>
          <DialogTitle className="sr-only">Retur Barang</DialogTitle>
          <div className="bg-gradient-to-r from-violet-600 via-violet-500 to-indigo-600 px-6 py-4 flex items-center gap-3">
            <span className="text-white font-semibold">Tukar Barang (Retur)</span>
          </div>
          <div className="space-y-4 pt-4 px-6 pb-6">
            <div className="bg-orange-50 border border-orange-100 p-3 rounded-lg flex flex-col gap-1">
              <span className="text-xs font-semibold text-orange-800 uppercase tracking-wider">Barang yang dikembalikan</span>
              <span className="font-bold text-sm">{itemToExchange?.productName}</span>
              <span className="text-xs text-orange-700">
                {parseFloat(itemToExchange?.kgs || 0)} {(itemToExchange as any)?.primaryUnit || 'M'} / {parseFloat(itemToExchange?.krats || 0)} {(itemToExchange as any)?.secondaryUnit || 'Krat'} (Rp {new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(parseFloat(itemToExchange?.pricePerKg || itemToExchange?.pricePerUnit || 0))})
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Kategori Pengganti</label>
                <Select value={replacementCategoryId} onValueChange={(val: string) => {
                  setReplacementCategoryId(val);
                  setReplacementProductId("");
                  setReplacementKratId("none");
                }}>
                  <SelectTrigger><SelectValue placeholder="Semua Kategori" /></SelectTrigger>
                  <SelectContent className="z-[400]">
                    <SelectGroup className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 p-2">
                      <SelectItem value="all" className="border shadow-sm hover:border-primary/50 py-3 h-auto text-sm justify-center text-center font-semibold">Semua Kategori</SelectItem>
                      {categories?.map(c => (
                        <SelectItem key={c.id} value={c.id.toString()} className="border shadow-sm hover:border-primary/50 py-3 h-auto text-sm justify-center text-center break-words">
                          <span className="font-semibold truncate w-full">{c.name}</span>
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Barang Pengganti</label>
                <Select value={replacementProductId} onValueChange={(val: string) => {
                  setReplacementProductId(val);
                  setReplacementKratId("none");
                  const prod = products?.find(p => p.id === parseInt(val));
                  if (prod) setReplacementPrice(parseFloat(String(prod.pricePerKg)));
                }}>
                  <SelectTrigger><SelectValue placeholder="Pilih barang..." /></SelectTrigger>
                  <SelectContent className="z-[400]">
                    <SelectGroup className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 p-2">
                      {filteredReplacementProducts?.map(p => (
                        <SelectItem key={p.id} value={p.id.toString()} className="border shadow-sm hover:border-primary/50 py-3 h-auto text-sm justify-center text-center break-words">
                          <span className="font-semibold truncate w-full" title={p.name}>{p.name}</span>
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Pilih Krat (Opsional)</label>
              <Select value={replacementKratId} onValueChange={(val: string) => {
                setReplacementKratId(val);
                if (val !== "none") {
                  const krat = availableKrats.find(r => r.id === parseInt(val.replace("r_", "")));
                  if (krat) {
                    setReplacementKgs(parseFloat(String(krat.currentWeight)));
                    setReplacementKrats(1);
                  }
                }
              }} disabled={!replacementProductId || availableKrats.length === 0}>
                <SelectTrigger><SelectValue placeholder="Bebas Kgan" /></SelectTrigger>
                <SelectContent className="z-[400]">
                  <SelectItem value="none" className="border shadow-sm hover:border-primary/50 mb-2 w-full text-base justify-center">Bebas Kgan</SelectItem>
                  {availableKrats.length > 0 && (
                    <SelectGroup className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 p-2">
                      {availableKrats.map(r => (
                        <SelectItem key={`r_${r.id}`} value={`r_${r.id}`} className="border shadow-sm hover:border-primary/50 py-3 h-auto justify-center text-center">
                          <div className="flex flex-col items-center gap-1 w-full min-w-0">
                            <span className="font-semibold text-base">{r.currentWeight}m</span>
                            <span className="text-[10px] text-muted-foreground whitespace-normal break-all text-center leading-tight">
                              {r.barcode}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Jml Kg</label>
                <Input type="number" step="any" value={replacementKgs} onChange={e => setReplacementKgs(e.target.value === "" ? "" : parseFloat(e.target.value))} disabled={!!replacementKratId && replacementKratId !== "none"} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Jml Krat</label>
                <Input type="number" step="any" value={replacementKrats} onChange={e => setReplacementKrats(e.target.value === "" ? "" : parseFloat(e.target.value))} disabled={!!replacementKratId && replacementKratId !== "none"} />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Harga/Kg Pengganti</label>
              <Input type="number" step="any" value={replacementPrice} onChange={e => setReplacementPrice(e.target.value === "" ? "" : parseFloat(e.target.value))} />
            </div>

            {/* Payment Status Selector if there is an underpayment */}
            {(() => {
              const retSubtotal = parseFloat(itemToExchange?.subtotal as string || "0");
              const exSubtotal = (typeof replacementKgs === "number" ? replacementKgs : 0) * (typeof replacementPrice === "number" ? replacementPrice : 0);
              const diff = exSubtotal - retSubtotal;
              
              if (diff > 0) {
                return (
                  <div className="space-y-2 bg-rose-50 p-3 rounded-lg border border-rose-100 mt-2">
                    <div className="flex justify-between items-center mb-2">
                      <label className="text-sm font-bold text-rose-800">Kekurangan Bayar</label>
                      <span className="font-bold text-rose-600">Rp {new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(diff)}</span>
                    </div>
                    <label className="text-xs font-medium text-rose-700">Status Pembayaran Selisih</label>
                    <Select value={exchangePaymentStatus || (displayData?.remainingAmount && parseFloat(displayData.remainingAmount as string) > 0 ? "tempo" : "lunas")} onValueChange={(val: "lunas" | "tempo") => setExchangePaymentStatus(val)}>
                      <SelectTrigger className="bg-white"><SelectValue placeholder="Pilih status" /></SelectTrigger>
                      <SelectContent className="z-[400]">
                        <SelectItem value="lunas">Lunas (Bayar Sekarang)</SelectItem>
                        <SelectItem value="tempo">Tempo (Masuk Piutang)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                );
              }
              return null;
            })()}

          </div>
          <DialogFooter className="mt-4 px-6 pb-6">
            <Button variant="outline" onClick={() => setExchangeOpen(false)}>Batal</Button>
            <Button onClick={handleExchangeSubmit} disabled={createReturnMutation.isPending || !replacementProductId || !replacementKgs}>
              {createReturnMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Simpan Retur
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* OTP Authorization Dialog */}
      <OtpDialog 
        open={otpDialogOpen} 
        onOpenChange={setOtpDialogOpen} 
        onSuccess={handleOtpSuccess} 
      />
    </>
  );
}



