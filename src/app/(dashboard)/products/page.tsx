"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Search } from "lucide-react";
import DataTable from "@/components/ui/DataTable";
import { useDebounce } from "@/lib/hooks/useDebounce";

const STORAGE_KEY = "products-filters";

interface Product {
  id: string;
  name: string;
  code: string | null;
  family: string | null;
  supplier: string | null;
  duration: string | null;
  durationMonths: number | null;
  unitPrice: number | null;
  _count: { installations: number };
}

function readSaved(): Record<string, string> {
  try { return JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "{}"); } catch { return {}; }
}
function init(sp: URLSearchParams, key: string, fb = ""): string {
  return sp.get(key) || readSaved()[key] || fb;
}

export default function ProductsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const mountRef = useRef(false);

  const [products, setProducts] = useState<Product[]>([]);
  const [page, setPage] = useState(() => parseInt(init(searchParams, "page", "1")) || 1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(() => init(searchParams, "search"));
  const [perPage, setPerPage] = useState(() => parseInt(init(searchParams, "perPage", "40")) || 40);
  const debouncedSearch = useDebounce(search);

  useEffect(() => {
    if (!mountRef.current) { mountRef.current = true; return; }
    const p = new URLSearchParams();
    if (debouncedSearch) p.set("search", debouncedSearch);
    if (page > 1) p.set("page", String(page));
    if (perPage !== 40) p.set("perPage", String(perPage));
    const qs = p.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    const s: Record<string, string> = {};
    if (debouncedSearch) s.search = debouncedSearch;
    if (page > 1) s.page = String(page);
    if (perPage !== 40) s.perPage = String(perPage);
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  }, [debouncedSearch, page, perPage, pathname, router]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("limit", String(perPage));
    if (debouncedSearch) params.set("search", debouncedSearch);

    const res = await fetch(`/api/products?${params}`);
    const data = await res.json();
    setProducts(data.products || []);
    setTotalPages(data.pagination?.totalPages || 1);
    setLoading(false);
  }, [page, debouncedSearch, perPage]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const columns = [
    {
      key: "name",
      label: "Produit",
      width: "60%",
      render: (p: Product) => (
        <span className="font-medium text-slate-900 block truncate max-w-[300px]" title={p.name}>
          {p.name}
        </span>
      ),
    },
    { key: "code", label: "Code" },
    { key: "family", label: "Famille" },
    { key: "supplier", label: "Fournisseur" },
    {
      key: "duration",
      label: "Durée",
      render: (p: Product) => p.durationMonths ? `${p.durationMonths} mois` : "—",
    },
    {
      key: "unitPrice",
      label: "Prix unitaire",
      render: (p: Product) => p.unitPrice ? `${p.unitPrice.toFixed(2)} €` : "—",
    },
    {
      key: "_count.installations",
      label: "Installations",
      render: (p: Product) => (
        <span className="rounded-full bg-primary-600/20 px-2.5 py-0.5 text-xs font-medium text-primary-600">
          {p._count.installations}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Produits</h1>
        <p className="text-sm text-slate-500 mt-1">Catalogue des produits synchronisés</p>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Rechercher un produit..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-10 pr-4 text-sm text-slate-800 placeholder-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        />
      </div>

      <DataTable
        columns={columns}
        data={products}
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        onRowClick={(p) => router.push(`/products/${p.id}`)}
        isLoading={loading}
        perPage={perPage}
        onPerPageChange={setPerPage}
      />
    </div>
  );
}
