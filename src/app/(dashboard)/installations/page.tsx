"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
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

    const res = await fetch(`/api/installations?${params}`);
    const data = await res.json();
    setInstallations(data.installations || []);
    setTotalPages(data.pagination?.totalPages || 1);
    setLoading(false);
  }, [page, search, statusFilter, familyFilter, supplierFilter, expiringFilter, monthFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const columns = [
    {
      key: "client",
      label: "Client",
      render: (i: Installation) => (
        <span className="font-medium text-white">{i.client.name}</span>
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
        <span className={`text-xs font-bold ${getCountdownColor(i.endDate)}`}>
          {formatCountdown(i.endDate)}
        </span>
      ),
    },
    {
      key: "status",
      label: "Statut",
      render: (i: Installation) => <StatusBadge status={i.status} />,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Installations</h1>
        <p className="text-sm text-surface-400 mt-1">Suivi des garanties sur les produits installés</p>
      </div>

      {(expiringFilter || monthFilter) && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-surface-500">Filtre actif :</span>
          {expiringFilter && (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary-600/20 px-3 py-1 text-xs font-medium text-primary-400">
              Expire dans {expiringFilter} jours
              <button onClick={() => { setExpiringFilter(""); setPage(1); }} className="hover:text-white">
                <X className="h-3 w-3" />
              </button>
            </span>
          )}
          {monthFilter && (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary-600/20 px-3 py-1 text-xs font-medium text-primary-400">
              Mois : {monthFilter}
              <button onClick={() => { setMonthFilter(""); setPage(1); }} className="hover:text-white">
                <X className="h-3 w-3" />
              </button>
            </span>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-500" />
          <input
            type="text"
            placeholder="Rechercher..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full rounded-lg border border-surface-700 bg-surface-900 py-2 pl-10 pr-4 text-sm text-surface-200 placeholder-surface-500 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="rounded-lg border border-surface-700 bg-surface-900 px-3 py-2 text-sm text-surface-300 focus:border-primary-500 focus:outline-none"
        >
          <option value="">Tous les statuts</option>
          <option value="EN_PARC_GARANTIE">En parc garantie</option>
          <option value="EN_PARC_HORS_GARANTIE">En parc sans garantie</option>
          <option value="RENOUVELE">Renouvelé</option>
          <option value="NON_DEFINI">Non défini</option>
        </select>

        <input
          type="text"
          placeholder="Famille..."
          value={familyFilter}
          onChange={(e) => { setFamilyFilter(e.target.value); setPage(1); }}
          className="rounded-lg border border-surface-700 bg-surface-900 px-3 py-2 text-sm text-surface-300 placeholder-surface-500 focus:border-primary-500 focus:outline-none w-40"
        />

        <input
          type="text"
          placeholder="Fournisseur..."
          value={supplierFilter}
          onChange={(e) => { setSupplierFilter(e.target.value); setPage(1); }}
          className="rounded-lg border border-surface-700 bg-surface-900 px-3 py-2 text-sm text-surface-300 placeholder-surface-500 focus:border-primary-500 focus:outline-none w-40"
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
      />
    </div>
  );
}
