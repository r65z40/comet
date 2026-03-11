"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Mail, Phone, MapPin, Clock, ShieldCheck, ShieldX, RefreshCw } from "lucide-react";
import StatusBadge from "@/components/ui/StatusBadge";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { formatDate, formatCountdown, getCountdownColor, formatCurrency } from "@/lib/utils";
import Link from "next/link";

interface Installation {
  id: string;
  status: string;
  startDate: string;
  endDate: string;
  durationMonths: number;
  quantity: number;
  supplier: string | null;
  family: string | null;
  product: { id: string; name: string; code: string | null };
  invoice: { id: string; invoiceNumber: string | null; invoiceDate: string } | null;
}

interface ClientDetail {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  zipCode: string | null;
  installations: Installation[];
  invoices: {
    id: string;
    invoiceNumber: string | null;
    invoiceDate: string;
    totalAmount: number | null;
    status: string | null;
  }[];
}

export default function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [client, setClient] = useState<ClientDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/clients/${id}`)
      .then((r) => r.json())
      .then(setClient)
      .finally(() => setLoading(false));
  }, [id]);

  async function changeStatus(installId: string, newStatus: string) {
    setUpdatingStatus(installId);
    await fetch(`/api/installations/${installId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    // Refresh client data
    const res = await fetch(`/api/clients/${id}`);
    const data = await res.json();
    setClient(data);
    setUpdatingStatus(null);
  }

  if (loading) return <LoadingSpinner />;
  if (!client) {
    return (
      <div className="text-center py-12">
        <p className="text-surface-400">Client non trouvé</p>
        <button onClick={() => router.back()} className="mt-4 text-primary-400 hover:text-primary-300 text-sm">
          Retour
        </button>
      </div>
    );
  }

  const enGarantie = client.installations.filter((i) => i.status === "EN_PARC_GARANTIE");
  const horsGarantie = client.installations.filter((i) => i.status === "EN_PARC_HORS_GARANTIE");
  const renouvele = client.installations.filter((i) => i.status === "RENOUVELE");

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.back()}
          className="rounded-lg border border-surface-700 p-2 text-surface-400 hover:bg-surface-800 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-white">{client.name}</h1>
          <div className="flex items-center gap-4 mt-1">
            {client.email && (
              <span className="flex items-center gap-1 text-xs text-surface-400">
                <Mail className="h-3 w-3" /> {client.email}
              </span>
            )}
            {client.phone && (
              <span className="flex items-center gap-1 text-xs text-surface-400">
                <Phone className="h-3 w-3" /> {client.phone}
              </span>
            )}
            {client.city && (
              <span className="flex items-center gap-1 text-xs text-surface-400">
                <MapPin className="h-3 w-3" /> {client.city}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="rounded-xl border border-surface-800 bg-surface-900 p-4 text-center">
          <p className="text-2xl font-bold text-white">{client.installations.length}</p>
          <p className="text-xs text-surface-400 mt-1">Total</p>
        </div>
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-center">
          <p className="text-2xl font-bold text-emerald-400">{enGarantie.length}</p>
          <p className="text-xs text-surface-400 mt-1">En parc garantie</p>
        </div>
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-center">
          <p className="text-2xl font-bold text-red-400">{horsGarantie.length}</p>
          <p className="text-xs text-surface-400 mt-1">Sans garantie</p>
        </div>
        <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-4 text-center">
          <p className="text-2xl font-bold text-blue-400">{renouvele.length}</p>
          <p className="text-xs text-surface-400 mt-1">Renouvelés</p>
        </div>
      </div>

      {/* Tableau principal des installations avec toutes les infos */}
      <div className="rounded-xl border border-surface-800 bg-surface-900 overflow-hidden">
        <div className="px-6 py-4 border-b border-surface-800">
          <h3 className="text-sm font-medium text-white">Produits installés — Suivi des garanties</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-surface-800">
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-surface-500">Produit</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-surface-500">Famille</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-surface-500">Fournisseur</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-surface-500">Facture</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-surface-500">Début</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-surface-500">Durée</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-surface-500">Fin garantie</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-surface-500">Compte à rebours</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-surface-500">Statut</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-surface-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-800">
              {client.installations.map((inst) => (
                <tr
                  key={inst.id}
                  className="hover:bg-surface-800/50 transition-colors"
                >
                  <td className="px-4 py-3">
                    <Link href={`/installations/${inst.id}`} className="text-sm font-medium text-primary-400 hover:text-primary-300">
                      {inst.product.name}
                    </Link>
                    {inst.product.code && <p className="text-[10px] text-surface-500">{inst.product.code}</p>}
                  </td>
                  <td className="px-4 py-3 text-sm text-surface-300">{inst.family || "—"}</td>
                  <td className="px-4 py-3 text-sm text-surface-300">{inst.supplier || "—"}</td>
                  <td className="px-4 py-3 text-sm text-surface-400">
                    {inst.invoice ? (
                      <Link href={`/invoices/${inst.invoice.id}`} className="text-primary-400 hover:text-primary-300">
                        {inst.invoice.invoiceNumber || formatDate(inst.invoice.invoiceDate)}
                      </Link>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-3 text-sm text-surface-300 whitespace-nowrap">{formatDate(inst.startDate)}</td>
                  <td className="px-4 py-3 text-sm text-surface-300 whitespace-nowrap font-medium">{inst.durationMonths} mois</td>
                  <td className="px-4 py-3 text-sm text-surface-300 whitespace-nowrap">{formatDate(inst.endDate)}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`text-xs font-bold ${getCountdownColor(inst.endDate)}`}>
                      {inst.status === "RENOUVELE" ? "Renouvelé" : formatCountdown(inst.endDate)}
                    </span>
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={inst.status} /></td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      {inst.status !== "EN_PARC_GARANTIE" && (
                        <button
                          onClick={(e) => { e.stopPropagation(); changeStatus(inst.id, "EN_PARC_GARANTIE"); }}
                          disabled={updatingStatus === inst.id}
                          title="En parc garantie"
                          className="rounded p-1 text-surface-500 hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors disabled:opacity-50"
                        >
                          <ShieldCheck className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {inst.status !== "EN_PARC_HORS_GARANTIE" && (
                        <button
                          onClick={(e) => { e.stopPropagation(); changeStatus(inst.id, "EN_PARC_HORS_GARANTIE"); }}
                          disabled={updatingStatus === inst.id}
                          title="En parc sans garantie"
                          className="rounded p-1 text-surface-500 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                        >
                          <ShieldX className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {inst.status !== "RENOUVELE" && (
                        <button
                          onClick={(e) => { e.stopPropagation(); changeStatus(inst.id, "RENOUVELE"); }}
                          disabled={updatingStatus === inst.id}
                          title="Renouvelé"
                          className="rounded p-1 text-surface-500 hover:text-blue-400 hover:bg-blue-500/10 transition-colors disabled:opacity-50"
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {client.installations.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-sm text-surface-500">Aucune installation</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {client.invoices.length > 0 && (
        <div className="rounded-xl border border-surface-800 bg-surface-900 overflow-hidden">
          <div className="px-6 py-4 border-b border-surface-800">
            <h3 className="text-sm font-medium text-surface-400">Historique des factures</h3>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-surface-800">
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-surface-500">Numéro</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-surface-500">Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-surface-500">Montant</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-800">
              {client.invoices.map((inv) => (
                <tr
                  key={inv.id}
                  className="hover:bg-surface-800/50 cursor-pointer transition-colors"
                  onClick={() => router.push(`/invoices/${inv.id}`)}
                >
                  <td className="px-4 py-3 text-sm text-surface-200">{inv.invoiceNumber || "—"}</td>
                  <td className="px-4 py-3 text-sm text-surface-300">{formatDate(inv.invoiceDate)}</td>
                  <td className="px-4 py-3 text-sm text-surface-300">{inv.totalAmount ? formatCurrency(inv.totalAmount) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
