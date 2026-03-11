"use client";

import { useEffect, useState, use, useRef } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Mail, Phone, MapPin, ShieldCheck, ShieldX, RefreshCw, Upload, Printer, X, ImageIcon, Trash2 } from "lucide-react";
import StatusBadge from "@/components/ui/StatusBadge";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { formatDate, formatCountdown, getCountdownColor, formatCurrency, getStatusLabel, isWarrantyExpired } from "@/lib/utils";
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
  logoUrl: string | null;
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
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [reportSettings, setReportSettings] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch(`/api/clients/${id}`)
      .then((r) => r.json())
      .then(setClient)
      .finally(() => setLoading(false));
    fetch("/api/settings")
      .then((r) => r.json())
      .then(setReportSettings);
  }, [id]);

  async function changeStatus(installId: string, newStatus: string) {
    setUpdatingStatus(installId);
    await fetch(`/api/installations/${installId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    const res = await fetch(`/api/clients/${id}`);
    const data = await res.json();
    setClient(data);
    setUpdatingStatus(null);
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      alert("Le fichier est trop volumineux (max 2 Mo)");
      return;
    }
    setUploadingLogo(true);
    const reader = new FileReader();
    reader.onload = async () => {
      const logoUrl = reader.result as string;
      await fetch(`/api/clients/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logoUrl }),
      });
      setClient((prev) => prev ? { ...prev, logoUrl } : prev);
      setUploadingLogo(false);
    };
    reader.readAsDataURL(file);
  }

  async function removeLogo() {
    setUploadingLogo(true);
    await fetch(`/api/clients/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ logoUrl: null }),
    });
    setClient((prev) => prev ? { ...prev, logoUrl: null } : prev);
    setUploadingLogo(false);
  }

  async function deleteInstallation(installId: string, productName: string) {
    if (!confirm(`Supprimer l'installation "${productName}" ?`)) return;
    await fetch(`/api/installations/${installId}`, { method: "DELETE" });
    const res = await fetch(`/api/clients/${id}`);
    const data = await res.json();
    setClient(data);
  }

  function printReport() {
    if (!client) return;

    const title = reportSettings.report_title || "Rapport de suivi des garanties";
    const subtitle = reportSettings.report_subtitle || "";
    const message = reportSettings.report_message || "";
    const companyLogo = reportSettings.company_logo || "";
    const groupByFamily = reportSettings.report_group_mode === "family";
    const today = new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });

    function getReportStatusLabel(status: string): string {
      if (status === "EN_PARC_GARANTIE") return "En parc";
      if (status === "EN_PARC_HORS_GARANTIE") return "Hors parc";
      if (status === "RENOUVELE") return "Hors parc (Renouvelé)";
      return status;
    }

    function getStatusStyle(status: string, endDate: string): string {
      const expired = new Date(endDate).getTime() < Date.now();
      if (status === "RENOUVELE") return "color: #2563eb; font-weight: 700;";
      if (status === "EN_PARC_HORS_GARANTIE") return "color: #dc2626; font-weight: 700;";
      if (expired) return "color: #dc2626; font-weight: 700;";
      const days = Math.ceil((new Date(endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      if (days <= 90) return "color: #ea580c; font-weight: 700;";
      return "color: #16a34a; font-weight: 700;";
    }

    function buildInstRows(installations: Installation[]): string {
      return installations.map((inst) => `
        <tr>
          <td>${inst.product.name}</td>
          <td>${inst.family || "—"}</td>
          <td>${inst.supplier || "—"}</td>
          <td>${formatDate(inst.startDate)}</td>
          <td>${inst.durationMonths} mois</td>
          <td>${formatDate(inst.endDate)}</td>
          <td style="${getStatusStyle(inst.status, inst.endDate)}">${getReportStatusLabel(inst.status)}</td>
        </tr>
      `).join("");
    }

    let tableContent = "";
    if (groupByFamily) {
      const families = new Map<string, Installation[]>();
      client.installations.forEach((inst) => {
        const fam = inst.family || "Autre";
        if (!families.has(fam)) families.set(fam, []);
        families.get(fam)!.push(inst);
      });
      const sortedFamilies = Array.from(families.entries()).sort((a, b) => a[0].localeCompare(b[0]));
      tableContent = sortedFamilies.map(([family, installs]) => `
        <div style="margin-top: 20px;">
          <h3 style="font-size: 14px; font-weight: 700; color: #3b82f6; margin-bottom: 8px; padding: 6px 10px; background: #eff6ff; border-radius: 4px;">${family} (${installs.length})</h3>
          <table>
            <thead>
              <tr>
                <th>Produit</th>
                <th>Fournisseur</th>
                <th>Début</th>
                <th>Durée</th>
                <th>Fin garantie</th>
                <th>Statut</th>
              </tr>
            </thead>
            <tbody>
              ${installs.map((inst) => `
                <tr>
                  <td>${inst.product.name}</td>
                  <td>${inst.supplier || "—"}</td>
                  <td>${formatDate(inst.startDate)}</td>
                  <td>${inst.durationMonths} mois</td>
                  <td>${formatDate(inst.endDate)}</td>
                  <td style="${getStatusStyle(inst.status, inst.endDate)}">${getReportStatusLabel(inst.status)}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      `).join("");
    } else {
      const sorted = [...client.installations].sort((a, b) => new Date(a.endDate).getTime() - new Date(b.endDate).getTime());
      tableContent = `
        <table>
          <thead>
            <tr>
              <th>Produit</th>
              <th>Famille</th>
              <th>Fournisseur</th>
              <th>Début</th>
              <th>Durée</th>
              <th>Fin garantie</th>
              <th>Statut</th>
            </tr>
          </thead>
          <tbody>
            ${buildInstRows(sorted)}
          </tbody>
        </table>
      `;
    }

    const enParc = client.installations.filter(i => i.status === "EN_PARC_GARANTIE");
    const horsParc = client.installations.filter(i => i.status === "EN_PARC_HORS_GARANTIE" || i.status === "RENOUVELE");

    const clientLogoHtml = client.logoUrl
      ? `<img src="${client.logoUrl}" alt="Logo client" style="max-width: 180px; max-height: 120px;" />`
      : "";
    const companyLogoHtml = companyLogo
      ? `<img src="${companyLogo}" alt="Logo société" style="max-width: 180px; max-height: 120px;" />`
      : "";

    const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <title>Rapport - ${client.name}</title>
  <style>
    @media print {
      @page { margin: 15mm; }
      html, body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #1a1a2e; }

    .cover-page {
      height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      page-break-after: always;
      background: #ffffff;
      color: #1a1a2e;
      padding: 40px;
    }
    .cover-logos { display: flex; align-items: center; justify-content: center; gap: 40px; margin-bottom: 40px; }
    .cover-logos img { border-radius: 12px; background: white; padding: 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .cover-page h1 { font-size: 32px; font-weight: 700; margin-bottom: 12px; color: #1e293b; }
    .cover-page .client-name { font-size: 42px; font-weight: 800; color: #3b82f6; margin-bottom: 30px; }
    .cover-page .subtitle { font-size: 18px; color: #64748b; margin-bottom: 8px; }
    .cover-page .date { font-size: 16px; color: #94a3b8; margin-top: 40px; }
    .cover-page .message { font-size: 14px; color: #64748b; margin-top: 20px; max-width: 500px; line-height: 1.6; }

    .report-content { padding: 20px 0; }
    .section-title { font-size: 18px; font-weight: 700; margin-bottom: 16px; color: #0f172a; border-bottom: 2px solid #3b82f6; padding-bottom: 8px; }

    .stats { display: flex; gap: 16px; margin-bottom: 30px; flex-wrap: wrap; }
    .stat-card { flex: 1; min-width: 120px; padding: 16px; border-radius: 8px; text-align: center; border: 1px solid #e2e8f0; }
    .stat-card .value { font-size: 28px; font-weight: 800; }
    .stat-card .label { font-size: 11px; color: #64748b; margin-top: 4px; }
    .stat-green { border-color: #10b981; } .stat-green .value { color: #10b981; }
    .stat-red { border-color: #ef4444; } .stat-red .value { color: #ef4444; }
    .stat-blue { border-color: #3b82f6; } .stat-blue .value { color: #3b82f6; }

    table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 10px; }
    th { background: #f1f5f9; padding: 10px 8px; text-align: left; font-weight: 600; font-size: 11px; text-transform: uppercase; color: #475569; border-bottom: 2px solid #e2e8f0; }
    td { padding: 8px; border-bottom: 1px solid #f1f5f9; }
    tr:nth-child(even) { background: #fafafa; }

    .header-bar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; padding-bottom: 16px; border-bottom: 1px solid #e2e8f0; }
    .header-bar .client-info h2 { font-size: 22px; font-weight: 700; }
    .header-bar .client-info p { font-size: 12px; color: #64748b; }
    .header-bar .report-date { font-size: 12px; color: #64748b; text-align: right; }
  </style>
</head>
<body>
  <div class="cover-page">
    <div class="cover-logos">
      ${companyLogoHtml}
      ${clientLogoHtml}
    </div>
    <h1>${title}</h1>
    <div class="client-name">${client.name}</div>
    ${subtitle ? `<div class="subtitle">${subtitle}</div>` : ""}
    <div class="date">${today}</div>
    ${message ? `<div class="message">${message}</div>` : ""}
  </div>

  <div class="report-content">
    <div class="header-bar">
      <div class="client-info">
        <h2>${client.name}</h2>
        <p>${[client.email, client.phone, client.city].filter(Boolean).join(" • ")}</p>
      </div>
      <div class="report-date">
        <p>Généré le ${today}</p>
        <p>${client.installations.length} installation(s)</p>
      </div>
    </div>

    <div class="stats">
      <div class="stat-card">
        <div class="value">${client.installations.length}</div>
        <div class="label">Total</div>
      </div>
      <div class="stat-card stat-green">
        <div class="value">${enParc.length}</div>
        <div class="label">En parc</div>
      </div>
      <div class="stat-card stat-red">
        <div class="value">${horsParc.length}</div>
        <div class="label">Hors parc</div>
      </div>
    </div>

    <div class="section-title">Détail des installations</div>
    ${tableContent}
  </div>

  <script>
    // Remove browser headers/footers during print
    (function() {
      var style = document.createElement('style');
      style.textContent = '@page { margin: 15mm; } @media print { title { display: none; } }';
      document.head.appendChild(style);
      document.title = ' ';
    })();
  </script>
</body>
</html>`;

    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.onload = () => {
        printWindow.print();
      };
    }
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

  const enParc = client.installations.filter((i) => i.status === "EN_PARC_GARANTIE");
  const horsParc = client.installations.filter((i) => i.status === "EN_PARC_HORS_GARANTIE");
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
        <div className="flex items-center gap-4 flex-1">
          {/* Logo */}
          <div className="relative group">
            {client.logoUrl ? (
              <div className="relative">
                <img
                  src={client.logoUrl}
                  alt={`Logo ${client.name}`}
                  className="h-14 w-14 rounded-lg object-contain bg-white p-1 border border-surface-700"
                />
                <button
                  onClick={removeLogo}
                  disabled={uploadingLogo}
                  className="absolute -top-1.5 -right-1.5 rounded-full bg-red-500 p-0.5 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingLogo}
                className="flex h-14 w-14 items-center justify-center rounded-lg border-2 border-dashed border-surface-700 text-surface-500 hover:border-primary-500 hover:text-primary-400 transition-colors"
              >
                {uploadingLogo ? (
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
                ) : (
                  <ImageIcon className="h-5 w-5" />
                )}
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleLogoUpload}
            />
          </div>
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
        <div className="flex gap-2">
          {client.logoUrl && (
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingLogo}
              className="flex items-center gap-2 rounded-lg border border-surface-700 px-3 py-2 text-xs font-medium text-surface-400 hover:bg-surface-800 transition-colors"
            >
              <Upload className="h-3.5 w-3.5" />
              Changer le logo
            </button>
          )}
          <button
            onClick={printReport}
            className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-xs font-medium text-white hover:bg-primary-700 transition-colors"
          >
            <Printer className="h-3.5 w-3.5" />
            Imprimer le rapport
          </button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="rounded-xl border border-surface-800 bg-surface-900 p-4 text-center">
          <p className="text-2xl font-bold text-white">{client.installations.length}</p>
          <p className="text-xs text-surface-400 mt-1">Total</p>
        </div>
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-center">
          <p className="text-2xl font-bold text-emerald-400">{enParc.length}</p>
          <p className="text-xs text-surface-400 mt-1">En parc</p>
        </div>
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-center">
          <p className="text-2xl font-bold text-red-400">{horsParc.length}</p>
          <p className="text-xs text-surface-400 mt-1">Hors parc</p>
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
              {client.installations.map((inst) => {
                const expired = isWarrantyExpired(inst.endDate);
                return (
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
                  <td className={`px-4 py-3 text-sm whitespace-nowrap ${expired ? "text-red-400 font-medium" : "text-surface-300"}`}>{formatDate(inst.endDate)}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`text-xs font-bold ${expired ? "text-red-400" : getCountdownColor(inst.endDate)}`}>
                      {inst.status === "RENOUVELE" ? "Renouvelé" : formatCountdown(inst.endDate)}
                    </span>
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={inst.status} expired={expired} /></td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button
                        onClick={(e) => { e.stopPropagation(); changeStatus(inst.id, "EN_PARC_GARANTIE"); }}
                        disabled={updatingStatus === inst.id}
                        title="En parc"
                        className={`rounded p-1 transition-colors disabled:opacity-50 ${
                          inst.status === "EN_PARC_GARANTIE"
                            ? "text-emerald-400 bg-emerald-500/10"
                            : "text-surface-500 hover:text-emerald-400 hover:bg-emerald-500/10"
                        }`}
                      >
                        <ShieldCheck className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); changeStatus(inst.id, "EN_PARC_HORS_GARANTIE"); }}
                        disabled={updatingStatus === inst.id}
                        title="Hors parc"
                        className={`rounded p-1 transition-colors disabled:opacity-50 ${
                          inst.status === "EN_PARC_HORS_GARANTIE"
                            ? "text-red-400 bg-red-500/10"
                            : "text-surface-500 hover:text-red-400 hover:bg-red-500/10"
                        }`}
                      >
                        <ShieldX className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); changeStatus(inst.id, "RENOUVELE"); }}
                        disabled={updatingStatus === inst.id}
                        title="Renouvelé"
                        className={`rounded p-1 transition-colors disabled:opacity-50 ${
                          inst.status === "RENOUVELE"
                            ? "text-blue-400 bg-blue-500/10"
                            : "text-surface-500 hover:text-blue-400 hover:bg-blue-500/10"
                        }`}
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteInstallation(inst.id, inst.product.name); }}
                        title="Supprimer"
                        className="rounded p-1 text-surface-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
                );
              })}
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
