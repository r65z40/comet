"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Calendar, Package, Building2, Truck, Tag, FileText, Save, Clock, ShieldCheck, ShieldX, RefreshCw, Trash2, Pencil } from "lucide-react";
import StatusBadge from "@/components/ui/StatusBadge";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { formatDate, formatCountdown, getCountdownColor, isWarrantyExpired } from "@/lib/utils";
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
  const [editingEndDate, setEditingEndDate] = useState(false);
  const [newEndDate, setNewEndDate] = useState("");

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

  async function saveEndDate() {
    if (!newEndDate) return;
    setSaving(true);
    const res = await fetch(`/api/installations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endDate: newEndDate }),
    });
    const updated = await res.json();
    setInstallation((prev) => prev ? { ...prev, endDate: updated.endDate } : prev);
    setEditingEndDate(false);
    setSaving(false);
  }

  if (loading) return <LoadingSpinner />;
  if (!installation) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-500">Installation non trouvée</p>
        <button onClick={() => router.back()} className="mt-4 text-primary-600 hover:text-primary-700 text-sm">
          Retour
        </button>
      </div>
    );
  }

  const countdown = formatCountdown(installation.endDate);
  const countdownColor = getCountdownColor(installation.endDate);
  const expired = isWarrantyExpired(installation.endDate);
  const isRenewed = installation.status === "RENOUVELE";

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
          <h1 className="text-2xl font-bold text-slate-900">{installation.product.name}</h1>
          <p className="text-sm text-slate-500 mt-1">
            Installé chez <Link href={`/clients/${installation.client.id}`} className="text-primary-600 hover:text-primary-700">{installation.client.name}</Link>
          </p>
        </div>
        <StatusBadge status={installation.status} expired={expired} />
        <button
          onClick={async () => {
            if (!confirm("Supprimer cette installation ?")) return;
            await fetch(`/api/installations/${installation.id}`, { method: "DELETE" });
            router.push("/installations");
          }}
          className="flex items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Supprimer
        </button>
      </div>

      {/* Compte à rebours principal */}
      <div className={`rounded-xl border p-6 text-center ${
        isRenewed
          ? "border-blue-200 bg-blue-50"
          : expired
            ? "border-red-200 bg-red-50"
            : countdownColor === "text-orange-400"
              ? "border-orange-200 bg-orange-50"
              : countdownColor === "text-amber-400"
                ? "border-amber-200 bg-amber-50"
                : "border-emerald-200 bg-emerald-50"
      }`}>
        {isRenewed ? (
          <div className="flex items-center justify-center gap-3">
            <RefreshCw className="h-6 w-6 text-blue-600" />
            <span className="text-2xl font-bold text-blue-600">Renouvelé</span>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-center gap-2 mb-2">
              <Clock className={`h-5 w-5 ${countdownColor}`} />
              <span className="text-sm text-slate-500">Garantie restante</span>
            </div>
            <p className={`text-3xl font-bold ${countdownColor}`}>{countdown}</p>
            <p className="text-sm text-slate-500 mt-2">
              Début : {formatDate(installation.startDate)} — Fin : {formatDate(installation.endDate)} ({installation.durationMonths} mois)
            </p>
          </>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <h3 className="text-sm font-medium text-slate-500 mb-4">Détails de l&apos;installation</h3>
            <div className="grid grid-cols-2 gap-4">
              <InfoItem icon={Building2} label="Client" value={installation.client.name} />
              <InfoItem icon={Package} label="Produit" value={installation.product.name} />
              <InfoItem icon={Truck} label="Fournisseur" value={installation.supplier || "—"} />
              <InfoItem icon={Tag} label="Famille" value={installation.family || "—"} />
              <InfoItem icon={Calendar} label="Début garantie" value={formatDate(installation.startDate)} />
              <div className="flex items-start gap-3">
                <div className="rounded-lg bg-slate-100 p-2">
                  <Calendar className="h-4 w-4 text-slate-500" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-slate-400">Fin garantie</p>
                  {editingEndDate ? (
                    <div className="flex items-center gap-2 mt-1">
                      <input
                        type="date"
                        value={newEndDate}
                        onChange={(e) => setNewEndDate(e.target.value)}
                        className="rounded-lg border border-slate-200 bg-slate-100 px-2 py-1 text-sm text-slate-800 focus:border-primary-500 focus:outline-none"
                      />
                      <button
                        onClick={saveEndDate}
                        disabled={saving}
                        className="rounded px-2 py-1 text-xs bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50"
                      >
                        OK
                      </button>
                      <button
                        onClick={() => setEditingEndDate(false)}
                        className="rounded px-2 py-1 text-xs border border-slate-200 text-slate-500 hover:bg-slate-50"
                      >
                        Annuler
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <p className={`text-sm font-medium ${expired ? "text-red-600" : "text-slate-800"}`}>{formatDate(installation.endDate)}</p>
                      <button
                        onClick={() => {
                          setNewEndDate(new Date(installation.endDate).toISOString().split("T")[0]);
                          setEditingEndDate(true);
                        }}
                        className="rounded p-0.5 text-slate-400 hover:text-primary-600 transition-colors"
                        title="Modifier la date de fin"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
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
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-slate-500">Statut et notes</h3>
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
              <label className="block text-xs text-slate-400 mb-2">Statut</label>
              <div className="flex gap-2 flex-wrap">
                <StatusButton
                  label="En parc"
                  value="EN_PARC_GARANTIE"
                  current={status}
                  onClick={setStatus}
                  icon={ShieldCheck}
                  color="emerald"
                />
                <StatusButton
                  label="Hors parc"
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
              <label className="block text-xs text-slate-400 mb-2">Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ajouter des notes..."
                rows={4}
                className="w-full rounded-lg border border-slate-200 bg-slate-100 px-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:border-primary-500 focus:outline-none resize-none"
              />
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <h3 className="text-sm font-medium text-slate-500 mb-4">Client</h3>
            <div className="space-y-3">
              <p className="text-sm font-medium text-slate-900">{installation.client.name}</p>
              {installation.client.email && (
                <p className="text-xs text-slate-500">{installation.client.email}</p>
              )}
              {installation.client.phone && (
                <p className="text-xs text-slate-500">{installation.client.phone}</p>
              )}
              {installation.client.address && (
                <p className="text-xs text-slate-500">
                  {installation.client.address}
                  {installation.client.city && `, ${installation.client.city}`}
                </p>
              )}
              <Link
                href={`/clients/${installation.client.id}`}
                className="inline-block text-xs text-primary-600 hover:text-primary-700"
              >
                Voir le client
              </Link>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <h3 className="text-sm font-medium text-slate-500 mb-4">Produit</h3>
            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-900">{installation.product.name}</p>
              {installation.product.code && (
                <p className="text-xs text-slate-500">Code: {installation.product.code}</p>
              )}
              {installation.product.description && (
                <p className="text-xs text-slate-500">{installation.product.description}</p>
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
      <div className="rounded-lg bg-slate-100 p-2">
        <Icon className="h-4 w-4 text-slate-500" />
      </div>
      <div>
        <p className="text-xs text-slate-400">{label}</p>
        <p className="text-sm font-medium text-slate-800">{value}</p>
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
    emerald: isActive ? "border-emerald-500 bg-emerald-50 text-emerald-600" : "border-slate-200 text-slate-500 hover:border-emerald-500/50",
    red: isActive ? "border-red-500 bg-red-50 text-red-600" : "border-slate-200 text-slate-500 hover:border-red-500/50",
    blue: isActive ? "border-blue-500 bg-blue-500/20 text-blue-600" : "border-slate-200 text-slate-500 hover:border-blue-500/50",
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
