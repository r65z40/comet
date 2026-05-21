"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Search } from "lucide-react";
import DataTable from "@/components/ui/DataTable";
import { formatDate, formatCurrency } from "@/lib/utils";
import { useDebounce } from "@/lib/hooks/useDebounce";

const STORAGE_KEY = "invoices-filters";

interface Invoice {
  id: string;
  invoiceNumber: string | null;
  invoiceDate: string;
  totalAmount: number | null;
  status: string | null;
  client: { id: string; name: string };
  _count: { lines: number; installations: number };
}

function readSaved(): Record<string, string> {
  try { return JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "{}"); } catch { return {}; }
}
function init(sp: URLSearchParams, key: string, fb = ""): string {
  return sp.get(key) || readSaved()[key] || fb;
}

export default function InvoicesPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const mountRef = useRef(false);

  const [invoices, setInvoices] = useState<Invoice[]>([]);
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

    const res = await fetch(`/api/invoices?${params}`);
    const data = await res.json();
    setInvoices(data.invoices || []);
    setTotalPages(data.pagination?.totalPages || 1);
    setLoading(false);
  }, [page, debouncedSearch, perPage]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const columns = [
    {
      key: "invoiceNumber",
      label: "N° Facture",
      render: (inv: Invoice) => (
        <span className="font-medium text-slate-900">{inv.invoiceNumber || "—"}</span>
      ),
    },
    {
      key: "client",
      label: "Client",
      width: "35%",
      render: (inv: Invoice) => (
        <span className="font-medium text-slate-900">{inv.client.name}</span>
      ),
    },
    {
      key: "invoiceDate",
      label: "Date",
      render: (inv: Invoice) => formatDate(inv.invoiceDate),
    },
    {
      key: "totalAmount",
      label: "Montant",
      render: (inv: Invoice) => inv.totalAmount != null ? formatCurrency(inv.totalAmount) : "—",
    },
    {
      key: "status",
      label: "Statut",
      render: (inv: Invoice) => inv.status ? (
        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
          {inv.status}
        </span>
      ) : "—",
    },
    {
      key: "lines",
      label: "Lignes",
      render: (inv: Invoice) => (
        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
          {inv._count.lines}
        </span>
      ),
    },
    {
      key: "installations",
      label: "Installations",
      render: (inv: Invoice) => (
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
          inv._count.installations > 0
            ? "bg-primary-600/20 text-primary-600"
            : "bg-slate-100 text-slate-400"
        }`}>
          {inv._count.installations}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Factures</h1>
        <p className="text-sm text-slate-500 mt-1">Liste des factures synchronisées depuis Axonaut</p>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Rechercher par numéro ou client..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-10 pr-4 text-sm text-slate-800 placeholder-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        />
      </div>

      <DataTable
        columns={columns}
        data={invoices}
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        onRowClick={(inv) => router.push(`/invoices/${inv.id}`)}
        isLoading={loading}
        perPage={perPage}
        onPerPageChange={setPerPage}
      />
    </div>
  );
}
