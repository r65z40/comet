"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import DataTable from "@/components/ui/DataTable";

interface Client {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  city: string | null;
  _count: { installations: number };
}

export default function ClientsPage() {
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("limit", "40");
    if (search) params.set("search", search);

    const res = await fetch(`/api/clients?${params}`);
    const data = await res.json();
    setClients(data.clients || []);
    setTotalPages(data.pagination?.totalPages || 1);
    setLoading(false);
  }, [page, search]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const columns = [
    {
      key: "name",
      label: "Nom",
      render: (c: Client) => <span className="font-medium text-white">{c.name}</span>,
    },
    { key: "email", label: "Email" },
    { key: "phone", label: "Téléphone" },
    { key: "city", label: "Ville" },
    {
      key: "installations",
      label: "Installations",
      render: (c: Client) => (
        <span className="rounded-full bg-primary-600/20 px-2.5 py-0.5 text-xs font-medium text-primary-400">
          {c._count.installations}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Clients</h1>
        <p className="text-sm text-surface-400 mt-1">Liste de tous les clients</p>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-500" />
        <input
          type="text"
          placeholder="Rechercher un client..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="w-full rounded-lg border border-surface-700 bg-surface-900 py-2 pl-10 pr-4 text-sm text-surface-200 placeholder-surface-500 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
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
      />
    </div>
  );
}
