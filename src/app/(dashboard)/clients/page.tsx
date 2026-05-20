"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Search } from "lucide-react";
import DataTable from "@/components/ui/DataTable";
import { useDebounce } from "@/lib/hooks/useDebounce";

const STORAGE_KEY = "clients-filters";

interface Contact {
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
}

interface Client {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  city: string | null;
  contacts: Contact[];
  _count: { installations: number };
}

function readSaved(): Record<string, string> {
  try {
    return JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "{}");
  } catch { return {}; }
}

function init(searchParams: URLSearchParams, key: string, fallback: string = ""): string {
  return searchParams.get(key) || readSaved()[key] || fallback;
}

export default function ClientsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const mountRef = useRef(false);

  const [clients, setClients] = useState<Client[]>([]);
  const [page, setPage] = useState(() => parseInt(init(searchParams, "page", "1")) || 1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(() => init(searchParams, "search"));
  const [perPage, setPerPage] = useState(() => parseInt(init(searchParams, "perPage", "40")) || 40);
  const debouncedSearch = useDebounce(search);

  useEffect(() => {
    if (!mountRef.current) { mountRef.current = true; return; }
    const params = new URLSearchParams();
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (page > 1) params.set("page", String(page));
    if (perPage !== 40) params.set("perPage", String(perPage));
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    const save: Record<string, string> = {};
    if (debouncedSearch) save.search = debouncedSearch;
    if (page > 1) save.page = String(page);
    if (perPage !== 40) save.perPage = String(perPage);
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(save));
  }, [debouncedSearch, page, perPage, pathname, router]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("limit", String(perPage));
    if (debouncedSearch) params.set("search", debouncedSearch);

    const res = await fetch(`/api/clients?${params}`);
    const data = await res.json();
    setClients(data.clients || []);
    setTotalPages(data.pagination?.totalPages || 1);
    setLoading(false);
  }, [page, debouncedSearch, perPage]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const columns = [
    {
      key: "name",
      label: "Nom",
      width: "40%",
      render: (c: Client) => <span className="font-medium text-slate-900">{c.name}</span>,
    },
    {
      key: "contact",
      label: "Contact",
      render: (c: Client) => {
        const contact = c.contacts?.[0];
        if (!contact) return <span className="text-slate-400">—</span>;
        const name = [contact.firstName, contact.lastName].filter(Boolean).join(" ");
        return (
          <div className="text-sm">
            {name && <div className="font-medium text-slate-900">{name}</div>}
            {(contact.email || contact.phone || contact.mobile) && (
              <div className="text-slate-500 text-xs">
                {contact.email || contact.phone || contact.mobile}
              </div>
            )}
          </div>
        );
      },
    },
    { key: "city", label: "Ville" },
    {
      key: "installations",
      label: "Installations",
      render: (c: Client) => (
        <span className="rounded-full bg-primary-600/20 px-2.5 py-0.5 text-xs font-medium text-primary-600">
          {c._count.installations}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Clients</h1>
        <p className="text-sm text-slate-500 mt-1">Liste de tous les clients</p>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Rechercher un client..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-10 pr-4 text-sm text-slate-800 placeholder-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        />
      </div>

      <DataTable
        columns={columns}
        data={clients}
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        onRowClick={(c) => router.push(`/clients/${c.id}`)}
        isLoading={loading}
        perPage={perPage}
        onPerPageChange={setPerPage}
      />
    </div>
  );
}
