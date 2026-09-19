import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { formatRupiah, formatDate, formatDateTime } from "@/lib/utils";
import { useSettings } from "@/hooks/useSettings";
import { useState, useRef, useEffect } from "react";
import * as htmlToImage from "html-to-image";
import { Printer, Loader2, Download, RefreshCcw } from "lucide-react";
import { useGetReturn, getGetReturnQueryKey } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";

interface ReturnInvoiceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  returnId?: number;
}

export function ReturnInvoiceModal({ open, onOpenChange, returnId }: ReturnInvoiceModalProps) {
  const { data: settings } = useSettings();
  const { data: returnDoc, isLoading } = useGetReturn(returnId || 0, {
    query: { queryKey: getGetReturnQueryKey(returnId || 0), enabled: !!returnId && open }
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const invoiceRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [scaledHeight, setScaledHeight] = useState<number | "auto">("auto");

  useEffect(() => {
    if (!open) return;
    
    const updateDimensions = () => {
      if (containerRef.current && invoiceRef.current) {
        const containerWidth = containerRef.current.clientWidth;
        const invoiceWidth = 800; // fixed invoice width
        if (containerWidth > 0 && containerWidth < invoiceWidth) {
          const newScale = containerWidth / invoiceWidth;
          setScale(newScale);
          setScaledHeight(invoiceRef.current.offsetHeight * newScale);
        } else {
          setScale(1);
          setScaledHeight("auto");
        }
      }
    };

    const timeoutId = setTimeout(updateDimensions, 50);
    const resizeObserver = new ResizeObserver(() => updateDimensions());
    
    if (invoiceRef.current) resizeObserver.observe(invoiceRef.current);
    if (containerRef.current) resizeObserver.observe(containerRef.current);
    window.addEventListener("resize", updateDimensions);
    
    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener("resize", updateDimensions);
      resizeObserver.disconnect();
    };
  }, [open, returnDoc]);

  const appName = (settings?.["app_name"] || "ENKA TEXTILE").replace(/ENKATEXTILE/gi, "ENKA TEXTILE").replace(/EnkaTextile/gi, "ENKA TEXTILE");
  const appAddress = settings?.["app_address"] || "Alamat belum diatur (Ubah di Pengaturan)";

  const handlePrint = () => {
    const printContent = document.getElementById("printable-return");
    if (!printContent) return;
    
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = printContent.innerHTML;
    
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    
    printWindow.document.write(`
      <html>
        <head>
          <title>Print Nota Retur</title>
          <style>
            @import url("https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;900&display=swap");
            body { 
              font-family: "Inter", sans-serif; 
              margin: 0; 
              padding: 20px;
              color: #000;
              background: #fff;
            }
            .invoice-container { max-width: 800px; margin: 0 auto; }
            * { box-sizing: border-box; }
            .grid { display: grid; }
            .flex { display: flex; }
            .items-center { align-items: center; }
            .justify-between { justify-content: space-between; }
            .text-center { text-align: center; }
            .text-right { text-align: right; }
            .font-bold { font-weight: 700; }
            .font-black { font-weight: 900; }
            .text-sm { font-size: 14px; }
            .text-xs { font-size: 12px; }
            .text-muted { color: #666; }
            .border-b { border-bottom: 1px solid #ddd; }
            .border-t { border-top: 1px solid #ddd; }
            .pb-4 { padding-bottom: 1rem; }
            .pt-4 { padding-top: 1rem; }
            .mb-2 { margin-bottom: 0.5rem; }
            .mb-4 { margin-bottom: 1rem; }
            .mb-8 { margin-bottom: 2rem; }
            .p-4 { padding: 1rem; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 1.5rem; }
            th { border-bottom: 2px solid #000; text-align: left; padding: 8px; font-size: 12px; text-transform: uppercase; }
            th.right { text-align: right; }
            td { padding: 8px; font-size: 13px; border-bottom: 1px solid #eee; }
            td.right { text-align: right; }
            .watermark { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-30deg); font-size: 8rem; font-weight: 900; color: rgba(220, 38, 38, 0.05); z-index: -1; text-transform: uppercase; letter-spacing: 0.2em; }
            @media print {
              body { padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            }
          </style>
        </head>
        <body>
          <div class="invoice-container">
            ${tempDiv.innerHTML}
          </div>
          <script>
            setTimeout(() => {
              window.print();
              window.close();
            }, 300);
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  if (!returnDoc && !isLoading) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="mx-auto w-full max-w-2xl px-4 sm:px-6 pb-[max(1.5rem,env(safe-area-inset-bottom,0px))] pt-2 flex flex-col" style={{ maxHeight: "calc(95dvh - env(safe-area-inset-top, 0px))" }}>
          <div className="flex items-center justify-center h-full">Data nota retur tidak ditemukan.</div>
        </DrawerContent>
      </Drawer>
    );
  }

  const isSaleReturn = returnDoc?.type === "penjualan";
  const partnerName = isSaleReturn ? (returnDoc as any)?.customer?.name : (returnDoc as any)?.supplier?.name;
  const difference = Number(returnDoc?.differenceAmount) || 0;

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="mx-auto w-full max-w-4xl pb-[max(1rem,env(safe-area-inset-bottom,0px))] pt-0 bg-slate-100 flex flex-col" style={{ maxHeight: "calc(95dvh - env(safe-area-inset-top, 0px))" }}>
        <DrawerTitle className="sr-only">Preview Nota Retur</DrawerTitle>
        
        {/* Gradient Header */}
        <div className="bg-gradient-to-r from-violet-600 via-violet-500 to-indigo-600 px-6 py-4 flex items-center justify-between gap-3 shrink-0 sticky top-0 z-20 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
              <Printer className="w-5 h-5 text-white" strokeWidth={1.5} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white leading-tight">Preview Nota Retur</h2>
              <p className="text-violet-200 text-[11px] sm:text-xs">Periksa kembali nota retur sebelum dicetak</p>
            </div>
          </div>
          <Button onClick={handlePrint} className="hidden sm:flex gap-2 rounded-[12px] px-6 shadow-sm bg-white text-violet-700 hover:bg-violet-50 hover:text-violet-800 font-bold"><Printer className="w-4 h-4" /> Cetak Sekarang</Button>
          <Button size="icon" onClick={handlePrint} className="sm:hidden rounded-xl bg-white text-violet-700 hover:bg-violet-50 shadow-sm"><Printer className="w-4 h-4" /></Button>
        </div>

        <div className="flex-1 overflow-y-auto w-full p-4 md:p-8 bg-slate-50/50 block" ref={containerRef}>
          {isLoading ? (
            <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-violet-500" /></div>
          ) : (
            <div 
              ref={invoiceRef}
              className="bg-white shadow-[0_8px_30px_rgb(0,0,0,0.08)] rounded-xl relative overflow-hidden w-full max-w-4xl mx-auto mb-8"
            >
              <div id="printable-return" className="p-6 sm:p-8 md:p-12 h-full flex flex-col relative bg-white">
                <div className="watermark" style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%) rotate(-30deg)", fontSize: "clamp(3rem, 10vw, 8rem)", fontWeight: 900, color: "rgba(220, 38, 38, 0.05)", zIndex: 0, textTransform: "uppercase", letterSpacing: "0.2em", pointerEvents: "none", whiteSpace: "nowrap" }}>
                  RETUR {returnDoc?.paymentStatus === "lunas" ? "LUNAS" : "TEMPO"}
                </div>
                
                <div className="relative z-10 flex-1">
                  {/* Header */}
                  <div className="flex flex-col sm:flex-row justify-between items-start border-b-2 border-red-500 pb-6 mb-6 gap-6">
                    <div className="w-full sm:w-auto text-center sm:text-left">
                      <div className="inline-flex flex-col items-center sm:items-start mb-2">
                        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight uppercase">{appName}</h1>
                        <div className="text-xs font-bold text-slate-800 tracking-tight mt-0.5 uppercase">PT. Spectra Jaya Fashion</div>
                      </div>
                      <div className="text-sm text-slate-500 mt-2 max-w-[280px] mx-auto sm:mx-0 leading-relaxed">{appAddress}</div>
                    </div>
                    <div className="w-full sm:w-auto text-center sm:text-right">
                      <div className="text-lg sm:text-xl font-bold text-red-600 uppercase tracking-widest mb-2 border-2 border-red-600 px-4 py-1 inline-block rounded-md">NOTA RETUR</div>
                      <div className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight">{returnDoc?.returnNumber}</div>
                      <div className="text-xs sm:text-sm text-slate-500 mt-2">Tanggal: {formatDateTime(returnDoc?.createdAt || new Date().toISOString())}</div>
                      <div className="text-xs sm:text-sm text-slate-700 font-medium mt-1 uppercase">Tipe: {isSaleReturn ? "Penjualan" : "Pembelian"}</div>
                    </div>
                  </div>

                  {/* Customer Info */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex-1">
                      <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">{isSaleReturn ? "Pelanggan" : "Supplier"}</div>
                      <div className="text-base sm:text-lg font-bold text-slate-800">{partnerName || "Umum"}</div>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex-1">
                      <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Status Penyelesaian</div>
                      <div className="text-base sm:text-lg font-bold text-slate-800 uppercase">{returnDoc?.paymentStatus === "lunas" ? "Kas Tunai" : "Potong Saldo"}</div>
                    </div>
                  </div>

                  {/* Items Tables */}
                  {(returnDoc?.returnedItems?.length || 0) > 0 && (
                    <div className="mb-8 overflow-hidden">
                      <h3 className="font-bold text-red-600 mb-2 uppercase text-sm tracking-wider">Barang Dikembalikan (Masuk Toko)</h3>
                      <div className="overflow-x-auto pb-2">
                        <table style={{ width: "100%", minWidth: "600px", borderCollapse: "collapse" }}>
                          <thead>
                            <tr>
                              <th style={{ borderBottom: "2px solid #000", textAlign: "left", padding: "8px", fontSize: "12px", textTransform: "uppercase" }}>Nama Barang</th>
                              <th style={{ borderBottom: "2px solid #000", textAlign: "right", padding: "8px", fontSize: "12px", textTransform: "uppercase" }}>Kuantitas</th>
                              <th style={{ borderBottom: "2px solid #000", textAlign: "right", padding: "8px", fontSize: "12px", textTransform: "uppercase" }}>Harga</th>
                              <th style={{ borderBottom: "2px solid #000", textAlign: "right", padding: "8px", fontSize: "12px", textTransform: "uppercase" }}>Subtotal</th>
                            </tr>
                          </thead>
                          <tbody>
                            {returnDoc?.returnedItems?.map((item: any, i: number) => (
                              <tr key={i}>
                                <td style={{ padding: "8px", fontSize: "13px", borderBottom: "1px solid #eee" }}>
                                  <div className="font-bold">{item.productName}</div>
                                </td>
                                <td style={{ textAlign: "right", padding: "8px", fontSize: "13px", borderBottom: "1px solid #eee" }}>
                                  {Number(item.kgs) > 0 ? `${Number(item.kgs)} ${item.primaryUnit || 'M'}` : ""} {Number(item.krats) > 0 ? `(${Number(item.krats)} ${item.secondaryUnit || 'Krat'})` : ""}
                                </td>
                                <td style={{ textAlign: "right", padding: "8px", fontSize: "13px", borderBottom: "1px solid #eee" }}>{formatRupiah(Number(item.pricePerKg))}</td>
                                <td style={{ textAlign: "right", padding: "8px", fontSize: "13px", borderBottom: "1px solid #eee", fontWeight: "bold" }}>{formatRupiah(Number(item.subtotal))}</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr>
                              <td colSpan={3} style={{ textAlign: "right", padding: "12px 8px", fontSize: "13px", fontWeight: "bold" }}>Nilai Barang Kembali:</td>
                              <td style={{ textAlign: "right", padding: "12px 8px", fontSize: "14px", fontWeight: "900", color: "#dc2626" }}>{formatRupiah(Number(returnDoc?.totalReturnedValue))}</td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>
                  )}

                  {(returnDoc?.exchangedItems?.length || 0) > 0 && (
                    <div className="mb-8 overflow-hidden">
                      <h3 className="font-bold text-blue-600 mb-2 uppercase text-sm tracking-wider">Barang Pengganti (Keluar Toko)</h3>
                      <div className="overflow-x-auto pb-2">
                        <table style={{ width: "100%", minWidth: "600px", borderCollapse: "collapse" }}>
                        <thead>
                          <tr>
                            <th style={{ borderBottom: "2px solid #000", textAlign: "left", padding: "8px", fontSize: "12px", textTransform: "uppercase" }}>Nama Barang</th>
                            <th style={{ borderBottom: "2px solid #000", textAlign: "right", padding: "8px", fontSize: "12px", textTransform: "uppercase" }}>Kuantitas</th>
                            <th style={{ borderBottom: "2px solid #000", textAlign: "right", padding: "8px", fontSize: "12px", textTransform: "uppercase" }}>Harga</th>
                            <th style={{ borderBottom: "2px solid #000", textAlign: "right", padding: "8px", fontSize: "12px", textTransform: "uppercase" }}>Subtotal</th>
                          </tr>
                        </thead>
                        <tbody>
                          {returnDoc?.exchangedItems?.map((item: any, i: number) => (
                            <tr key={i}>
                              <td style={{ padding: "8px", fontSize: "13px", borderBottom: "1px solid #eee" }}>
                                <div className="font-bold">{item.productName}</div>
                              </td>
                              <td style={{ textAlign: "right", padding: "8px", fontSize: "13px", borderBottom: "1px solid #eee" }}>
                                {Number(item.kgs) > 0 ? `${Number(item.kgs)} ${item.primaryUnit || 'M'}` : ""} {Number(item.krats) > 0 ? `(${Number(item.krats)} ${item.secondaryUnit || 'Krat'})` : ""}
                              </td>
                              <td style={{ textAlign: "right", padding: "8px", fontSize: "13px", borderBottom: "1px solid #eee" }}>{formatRupiah(Number(item.pricePerKg))}</td>
                              <td style={{ textAlign: "right", padding: "8px", fontSize: "13px", borderBottom: "1px solid #eee", fontWeight: "bold" }}>{formatRupiah(Number(item.subtotal))}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr>
                            <td colSpan={3} style={{ textAlign: "right", padding: "12px 8px", fontSize: "13px", fontWeight: "bold" }}>Nilai Barang Pengganti:</td>
                            <td style={{ textAlign: "right", padding: "12px 8px", fontSize: "14px", fontWeight: "900", color: "#2563eb" }}>{formatRupiah(Number(returnDoc?.totalExchangedValue))}</td>
                          </tr>
                        </tfoot>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Summary */}
                  <div className="flex justify-end pt-6 border-t-2 border-slate-200 mt-auto">
                    <div className="w-full sm:w-[350px] bg-slate-50 p-6 rounded-xl border border-slate-200 shadow-sm">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-slate-500 font-medium uppercase text-xs">Nilai Barang Kembali</span>
                        <span className="font-bold text-slate-800">{formatRupiah(Number(returnDoc?.totalReturnedValue))}</span>
                      </div>
                      <div className="flex justify-between items-center pb-4 border-b border-slate-200 mb-4">
                        <span className="text-slate-500 font-medium uppercase text-xs">Nilai Barang Pengganti</span>
                        <span className="font-bold text-slate-800">{formatRupiah(Number(returnDoc?.totalExchangedValue))}</span>
                      </div>
                      
                      <div className="flex justify-between items-center bg-slate-900 text-white p-4 rounded-lg mb-2">
                        <span className="font-bold uppercase text-sm">Total Selisih</span>
                        <span className="font-black text-xl">{difference > 0 ? "+" : ""}{formatRupiah(difference)}</span>
                      </div>
                      <div className="text-right text-[10px] text-slate-500">
                        {difference > 0 ? "Pelanggan Kurang Bayar" : difference < 0 ? "Toko Lebih Bayar / Kembali" : "Pas"}
                      </div>
                    </div>
                  </div>

                  {/* Footer Signatures */}
                  <div className="flex justify-between items-end mt-16 pt-8 border-t border-slate-200">
                    <div className="text-center w-48">
                      <div className="mb-16 text-sm font-medium text-slate-500">Tanda Terima,</div>
                      <div className="border-b border-slate-400 pb-1 font-bold text-slate-800"></div>
                      <div className="text-xs text-slate-500 mt-1 uppercase">Pelanggan</div>
                    </div>
                    <div className="text-center w-48">
                      <div className="mb-16 text-sm font-medium text-slate-500">Hormat Kami,</div>
                      <div className="border-b border-slate-400 pb-1 font-bold text-slate-800"></div>
                      <div className="text-xs font-bold text-slate-900 mt-1 uppercase">{appName}</div>
                      <div className="text-[7px] font-semibold text-slate-600 mt-0.5 uppercase tracking-tight">PT. Spectra Jaya Fashion</div>
                    </div>
                  </div>
                  
                </div>
              </div>
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
