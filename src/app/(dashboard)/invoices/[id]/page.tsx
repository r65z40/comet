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
        <p className="text-slate-500">Facture non trouvée</p>
        <button onClick={() => router.back()} className="mt-4 text-primary-600 hover:text-primary-700 text-sm">
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
          className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-slate-900">
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
        {invoice.status && (
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
            {invoice.status}
          </span>
        )}
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
