"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, X, ShieldCheck, ShieldAlert, RefreshCw } from "lucide-react";
import DataTable from "@/components/ui/DataTable";
import StatusBadge from "@/components/ui/StatusBadge";
import { formatDate, formatCountdown, getCountdownColor } from "@/lib/utils";

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
  client: { id: string; name: string };
  product: { id: string; name: string; code: string | null };
}

export default function InstallationsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [installations, setInstallations] = useState<Installation[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [statusFilter, setStatusFilter] = useState(searchParams.get("status") || "");
  const [familyFilter, setFamilyFilter] = useState("");
  const [supplierFilter, setSupplierFilter] = useState("");
  const [expiringFilter, setExpiringFilter] = useState(searchParams.get("expiring") || "");
  const [monthFilter, setMonthFilter] = useState(searchParams.get("month") || "");

  const fetchData = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("limit", "40");
    if (search) params.set("search", search);
    if (statusFilter) params.set("status", statusFilter);
    if (familyFilter) params.set("family", familyFilter);
    if (supplierFilter) params.set("supplier", supplierFilter);
    if (expiringFilter) params.set("expiring", expiringFilter);
    if (monthFilter) params.set("month", monthFilter);
    if (!statusFilter) params.set("excludeRenewed", "true");

    const res = await fetch(`/api/installations?${params}`);
    const data = await res.json();
    setInstallations(data.installations || []);
    setTotalPages(data.pagination?.totalPages || 1);
    setLoading(false);
  }, [page, search, statusFilter, familyFilter, supplierFilter, expiringFilter, monthFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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
      render: (i: Installation) => (
        <span className="font-medium text-slate-900">{i.client.name}</span>
      ),
    },
    {
      key: "product",
      label: "Produit",
      render: (i: Installation) => i.product.name,
    },
    { key: "family", label: "Famille" },
    { key: "supplier", label: "Fournisseur" },
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
      key: "status",
      label: "Statut",
      render: (i: Installation) => <StatusBadge status={i.status} endDate={i.endDate} alwaysInFleet={i.alwaysInFleet} />,
    },
    {
      key: "actions",
      label: "Actions",
      render: (i: Installation) => {
        const isEnParc = i.status === "EN_PARC" || i.status === "EN_PARC_GARANTIE";
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

      <DataTable
        columns={columns}
        data={installations}
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        onRowClick={(i) => router.push(`/installations/${i.id}`)}
        isLoading={loading}
        rowClassName={() => ""}
      />
    </div>
  );
}
