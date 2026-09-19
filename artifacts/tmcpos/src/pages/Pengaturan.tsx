import { useState, useEffect } from "react";
import { PageHeader } from "../components/PageHeader";
import {
  useListPaymentMethods,
  useCreatePaymentMethod,
  useUpdatePaymentMethod,
  useDeletePaymentMethod,
  getListPaymentMethodsQueryKey,
  useListUnits,
  useCreateUnit,
  useUpdateUnit,
  useDeleteUnit,
  getListUnitsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter } from "@/components/ui/drawer";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Plus, Pencil, Trash2, CreditCard, GripVertical, Settings, Box, BellRing, MonitorSmartphone, Save, Image as ImageIcon, Receipt, Moon, Sun, Palette, Lock, ShieldCheck, Store } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { registerAndSubscribePush } from "../lib/pushNotification";
import { useSettings, useUpdateSettings } from "@/hooks/useSettings";
import { useTheme } from "@/hooks/useTheme";
import { useLicense } from "@/hooks/useLicense";

export default function Pengaturan() {
  const { theme, toggle: toggleTheme } = useTheme();
  const { data: methods = [], isLoading } = useListPaymentMethods(
    { query: { queryKey: getListPaymentMethodsQueryKey() } }
  );
  const { data: units = [], isLoading: isLoadingUnits } = useListUnits(
    { query: { queryKey: getListUnitsQueryKey() } }
  );

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const licenseInfo = useLicense();

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editItem, setEditItem] = useState<{ id: number; name: string; isActive: boolean; sortOrder: number } | null>(null);
  const [newCode, setNewCode] = useState("");
  const [newName, setNewName] = useState("");
  const [newSortOrder, setNewSortOrder] = useState("99");

  // Unit State
  const [isAddUnitOpen, setIsAddUnitOpen] = useState(false);
  const [editUnitItem, setEditUnitItem] = useState<{ id: number; name: string; symbol: string } | null>(null);
  const [newUnitName, setNewUnitName] = useState("");
  const [newUnitSymbol, setNewUnitSymbol] = useState("");

  const [isEnablingPush, setIsEnablingPush] = useState(false);
  const [appNameInput, setAppNameInput] = useState("");
  const [appAddressInput, setAppAddressInput] = useState("");
  const [appLogoInput, setAppLogoInput] = useState("");
  
  const [invoiceBankNameInput, setInvoiceBankNameInput] = useState("");
  const [invoiceBankAccountInput, setInvoiceBankAccountInput] = useState("");
  const [invoiceNotesInput, setInvoiceNotesInput] = useState("");

  const [shopEnableCartInput, setShopEnableCartInput] = useState(true);

  // State untuk perpanjangan lisensi
  const [renewKeyInput, setRenewKeyInput] = useState("");
  const [isRenewing, setIsRenewing] = useState(false);
  const [showRenewForm, setShowRenewForm] = useState(false);
  

  
  const { data: settings, isLoading: isLoadingSettings } = useSettings();
  const updateSettingsMutation = useUpdateSettings();

  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    if (settings && !isInitialized) {
      if (settings["app_name"]) {
        setAppNameInput(settings["app_name"]);
      }
      if (settings["app_address"]) {
        setAppAddressInput(settings["app_address"]);
      }
      if (settings["app_logo"]) {
        setAppLogoInput(settings["app_logo"]);
      }
      if (settings["invoice_bank_name"]) {
        setInvoiceBankNameInput(settings["invoice_bank_name"]);
      }
      if (settings["invoice_bank_account"]) {
        setInvoiceBankAccountInput(settings["invoice_bank_account"]);
      }
      if (settings["invoice_notes"]) {
        setInvoiceNotesInput(settings["invoice_notes"]);
      }
      if (settings["shop_enable_cart"]) {
        setShopEnableCartInput(settings["shop_enable_cart"] === "true");
      }

      setIsInitialized(true);
    }
  }, [settings, isInitialized]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getListPaymentMethodsQueryKey() });
  const invalidateUnits = () => queryClient.invalidateQueries({ queryKey: getListUnitsQueryKey() });

  const handleEnableNotification = async () => {
    setIsEnablingPush(true);
    try {
      await registerAndSubscribePush();
      toast({ title: "Notifikasi diaktifkan!", description: "Perangkat ini akan menerima notifikasi transaksi." });
    } catch (error: any) {
      toast({ title: "Gagal", description: error.message, variant: "destructive" });
    } finally {
      setIsEnablingPush(false);
    }
  };

  const handleSaveSettings = () => {
    if (!appNameInput.trim()) return;
    updateSettingsMutation.mutate(
      { app_name: appNameInput.trim(), app_address: appAddressInput.trim(), app_logo: appLogoInput },
      {
        onSuccess: () => toast({ title: "Pengaturan Utama disimpan!" }),
        onError: (err: any) => toast({ title: "Gagal menyimpan", description: err.message, variant: "destructive" }),
      }
    );
  };

  const handleSaveInvoiceSettings = () => {
    updateSettingsMutation.mutate(
      { 
        invoice_bank_name: invoiceBankNameInput.trim(), 
        invoice_bank_account: invoiceBankAccountInput.trim(), 
        invoice_notes: invoiceNotesInput.trim() 
      },
      {
        onSuccess: () => toast({ title: "Pengaturan Nota disimpan!" }),
        onError: (err: any) => toast({ title: "Gagal menyimpan", description: err.message, variant: "destructive" }),
      }
    );
  };

  const handleSaveShopSettings = () => {
    updateSettingsMutation.mutate(
      { 
        shop_enable_cart: shopEnableCartInput ? "true" : "false" 
      },
      {
        onSuccess: () => toast({ title: "Pengaturan Katalog disimpan!" }),
        onError: (err: any) => toast({ title: "Gagal menyimpan", description: err.message, variant: "destructive" }),
      }
    );
  };

  const handleRenewLicense = async () => {
    if (!renewKeyInput.trim()) return;
    setIsRenewing(true);
    const result = await licenseInfo.activateLicense(renewKeyInput.trim());
    setIsRenewing(false);
    if (result.ok) {
      toast({ title: "✅ Lisensi Diperpanjang!", description: "Key baru berhasil diaktifkan." });
      setRenewKeyInput("");
      setShowRenewForm(false);
    } else {
      toast({ title: "Gagal Aktivasi", description: result.error || "Key tidak valid.", variant: "destructive" });
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "File terlalu besar", description: "Ukuran maksimal 2MB", variant: "destructive" });
      return;
    }
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;
        
        const MAX_SIZE = 512;
        if (width > height) {
          if (width > MAX_SIZE) {
            height *= MAX_SIZE / width;
            width = MAX_SIZE;
          }
        } else {
          if (height > MAX_SIZE) {
            width *= MAX_SIZE / height;
            height = MAX_SIZE;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0, width, height);
        
        const dataUrl = canvas.toDataURL("image/png", 0.9);
        setAppLogoInput(dataUrl);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const createMutation = useCreatePaymentMethod({
    mutation: {
      onSuccess: () => {
        invalidate();
        setIsAddOpen(false);
        setNewCode(""); setNewName(""); setNewSortOrder("99");
        toast({ title: "Metode pembayaran ditambahkan" });
      },
      onError: (err: any) => {
        toast({ title: "Gagal menambahkan", description: err?.message, variant: "destructive" });
      },
    },
  });

  const updateMutation = useUpdatePaymentMethod({
    mutation: {
      onSuccess: () => {
        invalidate();
        setEditItem(null);
        toast({ title: "Metode pembayaran diperbarui" });
      },
    },
  });

  const deleteMutation = useDeletePaymentMethod({
    mutation: {
      onSuccess: () => {
        invalidate();
        toast({ title: "Metode pembayaran dihapus" });
      },
    },
  });

  const handleAdd = () => {
    if (!newCode.trim() || !newName.trim()) return;
    createMutation.mutate({
      data: { code: newCode.trim(), name: newName.trim(), isActive: true, sortOrder: parseInt(newSortOrder) || 99 },
    });
  };

  const handleToggleActive = (item: typeof methods[0]) => {
    updateMutation.mutate({ id: item.id, data: { isActive: !item.isActive } });
  };

  const handleEditSave = () => {
    if (!editItem) return;
    updateMutation.mutate({
      id: editItem.id,
      data: { name: editItem.name, isActive: editItem.isActive, sortOrder: editItem.sortOrder },
    });
  };

  const handleDelete = (id: number) => {
    if (!confirm("Hapus metode pembayaran ini?")) return;
    deleteMutation.mutate({ id });
  };

  // Unit Mutations
  const createUnitMutation = useCreateUnit({
    mutation: {
      onSuccess: () => {
        invalidateUnits();
        setIsAddUnitOpen(false);
        setNewUnitName(""); setNewUnitSymbol("");
        toast({ title: "Satuan ditambahkan" });
      },
      onError: (err: any) => {
        toast({ title: "Gagal menambahkan satuan", description: err?.message, variant: "destructive" });
      },
    },
  });

  const updateUnitMutation = useUpdateUnit({
    mutation: {
      onSuccess: () => {
        invalidateUnits();
        setEditUnitItem(null);
        toast({ title: "Satuan diperbarui" });
      },
    },
  });

  const deleteUnitMutation = useDeleteUnit({
    mutation: {
      onSuccess: () => {
        invalidateUnits();
        toast({ title: "Satuan dihapus" });
      },
    },
  });

  const handleAddUnit = () => {
    if (!newUnitName.trim() || !newUnitSymbol.trim()) return;
    createUnitMutation.mutate({
      data: { name: newUnitName.trim(), symbol: newUnitSymbol.trim() },
    });
  };

  const handleEditUnitSave = () => {
    if (!editUnitItem) return;
    updateUnitMutation.mutate({
      id: editUnitItem.id,
      data: { name: editUnitItem.name, symbol: editUnitItem.symbol },
    });
  };

  const handleDeleteUnit = (id: number) => {
    if (!confirm("Hapus satuan ini? Satuan yang sedang digunakan mungkin akan mengalami error pada tampilan.")) return;
    deleteUnitMutation.mutate({ id });
  };

  return (
    <div className="space-y-4 md:space-y-6 max-w-[800px] mx-auto pb-4">
      {/* Mobile-optimized Header */}
      <div className="flex flex-col pt-2 pb-2">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Pengaturan</h1>
            <p className="text-sm text-slate-500">Konfigurasi sistem & tampilan</p>
          </div>
        </div>
      </div>

      {/* App Appearance Card */}
      <div className="bg-white rounded-3xl p-5 shadow-[0_2px_12px_rgba(0,0,0,0.03)] border border-slate-100 flex flex-col gap-4">
        <div>
          <h3 className="flex items-center gap-2 font-bold text-slate-800 text-base">
            <Palette size={18} className="text-violet-500" />
            Tampilan Aplikasi
          </h3>
          <p className="text-xs text-slate-500 mt-1 ml-6.5">
            Sesuaikan mode warna aplikasi sesuai dengan kenyamanan mata Anda.
          </p>
        </div>
        <div 
          onClick={toggleTheme}
          className="flex items-center justify-between bg-slate-50 p-4 rounded-2xl border border-slate-100 cursor-pointer hover:bg-slate-100/80 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center bg-white border border-slate-100 shadow-sm">
              {theme === "dark" ? (
                <Moon className="w-5 h-5 text-indigo-500" />
              ) : (
                <Sun className="w-5 h-5 text-amber-500" />
              )}
            </div>
            <div>
              <p className="font-bold text-sm text-slate-800">Mode Gelap (Dark Mode)</p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {theme === "dark" ? "Mode gelap sedang aktif" : "Gunakan mode gelap untuk malam hari"}
              </p>
            </div>
          </div>
          <Switch checked={theme === "dark"} onCheckedChange={toggleTheme} className="data-[state=checked]:bg-violet-600" />
        </div>
      </div>

      {/* General Settings Card */}
      <div className="bg-white rounded-3xl p-5 shadow-[0_2px_12px_rgba(0,0,0,0.03)] border border-slate-100 flex flex-col gap-4">
        <div>
          <h3 className="flex items-center gap-2 font-bold text-slate-800 text-base">
            <MonitorSmartphone size={18} className="text-violet-500" />
            Pengaturan Utama
          </h3>
          <p className="text-xs text-slate-500 mt-1 ml-6.5">
            Ubah nama aplikasi yang akan ditampilkan di layar dan notifikasi.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-end gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-100">
          <div className="space-y-1.5 w-full sm:max-w-sm">
            <Label className="text-xs font-semibold text-slate-600">Nama Aplikasi</Label>
            <Input 
              value={appNameInput} 
              onChange={(e) => setAppNameInput(e.target.value)} 
              placeholder="mis: Enka Textile POS" 
              disabled={isLoadingSettings}
              className="bg-white border-slate-200 rounded-xl focus-visible:ring-violet-500"
            />
          </div>
          
          <div className="space-y-1.5 w-full sm:max-w-sm">
            <Label className="text-xs font-semibold text-slate-600">Alamat Toko</Label>
            <Input 
              value={appAddressInput} 
              onChange={(e) => setAppAddressInput(e.target.value)} 
              placeholder="mis: Jl. Jend. Sudirman No. 1" 
              disabled={isLoadingSettings}
              className="bg-white border-slate-200 rounded-xl focus-visible:ring-violet-500"
            />
          </div>
          
          <div className="space-y-1.5 w-full sm:w-auto">
            <Label className="text-xs font-semibold text-slate-600">Logo Aplikasi (Opsional)</Label>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 border border-slate-200 rounded-xl flex items-center justify-center bg-white overflow-hidden shrink-0 shadow-sm">
                {appLogoInput ? (
                  <img src={appLogoInput} alt="Logo" className="w-full h-full object-cover" />
                ) : (
                  <ImageIcon size={16} className="text-slate-400" />
                )}
              </div>
              <Label htmlFor="logo-upload" className="cursor-pointer">
                <div className="h-10 px-3 border border-slate-200 bg-white rounded-xl hover:bg-slate-50 transition-colors flex items-center text-sm font-medium text-slate-700 shadow-sm">
                  Pilih Gambar
                </div>
              </Label>
              <input 
                id="logo-upload" 
                type="file" 
                accept="image/*" 
                className="hidden" 
                onChange={handleLogoUpload}
                disabled={isLoadingSettings}
              />
            </div>
          </div>

          <Button 
            onClick={handleSaveSettings}
            disabled={isLoadingSettings || updateSettingsMutation.isPending || !appNameInput.trim()}
            className="w-full sm:w-auto flex items-center gap-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-semibold"
          >
            <Save size={16} />
            {updateSettingsMutation.isPending ? "Menyimpan..." : "Simpan"}
          </Button>
        </div>
      </div>

      {/* Invoice Settings Card */}
      <div className="bg-white rounded-3xl p-5 shadow-[0_2px_12px_rgba(0,0,0,0.03)] border border-slate-100 flex flex-col gap-4">
        <div>
          <h3 className="flex items-center gap-2 font-bold text-slate-800 text-base">
            <Receipt size={18} className="text-violet-500" />
            Pengaturan Nota / Invoice
          </h3>
          <p className="text-xs text-slate-500 mt-1 ml-6.5">
            Ubah detail informasi bank dan keterangan tambahan yang dicetak pada nota.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-start sm:items-end gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-100">
          <div className="space-y-1.5 w-full sm:max-w-[200px]">
            <Label className="text-xs font-semibold text-slate-600">Nama Rekening</Label>
            <Input 
              value={invoiceBankNameInput} 
              onChange={(e) => setInvoiceBankNameInput(e.target.value)} 
              placeholder="mis: A.n PT XYZ" 
              disabled={isLoadingSettings}
              className="bg-white border-slate-200 rounded-xl focus-visible:ring-violet-500"
            />
          </div>
          
          <div className="space-y-1.5 w-full sm:max-w-[200px]">
            <Label className="text-xs font-semibold text-slate-600">Nomor Rekening</Label>
            <Input 
              value={invoiceBankAccountInput} 
              onChange={(e) => setInvoiceBankAccountInput(e.target.value)} 
              placeholder="mis: BCA - 12345" 
              disabled={isLoadingSettings}
              className="bg-white border-slate-200 rounded-xl focus-visible:ring-violet-500"
            />
          </div>
          
          <div className="space-y-1.5 w-full">
            <Label className="text-xs font-semibold text-slate-600">Keterangan / Pesan Tambahan</Label>
            <Input 
              value={invoiceNotesInput} 
              onChange={(e) => setInvoiceNotesInput(e.target.value)} 
              placeholder="mis: Barang yang dibeli tidak dapat ditukar" 
              disabled={isLoadingSettings}
              className="bg-white border-slate-200 rounded-xl focus-visible:ring-violet-500"
            />
          </div>

          <Button 
            onClick={handleSaveInvoiceSettings}
            disabled={isLoadingSettings || updateSettingsMutation.isPending}
            className="w-full sm:w-auto flex items-center gap-2 shrink-0 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-semibold"
          >
            <Save size={16} />
            {updateSettingsMutation.isPending ? "Menyimpan..." : "Simpan"}
          </Button>
        </div>
      </div>

      {/* Shop Settings Card */}
      <div className="bg-white rounded-3xl p-5 shadow-[0_2px_12px_rgba(0,0,0,0.03)] border border-slate-100 flex flex-col gap-4">
        <div>
          <h3 className="flex items-center gap-2 font-bold text-slate-800 text-base">
            <Store size={18} className="text-emerald-500" />
            Pengaturan Katalog (Shop)
          </h3>
          <p className="text-xs text-slate-500 mt-1 ml-6.5">
            Atur fitur e-commerce untuk pelanggan Anda.
          </p>
        </div>
        <div className="flex items-center justify-between bg-slate-50 p-4 rounded-2xl border border-slate-100">
          <div>
            <div className="font-semibold text-slate-700 text-sm">Fitur Keranjang & Detail Ukuran Krat</div>
            <div className="text-xs text-slate-500 mt-1 max-w-[400px]">
              Jika diaktifkan, customer bisa melihat panjang krat spesifik dan memasukkannya ke Keranjang Belanja. Jika dimatikan, customer langsung order via WhatsApp tanpa tahu panjang krat spesifik.
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Switch 
              checked={shopEnableCartInput} 
              onCheckedChange={(val) => {
                setShopEnableCartInput(val);
                // Auto save
                updateSettingsMutation.mutate({ shop_enable_cart: val ? "true" : "false" }, {
                  onSuccess: () => toast({ title: "Pengaturan Katalog disimpan!" })
                });
              }} 
              className="data-[state=checked]:bg-emerald-600" 
              disabled={isLoadingSettings || updateSettingsMutation.isPending}
            />
          </div>
        </div>
      </div>

      {/* Security Settings Card */}
      <div className="bg-white rounded-3xl p-5 shadow-[0_2px_12px_rgba(0,0,0,0.03)] border border-slate-100 flex flex-col gap-4">
        <div>
          <h3 className="flex items-center gap-2 font-bold text-slate-800 text-base">
            <Lock size={18} className="text-violet-500" />
            Keamanan & Otorisasi
          </h3>
          <p className="text-xs text-slate-500 mt-1 ml-6.5">
            Otorisasi fitur sensitif seperti Retur Barang kini diamankan menggunakan OTP 6 digit dinamis yang dikirim ke notifikasi perangkat Anda.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-violet-50 p-4 rounded-2xl border border-violet-100 text-violet-800">
          <div className="space-y-1">
            <span className="text-sm font-semibold flex items-center gap-1.5"><ShieldCheck size={16} /> Web Push Notification OTP</span>
            <p className="text-xs opacity-80 leading-snug">
              Pastikan Anda mengizinkan notifikasi di browser pada perangkat Owner untuk menerima kode OTP otorisasi.
            </p>
          </div>
          <Button variant="outline" className="bg-white border-violet-200 text-violet-700 hover:bg-violet-100 shrink-0 text-xs h-8" onClick={() => Notification.requestPermission().then(p => toast({ title: p === 'granted' ? 'Notifikasi Diizinkan' : 'Notifikasi Ditolak' }))}>
            Tes Izin Notifikasi
          </Button>
        </div>
      </div>

      {/* Push Notification Card */}
      <div className="bg-white rounded-3xl p-5 shadow-[0_2px_12px_rgba(0,0,0,0.03)] border border-slate-100 flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h3 className="flex items-center gap-2 font-bold text-slate-800 text-base">
              <BellRing size={18} className="text-violet-500" />
              Notifikasi Transaksi
            </h3>
            <p className="text-xs text-slate-500 mt-1 ml-6.5">
              Aktifkan fitur ini agar perangkat Anda menerima Push Notification seketika dari sistem setiap kali ada penjualan baru.
            </p>
          </div>
          <Button 
            onClick={handleEnableNotification} 
            disabled={isEnablingPush}
            className="rounded-full bg-violet-600 hover:bg-violet-700 text-white font-semibold shadow-sm w-full sm:w-auto"
          >
            {isEnablingPush ? "Memproses..." : "Aktifkan Perangkat Ini"}
          </Button>
        </div>
      </div>

      {/* License Info Card */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-[0_2px_12px_rgba(0,0,0,0.03)] overflow-hidden mb-6">
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h3 className="flex items-center gap-2 font-bold text-slate-800 text-base">
              <ShieldCheck size={18} className="text-violet-500" />
              Informasi Lisensi
            </h3>
            <p className="text-xs text-slate-500 mt-1 ml-6.5">
              Status dan masa berlaku lisensi aplikasi Anda
            </p>
          </div>
          {licenseInfo.status === "active" ? (
             <Badge className="bg-green-100 text-green-700 hover:bg-green-200">Aktif</Badge>
          ) : licenseInfo.status === "offline_cached" ? (
             <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-200">Mode Offline</Badge>
          ) : (
             <Badge className="bg-red-100 text-red-700 hover:bg-red-200">Tidak Aktif</Badge>
          )}
        </div>
        <div className="p-4 sm:p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
             <Label className="text-slate-500 text-xs uppercase tracking-wider mb-1 block">Status</Label>
             <p className="font-semibold text-slate-800">{licenseInfo.isValid ? "Berlaku" : "Kedaluwarsa"}</p>
          </div>
          <div>
             <Label className="text-slate-500 text-xs uppercase tracking-wider mb-1 block">Sisa Hari</Label>
             <p className={`font-semibold ${licenseInfo.daysLeft <= 7 && licenseInfo.daysLeft > 0 ? 'text-orange-600' : 'text-slate-800'}`}>
               {licenseInfo.daysLeft} Hari
             </p>
          </div>
          <div>
             <Label className="text-slate-500 text-xs uppercase tracking-wider mb-1 block">Masa Berlaku</Label>
             <p className="font-semibold text-slate-800">
               {licenseInfo.expiresAt ? new Intl.DateTimeFormat('id-ID', { dateStyle: 'long' }).format(licenseInfo.expiresAt) : "-"}
             </p>
          </div>
        </div>

        {/* Form Perpanjangan / Masukkan Key Baru */}
        <div className="border-t border-slate-100 p-4 sm:p-6">
          {!showRenewForm ? (
            <button
              onClick={() => setShowRenewForm(true)}
              className="flex items-center gap-2 text-sm text-violet-600 hover:text-violet-800 font-semibold transition-colors"
            >
              🔑 Masukkan License Key Baru / Perpanjang Lisensi
            </button>
          ) : (
            <div className="flex flex-col sm:flex-row items-end gap-3">
              <div className="flex-1 space-y-1.5">
                <Label className="text-xs font-semibold text-slate-600">License Key Baru</Label>
                <Input
                  value={renewKeyInput}
                  onChange={(e) => setRenewKeyInput(e.target.value.toUpperCase())}
                  placeholder="VOC-XXXX-YYMMDD-XXXX"
                  className="font-mono tracking-widest text-center bg-slate-50 border-slate-200 rounded-xl focus-visible:ring-violet-500"
                  autoFocus
                />
                <p className="text-[11px] text-slate-400">Masukkan kode lisensi baru yang diberikan oleh Admin.</p>
              </div>
              <div className="flex gap-2 w-full sm:w-auto">
                <Button
                  variant="outline"
                  className="flex-1 sm:flex-none rounded-xl border-slate-200"
                  onClick={() => { setShowRenewForm(false); setRenewKeyInput(""); }}
                >
                  Batal
                </Button>
                <Button
                  onClick={handleRenewLicense}
                  disabled={isRenewing || !renewKeyInput.trim()}
                  className="flex-1 sm:flex-none rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-semibold"
                >
                  {isRenewing ? "Memverifikasi..." : "✓ Aktifkan Key"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Payment Methods Card */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-[0_2px_12px_rgba(0,0,0,0.03)] overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h3 className="flex items-center gap-2 font-bold text-slate-800 text-base">
              <CreditCard size={18} className="text-violet-500" />
              Metode Pembayaran
            </h3>
            <p className="text-xs text-slate-500 mt-1 ml-6.5">
              Kelola metode pembayaran yang tersedia di transaksi
            </p>
          </div>
          <Button
            size="sm"
            className="h-9 gap-1.5 rounded-full bg-violet-600 hover:bg-violet-700 text-white font-semibold shadow-sm w-full sm:w-auto"
            onClick={() => setIsAddOpen(true)}
          >
            <Plus size={14} />
            Tambah
          </Button>
        </div>
        
        {/* Mobile View for Payment Methods */}
        <div className="md:hidden flex flex-col divide-y divide-slate-100">
          {isLoading ? (
            <div className="p-8 text-center text-sm text-slate-500">Memuat...</div>
          ) : methods.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">Belum ada metode pembayaran</div>
          ) : (
            methods.map((m) => (
              <div key={m.id} className="p-4 flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                    {m.name}
                    {!m.isActive && <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-medium">Nonaktif</span>}
                  </h4>
                  <div className="flex gap-2 mt-1">
                    <span className="text-[10px] bg-slate-50 border border-slate-200 text-slate-600 px-2 py-0.5 rounded font-mono">{m.code}</span>
                    <span className="text-[10px] text-slate-400 font-medium">Urutan: {m.sortOrder}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-700 bg-slate-50 rounded-full" onClick={() => setEditItem({ id: m.id, name: m.name, isActive: m.isActive, sortOrder: m.sortOrder })}>
                    <Pencil size={14} />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-600 bg-slate-50 rounded-full" onClick={() => handleDelete(m.id)}>
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Desktop View for Payment Methods */}
        <div className="hidden md:block">
          <Table>
            <TableHeader className="bg-slate-50/50">
              <TableRow className="border-slate-100">
                <TableHead className="w-8 pl-6"></TableHead>
                <TableHead className="pl-2 font-semibold text-slate-600 h-10">Nama</TableHead>
                <TableHead className="font-semibold text-slate-600 h-10">Kode</TableHead>
                <TableHead className="w-24 text-center font-semibold text-slate-600 h-10">Urutan</TableHead>
                <TableHead className="w-24 text-center font-semibold text-slate-600 h-10">Status</TableHead>
                <TableHead className="w-28 text-right pr-6 font-semibold text-slate-600 h-10">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-10 text-slate-500">Memuat...</TableCell>
                </TableRow>
              ) : methods.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-10 text-slate-500">Belum ada metode pembayaran</TableCell>
                </TableRow>
              ) : (
                methods.map((m) => (
                  <TableRow key={m.id} className="border-slate-50">
                    <TableCell className="pl-6"><GripVertical size={14} className="text-slate-300" /></TableCell>
                    <TableCell className="pl-2 font-medium text-slate-800 text-sm">{m.name}</TableCell>
                    <TableCell><code className="text-xs bg-slate-50 border border-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono">{m.code}</code></TableCell>
                    <TableCell className="text-center text-sm text-slate-500">{m.sortOrder}</TableCell>
                    <TableCell className="text-center"><Switch checked={m.isActive} onCheckedChange={() => handleToggleActive(m)} className="scale-90 data-[state=checked]:bg-violet-500" /></TableCell>
                    <TableCell className="text-right pr-6">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-slate-800 rounded-full hover:bg-slate-100" onClick={() => setEditItem({ id: m.id, name: m.name, isActive: m.isActive, sortOrder: m.sortOrder })}><Pencil size={13} /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-red-600 rounded-full hover:bg-red-50" onClick={() => handleDelete(m.id)}><Trash2 size={13} /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Units Card */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-[0_2px_12px_rgba(0,0,0,0.03)] overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h3 className="flex items-center gap-2 font-bold text-slate-800 text-base">
              <Box size={18} className="text-violet-500" />
              Satuan Barang
            </h3>
            <p className="text-xs text-slate-500 mt-1 ml-6.5">
              Kelola jenis satuan utama dan tambahan untuk data barang
            </p>
          </div>
          <Button
            size="sm"
            className="h-9 gap-1.5 rounded-full bg-violet-600 hover:bg-violet-700 text-white font-semibold shadow-sm w-full sm:w-auto"
            onClick={() => setIsAddUnitOpen(true)}
          >
            <Plus size={14} />
            Tambah
          </Button>
        </div>
        
        {/* Mobile View for Units */}
        <div className="md:hidden flex flex-col divide-y divide-slate-100">
          {isLoadingUnits ? (
            <div className="p-8 text-center text-sm text-slate-500">Memuat...</div>
          ) : units.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">Belum ada satuan</div>
          ) : (
            units.map((u) => (
              <div key={u.id} className="p-4 flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-slate-800 text-sm">{u.name}</h4>
                  <span className="text-[10px] bg-slate-50 border border-slate-200 text-slate-600 px-2 py-0.5 rounded mt-1 inline-block">{u.symbol}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-700 bg-slate-50 rounded-full" onClick={() => setEditUnitItem({ id: u.id, name: u.name, symbol: u.symbol })}>
                    <Pencil size={14} />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-600 bg-slate-50 rounded-full" onClick={() => handleDeleteUnit(u.id)}>
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Desktop View for Units */}
        <div className="hidden md:block">
          <Table>
            <TableHeader className="bg-slate-50/50">
              <TableRow className="border-slate-100">
                <TableHead className="w-8 pl-6"></TableHead>
                <TableHead className="font-semibold text-slate-600 h-10">Nama Satuan</TableHead>
                <TableHead className="font-semibold text-slate-600 h-10">Simbol</TableHead>
                <TableHead className="w-28 text-right pr-6 font-semibold text-slate-600 h-10">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoadingUnits ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-10 text-slate-500">Memuat...</TableCell>
                </TableRow>
              ) : units.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-10 text-slate-500">Belum ada satuan</TableCell>
                </TableRow>
              ) : (
                units.map((u) => (
                  <TableRow key={u.id} className="border-slate-50">
                    <TableCell className="pl-6"><GripVertical size={14} className="text-slate-300" /></TableCell>
                    <TableCell className="font-medium text-slate-800 text-sm">{u.name}</TableCell>
                    <TableCell><Badge variant="outline" className="text-slate-600 border-slate-200 bg-slate-50">{u.symbol}</Badge></TableCell>
                    <TableCell className="text-right pr-6">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-slate-800 rounded-full hover:bg-slate-100" onClick={() => setEditUnitItem({ id: u.id, name: u.name, symbol: u.symbol })}><Pencil size={13} /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-red-600 rounded-full hover:bg-red-50" onClick={() => handleDeleteUnit(u.id)}><Trash2 size={13} /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Add Dialog */}
      <Drawer open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DrawerContent className="mx-auto w-full max-w-sm px-4 sm:px-6 pb-[max(1.5rem,env(safe-area-inset-bottom,0px))] pt-2 flex flex-col" style={{ maxHeight: "calc(95dvh - env(safe-area-inset-top, 0px))" }}>
          <DrawerHeader>
            <DrawerTitle>Tambah Metode Pembayaran</DrawerTitle>
          </DrawerHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Kode <span className="text-muted-foreground text-xs">(unik, otomatis lowercase)</span></Label>
              <Input
                placeholder="mis: gopay, ovo, dana"
                value={newCode}
                onChange={(e) => setNewCode(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Nama Tampil</Label>
              <Input
                placeholder="mis: GoPay / OVO / DANA"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Urutan <span className="text-muted-foreground text-xs">(angka lebih kecil tampil lebih atas)</span></Label>
              <Input
                type="number"
                value={newSortOrder}
                onChange={(e) => setNewSortOrder(e.target.value)}
              />
            </div>
          </div>
          <DrawerFooter className="px-0 pt-4 flex-row gap-2">
            <Button variant="ghost" className="flex-1 bg-muted text-muted-foreground hover:bg-muted/80" onClick={() => setIsAddOpen(false)}>Batal</Button>
            <Button
              className="w-full"
              onClick={handleAdd}
              disabled={!newCode.trim() || !newName.trim() || createMutation.isPending}
            >
              {createMutation.isPending ? "Menyimpan..." : "Simpan"}
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      {/* Edit Dialog */}
      <Drawer open={!!editItem} onOpenChange={() => setEditItem(null)}>
        <DrawerContent className="mx-auto w-full max-w-sm px-4 sm:px-6 pb-[max(1.5rem,env(safe-area-inset-bottom,0px))] pt-2 flex flex-col" style={{ maxHeight: "calc(95dvh - env(safe-area-inset-top, 0px))" }}>
          <DrawerHeader>
            <DrawerTitle>Edit Metode Pembayaran</DrawerTitle>
          </DrawerHeader>
          {editItem && (
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label>Nama Tampil</Label>
                <Input
                  value={editItem.name}
                  onChange={(e) => setEditItem({ ...editItem, name: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Urutan</Label>
                <Input
                  type="number"
                  value={editItem.sortOrder}
                  onChange={(e) => setEditItem({ ...editItem, sortOrder: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={editItem.isActive}
                  onCheckedChange={(v) => setEditItem({ ...editItem, isActive: v })}
                />
                <Label>{editItem.isActive ? "Aktif" : "Nonaktif"}</Label>
              </div>
            </div>
          )}
          <DrawerFooter className="px-0 pt-4 flex-row gap-2">
            <Button variant="ghost" className="flex-1 bg-muted text-muted-foreground hover:bg-muted/80" onClick={() => setEditItem(null)}>Batal</Button>
            <Button className="w-full" onClick={handleEditSave} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "Menyimpan..." : "Simpan"}
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      {/* Add Unit Dialog */}
      <Drawer open={isAddUnitOpen} onOpenChange={setIsAddUnitOpen}>
        <DrawerContent className="mx-auto w-full max-w-sm px-4 sm:px-6 pb-[max(1.5rem,env(safe-area-inset-bottom,0px))] pt-2 flex flex-col" style={{ maxHeight: "calc(95dvh - env(safe-area-inset-top, 0px))" }}>
          <DrawerHeader>
            <DrawerTitle>Tambah Satuan</DrawerTitle>
          </DrawerHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Nama Satuan</Label>
              <Input
                placeholder="mis: KG, YARD, KILOGRAM"
                value={newUnitName}
                onChange={(e) => setNewUnitName(e.target.value.toUpperCase())}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Simbol</Label>
              <Input
                placeholder="mis: m, yds, kg"
                value={newUnitSymbol}
                onChange={(e) => setNewUnitSymbol(e.target.value)}
              />
            </div>
          </div>
          <DrawerFooter className="px-0 pt-4 flex-row gap-2">
            <Button variant="ghost" className="flex-1 bg-muted text-muted-foreground hover:bg-muted/80" onClick={() => setIsAddUnitOpen(false)}>Batal</Button>
            <Button
              className="w-full"
              onClick={handleAddUnit}
              disabled={!newUnitName.trim() || !newUnitSymbol.trim() || createUnitMutation.isPending}
            >
              {createUnitMutation.isPending ? "Menyimpan..." : "Simpan"}
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      {/* Edit Unit Dialog */}
      <Drawer open={!!editUnitItem} onOpenChange={() => setEditUnitItem(null)}>
        <DrawerContent className="mx-auto w-full max-w-sm px-4 sm:px-6 pb-[max(1.5rem,env(safe-area-inset-bottom,0px))] pt-2 flex flex-col" style={{ maxHeight: "calc(95dvh - env(safe-area-inset-top, 0px))" }}>
          <DrawerHeader>
            <DrawerTitle>Edit Satuan</DrawerTitle>
          </DrawerHeader>
          {editUnitItem && (
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label>Nama Satuan</Label>
                <Input
                  value={editUnitItem.name}
                  onChange={(e) => setEditUnitItem({ ...editUnitItem, name: e.target.value.toUpperCase() })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Simbol</Label>
                <Input
                  value={editUnitItem.symbol}
                  onChange={(e) => setEditUnitItem({ ...editUnitItem, symbol: e.target.value })}
                />
              </div>
            </div>
          )}
          <DrawerFooter className="px-0 pt-4 flex-row gap-2">
            <Button variant="ghost" className="flex-1 bg-muted text-muted-foreground hover:bg-muted/80" onClick={() => setEditUnitItem(null)}>Batal</Button>
            <Button className="w-full" onClick={handleEditUnitSave} disabled={updateUnitMutation.isPending}>
              {updateUnitMutation.isPending ? "Menyimpan..." : "Simpan"}
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
