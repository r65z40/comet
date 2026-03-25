"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Monitor,
  Users,
  Package,
  FileText,
  Settings,
  LogOut,
  Menu,
  X,
  RotateCcw,
  ClipboardList,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Installations", href: "/installations", icon: Monitor },
  { name: "Renouvelés", href: "/renewed", icon: RotateCcw },
  { name: "Clients", href: "/clients", icon: Users },
  { name: "Produits", href: "/products", icon: Package },
  { name: "Factures", href: "/invoices", icon: FileText },
  { name: "Tableau", href: "/board", icon: ClipboardList },
  { name: "Paramètres", href: "/settings", icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [siteLogo, setSiteLogo] = useState("");

  // Close on route change
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Fetch custom site logo (lightweight branding endpoint)
  useEffect(() => {
    fetch("/api/branding")
      .then((r) => r.json())
      .then((data) => {
        if (data.site_logo) setSiteLogo(data.site_logo);
      })
      .catch(() => {});
  }, []);

  // Prevent body scroll when open on mobile
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  const sidebarContent = (
    <>
      <div className="flex h-16 items-center gap-2 border-b border-slate-200 px-6">
        <img src={siteLogo || "/logo.png"} alt="COMET" width={32} height={32} className="h-8 w-8 rounded" />
        <div>
          <span className="text-base font-bold tracking-tight text-slate-900">COMET</span>
          <span className="ml-0.5 text-base font-light tracking-tight text-primary-600">- CEDELIA</span>
        </div>
        <button
          onClick={() => setOpen(false)}
          className="ml-auto rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 lg:hidden"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {navigation.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary-50 text-primary-600"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.name}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-slate-200 p-3">
        <Link
          href="/signout"
          className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Déconnexion
        </Link>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile hamburger button */}
      <button
        onClick={() => setOpen(true)}
        className="fixed left-4 top-4 z-50 rounded-lg border border-slate-200 bg-white p-2 text-slate-500 shadow-sm hover:bg-slate-50 lg:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-50 h-screen w-64 border-r border-slate-200 bg-white flex flex-col transition-transform duration-300 lg:hidden",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {sidebarContent}
      </aside>

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex fixed left-0 top-0 z-40 h-screen w-64 border-r border-slate-200 bg-white flex-col">
        {sidebarContent}
      </aside>
    </>
  );
}
