"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Monitor,
  Users,
  Package,
  FileText,
  RefreshCw,
  Settings,
  LogOut,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Installations", href: "/installations", icon: Monitor },
  { name: "Clients", href: "/clients", icon: Users },
  { name: "Produits", href: "/products", icon: Package },
  { name: "Factures", href: "/invoices", icon: FileText },
  { name: "Synchronisation", href: "/sync", icon: RefreshCw },
  { name: "Paramètres", href: "/settings", icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r border-slate-200 bg-white flex flex-col">
      <div className="flex h-16 items-center gap-2 border-b border-slate-200 px-6">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-600">
          <Zap className="h-4 w-4 text-white" />
        </div>
        <div>
          <span className="text-base font-bold tracking-tight text-slate-900">COMET</span>
          <span className="ml-1 text-base font-light tracking-tight text-primary-600">CEDELIA</span>
        </div>
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
          href="/api/auth/signout"
          className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Déconnexion
        </Link>
      </div>
    </aside>
  );
}
