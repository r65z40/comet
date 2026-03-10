"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Mail, Phone, MapPin, Calendar, Clock } from "lucide-react";
import StatusBadge from "@/components/ui/StatusBadge";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { formatDate, daysUntil } from "@/lib/utils";
import Link from "next/link";

interface ClientDetail {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  zipCode: string | null;
  installations: {
    id: string;
    status: string;
    startDate: string;
    endDate: string;
    durationMonths: number;
    supplier: string | null;
    family: string | null;
    product: { id: string; name: string; code: string | null };
    invoice: { id: string; invoiceNumber: string | null; invoiceDate: string } | null;
  }[];
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

  useEffect(() => {
    fetch(`/api/clients/${id}`)
      .then((r) => r.json())
      .then(setClient)
      .finally(() => setLoading(false));
  }, [id]);

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

  const activeInstallations = client.installations.filter((i) => i.status === "ACTIF");
  const expiringInstallations = client.installations.filter((i) => i.status === "BIENTOT_EXPIRE");
  const expiredInstallations = client.installations.filter((i) => i.status === "EXPIRE");

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

      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-surface-800 bg-surface-900 p-4 text-center">
          <p className="text-2xl font-bold text-emerald-400">{activeInstallations.length}</p>
          <p className="text-xs text-surface-400 mt-1">Actives</p>
        </div>
        <div className="rounded-xl border border-surface-800 bg-surface-900 p-4 text-center">
          <p className="text-2xl font-bold text-amber-400">{expiringInstallations.length}</p>
          <p className="text-xs text-surface-400 mt-1">Bientôt expirées</p>
        </div>
        <div className="rounded-xl border border-surface-800 bg-surface-900 p-4 text-center">
          <p className="text-2xl font-bold text-red-400">{expiredInstallations.length}</p>
          <p className="text-xs text-surface-400 mt-1">Expirées</p>
        </div>
      </div>

      {expiringInstallations.length > 0 && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-6">
          <h3 className="text-sm font-medium text-amber-400 mb-3">Prochaines échéances</h3>
          <div className="space-y-2">
            {expiringInstallations.map((inst) => (
              <Link
                key={inst.id}
                href={`/installations/${inst.id}`}
                className="flex items-center justify-between rounded-lg bg-surface-900 border border-surface-800 p-3 hover:bg-surface-800/50 transition-colors"
              >
                <div>
                  <p className="text-sm font-medium text-surface-200">{inst.product.name}</p>
                  <p className="text-xs text-surface-500">{inst.family}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1 text-xs text-amber-400">
                    <Clock className="h-3 w-3" /> {daysUntil(inst.endDate)}j
                  </span>
                  <span className="text-xs text-surface-400">{formatDate(inst.endDate)}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-xl border border-surface-800 bg-surface-900 overflow-hidden">
        <div className="px-6 py-4 border-b border-surface-800">
          <h3 className="text-sm font-medium text-surface-400">Toutes les installations</h3>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-surface-800">
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-surface-500">Produit</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-surface-500">Famille</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-surface-500">Fournisseur</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-surface-500">Début</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-surface-500">Échéance</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-surface-500">Statut</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-800">
            {client.installations.map((inst) => (
              <tr
                key={inst.id}
                className="hover:bg-surface-800/50 cursor-pointer transition-colors"
                onClick={() => router.push(`/installations/${inst.id}`)}
              >
                <td className="px-4 py-3 text-sm font-medium text-surface-200">{inst.product.name}</td>
                <td className="px-4 py-3 text-sm text-surface-300">{inst.family || "—"}</td>
                <td className="px-4 py-3 text-sm text-surface-300">{inst.supplier || "—"}</td>
                <td className="px-4 py-3 text-sm text-surface-300">{formatDate(inst.startDate)}</td>
                <td className="px-4 py-3 text-sm text-surface-300">{formatDate(inst.endDate)}</td>
                <td className="px-4 py-3"><StatusBadge status={inst.status} /></td>
              </tr>
            ))}
            {client.installations.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-surface-500">Aucune installation</td>
              </tr>
            )}
          </tbody>
        </table>
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
                <tr key={inv.id} className="hover:bg-surface-800/50 transition-colors">
                  <td className="px-4 py-3 text-sm text-surface-200">{inv.invoiceNumber || "—"}</td>
                  <td className="px-4 py-3 text-sm text-surface-300">{formatDate(inv.invoiceDate)}</td>
                  <td className="px-4 py-3 text-sm text-surface-300">{inv.totalAmount ? `${inv.totalAmount.toFixed(2)} €` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
