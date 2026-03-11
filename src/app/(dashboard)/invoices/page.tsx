"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import DataTable from "@/components/ui/DataTable";
import { formatDate, formatCurrency } from "@/lib/utils";

interface Invoice {
  id: string;
  invoiceNumber: string | null;
  invoiceDate: string;
  totalAmount: number | null;
  status: string | null;
  client: { id: string; name: string };
  _count: { lines: number; installations: number };
}

export default function InvoicesPage() {
  const router = useRouter();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
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

    const res = await fetch(`/api/invoices?${params}`);
    const data = await res.json();
    setInvoices(data.invoices || []);
    setTotalPages(data.pagination?.totalPages || 1);
    setLoading(false);
  }, [page, search]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const columns = [
    {
      key: "invoiceNumber",
      label: "N° Facture",
      render: (inv: Invoice) => (
        <span className="font-medium text-white">{inv.invoiceNumber || "—"}</span>
      ),
    },
    {
      key: "client",
      label: "Client",
      render: (inv: Invoice) => inv.client.name,
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
        <span className="rounded-full bg-surface-800 px-2.5 py-0.5 text-xs font-medium text-surface-300">
          {inv.status}
        </span>
      ) : "—",
    },
    {
      key: "lines",
      label: "Lignes",
      render: (inv: Invoice) => (
        <span className="rounded-full bg-surface-800 px-2.5 py-0.5 text-xs font-medium text-surface-300">
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
            ? "bg-primary-600/20 text-primary-400"
            : "bg-surface-800 text-surface-500"
        }`}>
          {inv._count.installations}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Factures</h1>
        <p className="text-sm text-surface-400 mt-1">Liste des factures synchronisées depuis Axonaut</p>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-500" />
        <input
          type="text"
          placeholder="Rechercher par numéro ou client..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="w-full rounded-lg border border-surface-700 bg-surface-900 py-2 pl-10 pr-4 text-sm text-surface-200 placeholder-surface-500 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
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
      />
    </div>
  );
}
