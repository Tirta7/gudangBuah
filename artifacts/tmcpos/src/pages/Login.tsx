import { useState, useEffect } from "react";
import { PageHeader } from "../components/PageHeader";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useSettings } from "@/hooks/useSettings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Zap, Eye, EyeOff, Loader2 } from "lucide-react";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const [, navigate] = useLocation();
  const [appName, setAppName] = useState("Gudang Buah");
  const [appLogo, setAppLogo] = useState("");

  const { data: settings } = useSettings();

  useEffect(() => {
    if (settings?.["app_name"]) {
      setAppName(settings["app_name"]);
      document.title = settings["app_name"];
    }
    if (settings?.["app_logo"] && settings["app_logo"] !== "/favicon.svg") {
      setAppLogo(settings["app_logo"]);
    }
  }, [settings]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const result = await login(username, password);
    setLoading(false);
    if (result.ok) {
      window.location.href = "/pos";
    } else {
      setError(result.error ?? "Login gagal");
    }
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6 relative overflow-hidden"
      style={{ 
        backgroundColor: "#000000",
        backgroundImage: "radial-gradient(circle at 50% -20%, #222222 0%, #000000 60%)",
        fontFamily: "'-apple-system', BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
        paddingBottom: "max(env(safe-area-inset-bottom), 20px)",
        paddingTop: "max(env(safe-area-inset-top), 20px)"
      }}
    >
      {/* Subtle ambient light */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80vw] h-[80vw] max-w-[600px] max-h-[600px] bg-white/[0.02] rounded-full blur-[80px] pointer-events-none" />

      <div className="w-full max-w-[340px] flex flex-col items-center relative z-10">
        {/* Logo Section */}
        <div className="flex flex-col items-center mb-12">
          <div className="w-[84px] h-[84px] rounded-[22px] flex items-center justify-center mb-6 overflow-hidden relative"
               style={{
                 background: "linear-gradient(180deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 100%)",
                 boxShadow: "inset 0 1px 0 rgba(255,255,255,0.2), 0 20px 40px rgba(0,0,0,0.5)",
                 backdropFilter: "blur(20px)",
                 WebkitBackdropFilter: "blur(20px)"
               }}>
            {appLogo ? (
              <img src={appLogo} alt="Logo" className="w-full h-full object-cover" />
            ) : (
              <Zap size={36} className="text-white drop-shadow-lg" strokeWidth={1.2} />
            )}
          </div>
          <h1 className="text-[32px] font-medium text-white tracking-tight leading-none mb-2">{appName}</h1>
          <p className="text-white/40 text-[11px] font-semibold tracking-[0.2em] uppercase">Virtual Operational Control</p>
        </div>

        {/* Login Form (Premium Glass Style) */}
        <div className="w-full mb-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div 
              className="rounded-[20px] overflow-hidden"
              style={{
                background: "rgba(255, 255, 255, 0.04)",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                backdropFilter: "blur(30px)",
                WebkitBackdropFilter: "blur(30px)",
                boxShadow: "0 10px 40px rgba(0,0,0,0.3)"
              }}
            >
              {/* Username Field */}
              <div className="flex items-center px-5 border-b border-white/[0.06]">
                <Input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Username"
                  autoComplete="username"
                  required
                  className="h-14 border-0 rounded-none px-0 shadow-none focus-visible:ring-0 bg-transparent text-[17px] text-white placeholder:text-white/30 font-light tracking-wide"
                />
              </div>

              {/* Password Field */}
              <div className="flex items-center px-5 relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  autoComplete="current-password"
                  required
                  className="h-14 border-0 rounded-none px-0 shadow-none focus-visible:ring-0 bg-transparent text-[17px] text-white placeholder:text-white/30 font-light tracking-wide pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70 transition-colors"
                >
                  {showPassword ? <EyeOff size={20} strokeWidth={1} /> : <Eye size={20} strokeWidth={1} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="rounded-[14px] px-4 py-3 text-[13px] text-[#ff453a] bg-[#ff453a]/10 border border-[#ff453a]/20 text-center font-medium backdrop-blur-md">
                {error}
              </div>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-14 rounded-[16px] bg-white hover:bg-white/90 active:scale-[0.98] transition-all text-black font-semibold text-[17px]"
              style={{ boxShadow: "0 8px 30px rgba(255,255,255,0.12)" }}
            >
              {loading ? (
                <><Loader2 size={20} className="mr-2 animate-spin text-black" /> Memverifikasi...</>
              ) : (
                "Sign In"
              )}
            </Button>
          </form>
        </div>

        <p className="text-center text-white/30 text-[12px] mt-8 font-light tracking-wide">
          &copy; {new Date().getFullYear()} Enka Textile
        </p>
      </div>
    </div>
  );
}
