import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, Package2, Tags, UserCircle2, Building2,
  Receipt, ShoppingBasket, ArrowLeftRight, Landmark, CreditCard,
  BookMarked, BarChart3, Zap, X, Settings, LogOut, Home,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/hooks/useAuth";
import { useSettings } from "@/hooks/useSettings";

const navigation = [
  {
    title: "Overview",
    requiredRoles: ["admin", "kasir"],
    items: [
      { name: "Menu Utama", href: "/", icon: Home, requiredRoles: ["admin", "kasir"] },
      { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard, requiredRoles: ["admin"] },
    ]
  },
  {
    title: "Master Data",
    requiredRoles: ["admin", "kasir"],
    items: [
      { name: "Kategori", href: "/kategori", icon: Tags },
      { name: "Barang", href: "/barang", icon: Package2 },
      { name: "Pelanggan", href: "/pelanggan", icon: UserCircle2 },
      { name: "Supplier", href: "/supplier", icon: Building2 },
    ]
  },
  {
    title: "Transaksi",
    requiredRoles: ["admin", "kasir"],
    items: [
      { name: "Penjualan", href: "/penjualan", icon: Receipt },
      { name: "Pembelian", href: "/pembelian", icon: ShoppingBasket },
      { name: "Mutasi Stok", href: "/mutasi", icon: ArrowLeftRight },
    ]
  },
  {
    title: "Keuangan",
    requiredRoles: ["admin", "kasir"],
    items: [
      { name: "Piutang", href: "/piutang", icon: Landmark },
      { name: "Hutang", href: "/hutang", icon: CreditCard },
      { name: "Buku Kas", href: "/buku-kas", icon: BookMarked },
    ]
  },
  {
    title: "Pengaturan",
    requiredRoles: ["admin"],
    items: [
      { name: "Laporan", href: "/laporan", icon: BarChart3 },
      { name: "Pengaturan", href: "/pengaturan", icon: Settings },
      { name: "Karyawan", href: "/karyawan", icon: UserCircle2 },
    ]
  }
];

interface SidebarProps {
  isOpen: boolean;
  setOpen: (open: boolean) => void;
  collapsed: boolean;
  setCollapsed: (c: boolean) => void;
}

export function Sidebar({ isOpen, setOpen, collapsed, setCollapsed }: SidebarProps) {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const { data: settings } = useSettings();
  const appName = settings?.["app_name"] || "Gudang Buah";
  const appLogo = settings?.["app_logo"];

  const handleLogout = async () => {
    await logout();
    window.location.href = "/";
  };

  const initials = user?.fullName
    ?.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) ?? "A";

  const sidebarWidth = collapsed ? "w-[58px]" : "w-52";

  return (
    <>
      {/* Mobile overlay */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden transition-opacity duration-300",
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={() => setOpen(false)}
      />

      {/* Sidebar panel */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 transition-all duration-300 ease-in-out",
          "lg:sticky lg:top-0 lg:h-screen flex flex-col border-r border-white/8",
          sidebarWidth,
          isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
        style={{ background: "linear-gradient(180deg, #1a1832 0%, #131226 60%, #0c0b1a 100%)" }}
      >
        {/* Brand Header */}
        <div
          className="h-14 flex items-center px-3 border-b border-white/5 shrink-0 gap-2"
          style={{ background: "linear-gradient(135deg, rgba(139,92,246,0.10) 0%, transparent 70%)" }}
        >
          {/* Logo */}
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 overflow-hidden"
            style={{ background: "linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)" }}
          >
            {appLogo ? (
              <img src={appLogo} alt="Logo" className="w-full h-full object-cover" />
            ) : (
              <Zap size={14} className="text-white" />
            )}
          </div>

          {/* App name — hidden when collapsed */}
          {!collapsed && (
            <div className="flex-1 min-w-0 overflow-hidden">
              <div className="font-bold text-white text-[14px] tracking-tight leading-none truncate">{appName}</div>
              <div className="text-[8px] text-white/20 tracking-[0.12em] uppercase mt-0.5 truncate">Virtual OC</div>
            </div>
          )}

          {/* Close — mobile only */}
          <button
            className="lg:hidden flex items-center justify-center w-6 h-6 rounded-md text-white/30 hover:text-white/70 hover:bg-white/8 transition-all duration-200 shrink-0"
            onClick={() => setOpen(false)}
          >
            <X size={14} />
          </button>
        </div>

        {/* Navigation */}
        <ScrollArea className="flex-1 py-3">
          <nav className={cn("space-y-4", collapsed ? "px-1.5" : "px-2")}>
            {navigation
              .filter(group => !group.requiredRoles || group.requiredRoles.includes(user?.role as string || "admin"))
              .map((group) => (
                <div key={group.title}>
                  {/* Group title — hidden when collapsed */}
                  {!collapsed && (
                    <h4 className="px-2 text-[9px] font-semibold text-white/20 uppercase tracking-[0.18em] mb-1">
                      {group.title}
                    </h4>
                  )}
                  {collapsed && <div className="h-px bg-white/5 my-2 mx-1" />}

                  <div className="space-y-0.5">
                    {group.items
                      .filter(item => !item.requiredRoles || item.requiredRoles.includes(user?.role as string || "admin"))
                      .map((item) => {
                        const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
                        return (
                          <Link key={item.name} href={item.href} onClick={() => setOpen(false)}>
                            <div
                              title={collapsed ? item.name : undefined}
                              className={cn(
                                "flex items-center rounded-lg text-[12px] font-medium transition-all duration-150 cursor-pointer group",
                                collapsed ? "justify-center p-2" : "gap-2.5 px-2 py-1.5",
                                isActive
                                  ? "text-white"
                                  : "text-white/50 hover:text-white/80 hover:bg-white/8"
                              )}
                              style={isActive ? {
                                background: "linear-gradient(135deg, rgba(139,92,246,0.28) 0%, rgba(99,102,241,0.12) 100%)",
                                boxShadow: "0 0 20px rgba(139,92,246,0.12), inset 0 1px 0 rgba(255,255,255,0.06)"
                              } : {}}
                            >
                              {/* Icon */}
                              <div
                                className={cn(
                                  "flex items-center justify-center shrink-0 rounded-md transition-all duration-150",
                                  collapsed ? "w-6 h-6" : "w-6 h-6",
                                  isActive ? "text-white" : "text-white/30 group-hover:text-white/55"
                                )}
                                style={isActive ? {
                                  background: "linear-gradient(135deg, rgba(139,92,246,0.55) 0%, rgba(99,102,241,0.35) 100%)",
                                  boxShadow: "0 0 8px rgba(139,92,246,0.35)"
                                } : { background: "rgba(255,255,255,0.04)" }}
                              >
                                <item.icon size={13} />
                              </div>

                              {/* Label */}
                              {!collapsed && (
                                <span className="truncate flex-1">{item.name}</span>
                              )}

                              {/* Active dot */}
                              {isActive && !collapsed && (
                                <div
                                  className="w-1 h-1 rounded-full shrink-0"
                                  style={{ background: "linear-gradient(135deg, #a78bfa, #818cf8)" }}
                                />
                              )}
                            </div>
                          </Link>
                        );
                      })}
                  </div>
                </div>
              ))}
          </nav>
        </ScrollArea>

        {/* Footer */}
        <div className={cn("border-t border-white/5 shrink-0", collapsed ? "px-1.5 py-2" : "px-3 py-2.5")}>
          {collapsed ? (
            // Collapsed: show only avatar + logout icon stacked
            <div className="flex flex-col items-center gap-2">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                style={{ background: "linear-gradient(135deg, #8b5cf6, #6366f1)" }}
              >
                {initials}
              </div>
              <button
                onClick={handleLogout}
                className="text-white/25 hover:text-red-400 transition-colors duration-200 p-1 rounded-md hover:bg-red-500/10"
                title="Keluar"
              >
                <LogOut size={13} />
              </button>
            </div>
          ) : (
            // Expanded: full user info row
            <div className="flex items-center gap-2">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                style={{ background: "linear-gradient(135deg, #8b5cf6, #6366f1)" }}
              >
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-medium text-white/65 truncate">{user?.fullName ?? "Admin"}</div>
                <div className="text-[9px] text-white/20 truncate">{user?.username ?? ""}</div>
              </div>
              <button
                onClick={handleLogout}
                className="text-white/25 hover:text-red-400 transition-colors duration-200 shrink-0 p-1 rounded-md hover:bg-red-500/10"
                title="Keluar"
              >
                <LogOut size={13} />
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
