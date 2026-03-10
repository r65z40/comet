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
    client: "bg-blue-500/20 text-blue-400",
    product: "bg-purple-500/20 text-purple-400",
    installation: "bg-emerald-500/20 text-emerald-400",
  };
  const typeLinks = {
    client: "/clients/",
    product: "/products",
    installation: "/installations/",
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-surface-800 bg-surface-950/80 backdrop-blur-sm px-6">
      <div ref={ref} className="relative w-96">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-500" />
        <input
          type="text"
          placeholder="Rechercher clients, produits, installations..."
          className="w-full rounded-lg border border-surface-700 bg-surface-900 py-2 pl-10 pr-4 text-sm text-surface-200 placeholder-surface-500 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setIsOpen(true)}
        />
        {isOpen && results.length > 0 && (
          <div className="absolute top-full mt-2 w-full rounded-lg border border-surface-700 bg-surface-900 py-2 shadow-xl">
            {results.map((r) => (
              <Link
                key={`${r.type}-${r.id}`}
                href={`${typeLinks[r.type]}${r.type !== "product" ? r.id : ""}`}
                className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-800 transition-colors"
                onClick={() => { setIsOpen(false); setQuery(""); }}
              >
                <span className={`rounded px-2 py-0.5 text-xs font-medium ${typeColors[r.type]}`}>
                  {typeLabels[r.type]}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-surface-200 truncate">{r.title}</p>
                  {r.subtitle && <p className="text-xs text-surface-500 truncate">{r.subtitle}</p>}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center gap-4">
        <button className="relative rounded-lg p-2 text-surface-400 hover:bg-surface-800 hover:text-surface-200 transition-colors">
          <Bell className="h-5 w-5" />
        </button>
      </div>
    </header>
  );
}
