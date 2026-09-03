"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Search, X, ShieldCheck, ShieldAlert, RefreshCw, Trash2, CheckSquare } from "lucide-react";
import DataTable from "@/components/ui/DataTable";
import StatusBadge from "@/components/ui/StatusBadge";
import { formatDate, formatCountdown, getCountdownColor } from "@/lib/utils";
import { useDebounce } from "@/lib/hooks/useDebounce";

const STORAGE_KEY = "installations-filters";

interface Installation {
  id: string;
  supplier: string | null;
  family: string | null;
  quantity: number;
  startDate: string;
  durationMonths: number;
  endDate: string;
  status: string;
  alwaysInFleet: boolean;
  comParc: string | null;
  importSource: string | null;
  importDetails: string | null;
  client: { id: string; name: string };
  product: { id: string; name: string; code: string | null };
}

function readSaved(): Record<string, string> {
  try {
    return JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "{}");
  } catch { return {}; }
}

function init(searchParams: URLSearchParams, hasUrlParams: boolean, key: string, fallback: string = ""): string {
  const urlVal = searchParams.get(key);
  if (urlVal) return urlVal;
  if (hasUrlParams) return fallback;
  return readSaved()[key] || fallback;
}

export default function InstallationsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const mountRef = useRef(false);
  const hasUrlParams = searchParams.toString().length > 0;

  const [installations, setInstallations] = useState<Installation[]>([]);
  const [page, setPage] = useState(() => parseInt(init(searchParams, hasUrlParams, "page", "1")) || 1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(() => init(searchParams, hasUrlParams, "search"));
  const [statusFilter, setStatusFilter] = useState(() => init(searchParams, hasUrlParams, "status"));
  const [familyFilter, setFamilyFilter] = useState(() => init(searchParams, hasUrlParams, "family"));
  const [supplierFilter, setSupplierFilter] = useState(() => init(searchParams, hasUrlParams, "supplier"));
  const [expiringFilter, setExpiringFilter] = useState(() => init(searchParams, hasUrlParams, "expiring"));
  const [monthFilter, setMonthFilter] = useState(() => init(searchParams, hasUrlParams, "month"));
  const [perPage, setPerPage] = useState(() => parseInt(init(searchParams, hasUrlParams, "perPage", "40")) || 40);
  const debouncedSearch = useDebounce(search);
  const debouncedFamily = useDebounce(familyFilter);
  const debouncedSupplier = useDebounce(supplierFilter);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);

  // Sync filters → URL + sessionStorage
  useEffect(() => {
    if (!mountRef.current) { mountRef.current = true; return; }
    const params = new URLSearchParams();
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (statusFilter) params.set("status", statusFilter);
    if (debouncedFamily) params.set("family", debouncedFamily);
    if (debouncedSupplier) params.set("supplier", debouncedSupplier);
    if (expiringFilter) params.set("expiring", expiringFilter);
    if (monthFilter) params.set("month", monthFilter);
    if (page > 1) params.set("page", String(page));
    if (perPage !== 40) params.set("perPage", String(perPage));
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    const save: Record<string, string> = {};
    if (debouncedSearch) save.search = debouncedSearch;
    if (statusFilter) save.status = statusFilter;
    if (debouncedFamily) save.family = debouncedFamily;
    if (debouncedSupplier) save.supplier = debouncedSupplier;
    if (expiringFilter) save.expiring = expiringFilter;
    if (monthFilter) save.month = monthFilter;
    if (page > 1) save.page = String(page);
    if (perPage !== 40) save.perPage = String(perPage);
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(save));
  }, [debouncedSearch, statusFilter, debouncedFamily, debouncedSupplier, expiringFilter, monthFilter, page, perPage, pathname, router]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("limit", String(perPage));
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (statusFilter) params.set("status", statusFilter);
    if (debouncedFamily) params.set("family", debouncedFamily);
    if (debouncedSupplier) params.set("supplier", debouncedSupplier);
    if (expiringFilter) params.set("expiring", expiringFilter);
    if (monthFilter) params.set("month", monthFilter);
    if (!statusFilter) params.set("excludeRenewed", "true");

    const res = await fetch(`/api/installations?${params}`);
    const data = await res.json();
    setInstallations(data.installations || []);
    setTotalPages(data.pagination?.totalPages || 1);
    setLoading(false);
  }, [page, debouncedSearch, statusFilter, debouncedFamily, debouncedSupplier, expiringFilter, monthFilter, perPage]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function bulkAction(action: string, value?: string | boolean) {
    if (selectedIds.size === 0) return;
    if (action === "delete" && !confirm(`Supprimer ${selectedIds.size} installation(s) ? (récupérable depuis la corbeille)`)) return;
    setBulkLoading(true);
    await fetch("/api/installations/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: Array.from(selectedIds), action, value }),
    });
    setSelectedIds(new Set());
    setBulkLoading(false);
    fetchData();
  }

  async function quickAction(installId: string, action: { status?: string; alwaysInFleet?: boolean }) {
    await fetch(`/api/installations/${installId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(action),
    });
    fetchData();
  }

  const columns = [
    {
      key: "client",
      label: "Client",
      width: "25%",
      render: (i: Installation) => (
        <span className="font-medium text-slate-900">{i.client.name}</span>
      ),
    },
    {
      key: "product",
      label: "Produit",
      width: "15%",
      render: (i: Installation) => (
        <span className="block truncate max-w-[180px]" title={i.product.name}>{i.product.name}</span>
      ),
    },
    { key: "family", label: "Famille" },
    {
      key: "comParc",
      label: "Com Parc",
      render: (i: Installation) => (
        <span className="block truncate text-xs" title={i.comParc || ""}>{i.comParc || "—"}</span>
      ),
    },
    {
      key: "quantity",
      label: "Qté",
      render: (i: Installation) => (
        <span className="text-xs">{i.quantity}</span>
      ),
    },
    {
      key: "startDate",
      label: "Début garantie",
      render: (i: Installation) => formatDate(i.startDate),
    },
    {
      key: "endDate",
      label: "Fin garantie",
      render: (i: Installation) => formatDate(i.endDate),
    },
    {
      key: "countdown",
      label: "Compte à rebours",
      render: (i: Installation) => (
        <span className={`text-xs font-bold ${i.alwaysInFleet ? "text-amber-600" : getCountdownColor(i.endDate)}`}>
          {i.alwaysInFleet ? "Toujours en parc" : formatCountdown(i.endDate)}
        </span>
      ),
    },
    {
      key: "importSource",
      label: "Source",
      render: (i: Installation) =>
        i.importSource ? (
          <span
            className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded ${
              i.importSource === "axonaut"
                ? "bg-blue-50 text-blue-700"
                : i.importSource === "import"
                ? "bg-amber-50 text-amber-700"
                : "bg-slate-50 text-slate-600"
            }`}
            title={i.importDetails || ""}
          >
            {i.importSource === "axonaut" ? "API" : i.importSource === "import" ? "Import" : i.importSource}
          </span>
        ) : (
          <span className="text-xs text-slate-300">—</span>
        ),
    },
    {
      key: "status",
      label: "Statut",
      render: (i: Installation) => <StatusBadge status={i.status} endDate={i.endDate} alwaysInFleet={i.alwaysInFleet} />,
    },
    {
      key: "actions",
      label: "Actions",
      render: (i: Installation) => {
        const isEnParc = i.status === "EN_PARC";
        return (
          <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => quickAction(i.id, { status: isEnParc ? "HORS_PARC" : "EN_PARC" })}
              title={isEnParc ? "Retirer du parc" : "Mettre en parc"}
              className={`rounded p-1 transition-colors ${
                isEnParc ? "text-emerald-600 bg-emerald-50" : "text-slate-400 hover:text-emerald-600 hover:bg-emerald-50"
              }`}
            >
              <ShieldCheck className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => quickAction(i.id, { alwaysInFleet: !i.alwaysInFleet })}
              title={i.alwaysInFleet ? "Retirer toujours en parc" : "Toujours en parc"}
              className={`rounded p-1 transition-colors ${
                i.alwaysInFleet ? "text-amber-600 bg-amber-50" : "text-slate-400 hover:text-amber-600 hover:bg-amber-50"
              }`}
            >
              <ShieldAlert className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => quickAction(i.id, { status: "RENOUVELE" })}
              title="Renouvelé"
              className={`rounded p-1 transition-colors ${
                i.status === "RENOUVELE" ? "text-blue-600 bg-blue-50" : "text-slate-400 hover:text-blue-600 hover:bg-blue-50"
              }`}
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Installations</h1>
        <p className="text-sm text-slate-500 mt-1">Suivi des garanties sur les produits installés</p>
      </div>

      {(expiringFilter || monthFilter) && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-slate-400">Filtre actif :</span>
          {expiringFilter && (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary-600/20 px-3 py-1 text-xs font-medium text-primary-600">
              Expire dans {expiringFilter} jours
              <button onClick={() => { setExpiringFilter(""); setPage(1); }} className="hover:text-slate-900">
                <X className="h-3 w-3" />
              </button>
            </span>
          )}
          {monthFilter && (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary-600/20 px-3 py-1 text-xs font-medium text-primary-600">
              Mois : {monthFilter}
              <button onClick={() => { setMonthFilter(""); setPage(1); }} className="hover:text-slate-900">
                <X className="h-3 w-3" />
              </button>
            </span>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Rechercher..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-10 pr-4 text-sm text-slate-800 placeholder-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 focus:border-primary-500 focus:outline-none"
        >
          <option value="">Tous les statuts</option>
          <option value="EN_PARC">En parc</option>
          <option value="HORS_PARC">Hors parc</option>
        </select>

        <input
          type="text"
          placeholder="Famille..."
          value={familyFilter}
          onChange={(e) => { setFamilyFilter(e.target.value); setPage(1); }}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 placeholder-slate-400 focus:border-primary-500 focus:outline-none w-40"
        />

        <input
          type="text"
          placeholder="Fournisseur..."
          value={supplierFilter}
          onChange={(e) => { setSupplierFilter(e.target.value); setPage(1); }}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 placeholder-slate-400 focus:border-primary-500 focus:outline-none w-40"
        />
      </div>

      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-primary-200 bg-primary-50 px-4 py-2.5">
          <CheckSquare className="h-4 w-4 text-primary-600" />
          <span className="text-sm font-medium text-primary-700">{selectedIds.size} sélectionné(s)</span>
          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={() => bulkAction("status", "RENOUVELE")}
              disabled={bulkLoading}
              className="rounded-lg bg-blue-100 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-200 transition-colors disabled:opacity-50"
            >
              Renouvelé
            </button>
            <button
              onClick={() => bulkAction("status", "HORS_PARC")}
              disabled={bulkLoading}
              className="rounded-lg bg-orange-100 px-3 py-1.5 text-xs font-medium text-orange-700 hover:bg-orange-200 transition-colors disabled:opacity-50"
            >
              Hors parc
            </button>
            <button
              onClick={() => bulkAction("delete")}
              disabled={bulkLoading}
              className="rounded-lg bg-red-100 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-200 transition-colors disabled:opacity-50 flex items-center gap-1"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Supprimer
            </button>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100 transition-colors"
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      <DataTable
        columns={columns}
        data={installations}
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        onRowClick={(i) => router.push(`/installations/${i.id}`)}
        isLoading={loading}
        rowClassName={() => ""}
        perPage={perPage}
        onPerPageChange={setPerPage}
        selectable
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
      />
    </div>
  );
}
