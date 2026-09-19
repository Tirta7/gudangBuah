import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/hooks/useAuth";
import { sessionExpiredEvent } from "@/hooks/useAuth";
import NotFound from "@/pages/not-found";
import Login from "@/pages/Login";
import Home from "@/pages/Home";
import Dashboard from "@/pages/Dashboard";
import Kategori from "@/pages/Kategori";
import Barang from "@/pages/Barang";
import Pelanggan from "@/pages/Pelanggan";
import Supplier from "@/pages/Supplier";
import Penjualan from "@/pages/Penjualan";
import Pembelian from "@/pages/Pembelian";
import Mutasi from "@/pages/Mutasi";
import Retur from "@/pages/Retur"; // Retur Page
import Piutang from "@/pages/Piutang";
import Hutang from "@/pages/Hutang";
import BukuKas from "@/pages/BukuKas";
import Laporan from "@/pages/Laporan";
import Pengaturan from "@/pages/Pengaturan";
import Karyawan from "@/pages/Karyawan";
import { Loader2 } from "lucide-react";
import Shop from "@/pages/Shop";
import { LicenseGate } from "@/components/LicenseGate";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: (failureCount, error: any) => {
        // Jangan retry jika 401 (session expired)
        if (error?.status === 401 || error?.message?.includes('401')) return false;
        return failureCount < 1;
      },
    },
    mutations: {
      onError: (error: any) => {
        if (error?.status === 401 || error?.message?.includes('401')) {
          // Session expired — broadcast event untuk logout
          window.dispatchEvent(new Event(sessionExpiredEvent));
        }
      },
    },
  },
});

function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center"
        style={{ background: "linear-gradient(135deg, #0d0a1f 0%, #07090f 100%)" }}>
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={32} className="animate-spin text-violet-400" />
          <p className="text-white/40 text-sm">Memuat sistem...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return <>{children}</>;
}

function Router() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  return (
    <AppLayout>
      <Switch>
        <Route path="/" component={Home} />
        {isAdmin && <Route path="/dashboard" component={Dashboard} />}
        
        <Route path="/kategori" component={Kategori} />
        <Route path="/barang" component={Barang} />
        <Route path="/pelanggan" component={Pelanggan} />
        <Route path="/supplier" component={Supplier} />
        <Route path="/penjualan" component={Penjualan} />
        <Route path="/pembelian" component={Pembelian} />
        <Route path="/retur" component={Retur} />
        <Route path="/mutasi" component={Mutasi} />
        <Route path="/piutang" component={Piutang} />
        <Route path="/hutang" component={Hutang} />
        <Route path="/buku-kas" component={BukuKas} />
        
        {isAdmin && <Route path="/laporan" component={Laporan} />}
        {isAdmin && <Route path="/pengaturan" component={Pengaturan} />}
        {isAdmin && <Route path="/karyawan" component={Karyawan} />}
        
        {/* Redirect non-admins trying to access restricted routes */}
        {!isAdmin && <Route path="/laporan"><Redirect to="/penjualan" /></Route>}
        {!isAdmin && <Route path="/pengaturan"><Redirect to="/penjualan" /></Route>}
        {!isAdmin && <Route path="/karyawan"><Redirect to="/penjualan" /></Route>}
        
        <Route component={NotFound} />
      </Switch>
    </AppLayout>
  );
}

import { useEffect } from "react";
import { useSettings } from "@/hooks/useSettings";

function GlobalAppEffects() {
  const { data: settings } = useSettings();

  useEffect(() => {
    const appName = settings?.["app_name"];
    if (appName) {
      document.title = appName;
    } else {
      document.title = "Gudang Buah";
    }

    const appLogo = settings?.["app_logo"];
    if (appLogo && appLogo !== "/favicon.svg") {
      // Remove all existing icon links to force browser to pick up the new one
      const existingLinks = document.querySelectorAll("link[rel~='icon']");
      existingLinks.forEach(link => link.remove());

      // Create new standard favicon
      const link = document.createElement('link');
      link.rel = 'icon';
      link.href = appLogo;
      document.head.appendChild(link);

      // Create new apple-touch-icon
      const appleLink = document.createElement('link');
      appleLink.rel = 'apple-touch-icon';
      appleLink.href = appLogo;
      document.head.appendChild(appleLink);
    }
  }, [settings]);

  return null;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <GlobalAppEffects />
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Switch>
            {/* Public shop route at root */}
            <Route path="/" component={Shop} />
            
            {/* Redirect old /shop to root */}
            <Route path="/shop"><Redirect to="/" /></Route>
            
            {/* Protected POS routes under /pos */}
            <Route path="/pos/*?">
              <WouterRouter base="/pos">
                <LicenseGate>
                  <AuthGate>
                    <Router />
                  </AuthGate>
                </LicenseGate>
              </WouterRouter>
            </Route>
            
            <Route component={NotFound} />
          </Switch>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
