import { useState, useEffect, useRef } from "react";

// ─── Types ──────────────────────────────────────────────────────────────────
interface ShopProduct {
  id: number;
  name: string;
  categoryId: number;
  categoryName: string | null;
  imageUrl: string | null;
  description: string | null;
  primaryUnit: string;
  secondaryUnit: string;
  pricePerKg: number;
  pricePerKrat: number | null;
  kratStock: number;
  kgStock: number;
  inStock: boolean;
}

interface ShopProductDetail extends ShopProduct {
  availableSizes: { length: number; count: number }[];
  totalKrats: number;
}

export interface CartItem {
  id: string; // unique id per cart entry
  product: ShopProductDetail;
  size: number | null; // null means custom cut
  customLength?: number;
  qty: number;
}

interface ShopCategory {
  id: number;
  name: string;
  description: string | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const API_BASE = window.location.origin;

function formatRupiah(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

// Warna kategori yang konsisten
const CATEGORY_COLORS = [
  "bg-rose-100 text-rose-700",
  "bg-violet-100 text-violet-700",
  "bg-blue-100 text-blue-700",
  "bg-emerald-100 text-emerald-700",
  "bg-amber-100 text-amber-700",
  "bg-pink-100 text-pink-700",
  "bg-cyan-100 text-cyan-700",
  "bg-orange-100 text-orange-700",
];

function getCategoryColor(id: number) {
  return CATEGORY_COLORS[id % CATEGORY_COLORS.length];
}

// Deteksi warna kain dari nama produk
const COLOR_MAP: Record<string, string> = {
  merah: "#e53e3e", red: "#e53e3e",
  pink: "#ed64a6", rosa: "#ed64a6",
  orange: "#ed8936", oranye: "#ed8936",
  kuning: "#ecc94b", yellow: "#ecc94b", cream: "#f6e05e",
  hijau: "#48bb78", green: "#48bb78",
  tosca: "#38b2ac", teal: "#38b2ac",
  biru: "#4299e1", blue: "#4299e1", navy: "#2b4c7e",
  ungu: "#9f7aea", purple: "#9f7aea", violet: "#805ad5",
  coklat: "#a0522d", brown: "#a0522d",
  hitam: "#2d3748", black: "#2d3748",
  putih: "#f7fafc", white: "#f7fafc",
  abu: "#718096", grey: "#718096", gray: "#718096",
  maron: "#6b2737", maroon: "#6b2737",
  gold: "#d4af37", emas: "#d4af37",
  silver: "#a0aec0",
  motif: "linear-gradient(135deg,#e2e8f0,#cbd5e0)",
  bw: "linear-gradient(135deg,#2d3748 50%,#f7fafc 50%)",
};

function getFabricColor(name: string): string | null {
  const lower = name.toLowerCase();
  for (const [key, val] of Object.entries(COLOR_MAP)) {
    if (lower.includes(key)) return val;
  }
  return null;
}

// ─── Image placeholder ────────────────────────────────────────────────────────
function ProductImage({ src, name, className = "" }: { src: string | null; name: string; className?: string }) {
  const [error, setError] = useState(false);

  if (!src || error) {
    return (
      <div className={`bg-linear-to-br from-slate-100 to-slate-200 flex flex-col items-center justify-center gap-1 ${className}`}>
        <span className="text-3xl">🧵</span>
        <span className="text-[10px] text-slate-400 font-medium text-center px-2 leading-tight">{name}</span>
      </div>
    );
  }

  let actualSrc = src;
  if (actualSrc && actualSrc.startsWith("/uploads/")) {
    actualSrc = `/api${actualSrc}`;
  }
  if (actualSrc && !actualSrc.startsWith("http")) {
    actualSrc = `${API_BASE}${actualSrc}`;
  }

  return (
    <img
      src={actualSrc}
      alt={name}
      className={`object-cover ${className}`}
      onError={() => setError(true)}
    />
  );
}

// ─── Bottom Sheet ─────────────────────────────────────────────────────────────
function BottomSheet({ product, onClose, onAddToCart, enableCart, whatsapp }: { product: ShopProductDetail | null; onClose: () => void; onAddToCart: (item: Omit<CartItem, "id">) => void; enableCart: boolean; whatsapp: string }) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const [selectedSize, setSelectedSize] = useState<number | null>(null);
  const [customLengthStr, setCustomLengthStr] = useState("");
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    if (product) {
      setSelectedSize(null);
      setCustomLengthStr("");
      setQuantity(1);
    }
  }, [product]);

  useEffect(() => {
    setQuantity(1);
  }, [selectedSize]);

  // Close on backdrop click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  const handleAddToCart = () => {
    if (!product) return;
    
    let customLength: number | undefined;
    if (selectedSize === null) {
      customLength = parseFloat(customLengthStr);
      if (isNaN(customLength) || customLength <= 0) {
        alert("Silakan masukkan jumlah kg/kg yang valid untuk Bebas Potong.");
        return;
      }
    }

    if (!enableCart) {
      // Direct checkout if cart is disabled
      let msg = `Halo GUDANG BUAH! 👋\nSaya ingin memesan:\n\n`;
      if (selectedSize === null) {
        msg += `${quantity}x ${product.name} (Bebas Potong - ${customLengthStr} ${product.primaryUnit})\n`;
      } else {
        msg += `${quantity}x ${product.name} (Krat-an)\n`;
      }
      msg += `\nApakah stoknya masih tersedia?`;
      window.open(`https://wa.me/${whatsapp}?text=${encodeURIComponent(msg)}`, '_blank');
      onClose();
      return;
    }

    onAddToCart({
      product,
      size: selectedSize,
      customLength,
      qty: quantity
    });
    onClose();
  };

  if (!product) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center md:p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.45)", backdropFilter: "blur(4px)" }}
      onClick={handleBackdropClick}
    >
      <div
        ref={sheetRef}
        className="w-full md:max-w-105 bg-white rounded-t-3xl md:rounded-3xl overflow-hidden shadow-2xl flex flex-col relative"
        style={{
          maxHeight: "88vh",
          paddingBottom: "max(env(safe-area-inset-bottom), 16px)",
          animation: "slideUp 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)",
        }}
      >
        {/* Drag Handle (Mobile Only) */}
        <div className="flex justify-center pt-3 pb-1 md:hidden">
          <div className="w-10 h-1 rounded-full bg-slate-200" />
        </div>

        <div className="overflow-y-auto" style={{ maxHeight: "calc(88vh - 28px)" }}>
          {/* Product Image */}
          <div className="relative w-full h-64 bg-slate-100 overflow-hidden">
            <ProductImage src={product.imageUrl} name={product.name} className="w-full h-full" />
            <button
              onClick={onClose}
              className="absolute top-4 right-4 w-9 h-9 bg-white/80 backdrop-blur-sm rounded-full flex items-center justify-center shadow-md"
            >
              <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            {!product.inStock && (
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                <span className="bg-white/90 text-slate-700 font-bold text-sm px-4 py-1.5 rounded-full">Stok Habis</span>
              </div>
            )}
          </div>

          <div className="px-5 py-4 space-y-5">
            {/* Category & Name */}
            <div>
              {product.categoryName && (
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${getCategoryColor(product.categoryId)}`}>
                  {product.categoryName}
                </span>
              )}
              <h2 className="text-xl font-bold text-slate-900 mt-2 leading-tight">{product.name}</h2>
              {product.description && (
                <p className="text-sm text-slate-500 mt-1 leading-relaxed">{product.description}</p>
              )}
            </div>

            {/* Pricing */}
            <div className="bg-slate-50 rounded-2xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500">Harga Eceran</span>
                <span className="text-xl font-bold text-rose-600">
                  {formatRupiah(product.pricePerKg)}
                  <span className="text-sm font-medium text-slate-400">/{product.primaryUnit}</span>
                </span>
              </div>
              
              {selectedSize === null && parseFloat(customLengthStr) > 0 && (
                <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 mt-1">
                  <span className="text-sm text-slate-500">
                    Total Eceran ({quantity > 1 ? `${quantity}x ` : ''}{customLengthStr} {product.primaryUnit})
                  </span>
                  <span className="text-base font-bold text-rose-600">
                    {formatRupiah(product.pricePerKg * parseFloat(customLengthStr) * quantity)}
                  </span>
                </div>
              )}

              {product.pricePerKrat && (
                <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 mt-1">
                  <span className="text-sm text-slate-500">
                    {enableCart && selectedSize ? `Total ${quantity} Krat (${selectedSize} ${product.primaryUnit})` : "Harga Grosir (Beli Krat-an)"}
                  </span>
                  <div className="flex flex-col items-end">
                    <span className="text-base font-bold text-violet-600">
                      {enableCart && selectedSize ? formatRupiah(product.pricePerKrat * selectedSize * quantity) : formatRupiah(product.pricePerKrat)}
                      {(!enableCart || !selectedSize) && <span className="text-xs font-medium text-slate-400">/{product.primaryUnit}</span>}
                    </span>
                    {selectedSize && (
                      <span className="text-[10px] text-slate-400 font-medium">
                        (Harga grosir {formatRupiah(product.pricePerKrat)}/{product.primaryUnit})
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Available Sizes (Krat lengths) */}
            {product.availableSizes.length > 0 && (
              <div>
                <p className="text-sm font-semibold text-slate-700 mb-3">
                  Pilihan Pembelian
                  <span className="ml-2 text-xs text-slate-400 font-normal">({product.totalKrats} krat)</span>
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setSelectedSize(null)}
                    className={`px-4 py-2 rounded-xl text-sm font-medium border-2 transition-all ${
                      selectedSize === null
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-200 bg-white text-slate-600"
                    }`}
                  >
                    Bebas Potong
                  </button>
                  
                  {enableCart ? (
                    product.availableSizes.map(size => (
                      <button
                        key={size.length}
                        onClick={() => setSelectedSize(size.length)}
                        className={`px-4 py-2 rounded-xl text-sm font-medium border-2 transition-all ${
                          selectedSize === size.length
                            ? "border-rose-500 bg-rose-50 text-rose-700"
                            : "border-slate-200 bg-white text-slate-700"
                        }`}
                      >
                        {size.length} {product.primaryUnit}
                        <span className="ml-1 text-[10px] opacity-70 font-normal">({size.count} stok)</span>
                      </button>
                    ))
                  ) : (
                    <button
                      onClick={() => setSelectedSize(1)} // dummy truthy value for "Krat-an"
                      className={`px-4 py-2 rounded-xl text-sm font-medium border-2 transition-all ${
                        selectedSize !== null
                          ? "border-rose-500 bg-rose-50 text-rose-700"
                          : "border-slate-200 bg-white text-slate-700"
                      }`}
                    >
                      Beli Krat-an
                    </button>
                  )}
                </div>
                
                {/* Custom Length Input Form */}
                {selectedSize === null && (
                  <div className="mt-3 p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center gap-3 animate-[slideUp_0.2s_ease-out]">
                    <div className="flex-1">
                      <p className="text-xs font-bold text-slate-700 mb-1">Jumlah {product.primaryUnit}</p>
                      <input
                        type="number"
                        min="1"
                        placeholder="Contoh: 5"
                        value={customLengthStr}
                        onChange={e => setCustomLengthStr(e.target.value)}
                        className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm focus:border-rose-500 focus:ring-1 focus:ring-rose-500 outline-none transition-all"
                      />
                    </div>
                    <div className="shrink-0 w-24">
                      <p className="text-xs font-medium text-slate-400 mb-1">Satuan</p>
                      <div className="h-10 flex items-center justify-center bg-slate-200 rounded-lg text-sm font-semibold text-slate-600">
                        {product.primaryUnit}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Stock Info & Quantity Selector */}
            <div className="flex items-center justify-between mt-4">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${product.inStock ? "bg-emerald-400" : "bg-slate-300"}`} />
                <span className="text-sm text-slate-500">
                  {product.inStock
                    ? `${new Intl.NumberFormat('id-ID').format(product.kratStock)} krat tersedia`
                    : "Stok habis"}
                </span>
              </div>
              
              {product.inStock && (
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-slate-500 uppercase">Jumlah</span>
                  <div className="flex items-center bg-slate-100 rounded-lg border border-slate-200">
                    <button 
                      onClick={() => setQuantity(q => Math.max(1, q - 1))}
                      disabled={quantity <= 1}
                      className={`w-8 h-8 flex items-center justify-center rounded-l-lg transition-colors ${quantity <= 1 ? "text-slate-300 cursor-not-allowed" : "text-slate-600 hover:bg-slate-200 active:scale-95"}`}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" /></svg>
                    </button>
                    <div className="w-10 text-center font-bold text-slate-700 text-sm">{quantity}</div>
                    <button 
                      onClick={() => {
                        const maxQty = enableCart && selectedSize !== null ? (product.availableSizes.find(s => s.length === selectedSize)?.count ?? 1) : product.kratStock;
                        setQuantity(q => Math.min(maxQty, q + 1));
                      }}
                      disabled={(enableCart && selectedSize !== null) ? quantity >= (product.availableSizes.find(s => s.length === selectedSize)?.count ?? 1) : quantity >= product.kratStock}
                      className={`w-8 h-8 flex items-center justify-center rounded-r-lg transition-colors ${((enableCart && selectedSize !== null) ? quantity >= (product.availableSizes.find(s => s.length === selectedSize)?.count ?? 1) : quantity >= product.kratStock) ? "text-slate-300 cursor-not-allowed" : "text-slate-600 hover:bg-slate-200 active:scale-95"}`}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Add to Cart Button */}
            <button
              onClick={handleAddToCart}
              className={`flex items-center justify-center gap-3 w-full py-4 rounded-2xl font-bold text-base transition-transform active:scale-95 ${
                product.inStock
                  ? "bg-rose-500 text-white shadow-lg shadow-rose-200"
                  : "bg-slate-100 text-slate-400 cursor-not-allowed pointer-events-none"
              }`}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              {product.inStock ? "Tambah ke Keranjang" : "Stok Habis"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Product Card ─────────────────────────────────────────────────────────────
function ProductCard({ product, onClick }: { product: ShopProduct; onClick: () => void }) {
  const fabricColor = getFabricColor(product.name);
  const isGradient = fabricColor?.includes('gradient');

  return (
    <button
      onClick={onClick}
      className="text-left bg-white rounded-[20px] border border-slate-100/80 overflow-hidden hover:shadow-2xl hover:-translate-y-1.5 active:scale-[0.98] transition-all duration-300 w-full flex flex-col group"
      style={{ boxShadow: "0 4px 20px rgba(0,0,0,0.04)" }}
    >
      {/* Image / Color Swatch Half */}
      <div className="relative aspect-4/3 w-full overflow-hidden">
        {product.imageUrl ? (
          <ProductImage src={product.imageUrl} name={product.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
        ) : fabricColor ? (
          <div
            className="w-full h-full transition-transform duration-500 group-hover:scale-105"
            style={{ background: isGradient ? fabricColor : undefined, backgroundColor: isGradient ? undefined : fabricColor }}
          >
            {/* Subtle fabric texture overlay */}
            <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 5px, rgba(0,0,0,0.05) 5px, rgba(0,0,0,0.05) 10px)' }} />
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
              <span className="text-3xl drop-shadow-sm">🧵</span>
              <span className="text-[10px] font-black text-white/80 uppercase tracking-widest drop-shadow-sm text-center px-2">{product.name}</span>
            </div>
          </div>
        ) : (
          <div className="w-full h-full bg-linear-to-br from-slate-100 to-slate-200 flex flex-col items-center justify-center gap-1">
            <span className="text-3xl">🧵</span>
            <span className="text-[10px] text-slate-400 font-medium text-center px-2 leading-tight">{product.name}</span>
          </div>
        )}

        {/* Overlay: Out of stock */}
        {!product.inStock && (
          <div className="absolute inset-0 bg-black/30 flex items-center justify-center backdrop-blur-[2px]">
            <span className="text-white font-bold text-xs bg-black/60 px-4 py-2 rounded-full">Stok Habis</span>
          </div>
        )}

        {/* Category badge */}
        {product.categoryName && (
          <div className="absolute top-2.5 left-2.5 z-10">
            <span className="bg-black/40 text-white backdrop-blur-md text-[9px] font-black px-2.5 py-1 rounded-full uppercase tracking-widest">
              {product.categoryName}
            </span>
          </div>
        )}

        {/* Stock indicators */}
        {product.inStock && (
          <div className="absolute bottom-2.5 right-2.5 flex items-center gap-1">
            <span className="bg-black/40 text-white backdrop-blur-md text-[9px] font-bold px-2 py-0.5 rounded-full">
              📦 {new Intl.NumberFormat('id-ID').format(product.kratStock)} Krat
            </span>
          </div>
        )}
      </div>

      {/* Info Half */}
      <div className="p-4 flex-1 flex flex-col gap-3">
        {/* Name */}
        <div>
          <h3 className="text-[14px] font-black text-slate-800 leading-snug line-clamp-2 group-hover:text-rose-600 transition-colors">{product.name}</h3>
          <p className="text-[10px] text-slate-400 font-medium mt-0.5">
            {new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 }).format(product.kgStock)} {product.primaryUnit} tersedia
          </p>
        </div>

        {/* Price + CTA */}
        <div className="mt-auto flex items-center justify-between gap-2 pt-2.5 border-t border-slate-100">
          <div>
            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Harga Grosir</p>
            <p className="text-[14px] font-black text-rose-600 leading-tight">{formatRupiah(product.pricePerKg)}<span className="text-[9px] font-bold text-slate-400 ml-0.5">/{product.primaryUnit}</span></p>
          </div>
          <div className="shrink-0 px-3 py-1.5 rounded-xl bg-rose-500 text-white text-[10px] font-black uppercase tracking-wide group-hover:bg-rose-600 transition-colors shadow-sm shadow-rose-200 flex items-center gap-1">
            Lihat
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" /></svg>
          </div>
        </div>
      </div>
    </button>
  );
}



// ─── Cart Modal ───────────────────────────────────────────────────────────────
function CartModal({
  isOpen,
  onClose,
  cart,
  setCart,
  whatsapp
}: {
  isOpen: boolean;
  onClose: () => void;
  cart: CartItem[];
  setCart: React.Dispatch<React.SetStateAction<CartItem[]>>;
  whatsapp: string;
}) {
  if (!isOpen) return null;

  const handleRemove = (id: string) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const calculateItemPrice = (item: CartItem) => {
    if (item.size === null && item.customLength) {
      return item.product.pricePerKg * item.customLength;
    }
    if (item.size !== null && item.product.pricePerKrat) {
      return item.product.pricePerKrat * item.size;
    }
    return 0;
  };

  const subtotal = cart.reduce((acc, item) => acc + calculateItemPrice(item) * item.qty, 0);

  const handleCheckout = () => {
    let msg = `Halo GUDANG BUAH! 👋\nSaya ingin memesan:\n\n`;
    cart.forEach((item, index) => {
      const itemPrice = calculateItemPrice(item);
      const totalItemPrice = itemPrice * item.qty;
      
      if (item.size === null) {
        msg += `${index + 1}. ${item.product.name} (${item.qty}x Bebas Potong - ${item.customLength} ${item.product.primaryUnit})\n`;
        msg += `   ${item.qty} x ${formatRupiah(item.product.pricePerKg)} x ${item.customLength} = ${formatRupiah(totalItemPrice)}\n`;
      } else {
        msg += `${index + 1}. ${item.product.name} (${item.qty} Krat - ${item.size} ${item.product.primaryUnit})\n`;
        msg += `   ${item.qty} x ${formatRupiah(item.product.pricePerKrat || 0)} x ${item.size} = ${formatRupiah(totalItemPrice)}\n`;
      }
    });
    msg += `\nTotal Pesanan: ${formatRupiah(subtotal)}\nApakah stoknya masih tersedia?`;
    
    window.open(`https://wa.me/${whatsapp}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  return (
    <div className="fixed inset-0 z-60 flex items-end md:items-center justify-center md:p-4" style={{ backgroundColor: "rgba(0,0,0,0.45)", backdropFilter: "blur(4px)" }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full md:max-w-105 bg-white rounded-t-3xl md:rounded-3xl shadow-2xl flex flex-col h-[85vh] animate-[slideUp_0.35s_ease-out]">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-800">Keranjang Belanja</h2>
          <button onClick={onClose} className="p-2 bg-slate-100 rounded-full text-slate-500 hover:bg-slate-200"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400">
              <span className="text-4xl mb-2">🛒</span>
              <p>Keranjang masih kosong</p>
            </div>
          ) : (
            cart.map(item => (
              <div key={item.id} className="flex gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0 bg-white border border-slate-100">
                  <ProductImage src={item.product.imageUrl} name={item.product.name} className="w-full h-full" />
                </div>
                <div className="flex-1 flex flex-col justify-between">
                  <div className="flex justify-between items-start">
                    <h3 className="text-sm font-bold text-slate-800 leading-tight">{item.product.name}</h3>
                    <button onClick={() => handleRemove(item.id)} className="text-red-400 hover:text-red-600 p-1"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                  </div>
                  <p className="text-xs text-slate-500 font-medium mt-1">
                    {item.qty} x {item.size === null ? `Bebas Potong (${item.customLength} ${item.product.primaryUnit})` : `Krat (${item.size} ${item.product.primaryUnit})`}
                  </p>
                  <p className="text-sm font-black text-rose-600 mt-1">{formatRupiah(calculateItemPrice(item) * item.qty)}</p>
                </div>
              </div>
            ))
          )}
        </div>
        {cart.length > 0 && (
          <div className="p-5 border-t border-slate-100 bg-white">
            <div className="flex justify-between items-center mb-4">
              <span className="text-sm font-semibold text-slate-500">Total Pesanan</span>
              <span className="text-xl font-black text-slate-900">{formatRupiah(subtotal)}</span>
            </div>
            <button onClick={handleCheckout} className="w-full py-4 rounded-2xl font-bold text-white bg-emerald-500 hover:bg-emerald-600 shadow-lg shadow-emerald-200 transition-all active:scale-95 flex items-center justify-center gap-2">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              Pesan Sekarang
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Shop Page ───────────────────────────────────────────────────────────
export default function Shop() {
  const [products, setProducts] = useState<ShopProduct[]>([]);
  const [categories, setCategories] = useState<ShopCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<ShopProductDetail | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [shopSettings, setShopSettings] = useState({ storeName: "GUDANG BUAH", whatsapp: "", enableCart: true });
  const [activeSection, setActiveSection] = useState<"beranda" | "katalog" | "promo">("beranda");

  // Cart state
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartModalOpen, setCartModalOpen] = useState(false);

  const handleAddToCart = (item: Omit<CartItem, "id">) => {
    setCart(prev => [...prev, { ...item, id: Math.random().toString(36).substring(7) }]);
    // We could add a toast notification here if desired
  };

  const sectionRefs = {
    beranda: useRef<HTMLDivElement>(null),
    promo: useRef<HTMLDivElement>(null),
    katalog: useRef<HTMLDivElement>(null),
  };

  const scrollTo = (section: "beranda" | "katalog" | "promo") => {
    setActiveSection(section);
    if (section === "beranda") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else if (section === "katalog") {
      sectionRefs.katalog.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    } else if (section === "promo") {
      sectionRefs.promo.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  // Load categories
  useEffect(() => {
    fetch(`${API_BASE}/api/shop/categories`)
      .then(r => r.json())
      .then(setCategories)
      .catch(() => {});
  }, []);

  // Load products, settings & Setup Polling
  useEffect(() => {
    let isMounted = true;
    
    const fetchSettings = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/settings`);
        const d = await res.json();
        if (isMounted) {
          setShopSettings(s => {
            const newSettings = { ...s };
            if (d.app_name) newSettings.storeName = d.app_name;
            if (d.app_whatsapp) newSettings.whatsapp = d.app_whatsapp;
            if (d.shop_enable_cart) newSettings.enableCart = d.shop_enable_cart === "true";
            return newSettings;
          });
        }
      } catch (err) {
        // silently fail
      }
    };

    const fetchProducts = async (showLoading = false) => {
      if (showLoading) setLoading(true);
      const params = new URLSearchParams();
      if (selectedCategory) params.set("categoryId", String(selectedCategory));
      if (search) params.set("search", search);

      try {
        const res = await fetch(`${API_BASE}/api/shop/products?${params}`);
        const data = await res.json();
        if (isMounted) {
          setProducts(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        // silently fail for background poll
      } finally {
        if (isMounted && showLoading) setLoading(false);
      }
    };

    fetchSettings();
    fetchProducts(true);

    const intervalId = setInterval(() => {
      fetchSettings();
      fetchProducts(false);
    }, 15000); // Auto refresh every 15 seconds

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, [selectedCategory, search]);

  // Open product detail
  const openProduct = async (product: ShopProduct) => {
    const res = await fetch(`${API_BASE}/api/shop/products/${product.id}`);
    const detail: ShopProductDetail = await res.json();
    setSelectedProduct(detail);
    setSheetOpen(true);
  };

  const inStockProducts = products.filter(p => p.inStock);
  const outOfStockProducts = products.filter(p => !p.inStock);
  const displayProducts = [...inStockProducts, ...outOfStockProducts];

  return (
    <div className="min-h-screen bg-[#fafafa] w-full flex justify-center text-slate-800" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* CSS Overrides */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
        @keyframes slideRight { from { transform: translateX(-100%); } to { transform: translateX(0); } }
        .line-clamp-2 { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        * { -webkit-tap-highlight-color: transparent; }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
      `}</style>

      <div className="w-full max-w-360 flex">
        
        {/* ── Left Sidebar (Desktop) ── */}
        <aside className="hidden lg:flex w-60 flex-col shrink-0 h-screen sticky top-0 border-r border-slate-200 bg-slate-50/60 py-6 px-4 z-30">
          {/* Brand/Store Name */}
          <div className="flex items-center gap-3 mb-8 bg-white p-3 rounded-2xl shadow-sm border border-slate-100">
             <div className="w-10 h-10 bg-linear-to-br from-rose-500 to-pink-600 rounded-xl flex items-center justify-center shrink-0 shadow-sm shadow-rose-200">
               <span className="text-white font-black text-lg">E</span>
             </div>
             <div>
               <h2 className="text-[13px] font-black text-slate-900 tracking-tight leading-none">{shopSettings.storeName}</h2>
               <p className="text-[9px] text-slate-400 font-semibold mt-0.5 uppercase tracking-widest">Virtual Operational</p>
             </div>
          </div>

          {/* Navigation Links */}
          <nav className="flex flex-col gap-1">
            {([
              { key: "beranda", icon: "🏠", label: "Beranda" },
              { key: "katalog", icon: "🛍️", label: "Katalog Kain" },
              { key: "promo",   icon: "🎁", label: "Promo Khusus" },
            ] as const).map(({ key, icon, label }) => (
              <button
                key={key}
                onClick={() => scrollTo(key)}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-semibold transition-all active:scale-[0.98] text-left text-[13px] ${
                  activeSection === key
                    ? "bg-white shadow-sm border border-slate-100 text-rose-600 font-black"
                    : "text-slate-500 hover:bg-white hover:text-slate-700"
                }`}
              >
                <span className="text-lg w-6 text-center">{icon}</span> {label}
              </button>
            ))}
          </nav>

          {/* Divider */}
          <div className="my-5 border-t border-slate-200" />

          {/* Stats quick view */}
          <div className="bg-white rounded-2xl border border-slate-100 p-3.5 space-y-2 text-[11px]">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Info Toko</p>
            <div className="flex items-center gap-2 text-slate-600">
              <span className="text-base">📍</span>
              <span className="font-medium leading-snug">Karangdadap, Pekalongan</span>
            </div>
            {shopSettings.whatsapp && (
              <a
                href={`https://wa.me/${shopSettings.whatsapp}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-emerald-600 font-bold hover:text-emerald-700 transition-colors"
              >
                <span className="text-base">💬</span>
                <span>Chat via WhatsApp</span>
              </a>
            )}
          </div>

          <div className="mt-auto pt-4 text-center">
            <p className="text-[9px] text-slate-300 font-medium">© {new Date().getFullYear()} {shopSettings.storeName}</p>
          </div>
        </aside>

        {/* ── Main Content Area ── */}
        <div className="flex-1 flex flex-col min-w-0 h-full">
          
          {/* Header & Search */}
          <header 
            className="sticky top-0 z-20 bg-white/95 backdrop-blur-xl border-b border-slate-200/80 shadow-sm"
            style={{ paddingTop: "max(env(safe-area-inset-top), 0px)" }}
          >
             <div className="flex items-center gap-2.5 lg:gap-4 px-3 lg:px-6 py-3">
                {/* Mobile menu button */}
                <button 
                  onClick={() => setMobileMenuOpen(true)}
                  className="lg:hidden p-2 rounded-xl bg-slate-50 border border-slate-200 active:scale-90 transition-transform cursor-pointer shrink-0"
                >
                   <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 6h16M4 12h16M4 18h16" /></svg>
                </button>
                
                {/* Search Bar */}
                <div className="relative flex-1 max-w-xl flex items-center">
                  <div className="absolute left-3.5 w-4 h-4 text-slate-400">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                  </div>
                  <input
                    type="text"
                    placeholder="Cari kain katun, dll..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 rounded-xl text-[13px] font-medium text-slate-800 placeholder-slate-400 outline-none focus:ring-2 focus:ring-rose-500/20 focus:bg-white border border-slate-200 transition-all"
                  />
                </div>

                {/* WhatsApp Quick Contact (Desktop) */}
                {shopSettings.whatsapp && (
                  <a
                    href={`https://wa.me/${shopSettings.whatsapp}?text=${encodeURIComponent('Halo GUDANG BUAH! 👋 Saya ingin bertanya tentang produk kain tersedia.')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hidden lg:flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold transition-colors shadow-sm shadow-emerald-200 shrink-0"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                    Chat Sekarang
                  </a>
                )}

                {/* Mobile Store Icon */}
                <div className="lg:hidden w-9 h-9 bg-linear-to-br from-rose-500 to-pink-600 rounded-xl flex items-center justify-center shrink-0 shadow-sm shadow-rose-200">
                  <span className="text-white font-black text-sm">E</span>
                </div>
             </div>
          </header>

          <main className="flex-1 overflow-x-hidden p-4 lg:p-8 space-y-8">
             {/* Promotional Banner */}
             <div ref={sectionRefs.promo} className="w-full bg-linear-to-r from-[#1a0a33] via-[#3b1560] to-[#EE4566] rounded-3xl overflow-hidden relative shadow-xl">
                {/* Dot pattern overlay */}
                <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at center, white 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
                {/* Glow blobs */}
                <div className="absolute top-0 right-1/4 w-64 h-64 rounded-full bg-rose-400/30 blur-3xl pointer-events-none" />
                <div className="absolute bottom-0 right-0 w-48 h-48 rounded-full bg-violet-400/20 blur-2xl pointer-events-none" />

                <div className="relative z-10 flex items-center justify-between">
                  {/* Left: Text */}
                  <div className="px-8 py-10 lg:py-14 md:max-w-[60%]">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/15 text-white/90 text-[10px] font-bold rounded-full backdrop-blur-md mb-4 uppercase tracking-widest border border-white/20">
                      ✨ Penawaran Spesial
                    </span>
                    <h2 className="text-3xl lg:text-5xl font-black text-white leading-tight mb-3">{shopSettings.storeName}</h2>
                    <p className="text-white/75 text-sm lg:text-[15px] font-medium mb-8 max-w-md leading-relaxed">Koleksi kain premium untuk segala kebutuhan fashion Anda. Belanja grosir lebih murah dan mudah.</p>
                    <div className="flex items-center gap-3 flex-wrap">
                      <button
                        onClick={() => scrollTo("katalog")}
                        className="px-6 py-3 bg-white text-rose-600 font-black rounded-xl shadow-lg hover:-translate-y-0.5 active:scale-95 transition-all text-sm"
                      >🛍️ Belanja Sekarang</button>
                      {shopSettings.whatsapp && (
                        <a
                          href={`https://wa.me/${shopSettings.whatsapp}`}
                          target="_blank" rel="noopener noreferrer"
                          className="px-5 py-3 bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl border border-white/20 transition-colors text-sm backdrop-blur-sm"
                        >💬 Tanya via WA</a>
                      )}
                    </div>
                  </div>

                  {/* Right: Decorative Fabric Swatches */}
                  <div className="hidden md:flex items-center justify-center pr-10 lg:pr-16 gap-3 lg:gap-4 shrink-0">
                    {[
                      { color: '#e53e3e', label: 'Merah' },
                      { color: '#48bb78', label: 'Hijau' },
                      { color: '#4299e1', label: 'Biru' },
                      { color: '#ecc94b', label: 'Kuning' },
                    ].map((swatch, i) => (
                      <div
                        key={i}
                        className="flex flex-col items-center gap-1.5"
                        style={{ transform: `translateY(${i % 2 === 0 ? '-8px' : '8px'})` }}
                      >
                        <div
                          className="w-12 h-16 lg:w-14 lg:h-20 rounded-2xl shadow-xl border-2 border-white/30"
                          style={{ backgroundColor: swatch.color }}
                        >
                          <div className="w-full h-full rounded-2xl opacity-20" style={{ backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(0,0,0,0.1) 3px, rgba(0,0,0,0.1) 6px)' }} />
                        </div>
                        <span className="text-[9px] font-bold text-white/60 uppercase tracking-widest">{swatch.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
             </div>

             {/* Categories */}
             {categories.length > 0 && (
               <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
                 <button
                   onClick={() => setSelectedCategory(null)}
                   className={`shrink-0 px-4 py-2 rounded-[10px] text-[12px] font-black transition-all border ${
                     selectedCategory === null
                       ? "bg-rose-500 text-white border-rose-500 shadow-sm shadow-rose-200"
                       : "bg-white text-slate-600 border-slate-200 hover:border-rose-200 hover:text-rose-600"
                   }`}
                 >
                   Semua Kain
                 </button>
                 {categories.map(cat => (
                   <button
                     key={cat.id}
                     onClick={() => setSelectedCategory(selectedCategory === cat.id ? null : cat.id)}
                     className={`shrink-0 px-4 py-2 rounded-[10px] text-[12px] font-black transition-all border ${
                       selectedCategory === cat.id
                         ? "bg-rose-500 text-white border-rose-500 shadow-sm shadow-rose-200"
                         : "bg-white text-slate-600 border-slate-200 hover:border-rose-200 hover:text-rose-600"
                     }`}
                   >
                     {cat.name}
                   </button>
                 ))}
               </div>
             )}

             {/* Section Title */}
             <div ref={sectionRefs.katalog} className="flex items-center justify-between scroll-mt-24">
                <div>
                   <h3 className="text-xl font-black text-slate-900">Koleksi Terbaru</h3>
                   <p className="text-sm font-medium text-slate-500 mt-1">{displayProducts.length} produk tersedia</p>
                </div>
                <div className="hidden lg:flex items-center gap-2">
                   <span className="text-xs font-semibold text-slate-500">Tampilan</span>
                   <div className="flex gap-1 bg-slate-200 p-1 rounded-lg">
                      <div className="w-7 h-7 bg-white rounded text-slate-800 flex items-center justify-center shadow-sm"><svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M4 4h4v4H4zM10 4h4v4h-4zM16 4h4v4h-4zM4 10h4v4H4zM10 10h4v4h-4zM16 10h4v4h-4zM4 16h4v4H4zM10 16h4v4h-4zM16 16h4v4h-4z"/></svg></div>
                      <div className="w-7 h-7 rounded text-slate-400 flex items-center justify-center"><svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M4 6h16v2H4zm0 5h16v2H4zm0 5h16v2H4z"/></svg></div>
                   </div>
                </div>
             </div>

             {/* Product Grid */}
             {loading ? (
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 lg:gap-6">
                  {[...Array(8)].map((_, i) => (
                    <div key={i} className="bg-white rounded-[20px] overflow-hidden border border-slate-100 animate-pulse h-65">
                      <div className="h-1/2 bg-slate-100" />
                      <div className="p-4 space-y-3">
                        <div className="h-4 bg-slate-100 rounded w-3/4" />
                        <div className="h-8 bg-slate-100 rounded w-1/2" />
                      </div>
                    </div>
                  ))}
                </div>
             ) : displayProducts.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 lg:gap-6">
                  {displayProducts.map(product => (
                    <ProductCard key={product.id} product={product} onClick={() => openProduct(product)} />
                  ))}
                </div>
             ) : (
                <div className="flex flex-col items-center justify-center py-20 text-center bg-white rounded-3xl border border-slate-100 shadow-sm">
                  <span className="text-6xl mb-4">🧵</span>
                  <p className="text-xl font-bold text-slate-800">Produk tidak ditemukan</p>
                  <p className="text-slate-500 font-medium mt-2">Coba kata kunci lain atau pilih kategori berbeda</p>
                  {(search || selectedCategory) && (
                    <button
                      onClick={() => { setSearch(""); setSelectedCategory(null); }}
                      className="mt-6 px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold rounded-full transition-colors shadow-lg shadow-slate-200"
                    >
                      Reset Pencarian
                    </button>
                  )}
                </div>
             )}

             {/* Footer */}
             <footer className="mt-16 pt-12 pb-24 lg:pb-8 border-t border-slate-200">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
                   <div>
                      <h4 className="font-bold text-slate-900 mb-4">Informasi</h4>
                      <ul className="space-y-3 text-sm font-medium text-slate-500">
                         <li><a href="#" className="hover:text-rose-600 transition-colors">Tentang Kami</a></li>
                         <li><a href="#" className="hover:text-rose-600 transition-colors">Syarat & Ketentuan</a></li>
                         <li><a href="#" className="hover:text-rose-600 transition-colors">Kebijakan Privasi</a></li>
                      </ul>
                   </div>
                   <div>
                      <h4 className="font-bold text-slate-900 mb-4">Bantuan</h4>
                      <ul className="space-y-3 text-sm font-medium text-slate-500">
                         <li><a href="#" className="hover:text-rose-600 transition-colors">Cara Pemesanan</a></li>
                         <li><a href="#" className="hover:text-rose-600 transition-colors">Pengiriman</a></li>
                         <li><a href="#" className="hover:text-rose-600 transition-colors">FAQ</a></li>
                      </ul>
                   </div>
                   <div className="col-span-2 md:col-span-2">
                      <div className="flex items-center gap-3 mb-4">
                         <div className="w-8 h-8 bg-linear-to-br from-rose-500 to-pink-600 rounded-lg flex items-center justify-center shadow-sm">
                           <span className="text-white font-black text-sm">E</span>
                         </div>
                         <h4 className="font-black text-xl text-slate-900">{shopSettings.storeName}</h4>
                      </div>
                      <p className="text-sm font-medium text-slate-500 leading-relaxed mb-6 max-w-sm">
                         Pusat grosir dan eceran kain berkualitas. Melayani pengiriman ke seluruh Indonesia dengan harga terbaik.
                         <br/><br/>
                         Gudang Kain Enka Textile<br/>
                         Jl. Raya Jrebengkembang, Masuk Gg. Griya Azzahra, Kedolon, Jrebengkembang, Karangdadap, kab. Pekalongan
                      </p>
                      <div className="flex items-center gap-3">
                         <a href="#" className="w-10 h-10 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center hover:bg-rose-500 hover:text-white transition-colors"><svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg></a>
                         <a href="#" className="w-10 h-10 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center hover:bg-rose-500 hover:text-white transition-colors"><svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.469h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.469h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg></a>
                         <a href="#" className="w-10 h-10 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center hover:bg-rose-500 hover:text-white transition-colors"><svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg></a>
                      </div>
                   </div>
                </div>
                <div className="text-center text-sm font-medium text-slate-400 pt-8 border-t border-slate-200">
                   &copy; {new Date().getFullYear()} {shopSettings.storeName}. All rights reserved.
                </div>
             </footer>
          </main>
        </div>
      </div>

      {/* ── Mobile Bottom Navigation ── */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-xl border-t border-slate-200 shadow-[0_-10px_40px_rgba(0,0,0,0.05)]" style={{ paddingBottom: "max(env(safe-area-inset-bottom), 16px)" }}>
        <div className="flex items-center justify-around px-2 pt-3 pb-2">
          {([
            { key: "beranda", icon: "🏠",  label: "Beranda" },
            { key: "katalog", icon: "🛍️", label: "Katalog" },
            { key: "promo",   icon: "🎁",  label: "Promo" },
          ] as const).map(({ key, icon, label }) => (
            <button
              key={key}
              onClick={() => scrollTo(key)}
              className={`flex flex-col items-center gap-1 px-4 py-2 rounded-2xl transition-all active:scale-90 relative ${
                activeSection === key ? "text-rose-600" : "text-slate-400 hover:bg-slate-50"
              }`}
            >
              <span className={`text-2xl leading-none transition-transform duration-300 ${activeSection === key ? 'scale-110 -translate-y-1' : ''}`}>{icon}</span>
              <span className={`text-[10px] font-bold transition-all duration-300 ${ activeSection === key ? "text-rose-600 opacity-100" : "text-slate-400 opacity-70" }`}>{label}</span>
              {activeSection === key && <div className="absolute bottom-1 w-1.5 h-1.5 rounded-full bg-rose-500 shadow-sm shadow-rose-200" />}
            </button>
          ))}
        </div>
      </nav>

      {/* ── Mobile Drawer ── */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div 
            className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative w-70 bg-white h-full shadow-2xl flex flex-col p-6 animate-[slideRight_0.3s_ease-out]">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                 <div className="w-10 h-10 bg-linear-to-br from-rose-500 to-pink-600 rounded-xl flex items-center justify-center shadow-sm">
                   <span className="text-white font-black text-lg">E</span>
                 </div>
                 <h2 className="text-xl font-black text-slate-900">{shopSettings.storeName}</h2>
              </div>
              <button 
                onClick={() => setMobileMenuOpen(false)}
                className="p-2 bg-slate-100 rounded-full text-slate-500 active:scale-90 transition-transform cursor-pointer"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <nav className="flex flex-col gap-2">
              {([
                { key: "beranda", icon: "🏠", label: "Beranda" },
                { key: "katalog", icon: "🛍️", label: "Katalog Kain" },
                { key: "promo",   icon: "🎁", label: "Promo Khusus" },
              ] as const).map(({ key, icon, label }) => (
                <button
                  key={key}
                  onClick={() => { scrollTo(key); setMobileMenuOpen(false); }}
                  className={`flex items-center gap-4 px-4 py-3.5 rounded-xl font-semibold transition-all active:scale-95 text-left ${
                    activeSection === key
                      ? "bg-rose-50 text-rose-600 font-bold"
                      : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <span className="text-2xl">{icon}</span> {label}
                </button>
              ))}
            </nav>
            
            <div className="mt-auto">
              <p className="text-xs text-center text-slate-400 font-medium">
                &copy; {new Date().getFullYear()} {shopSettings.storeName}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Bottom Sheet Modal ── */}
      {sheetOpen && (
        <BottomSheet
          product={selectedProduct}
          onClose={() => { setSheetOpen(false); setSelectedProduct(null); }}
          onAddToCart={handleAddToCart}
          enableCart={shopSettings.enableCart}
          whatsapp={shopSettings.whatsapp}
        />
      )}

      {/* ── Cart FAB ── */}
      {shopSettings.enableCart && (
        <button
          onClick={() => setCartModalOpen(true)}
          className="fixed bottom-20 lg:bottom-10 right-4 lg:right-10 z-40 bg-rose-500 text-white p-4 rounded-full shadow-2xl shadow-rose-200 hover:scale-105 active:scale-95 transition-all"
        >
          <div className="relative">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
            {cart.length > 0 && (
              <span className="absolute -top-2 -right-2 bg-slate-900 text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full border-2 border-white">
                {cart.length}
              </span>
            )}
          </div>
        </button>
      )}

      {/* ── Cart Modal ── */}
      {shopSettings.enableCart && (
        <CartModal
          isOpen={cartModalOpen}
          onClose={() => setCartModalOpen(false)}
          cart={cart}
          setCart={setCart}
          whatsapp={shopSettings.whatsapp}
        />
      )}
    </div>
  );
}
