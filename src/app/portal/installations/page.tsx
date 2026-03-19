"use client";

import { useEffect, useState } from "react";
import { usePortal } from "../layout";
import { Search, ArrowUpDown } from "lucide-react";

interface Installation {
  id: string;
  status: string;
  alwaysInFleet: boolean;
  comParc: string | null;
  startDate: string;
  endDate: string;
  durationMonths: number;
  quantity: number;
  supplier: string | null;
  family: string | null;
  product: { id: string; name: string; code: string | null };
}

type SortKey = "product" | "family" | "supplier" | "startDate" | "endDate" | "status";
type SortDir = "asc" | "desc";

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

function getStatusLabel(status: string, endDate: string, alwaysInFleet?: boolean): string {
  if (alwaysInFleet) return "Toujours en parc";
  if (status === "EN_PARC" || status === "EN_PARC_GARANTIE") {
    const days = Math.ceil((new Date(endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (days > 0 && days <= 90) return `En parc (${days}j)`;
    return "En parc";
  }
  if (status === "HORS_PARC" || status === "EN_PARC_HORS_GARANTIE") return "Hors parc";
  if (status === "RENOUVELE") return "Renouvelé";
  return status;
}

function getStatusColor(status: string, endDate: string, alwaysInFleet?: boolean): string {
  if (alwaysInFleet) return "bg-amber-50 text-amber-700";
  if (status === "RENOUVELE") return "bg-blue-50 text-blue-700";
  if (status === "HORS_PARC" || status === "EN_PARC_HORS_GARANTIE") return "bg-red-50 text-red-700";
  const expired = new Date(endDate).getTime() < Date.now();
  if (expired) return "bg-red-50 text-red-700";
  const days = Math.ceil((new Date(endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (days <= 90) return "bg-orange-50 text-orange-700";
  return "bg-emerald-50 text-emerald-700";
}

export default function PortalInstallationsPage() {
  const { portalSettings } = usePortal();
  const [installations, setInstallations] = useState<Installation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("endDate");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [statusFilter, setStatusFilter] = useState<"all" | "en_parc" | "hors_parc">("all");

  useEffect(() => {
    fetch("/api/portal/installations")
      .then((r) => r.json())
      .then((data) => {
        setInstallations(data.installations || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const primaryColor = portalSettings?.primaryColor || "#3b82f6";

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  }

  const filtered = installations
    .filter((i) => i.status !== "RENOUVELE")
    .filter((i) => {
      if (statusFilter === "en_parc") return i.status === "EN_PARC" || i.status === "EN_PARC_GARANTIE" || i.alwaysInFleet;
      if (statusFilter === "hors_parc") return i.status === "HORS_PARC" || i.status === "EN_PARC_HORS_GARANTIE";
      return true;
    })
    .filter((i) => {
      if (!search) return true;
      const s = search.toLowerCase();
      return i.product.name.toLowerCase().includes(s) ||
        (i.family || "").toLowerCase().includes(s) ||
        (i.supplier || "").toLowerCase().includes(s);
    })
    .sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "product": cmp = a.product.name.localeCompare(b.product.name); break;
        case "family": cmp = (a.family || "").localeCompare(b.family || ""); break;
        case "supplier": cmp = (a.supplier || "").localeCompare(b.supplier || ""); break;
        case "startDate": cmp = new Date(a.startDate).getTime() - new Date(b.startDate).getTime(); break;
        case "endDate": cmp = new Date(a.endDate).getTime() - new Date(b.endDate).getTime(); break;
        case "status": cmp = a.status.localeCompare(b.status); break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-primary-600" />
      </div>
    );
  }

  const SortHeader = ({ label, sortKeyName }: { label: string; sortKeyName: SortKey }) => (
    <th
      className="cursor-pointer select-none px-3 py-3 text-left text-xs font-semibold uppercase text-slate-500 hover:text-slate-700 transition-colors"
      onClick={() => toggleSort(sortKeyName)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        <ArrowUpDown className="h-3 w-3" />
      </span>
    </th>
  );

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-slate-900">Installations</h1>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Rechercher..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-10 pr-4 text-sm text-slate-900 placeholder-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
        </div>
        <div className="flex gap-1.5">
          {([
            ["all", "Tout"],
            ["en_parc", "En parc"],
            ["hors_parc", "Hors parc"],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setStatusFilter(key)}
              className="rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
              style={
                statusFilter === key
                  ? { backgroundColor: primaryColor, color: "#fff" }
                  : { border: "1px solid #e2e8f0", color: "#64748b" }
              }
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-100 bg-slate-50/50">
              <tr>
                <SortHeader label="Produit" sortKeyName="product" />
                {portalSettings?.showFamily && <SortHeader label="Famille" sortKeyName="family" />}
                {portalSettings?.showSupplier && <SortHeader label="Fournisseur" sortKeyName="supplier" />}
                {portalSettings?.showQuantity && <th className="px-3 py-3 text-left text-xs font-semibold uppercase text-slate-500">Qté</th>}
                {portalSettings?.showComParc && <th className="px-3 py-3 text-left text-xs font-semibold uppercase text-slate-500">Com. Parc</th>}
                <SortHeader label="Début" sortKeyName="startDate" />
                <SortHeader label="Fin" sortKeyName="endDate" />
                {portalSettings?.showDuration && <th className="px-3 py-3 text-left text-xs font-semibold uppercase text-slate-500">Durée</th>}
                <SortHeader label="Statut" sortKeyName="status" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-sm text-slate-400">
                    Aucune installation trouvée
                  </td>
                </tr>
              ) : (
                filtered.map((inst) => (
                  <tr key={inst.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-3 py-3 font-medium text-slate-900">{inst.product.name}</td>
                    {portalSettings?.showFamily && <td className="px-3 py-3 text-slate-500">{inst.family || "—"}</td>}
                    {portalSettings?.showSupplier && <td className="px-3 py-3 text-slate-500">{inst.supplier || "—"}</td>}
                    {portalSettings?.showQuantity && <td className="px-3 py-3 text-slate-500">{inst.quantity}</td>}
                    {portalSettings?.showComParc && <td className="px-3 py-3 text-slate-500">{inst.comParc || "—"}</td>}
                    <td className="px-3 py-3 text-slate-500 whitespace-nowrap">{formatDate(inst.startDate)}</td>
                    <td className="px-3 py-3 text-slate-500 whitespace-nowrap">{formatDate(inst.endDate)}</td>
                    {portalSettings?.showDuration && <td className="px-3 py-3 text-slate-500">{inst.durationMonths} mois</td>}
                    <td className="px-3 py-3">
                      <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${getStatusColor(inst.status, inst.endDate, inst.alwaysInFleet)}`}>
                        {getStatusLabel(inst.status, inst.endDate, inst.alwaysInFleet)}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-slate-400">{filtered.length} installation(s)</p>
    </div>
  );
}
