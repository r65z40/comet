"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { LayoutDashboard, Monitor, FileText, BookOpen, LogOut, Ticket } from "lucide-react";

interface PortalContextType {
  client: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    logoUrl: string | null;
    city: string | null;
  } | null;
  user: { id: string; name: string; email: string } | null;
  portalSettings: {
    primaryColor: string;
    headerLogo: string | null;
    welcomeMessage: string | null;
    welcomeTitle: string | null;
    welcomeContent: string | null;
    showStats: boolean;
    showExpiring: boolean;
    showFamily: boolean;
    showSupplier: boolean;
    showDuration: boolean;
    showQuantity: boolean;
    showComParc: boolean;
    showHeaderRow: boolean;
    footerText: string | null;
  } | null;
  companyLogo: string | null;
  companyName: string | null;
}

const PortalContext = createContext<PortalContextType>({ client: null, user: null, portalSettings: null, companyLogo: null, companyName: null });
export const usePortal = () => useContext(PortalContext);

const navItems = [
  { name: "Tableau de bord", href: "/portal", icon: LayoutDashboard },
  { name: "Installations", href: "/portal/installations", icon: Monitor },
  { name: "Rapport", href: "/portal/report", icon: FileText },
  { name: "Tickets", href: "/portal/tickets", icon: Ticket },
  { name: "Base de connaissances", href: "/portal/knowledge", icon: BookOpen },
];

const defaultSettings: PortalContextType["portalSettings"] = {
  primaryColor: "#3b82f6",
  headerLogo: null,
  welcomeMessage: null,
  welcomeTitle: null,
  welcomeContent: null,
  showStats: true,
  showExpiring: true,
  showFamily: true,
  showSupplier: true,
  showDuration: true,
  showQuantity: false,
  showComParc: false,
  showHeaderRow: true,
  footerText: null,
};

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ctx, setCtx] = useState<PortalContextType>({ client: null, user: null, portalSettings: null, companyLogo: null, companyName: null });
  const [loading, setLoading] = useState(true);

  const isPublicPage = pathname === "/portal/login" || pathname === "/portal/setup" || pathname === "/portal/forgot-password" || pathname === "/portal/reset-password";

  useEffect(() => {
    if (isPublicPage) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function loadSession() {
      // Retry once after a short delay to handle cookie propagation timing
      for (let attempt = 0; attempt < 2; attempt++) {
        if (cancelled) return;
        try {
          const r = await fetch("/api/portal/me");
          if (!r.ok) throw new Error("Unauthorized");
          const data = await r.json();
          if (cancelled) return;
          setCtx({
            client: data.client,
            user: data.user,
            portalSettings: data.portalSettings || defaultSettings,
            companyLogo: data.companyLogo || null,
            companyName: data.companyName || null,
          });
          setLoading(false);
          return;
        } catch {
          if (attempt === 0) {
            await new Promise((r) => setTimeout(r, 300));
          }
        }
      }
      if (!cancelled) {
        window.location.href = "/portal/login";
      }
    }

    loadSession();
    return () => { cancelled = true; };
  }, [router, isPublicPage]);

  async function handleLogout() {
    await fetch("/api/portal/auth", { method: "DELETE" });
    window.location.href = "/portal/login";
  }

  // Public pages (login, setup) render without portal chrome
  if (isPublicPage) {
    return <>{children}</>;
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-primary-600" />
      </div>
    );
  }

  const primaryColor = ctx.portalSettings?.primaryColor || "#3b82f6";

  return (
    <PortalContext.Provider value={ctx}>
      <div className="min-h-screen bg-slate-50">
        {/* Header */}
        <header
          className="sticky top-0 z-30 border-b bg-white/90 backdrop-blur-sm"
          style={{ borderBottomColor: primaryColor + "30" }}
        >
          <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
            <div className="flex items-center gap-3">
              {ctx.companyLogo && (
                <img
                  src={ctx.companyLogo}
                  alt={ctx.companyName || "Société"}
                  className="h-9 rounded-lg object-contain"
                />
              )}
              {ctx.client?.logoUrl && (
                <img
                  src={ctx.client.logoUrl}
                  alt={ctx.client.name}
                  className="h-9 rounded-lg object-contain"
                />
              )}
              <div>
                <span className="text-base font-bold text-slate-900">{ctx.client?.name}</span>
                <span className="ml-1.5 text-xs text-slate-400">Espace client</span>
              </div>
            </div>

            <div className="flex items-center gap-1">
              {navItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors"
                    style={isActive ? { backgroundColor: primaryColor + "15", color: primaryColor } : { color: "#64748b" }}
                  >
                    <item.icon className="h-4 w-4" />
                    <span className="hidden sm:inline">{item.name}</span>
                  </Link>
                );
              })}
              <button
                onClick={handleLogout}
                className="ml-2 flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-colors"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Déconnexion</span>
              </button>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
          {children}
        </main>

        {/* Footer */}
        {ctx.portalSettings?.footerText && (
          <footer className="border-t border-slate-100 py-4 text-center text-xs text-slate-400">
            {ctx.portalSettings.footerText}
          </footer>
        )}
      </div>
    </PortalContext.Provider>
  );
}
