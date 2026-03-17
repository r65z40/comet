"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import DataTable from "@/components/ui/DataTable";
import StatusBadge from "@/components/ui/StatusBadge";
import { formatDate } from "@/lib/utils";

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

export default function RenewedPage() {
  const router = useRouter();
  const [installations, setInstallations] = useState<Installation[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [perPage, setPerPage] = useState(40);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("limit", String(perPage));
    params.set("status", "RENOUVELE");
    if (search) params.set("search", search);

    const res = await fetch(`/api/installations?${params}`);
    const data = await res.json();
    setInstallations(data.installations || []);
    setTotalPages(data.pagination?.totalPages || 1);
    setLoading(false);
  }, [page, search, perPage]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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
      key: "status",
      label: "Statut",
      render: (i: Installation) => <StatusBadge status={i.status} endDate={i.endDate} />,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Produits renouvelés</h1>
        <p className="text-sm text-slate-500 mt-1">Installations ayant été renouvelées</p>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Rechercher..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-10 pr-4 text-sm text-slate-800 placeholder-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
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
        perPage={perPage}
        onPerPageChange={setPerPage}
      />
    </div>
  );
}
