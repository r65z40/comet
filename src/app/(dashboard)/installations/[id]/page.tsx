"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Calendar, Package, Building2, Truck, Tag, FileText, Save, Clock, ShieldCheck, ShieldX, ShieldAlert, RefreshCw, Trash2, Pencil, Info, MessageSquare } from "lucide-react";
import StatusBadge from "@/components/ui/StatusBadge";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { formatDate, formatCountdown, getCountdownColor, isWarrantyExpired, getWarrantyLabel } from "@/lib/utils";
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
  alwaysInFleet: boolean;
  comParc: string | null;
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
  const [comParc, setComParc] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [alwaysInFleet, setAlwaysInFleet] = useState(false);
  const [editingEndDate, setEditingEndDate] = useState(false);
  const [newEndDate, setNewEndDate] = useState("");

  useEffect(() => {
    fetch(`/api/installations/${id}`)
      .then((r) => r.json())
      .then((data) => {
        setInstallation(data);
        setNotes(data.notes || "");
        setComParc(data.comParc || "");
        setAlwaysInFleet(data.alwaysInFleet || false);
        // Migrate old statuses on the fly for display
        let s = data.status;
        if (s === "EN_PARC_GARANTIE") s = "EN_PARC";
        if (s === "EN_PARC_HORS_GARANTIE") s = "HORS_PARC";
        setStatus(s);
      })
      .finally(() => setLoading(false));
  }, [id]);

  async function saveNotes() {
    setSaving(true);
    const res = await fetch(`/api/installations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes, comParc }),
    });
    const updated = await res.json();
    setInstallation((prev) => prev ? { ...prev, notes: updated.notes, comParc: updated.comParc } : prev);
    setSaving(false);
  }

  async function changeStatus(newStatus: string) {
    setStatus(newStatus);
    const res = await fetch(`/api/installations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    const updated = await res.json();
    setInstallation((prev) => prev ? { ...prev, status: updated.status } : prev);
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

  async function toggleAlwaysInFleet() {
    const newVal = !alwaysInFleet;
    setAlwaysInFleet(newVal);
    await fetch(`/api/installations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ alwaysInFleet: newVal }),
    });
    setInstallation((prev) => prev ? { ...prev, alwaysInFleet: newVal } : prev);
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

  const isEnParc = status === "EN_PARC";
  const isRenewed = status === "RENOUVELE";
  const isHorsParc = status === "HORS_PARC";
  const expired = isWarrantyExpired(installation.endDate);
  const countdown = formatCountdown(installation.endDate);
  const countdownColor = getCountdownColor(installation.endDate);

  return (
    <div className={`space-y-6 ${isRenewed ? "opacity-60" : ""}`}>
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <button
            onClick={() => router.back()}
            className="shrink-0 rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 truncate">{installation.product.name}</h1>
            <p className="text-sm text-slate-500 mt-1">
              Installé chez <Link href={`/clients/${installation.client.id}`} className="text-primary-600 hover:text-primary-700">{installation.client.name}</Link>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <StatusBadge status={status} endDate={installation.endDate} alwaysInFleet={alwaysInFleet} />
          <button
            onClick={async () => {
              if (!confirm("Supprimer cette installation ?")) return;
              await fetch(`/api/installations/${installation.id}`, { method: "DELETE" });
              router.push("/installations");
            }}
            className="flex items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Supprimer</span>
          </button>
        </div>
      </div>

      {/* Bannière suggestion "Toujours en parc" pour les installations en parc hors garantie */}
      {isEnParc && expired && !alwaysInFleet && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex items-center gap-3">
          <Info className="h-5 w-5 text-amber-600 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-800">Cette installation est en parc mais hors garantie.</p>
            <p className="text-xs text-amber-600 mt-0.5">Souhaitez-vous la marquer comme &quot;Toujours en parc&quot; pour la conserver dans le suivi ?</p>
          </div>
          <button
            onClick={toggleAlwaysInFleet}
            className="shrink-0 flex items-center gap-2 rounded-lg bg-amber-600 px-3 py-2 text-xs font-medium text-white hover:bg-amber-700 transition-colors"
          >
            <ShieldAlert className="h-3.5 w-3.5" />
            Toujours en parc
          </button>
        </div>
      )}

      {/* Compte à rebours principal */}
      {isRenewed ? (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-6 text-center">
          <div className="flex items-center justify-center gap-3">
            <RefreshCw className="h-6 w-6 text-blue-600" />
            <span className="text-2xl font-bold text-blue-600">Renouvelé</span>
          </div>
        </div>
      ) : isHorsParc ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center">
          <div className="flex items-center justify-center gap-3">
            <ShieldX className="h-6 w-6 text-slate-500" />
            <span className="text-2xl font-bold text-slate-500">Hors parc</span>
          </div>
        </div>
      ) : (
        <div className={`rounded-xl border p-6 text-center ${
          expired
            ? "border-red-200 bg-red-50"
            : countdownColor === "text-orange-600"
              ? "border-orange-200 bg-orange-50"
              : countdownColor === "text-amber-600"
                ? "border-amber-200 bg-amber-50"
                : "border-emerald-200 bg-emerald-50"
        }`}>
          <div className="flex items-center justify-center gap-2 mb-2">
            <Clock className={`h-5 w-5 ${countdownColor}`} />
            <span className="text-sm text-slate-500">{getWarrantyLabel(installation.endDate)}</span>
          </div>
          <p className={`text-3xl font-bold ${countdownColor}`}>{countdown}</p>
          <p className="text-sm text-slate-500 mt-2">
            Début : {formatDate(installation.startDate)} — Fin : {formatDate(installation.endDate)} ({installation.durationMonths} mois)
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <h3 className="text-sm font-medium text-slate-500 mb-4">Détails de l&apos;installation</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
              <InfoItem icon={MessageSquare} label="Com Parc" value={installation.comParc || "—"} />
            </div>
          </div>

          {/* Changement de statut + Notes */}
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <h3 className="text-sm font-medium text-slate-500 mb-4">Statut</h3>

            <div className="mb-4">
              <label className="block text-xs text-slate-400 mb-2">Statut principal</label>
              <div className="flex gap-2 flex-wrap">
                <ToggleButton
                  label="En parc"
                  active={isEnParc}
                  onClick={() => changeStatus(isEnParc ? "HORS_PARC" : "EN_PARC")}
                  icon={isEnParc ? ShieldCheck : ShieldX}
                  activeColor="emerald"
                />
              </div>

              {isEnParc && expired && (
                <div className="mt-3">
                  <label className="block text-xs text-slate-400 mb-1.5">Maintien en parc</label>
                  <ToggleButton
                    label="Toujours en parc"
                    active={alwaysInFleet}
                    onClick={toggleAlwaysInFleet}
                    icon={ShieldAlert}
                    activeColor="amber"
                  />
                </div>
              )}

              {isEnParc && (
                <div className="mt-3 ml-1">
                  <p className="text-xs text-slate-400 mb-1.5">Garantie</p>
                  <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                    expired
                      ? "bg-red-50 text-red-700 border-red-200"
                      : "bg-emerald-50 text-emerald-700 border-emerald-200"
                  }`}>
                    {expired ? "Hors garantie" : "Sous garantie"}
                  </span>
                  <span className={`ml-2 text-xs font-medium ${getCountdownColor(installation.endDate)}`}>
                    {countdown}
                  </span>
                </div>
              )}

              {!isRenewed && (
                <div className="mt-3">
                  <label className="block text-xs text-slate-400 mb-1.5">Renouvellement</label>
                  <ToggleButton
                    label="Renouvelé"
                    active={isRenewed}
                    onClick={() => changeStatus("RENOUVELE")}
                    icon={RefreshCw}
                    activeColor="blue"
                  />
                </div>
              )}

              {isRenewed && (
                <div className="mt-3">
                  <label className="block text-xs text-slate-400 mb-1.5">Renouvellement</label>
                  <div className="flex gap-2 items-center">
                    <span className="inline-flex items-center gap-1.5 rounded-lg border border-blue-500 bg-blue-50 px-3 py-2 text-xs font-medium text-blue-600">
                      <RefreshCw className="h-3.5 w-3.5" />
                      Renouvelé
                    </span>
                    <button
                      onClick={() => changeStatus("EN_PARC")}
                      className="text-xs text-slate-400 hover:text-slate-600 underline"
                    >
                      Annuler le renouvellement
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs text-slate-400">Com Parc &amp; Notes</label>
                <button
                  onClick={saveNotes}
                  disabled={saving}
                  className="flex items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-700 disabled:opacity-50 transition-colors"
                >
                  <Save className="h-3 w-3" />
                  {saving ? "Enregistrement..." : "Enregistrer"}
                </button>
              </div>
              <label className="block text-xs text-slate-400 mb-1">Com Parc</label>
              <textarea
                value={comParc}
                onChange={(e) => setComParc(e.target.value)}
                placeholder="Informations propriétaire / commentaire parc..."
                rows={2}
                className="w-full rounded-lg border border-slate-200 bg-slate-100 px-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:border-primary-500 focus:outline-none resize-none mb-3"
              />
              <label className="block text-xs text-slate-400 mb-1">Notes</label>
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

function ToggleButton({
  label,
  active,
  onClick,
  icon: Icon,
  activeColor,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  icon: typeof ShieldCheck;
  activeColor: string;
}) {
  const colorClasses: Record<string, string> = {
    emerald: active ? "border-emerald-500 bg-emerald-50 text-emerald-600" : "border-slate-200 text-slate-500 hover:border-emerald-500/50",
    red: active ? "border-red-500 bg-red-50 text-red-600" : "border-slate-200 text-slate-500 hover:border-red-500/50",
    blue: active ? "border-blue-500 bg-blue-50 text-blue-600" : "border-slate-200 text-slate-500 hover:border-blue-500/50",
    amber: active ? "border-amber-500 bg-amber-50 text-amber-600" : "border-slate-200 text-slate-500 hover:border-amber-500/50",
  };

  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${colorClasses[activeColor]}`}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}
