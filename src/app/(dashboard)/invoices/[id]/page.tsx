"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Calendar, Building2, FileText, Package, RefreshCw, Plus } from "lucide-react";
import StatusBadge from "@/components/ui/StatusBadge";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { formatDate, formatCurrency } from "@/lib/utils";
import Link from "next/link";

interface InvoiceLine {
  id: string;
  description: string | null;
  quantity: number;
  unitPrice: number | null;
  totalPrice: number | null;
  product: {
    id: string;
    name: string;
    code: string | null;
    family: string | null;
    supplier: string | null;
    durationMonths: number | null;
  } | null;
}

interface Installation {
  id: string;
  invoiceLineId: string | null;
  startDate: string;
  endDate: string;
  durationMonths: number;
  status: string;
  product: { id: string; name: string };
}

interface InvoiceDetail {
  id: string;
  axonautId: number | null;
  invoiceNumber: string | null;
  invoiceDate: string;
  totalAmount: number | null;
  status: string | null;
  client: { id: string; name: string; email: string | null; phone: string | null; address: string | null; city: string | null };
  lines: InvoiceLine[];
  installations: Installation[];
}

export default function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [creatingInstall, setCreatingInstall] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/invoices/${id}`)
      .then((r) => r.json())
      .then((data) => setInvoice(data))
      .finally(() => setLoading(false));
  }, [id]);

  async function refreshFromAxonaut() {
    if (!invoice?.axonautId) return;
    setRefreshing(true);
    try {
      const syncRes = await fetch("/api/sync/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "invoice", axonautId: invoice.axonautId }),
      });
      if (!syncRes.ok) {
        const err = await syncRes.json().catch(() => ({}));
        alert(`Erreur: ${err.error || syncRes.statusText}`);
        setRefreshing(false);
        return;
      }
      const res = await fetch(`/api/invoices/${id}`);
      const data = await res.json();
      setInvoice(data);
    } catch {
      alert("Erreur lors de l'actualisation");
    }
    setRefreshing(false);
  }

  async function createInstallation(lineId: string) {
    setCreatingInstall(lineId);
    try {
      const res = await fetch("/api/installations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceLineId: lineId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(`Erreur: ${err.error || res.statusText}`);
        setCreatingInstall(null);
        return;
      }
      // Reload invoice data
      const refreshRes = await fetch(`/api/invoices/${id}`);
      const data = await refreshRes.json();
      setInvoice(data);
    } catch {
      alert("Erreur lors de la création de l'installation");
    }
    setCreatingInstall(null);
  }

  if (loading) return <LoadingSpinner />;
  if (!invoice) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-500">Facture non trouvée</p>
        <button onClick={() => router.back()} className="mt-4 text-primary-600 hover:text-primary-700 text-sm">
          Retour
        </button>
      </div>
    );
  }

  const installedLineIds = new Set(
    invoice.installations.map((inst) => inst.invoiceLineId).filter(Boolean)
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <button
            onClick={() => router.back()}
            className="shrink-0 rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 truncate">
              Facture {invoice.invoiceNumber || "—"}
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              <Link href={`/clients/${invoice.client.id}`} className="text-primary-600 hover:text-primary-700">
                {invoice.client.name}
              </Link>
              {" — "}
              {formatDate(invoice.invoiceDate)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {invoice.axonautId && (
            <button
              onClick={refreshFromAxonaut}
              disabled={refreshing}
              className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-500 hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Actualiser</span>
            </button>
          )}
          {invoice.status && (
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
              {invoice.status}
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          {/* Lignes de facture */}
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200">
              <h3 className="text-sm font-medium text-slate-900">Lignes de facture ({invoice.lines.length})</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-400">Produit</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-400">Famille</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-400">Fournisseur</th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-400">Qté</th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-400">Prix unit.</th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-400">Total</th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-400">Durée</th>
                    <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-slate-400">Installation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {invoice.lines.map((line) => (
                    <tr key={line.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-sm">
                        <div>
                          <p className="font-medium text-slate-900">
                            {line.product?.name || line.description || "—"}
                          </p>
                          {line.product?.code && (
                            <p className="text-xs text-slate-400">{line.product.code}</p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">
                        {line.product?.family || "—"}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">
                        {line.product?.supplier || "—"}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600 text-right">
                        {line.quantity}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600 text-right">
                        {line.unitPrice != null ? formatCurrency(line.unitPrice) : "—"}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-900 font-medium text-right">
                        {line.totalPrice != null ? formatCurrency(line.totalPrice) : "—"}
                      </td>
                      <td className="px-4 py-3 text-sm text-right">
                        {line.product?.durationMonths ? (
                          <span className="rounded-full bg-primary-600/20 px-2 py-0.5 text-xs font-medium text-primary-600">
                            {line.product.durationMonths} mois
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-center">
                        {installedLineIds.has(line.id) ? (
                          <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-600">
                            Créée
                          </span>
                        ) : line.product && !line.product.durationMonths ? (
                          <button
                            onClick={(e) => { e.stopPropagation(); createInstallation(line.id); }}
                            disabled={creatingInstall === line.id}
                            className="inline-flex items-center gap-1 rounded-lg border border-primary-200 bg-primary-50 px-2 py-1 text-xs font-medium text-primary-600 hover:bg-primary-100 transition-colors disabled:opacity-50"
                          >
                            <Plus className="h-3 w-3" />
                            {creatingInstall === line.id ? "Création..." : "Créer installation"}
                          </button>
                        ) : line.product?.durationMonths ? (
                          <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
                            Auto
                          </span>
                        ) : (
                          <span className="text-slate-400 text-xs">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                {invoice.totalAmount != null && (
                  <tfoot>
                    <tr className="border-t border-slate-200">
                      <td colSpan={5} className="px-4 py-3 text-sm font-medium text-slate-500 text-right">
                        Total
                      </td>
                      <td className="px-4 py-3 text-sm font-bold text-slate-900 text-right">
                        {formatCurrency(invoice.totalAmount)}
                      </td>
                      <td />
                      <td />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>

          {/* Installations générées */}
          {invoice.installations.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200">
                <h3 className="text-sm font-medium text-slate-900">
                  Installations générées ({invoice.installations.length})
                </h3>
              </div>
              <div className="divide-y divide-slate-200">
                {invoice.installations.map((inst) => (
                  <Link
                    key={inst.id}
                    href={`/installations/${inst.id}`}
                    className="flex items-center justify-between px-6 py-3 hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Package className="h-4 w-4 text-slate-400" />
                      <div>
                        <p className="text-sm font-medium text-slate-900">{inst.product.name}</p>
                        <p className="text-xs text-slate-400">
                          {formatDate(inst.startDate)} — {formatDate(inst.endDate)} ({inst.durationMonths} mois)
                        </p>
                      </div>
                    </div>
                    <StatusBadge status={inst.status} />
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar info */}
        <div className="space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <h3 className="text-sm font-medium text-slate-500 mb-4">Informations</h3>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="rounded-lg bg-slate-100 p-2">
                  <FileText className="h-4 w-4 text-slate-500" />
                </div>
                <div>
                  <p className="text-xs text-slate-400">N° Facture</p>
                  <p className="text-sm font-medium text-slate-800">{invoice.invoiceNumber || "—"}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="rounded-lg bg-slate-100 p-2">
                  <Calendar className="h-4 w-4 text-slate-500" />
                </div>
                <div>
                  <p className="text-xs text-slate-400">Date</p>
                  <p className="text-sm font-medium text-slate-800">{formatDate(invoice.invoiceDate)}</p>
                </div>
              </div>
              {invoice.totalAmount != null && (
                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-slate-100 p-2">
                    <FileText className="h-4 w-4 text-slate-500" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Montant total</p>
                    <p className="text-sm font-bold text-slate-900">{formatCurrency(invoice.totalAmount)}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <h3 className="text-sm font-medium text-slate-500 mb-4">Client</h3>
            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-900">{invoice.client.name}</p>
              {invoice.client.email && <p className="text-xs text-slate-500">{invoice.client.email}</p>}
              {invoice.client.phone && <p className="text-xs text-slate-500">{invoice.client.phone}</p>}
              {invoice.client.address && (
                <p className="text-xs text-slate-500">
                  {invoice.client.address}{invoice.client.city && `, ${invoice.client.city}`}
                </p>
              )}
              <Link
                href={`/clients/${invoice.client.id}`}
                className="inline-block text-xs text-primary-600 hover:text-primary-700 mt-1"
              >
                Voir le client
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
