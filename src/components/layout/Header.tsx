"use client";

import { useState, useEffect, useRef } from "react";
import { Search, Bell } from "lucide-react";
import Link from "next/link";

interface SearchResult {
  type: "client" | "product" | "installation";
  id: string;
  title: string;
  subtitle: string | null;
}

export default function Header() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
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
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white/80 backdrop-blur-sm px-6">
      <div ref={ref} className="relative w-96">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Rechercher clients, produits, installations..."
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

      <div className="flex items-center gap-4">
        <button className="relative rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors">
          <Bell className="h-5 w-5" />
        </button>
      </div>
    </header>
  );
}
