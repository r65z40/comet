"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Calendar, Package, Building2, Truck, Tag, FileText, Save, Clock, ShieldCheck, ShieldX, RefreshCw } from "lucide-react";
import StatusBadge from "@/components/ui/StatusBadge";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { formatDate, formatCountdown, getCountdownColor } from "@/lib/utils";
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
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/installations/${id}`)
      .then((r) => r.json())
      .then((data) => {
        setInstallation(data);
        setNotes(data.notes || "");
        setStatus(data.status);
      })
      .finally(() => setLoading(false));
  }, [id]);

  async function saveData() {
    setSaving(true);
    const res = await fetch(`/api/installations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes, status }),
    });
    const updated = await res.json();
    setInstallation((prev) => prev ? { ...prev, status: updated.status, notes: updated.notes } : prev);
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

  const countdown = formatCountdown(installation.endDate);
  const countdownColor = getCountdownColor(installation.endDate);

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

      {/* Compte à rebours principal */}
      <div className={`rounded-xl border p-6 text-center ${
        installation.status === "RENOUVELE"
          ? "border-blue-500/30 bg-blue-500/10"
          : countdownColor === "text-red-400"
            ? "border-red-500/30 bg-red-500/10"
            : countdownColor === "text-orange-400"
              ? "border-orange-500/30 bg-orange-500/10"
              : countdownColor === "text-amber-400"
                ? "border-amber-500/30 bg-amber-500/10"
                : "border-emerald-500/30 bg-emerald-500/10"
      }`}>
        {installation.status === "RENOUVELE" ? (
          <div className="flex items-center justify-center gap-3">
            <RefreshCw className="h-6 w-6 text-blue-400" />
            <span className="text-2xl font-bold text-blue-400">Renouvelé</span>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-center gap-2 mb-2">
              <Clock className={`h-5 w-5 ${countdownColor}`} />
              <span className="text-sm text-surface-400">Garantie restante</span>
            </div>
            <p className={`text-3xl font-bold ${countdownColor}`}>{countdown}</p>
            <p className="text-sm text-surface-400 mt-2">
              Début : {formatDate(installation.startDate)} — Fin : {formatDate(installation.endDate)} ({installation.durationMonths} mois)
            </p>
          </>
        )}
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
              <InfoItem icon={Calendar} label="Début garantie" value={formatDate(installation.startDate)} />
              <InfoItem icon={Calendar} label="Fin garantie" value={formatDate(installation.endDate)} />
              <InfoItem icon={Calendar} label="Durée" value={`${installation.durationMonths} mois`} />
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

          {/* Changement de statut + Notes */}
          <div className="rounded-xl border border-surface-800 bg-surface-900 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-surface-400">Statut et notes</h3>
              <button
                onClick={saveData}
                disabled={saving}
                className="flex items-center gap-2 rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-700 disabled:opacity-50 transition-colors"
              >
                <Save className="h-3 w-3" />
                {saving ? "Enregistrement..." : "Enregistrer"}
              </button>
            </div>

            <div className="mb-4">
              <label className="block text-xs text-surface-500 mb-2">Statut</label>
              <div className="flex gap-2 flex-wrap">
                <StatusButton
                  label="En parc garantie"
                  value="EN_PARC_GARANTIE"
                  current={status}
                  onClick={setStatus}
                  icon={ShieldCheck}
                  color="emerald"
                />
                <StatusButton
                  label="En parc sans garantie"
                  value="EN_PARC_HORS_GARANTIE"
                  current={status}
                  onClick={setStatus}
                  icon={ShieldX}
                  color="red"
                />
                <StatusButton
                  label="Renouvelé"
                  value="RENOUVELE"
                  current={status}
                  onClick={setStatus}
                  icon={RefreshCw}
                  color="blue"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-surface-500 mb-2">Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ajouter des notes..."
                rows={4}
                className="w-full rounded-lg border border-surface-700 bg-surface-800 px-4 py-3 text-sm text-surface-200 placeholder-surface-500 focus:border-primary-500 focus:outline-none resize-none"
              />
            </div>
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

function StatusButton({
  label,
  value,
  current,
  onClick,
  icon: Icon,
  color,
}: {
  label: string;
  value: string;
  current: string;
  onClick: (v: string) => void;
  icon: typeof ShieldCheck;
  color: string;
}) {
  const isActive = current === value;
  const colorClasses: Record<string, string> = {
    emerald: isActive ? "border-emerald-500 bg-emerald-500/20 text-emerald-400" : "border-surface-700 text-surface-400 hover:border-emerald-500/50",
    red: isActive ? "border-red-500 bg-red-500/20 text-red-400" : "border-surface-700 text-surface-400 hover:border-red-500/50",
    blue: isActive ? "border-blue-500 bg-blue-500/20 text-blue-400" : "border-surface-700 text-surface-400 hover:border-blue-500/50",
  };

  return (
    <button
      onClick={() => onClick(value)}
      className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${colorClasses[color]}`}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}
