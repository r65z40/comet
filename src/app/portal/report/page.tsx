"use client";

import { useEffect, useState } from "react";
import { usePortal } from "../layout";
import { Download, Loader2 } from "lucide-react";

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

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

export default function PortalReportPage() {
  const { client, portalSettings } = usePortal();
  const [installations, setInstallations] = useState<Installation[]>([]);
  const [loading, setLoading] = useState(true);
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

  function getStatusStyle(status: string, endDate: string, alwaysInFleet?: boolean): string {
    if (alwaysInFleet) return "color: #d97706; font-weight: 700;";
    if (status === "RENOUVELE") return "color: #2563eb; font-weight: 700;";
    if (status === "HORS_PARC" || status === "EN_PARC_HORS_GARANTIE") return "color: #dc2626; font-weight: 700;";
    const expired = new Date(endDate).getTime() < Date.now();
    if (expired) return "color: #dc2626; font-weight: 700;";
    const days = Math.ceil((new Date(endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (days <= 90) return "color: #ea580c; font-weight: 700;";
    return "color: #16a34a; font-weight: 700;";
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
        <td>${esc(inst.product.name)}</td>
        ${portalSettings?.showFamily ? `<td>${esc(inst.family || "—")}</td>` : ""}
        ${portalSettings?.showSupplier ? `<td>${esc(inst.supplier || "—")}</td>` : ""}
        ${portalSettings?.showQuantity ? `<td>${inst.quantity}</td>` : ""}
        ${portalSettings?.showComParc ? `<td>${esc(inst.comParc || "—")}</td>` : ""}
        <td>${formatDate(inst.startDate)}</td>
        <td>${formatDate(inst.endDate)}</td>
        ${portalSettings?.showDuration ? `<td>${inst.durationMonths} mois</td>` : ""}
        <td style="${getStatusStyle(inst.status, inst.endDate, inst.alwaysInFleet)}">${getStatusLabel(inst.status, inst.endDate, inst.alwaysInFleet)}</td>
      </tr>
    `).join("");

    const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"/>
<title>Rapport - ${esc(client.name)}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', Tahoma, sans-serif; color: #1a1a2e; padding: 10mm; }
  .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; padding-bottom: 16px; border-bottom: 2px solid ${primaryColor}; }
  .header h2 { font-size: 22px; font-weight: 700; }
  .header p { font-size: 12px; color: #64748b; }
  .stats { display: flex; gap: 16px; margin-bottom: 30px; }
  .stat-card { flex: 1; padding: 16px; border-radius: 8px; text-align: center; border: 1px solid #e2e8f0; }
  .stat-card .value { font-size: 28px; font-weight: 800; }
  .stat-card .label { font-size: 11px; color: #64748b; margin-top: 4px; }
  .stat-green { border-color: #10b981; } .stat-green .value { color: #10b981; }
  .stat-red { border-color: #ef4444; } .stat-red .value { color: #ef4444; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; margin-top: 10px; }
  th { background: #f1f5f9; padding: 10px 8px; text-align: left; font-weight: 600; font-size: 11px; text-transform: uppercase; color: #475569; white-space: nowrap; border-bottom: 2px solid #e2e8f0; }
  td { padding: 8px; border-bottom: 1px solid #f1f5f9; white-space: nowrap; }
  th:first-child, td:first-child { white-space: normal; width: 100%; }
  th:not(:first-child), td:not(:first-child) { text-align: center; padding: 8px 6px; }
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
  <table>${portalSettings?.showHeaderRow !== false ? `<thead><tr>
    <th>Produit</th>
    ${portalSettings?.showFamily ? "<th>Famille</th>" : ""}
    ${portalSettings?.showSupplier ? "<th>Fournisseur</th>" : ""}
    ${portalSettings?.showQuantity ? "<th>Qté</th>" : ""}
    ${portalSettings?.showComParc ? "<th>Com. Parc</th>" : ""}
    <th>Début</th><th>Fin</th>
    ${portalSettings?.showDuration ? "<th>Durée</th>" : ""}
    <th>Statut</th>
  </tr></thead>` : ""}<tbody>${rows}</tbody></table>
  ${portalSettings?.footerText ? `<div class="footer">${esc(portalSettings.footerText)}</div>` : ""}
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-primary-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Rapport</h1>
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <p className="text-sm text-slate-500 mb-4">
          Téléchargez un rapport PDF récapitulatif de toutes vos installations et garanties.
        </p>
        <button
          onClick={downloadPdf}
          disabled={downloading}
          className="flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-white transition-colors disabled:opacity-50"
          style={{ backgroundColor: primaryColor }}
        >
          {downloading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Génération...
            </>
          ) : (
            <>
              <Download className="h-4 w-4" />
              Télécharger le rapport PDF
            </>
          )}
        </button>
      </div>
    </div>
  );
}
