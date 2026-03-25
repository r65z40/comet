"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Search, Bell, AlertTriangle, X, CheckCheck } from "lucide-react";
import Link from "next/link";
import NotificationBell from "./NotificationBell";

interface SearchResult {
  type: "client" | "product" | "installation";
  id: string;
  title: string;
  subtitle: string | null;
}

interface ExpiringItem {
  id: string;
  clientName: string;
  clientId: string;
  productName: string;
  endDate: string;
  daysLeft: number;
}

export default function Header() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Notifications state
  const [notifOpen, setNotifOpen] = useState(false);
  const [allItems, setAllItems] = useState<ExpiringItem[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try {
      const stored = localStorage.getItem("comet_dismissed_notifs");
      if (stored) {
        const parsed = JSON.parse(stored);
        return new Set(parsed.ids as string[]);
      }
    } catch { /* ignore */ }
    return new Set();
  });
  const notifRef = useRef<HTMLDivElement>(null);

  const notifItems = allItems.filter((i) => !dismissed.has(i.id));
  const notifCount = notifItems.length;

  // Search logic
  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      setResults(data.results || []);
      setIsOpen(true);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  // Close search dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Persist dismissed notifications
  const saveDismissed = useCallback((ids: Set<string>) => {
    setDismissed(ids);
    try {
      localStorage.setItem("comet_dismissed_notifs", JSON.stringify({ ids: Array.from(ids) }));
    } catch { /* ignore */ }
  }, []);

  function dismissOne(id: string) {
    const next = new Set(dismissed);
    next.add(id);
    saveDismissed(next);
  }

  function dismissAll() {
    const next = new Set(dismissed);
    allItems.forEach((i) => next.add(i.id));
    saveDismissed(next);
  }

  // Fetch expiring notifications
  useEffect(() => {
    async function fetchNotifs() {
      try {
        const res = await fetch("/api/notifications/expiring");
        if (res.ok) {
          const data = await res.json();
          setAllItems(data.items || []);
        }
      } catch {
        // silently fail
      }
    }
    fetchNotifs();
    const interval = setInterval(fetchNotifs, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const typeLabels = { client: "Client", product: "Produit", installation: "Installation" };
  const typeColors = {
    client: "bg-blue-50 text-blue-600",
    product: "bg-purple-50 text-purple-600",
    installation: "bg-emerald-50 text-emerald-600",
  };
  const typeLinks = {
    client: "/clients/",
    product: "/products",
    installation: "/installations/",
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white/80 backdrop-blur-sm px-4 sm:px-6">
      {/* Spacer for hamburger on mobile */}
      <div className="w-10 lg:hidden" />
      <div ref={ref} className="relative flex-1 max-w-96">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Rechercher..."
          className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-10 pr-4 text-sm text-slate-900 placeholder-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 focus:bg-white"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setIsOpen(true)}
        />
        {isOpen && results.length > 0 && (
          <div className="absolute top-full mt-2 w-full rounded-lg border border-slate-200 bg-white py-2 shadow-lg">
            {results.map((r) => (
              <Link
                key={`${r.type}-${r.id}`}
                href={`${typeLinks[r.type]}${r.type !== "product" ? r.id : ""}`}
                className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 transition-colors"
                onClick={() => { setIsOpen(false); setQuery(""); }}
              >
                <span className={`rounded px-2 py-0.5 text-xs font-medium ${typeColors[r.type]}`}>
                  {typeLabels[r.type]}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">{r.title}</p>
                  {r.subtitle && <p className="text-xs text-slate-500 truncate">{r.subtitle}</p>}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div ref={notifRef} className="relative flex items-center gap-2">
        <NotificationBell />
        <button
          className="relative rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          onClick={() => setNotifOpen(!notifOpen)}
        >
          <Bell className="h-5 w-5" />
          {notifCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white min-w-[18px] h-[18px] px-1">
              {notifCount > 99 ? "99+" : notifCount}
            </span>
          )}
        </button>

        {notifOpen && (
          <div className="absolute right-0 top-full mt-2 w-[calc(100vw-2rem)] sm:w-96 max-w-96 rounded-lg border border-slate-200 bg-white shadow-lg">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <h3 className="text-sm font-semibold text-slate-900">Garanties expirantes</h3>
              <div className="flex items-center gap-2">
                {notifCount > 0 && (
                  <>
                    <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-600">
                      {notifCount}
                    </span>
                    <button
                      onClick={dismissAll}
                      className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                      title="Tout effacer"
                    >
                      <CheckCheck className="h-3.5 w-3.5" />
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="max-h-80 overflow-y-auto">
              {notifItems.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-slate-400">
                  Aucune garantie expirante dans les 30 prochains jours
                </div>
              ) : (
                notifItems.map((item) => {
                  const urgencyColor =
                    item.daysLeft <= 7
                      ? "text-red-600 bg-red-50"
                      : item.daysLeft <= 14
                        ? "text-orange-600 bg-orange-50"
                        : "text-yellow-600 bg-yellow-50";

                  return (
                    <div key={item.id} className="flex items-start gap-0 border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors">
                      <Link
                        href={`/installations/${item.id}`}
                        className="flex flex-1 items-start gap-3 px-4 py-3"
                        onClick={() => setNotifOpen(false)}
                      >
                        <AlertTriangle className={`h-4 w-4 mt-0.5 shrink-0 ${item.daysLeft <= 7 ? "text-red-500" : item.daysLeft <= 14 ? "text-orange-500" : "text-yellow-500"}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-900 truncate">{item.clientName}</p>
                          <p className="text-xs text-slate-500 truncate">{item.productName}</p>
                        </div>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${urgencyColor}`}>
                          {item.daysLeft}j
                        </span>
                      </Link>
                      <button
                        onClick={(e) => { e.stopPropagation(); dismissOne(item.id); }}
                        className="shrink-0 p-2 mt-2 mr-1 rounded text-slate-300 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                        title="Masquer"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            {notifCount > 0 && (
              <div className="border-t border-slate-100 px-4 py-2.5">
                <Link
                  href="/installations?expiring=30"
                  className="text-xs font-medium text-primary-600 hover:text-primary-700"
                  onClick={() => setNotifOpen(false)}
                >
                  Voir toutes les installations expirantes →
                </Link>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
