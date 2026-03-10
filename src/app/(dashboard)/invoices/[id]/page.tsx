"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Calendar, Building2, FileText, Package } from "lucide-react";
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
  startDate: string;
  endDate: string;
  durationMonths: number;
  status: string;
  product: { id: string; name: string };
}

interface InvoiceDetail {
  id: string;
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

  useEffect(() => {
    fetch(`/api/invoices/${id}`)
      .then((r) => r.json())
      .then((data) => setInvoice(data))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <LoadingSpinner />;
  if (!invoice) {
    return (
      <div className="text-center py-12">
        <p className="text-surface-400">Facture non trouvée</p>
        <button onClick={() => router.back()} className="mt-4 text-primary-400 hover:text-primary-300 text-sm">
          Retour
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.back()}
          className="rounded-lg border border-surface-700 p-2 text-surface-400 hover:bg-surface-800 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-white">
            Facture {invoice.invoiceNumber || "—"}
          </h1>
          <p className="text-sm text-surface-400 mt-1">
            <Link href={`/clients/${invoice.client.id}`} className="text-primary-400 hover:text-primary-300">
              {invoice.client.name}
            </Link>
            {" — "}
            {formatDate(invoice.invoiceDate)}
          </p>
        </div>
        {invoice.status && (
          <span className="rounded-full bg-surface-800 px-3 py-1 text-xs font-medium text-surface-300">
            {invoice.status}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          {/* Lignes de facture */}
          <div className="rounded-xl border border-surface-800 bg-surface-900 overflow-hidden">
            <div className="px-6 py-4 border-b border-surface-800">
              <h3 className="text-sm font-medium text-white">Lignes de facture ({invoice.lines.length})</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-surface-800">
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-surface-500">Produit</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-surface-500">Famille</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-surface-500">Fournisseur</th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-surface-500">Qté</th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-surface-500">Prix unit.</th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-surface-500">Total</th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-surface-500">Durée</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-800">
                  {invoice.lines.map((line) => (
                    <tr key={line.id} className="hover:bg-surface-800/50">
                      <td className="px-4 py-3 text-sm">
                        <div>
                          <p className="font-medium text-white">
                            {line.product?.name || line.description || "—"}
                          </p>
                          {line.product?.code && (
                            <p className="text-xs text-surface-500">{line.product.code}</p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-surface-300">
                        {line.product?.family || "—"}
                      </td>
                      <td className="px-4 py-3 text-sm text-surface-300">
                        {line.product?.supplier || "—"}
                      </td>
                      <td className="px-4 py-3 text-sm text-surface-300 text-right">
                        {line.quantity}
                      </td>
                      <td className="px-4 py-3 text-sm text-surface-300 text-right">
                        {line.unitPrice != null ? formatCurrency(line.unitPrice) : "—"}
                      </td>
                      <td className="px-4 py-3 text-sm text-white font-medium text-right">
                        {line.totalPrice != null ? formatCurrency(line.totalPrice) : "—"}
                      </td>
                      <td className="px-4 py-3 text-sm text-right">
                        {line.product?.durationMonths ? (
                          <span className="rounded-full bg-primary-600/20 px-2 py-0.5 text-xs font-medium text-primary-400">
                            {line.product.durationMonths} mois
                          </span>
                        ) : (
                          <span className="text-surface-500">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                {invoice.totalAmount != null && (
                  <tfoot>
                    <tr className="border-t border-surface-700">
                      <td colSpan={5} className="px-4 py-3 text-sm font-medium text-surface-400 text-right">
                        Total
                      </td>
                      <td className="px-4 py-3 text-sm font-bold text-white text-right">
                        {formatCurrency(invoice.totalAmount)}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>

          {/* Installations générées */}
          {invoice.installations.length > 0 && (
            <div className="rounded-xl border border-surface-800 bg-surface-900 overflow-hidden">
              <div className="px-6 py-4 border-b border-surface-800">
                <h3 className="text-sm font-medium text-white">
                  Installations générées ({invoice.installations.length})
                </h3>
              </div>
              <div className="divide-y divide-surface-800">
                {invoice.installations.map((inst) => (
                  <Link
                    key={inst.id}
                    href={`/installations/${inst.id}`}
                    className="flex items-center justify-between px-6 py-3 hover:bg-surface-800/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Package className="h-4 w-4 text-surface-500" />
                      <div>
                        <p className="text-sm font-medium text-white">{inst.product.name}</p>
                        <p className="text-xs text-surface-500">
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
          <div className="rounded-xl border border-surface-800 bg-surface-900 p-6">
            <h3 className="text-sm font-medium text-surface-400 mb-4">Informations</h3>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="rounded-lg bg-surface-800 p-2">
                  <FileText className="h-4 w-4 text-surface-400" />
                </div>
                <div>
                  <p className="text-xs text-surface-500">N° Facture</p>
                  <p className="text-sm font-medium text-surface-200">{invoice.invoiceNumber || "—"}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="rounded-lg bg-surface-800 p-2">
                  <Calendar className="h-4 w-4 text-surface-400" />
                </div>
                <div>
                  <p className="text-xs text-surface-500">Date</p>
                  <p className="text-sm font-medium text-surface-200">{formatDate(invoice.invoiceDate)}</p>
                </div>
              </div>
              {invoice.totalAmount != null && (
                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-surface-800 p-2">
                    <FileText className="h-4 w-4 text-surface-400" />
                  </div>
                  <div>
                    <p className="text-xs text-surface-500">Montant total</p>
                    <p className="text-sm font-bold text-white">{formatCurrency(invoice.totalAmount)}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-surface-800 bg-surface-900 p-6">
            <h3 className="text-sm font-medium text-surface-400 mb-4">Client</h3>
            <div className="space-y-2">
              <p className="text-sm font-medium text-white">{invoice.client.name}</p>
              {invoice.client.email && <p className="text-xs text-surface-400">{invoice.client.email}</p>}
              {invoice.client.phone && <p className="text-xs text-surface-400">{invoice.client.phone}</p>}
              {invoice.client.address && (
                <p className="text-xs text-surface-400">
                  {invoice.client.address}{invoice.client.city && `, ${invoice.client.city}`}
                </p>
              )}
              <Link
                href={`/clients/${invoice.client.id}`}
                className="inline-block text-xs text-primary-400 hover:text-primary-300 mt-1"
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
