"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Calendar, Package, Building2, Truck, Tag, FileText, Save } from "lucide-react";
import StatusBadge from "@/components/ui/StatusBadge";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { formatDate, daysUntil } from "@/lib/utils";
import Link from "next/link";

interface InstallationDetail {
  id: string;
  supplier: string | null;
  family: string | null;
  quantity: number;
  startDate: string;
  durationMonths: number;
  endDate: string;
  status: string;
  notes: string | null;
  client: { id: string; name: string; email: string | null; phone: string | null; address: string | null; city: string | null };
  product: { id: string; name: string; code: string | null; description: string | null };
  invoice: { id: string; invoiceNumber: string | null; invoiceDate: string } | null;
}

export default function InstallationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [installation, setInstallation] = useState<InstallationDetail | null>(null);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/installations/${id}`)
      .then((r) => r.json())
      .then((data) => {
        setInstallation(data);
        setNotes(data.notes || "");
      })
      .finally(() => setLoading(false));
  }, [id]);

  async function saveNotes() {
    setSaving(true);
    await fetch(`/api/installations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes }),
    });
    setSaving(false);
  }

  if (loading) return <LoadingSpinner />;
  if (!installation) {
    return (
      <div className="text-center py-12">
        <p className="text-surface-400">Installation non trouvée</p>
        <button onClick={() => router.back()} className="mt-4 text-primary-400 hover:text-primary-300 text-sm">
          Retour
        </button>
      </div>
    );
  }

  const days = daysUntil(installation.endDate);

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
          <h1 className="text-2xl font-bold text-white">{installation.product.name}</h1>
          <p className="text-sm text-surface-400 mt-1">
            Installé chez <Link href={`/clients/${installation.client.id}`} className="text-primary-400 hover:text-primary-300">{installation.client.name}</Link>
          </p>
        </div>
        <StatusBadge status={installation.status} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-xl border border-surface-800 bg-surface-900 p-6">
            <h3 className="text-sm font-medium text-surface-400 mb-4">Détails de l&apos;installation</h3>
            <div className="grid grid-cols-2 gap-4">
              <InfoItem icon={Building2} label="Client" value={installation.client.name} />
              <InfoItem icon={Package} label="Produit" value={installation.product.name} />
              <InfoItem icon={Truck} label="Fournisseur" value={installation.supplier || "—"} />
              <InfoItem icon={Tag} label="Famille" value={installation.family || "—"} />
              <InfoItem icon={Calendar} label="Date début" value={formatDate(installation.startDate)} />
              <InfoItem icon={Calendar} label="Date échéance" value={formatDate(installation.endDate)} />
              <InfoItem icon={Calendar} label="Durée" value={`${installation.durationMonths} mois`} />
              <InfoItem
                icon={Calendar}
                label="Jours restants"
                value={days > 0 ? `${days} jours` : `Expiré depuis ${Math.abs(days)} jours`}
              />
              {installation.invoice && (
                <InfoItem
                  icon={FileText}
                  label="Facture"
                  value={installation.invoice.invoiceNumber || formatDate(installation.invoice.invoiceDate)}
                />
              )}
              <InfoItem icon={Package} label="Quantité" value={String(installation.quantity)} />
            </div>
          </div>

          <div className="rounded-xl border border-surface-800 bg-surface-900 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-surface-400">Notes</h3>
              <button
                onClick={saveNotes}
                disabled={saving}
                className="flex items-center gap-2 rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-700 disabled:opacity-50 transition-colors"
              >
                <Save className="h-3 w-3" />
                {saving ? "Enregistrement..." : "Enregistrer"}
              </button>
            </div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ajouter des notes..."
              rows={4}
              className="w-full rounded-lg border border-surface-700 bg-surface-800 px-4 py-3 text-sm text-surface-200 placeholder-surface-500 focus:border-primary-500 focus:outline-none resize-none"
            />
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-xl border border-surface-800 bg-surface-900 p-6">
            <h3 className="text-sm font-medium text-surface-400 mb-4">Client</h3>
            <div className="space-y-3">
              <p className="text-sm font-medium text-white">{installation.client.name}</p>
              {installation.client.email && (
                <p className="text-xs text-surface-400">{installation.client.email}</p>
              )}
              {installation.client.phone && (
                <p className="text-xs text-surface-400">{installation.client.phone}</p>
              )}
              {installation.client.address && (
                <p className="text-xs text-surface-400">
                  {installation.client.address}
                  {installation.client.city && `, ${installation.client.city}`}
                </p>
              )}
              <Link
                href={`/clients/${installation.client.id}`}
                className="inline-block text-xs text-primary-400 hover:text-primary-300"
              >
                Voir le client
              </Link>
            </div>
          </div>

          <div className="rounded-xl border border-surface-800 bg-surface-900 p-6">
            <h3 className="text-sm font-medium text-surface-400 mb-4">Produit</h3>
            <div className="space-y-2">
              <p className="text-sm font-medium text-white">{installation.product.name}</p>
              {installation.product.code && (
                <p className="text-xs text-surface-400">Code: {installation.product.code}</p>
              )}
              {installation.product.description && (
                <p className="text-xs text-surface-400">{installation.product.description}</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoItem({ icon: Icon, label, value }: { icon: typeof Calendar; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="rounded-lg bg-surface-800 p-2">
        <Icon className="h-4 w-4 text-surface-400" />
      </div>
      <div>
        <p className="text-xs text-surface-500">{label}</p>
        <p className="text-sm font-medium text-surface-200">{value}</p>
      </div>
    </div>
  );
}
