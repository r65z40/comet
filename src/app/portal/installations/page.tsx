"use client";

import { useEffect, useState } from "react";
import { usePortal } from "../layout";
import { Search, ArrowUpDown, Download, Loader2 } from "lucide-react";

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
  const { portalSettings, client } = usePortal();
  const [installations, setInstallations] = useState<Installation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("endDate");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [statusFilter, setStatusFilter] = useState<"all" | "en_parc" | "hors_parc">("all");
  const [downloading, setDownloading] = useState(false);

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
                      <span className={`inline-flex items-center justify-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${getStatusColor(inst.status, inst.endDate, inst.alwaysInFleet)}`}>
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

      {/* Download report */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-slate-700">Rapport PDF</p>
          <p className="text-xs text-slate-400 mt-0.5">Téléchargez un récapitulatif de toutes vos installations</p>
        </div>
        <button
          onClick={downloadPdf}
          disabled={downloading}
          className="flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-white transition-colors disabled:opacity-50"
          style={{ backgroundColor: primaryColor }}
        >
          {downloading ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Génération...</>
          ) : (
            <><Download className="h-4 w-4" /> Télécharger le rapport</>
          )}
        </button>
      </div>
    </div>
  );

  function getStatusStylePdf(status: string, endDate: string, alwaysInFleet?: boolean): string {
    if (alwaysInFleet) return "color: #6b7280; font-weight: 700;";
    if (status === "RENOUVELE") return "color: #2563eb; font-weight: 700;";
    if (status === "HORS_PARC" || status === "EN_PARC_HORS_GARANTIE") return "color: #dc2626; font-weight: 700;";
    const expired = new Date(endDate).getTime() < Date.now();
    if (expired) return "color: #dc2626; font-weight: 700;";
    const days = Math.ceil((new Date(endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (days <= 90) return "color: #ea580c; font-weight: 700;";
    return "color: #16a34a; font-weight: 700;";
  }

  function getEndDateBgStyle(status: string, endDate: string, alwaysInFleet?: boolean): string {
    if (alwaysInFleet) return "background-color: #e5e7eb;";
    const expired = new Date(endDate).getTime() < Date.now();
    if (status === "HORS_PARC" || status === "EN_PARC_HORS_GARANTIE" || expired) return "background-color: #fecaca;";
    const days = Math.ceil((new Date(endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (days <= 90) return "background-color: #fed7aa;";
    return "background-color: #bbf7d0;";
  }

  function buildColgroup(ps: typeof portalSettings) {
    const colW = 80;
    const narrow = 45;
    let fixedCols = 3;
    if (ps?.showFamily) fixedCols++;
    if (ps?.showSupplier) fixedCols++;
    if (ps?.showQuantity) fixedCols++;
    if (ps?.showComParc) fixedCols++;
    if (ps?.showDuration) fixedCols++;
    const fixedWidth = fixedCols * colW + (ps?.showQuantity ? narrow - colW : 0);
    let cols = '<colgroup><col style="width: calc(100% - ' + fixedWidth + 'px);" />';
    if (ps?.showFamily) cols += '<col style="width: ' + colW + 'px;" />';
    if (ps?.showSupplier) cols += '<col style="width: ' + colW + 'px;" />';
    if (ps?.showComParc) cols += '<col style="width: ' + colW + 'px;" />';
    if (ps?.showQuantity) cols += '<col style="width: ' + narrow + 'px;" />';
    cols += '<col style="width: ' + colW + 'px;" />';
    cols += '<col style="width: ' + colW + 'px;" />';
    if (ps?.showDuration) cols += '<col style="width: ' + colW + 'px;" />';
    cols += '<col style="width: ' + colW + 'px;" /></colgroup>';
    return cols;
  }

  function buildThead(ps: typeof portalSettings) {
    if (ps?.showHeaderRow === false) return "";
    let h = "<thead><tr><th>Produit</th>";
    if (ps?.showFamily) h += "<th>Famille</th>";
    if (ps?.showSupplier) h += "<th>Fournisseur</th>";
    if (ps?.showComParc) h += "<th>Com. Parc</th>";
    if (ps?.showQuantity) h += "<th>Qté</th>";
    h += "<th>Début</th><th>Fin</th>";
    if (ps?.showDuration) h += "<th>Durée</th>";
    h += "<th>Statut</th></tr></thead>";
    return h;
  }

  async function downloadPdf() {
    if (!client) return;
    setDownloading(true);

    const reportInstallations = installations.filter(i => i.status !== "RENOUVELE");
    const today = new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
    const enParc = reportInstallations.filter(i => i.status === "EN_PARC" || i.status === "EN_PARC_GARANTIE");
    const horsParc = reportInstallations.filter(i => i.status === "HORS_PARC" || i.status === "EN_PARC_HORS_GARANTIE");
    const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

    const rows = reportInstallations.map(inst => `
      <tr>
        <td>${esc(inst.product.name.length > 50 ? inst.product.name.slice(0, 50) + "…" : inst.product.name)}</td>
        ${portalSettings?.showFamily ? `<td>${esc(inst.family || "—")}</td>` : ""}
        ${portalSettings?.showSupplier ? `<td>${esc(inst.supplier || "—")}</td>` : ""}
        ${portalSettings?.showComParc ? `<td>${esc(inst.comParc || "—")}</td>` : ""}
        ${portalSettings?.showQuantity ? `<td>${inst.quantity}</td>` : ""}
        <td>${formatDate(inst.startDate)}</td>
        <td style="${getEndDateBgStyle(inst.status, inst.endDate, inst.alwaysInFleet)}">${formatDate(inst.endDate)}</td>
        ${portalSettings?.showDuration ? `<td>${inst.durationMonths} mois</td>` : ""}
        <td style="${getStatusStylePdf(inst.status, inst.endDate, inst.alwaysInFleet)}">${getStatusLabel(inst.status, inst.endDate, inst.alwaysInFleet)}</td>
      </tr>
    `).join("");

    const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"/>
<title>Rapport - ${esc(client.name)}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', Tahoma, sans-serif; color: #1a1a2e; padding: 5mm; }
  .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; padding-bottom: 16px; border-bottom: 2px solid ${primaryColor}; }
  .header h2 { font-size: 22px; font-weight: 700; }
  .header p { font-size: 12px; color: #64748b; }
  .stats { display: flex; gap: 16px; margin-bottom: 30px; }
  .stat-card { flex: 1; padding: 16px; border-radius: 8px; text-align: center; border: 1px solid #e2e8f0; }
  .stat-card .value { font-size: 28px; font-weight: 800; }
  .stat-card .label { font-size: 11px; color: #64748b; margin-top: 4px; }
  .stat-green { border-color: #10b981; } .stat-green .value { color: #10b981; }
  .stat-red { border-color: #ef4444; } .stat-red .value { color: #ef4444; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; margin-top: 10px; table-layout: fixed; }
  th { background: #f1f5f9; padding: 4px 8px; text-align: left; font-weight: 600; font-size: 11px; text-transform: uppercase; color: #475569; white-space: nowrap; border-bottom: 2px solid #e2e8f0; }
  td { padding: 3px 8px; border-bottom: 1px solid #f1f5f9; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.4; }
  th:first-child, td:first-child { white-space: normal; word-wrap: break-word; }
  th:not(:first-child), td:not(:first-child) { text-align: center; padding: 2px 6px; }
  tr:nth-child(even) { background: #fafafa; }
  .section-title { font-size: 18px; font-weight: 700; margin-bottom: 16px; color: #0f172a; border-bottom: 2px solid ${primaryColor}; padding-bottom: 8px; }
  .footer { text-align: center; font-size: 11px; color: #94a3b8; padding-top: 20px; margin-top: 40px; border-top: 1px solid #e2e8f0; }
</style></head><body>
  <div class="header">
    <div>
      <h2>${esc(client.name)}</h2>
      <p>${[client.email, client.phone, client.city].filter(Boolean).map(s => esc(s!)).join(" • ")}</p>
    </div>
    <div style="text-align:right;">
      <p>Généré le ${today}</p>
      <p>${reportInstallations.length} installation(s)</p>
    </div>
  </div>
  <div class="stats">
    <div class="stat-card"><div class="value">${reportInstallations.length}</div><div class="label">Total</div></div>
    <div class="stat-card stat-green"><div class="value">${enParc.length}</div><div class="label">En parc</div></div>
    <div class="stat-card stat-red"><div class="value">${horsParc.length}</div><div class="label">Hors parc</div></div>
  </div>
  <div class="section-title">Détail des installations</div>
  <table>${buildColgroup(portalSettings)}${buildThead(portalSettings)}<tbody>${rows}</tbody></table>
  ${portalSettings?.footerText ? '<div class="footer">' + esc(portalSettings.footerText) + "</div>" : ""}
</body></html>`;

    try {
      const html2pdf = (await import("html2pdf.js")).default;
      const container = document.createElement("div");
      const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
      if (bodyMatch) container.innerHTML = bodyMatch[1];
      const styleMatch = html.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
      if (styleMatch) {
        const style = document.createElement("style");
        style.textContent = styleMatch[1];
        container.prepend(style);
      }
      document.body.appendChild(container);
      const fileName = `rapport-${client.name.replace(/[^a-zA-Z0-9]/g, "_")}-${new Date().toISOString().split("T")[0]}`;
      await html2pdf().set({
        margin: [10, 10, 10, 10],
        filename: `${fileName}.pdf`,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      }).from(container).save();
      document.body.removeChild(container);
    } catch {
      alert("Erreur lors de la génération du PDF");
    }
    setDownloading(false);
  }
}
