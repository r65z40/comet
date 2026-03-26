"use client";

import { useEffect, useState, use, useRef } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Mail, Phone, MapPin, ShieldCheck, ShieldX, ShieldAlert, RefreshCw, Upload, Printer, X, ImageIcon, Trash2, ArrowUpDown, Search, Download, Globe, UserPlus, Eye, EyeOff, Palette, Save, Loader2, Link as LinkIcon, Check, Copy, Building2, Users, Briefcase, Smartphone, FileText, ChevronDown, Calendar, ClipboardList } from "lucide-react";
import StatusBadge from "@/components/ui/StatusBadge";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { formatDate, formatCountdown, getCountdownColor, formatCurrency, getStatusLabel, isWarrantyExpired } from "@/lib/utils";
import Link from "next/link";
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
  invoice: { id: string; invoiceNumber: string | null; invoiceDate: string } | null;
}

type SortKey = "product" | "family" | "supplier" | "startDate" | "durationMonths" | "endDate" | "status";
type SortDir = "asc" | "desc";

interface Contact {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  jobTitle: string | null;
  isBillingContact: boolean;
}

interface ClientDetail {
  id: string;
  axonautId: number | null;
  name: string;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  fax: string | null;
  website: string | null;
  siret: string | null;
  address: string | null;
  addressComplement: string | null;
  city: string | null;
  zipCode: string | null;
  country: string | null;
  notes: string | null;
  logoUrl: string | null;
  installations: Installation[];
  invoices: {
    id: string;
    invoiceNumber: string | null;
    invoiceDate: string;
    totalAmount: number | null;
    status: string | null;
  }[];
  contacts: Contact[];
  boardCards: {
    id: string;
    title: string;
    priority: number;
    assigneeId: string | null;
    dueDate: string | null;
    column: { id: string; name: string; color: string };
    contact: { id: string; firstName: string | null; lastName: string | null } | null;
    tags: { id: string; tag: { id: string; name: string; color: string } }[];
    updatedAt: string;
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
  const [refreshing, setRefreshing] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("endDate");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [statusFilter, setStatusFilter] = useState<"all" | "en_parc" | "hors_parc" | "renouvele">("all");
  const [installSearch, setInstallSearch] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Portal state
  const [portalOpen, setPortalOpen] = useState(false);
  const [portalUsers, setPortalUsers] = useState<{ id: string; name: string; email: string; active: boolean; createdAt: string }[]>([]);
  const [portalSettings, setPortalSettings] = useState<{
    primaryColor: string; headerLogo: string | null; welcomeMessage: string | null;
    welcomeTitle: string | null; welcomeContent: string | null;
    showStats: boolean; showExpiring: boolean;
    showFamily: boolean; showSupplier: boolean; showDuration: boolean;
    showQuantity: boolean; showComParc: boolean; showHeaderRow: boolean; footerText: string | null;
  } | null>(null);
  const [portalLoaded, setPortalLoaded] = useState(false);
  const [portalSaving, setPortalSaving] = useState(false);
  const [newPortalUser, setNewPortalUser] = useState({ name: "", email: "" });
  const [portalUserCreating, setPortalUserCreating] = useState(false);
  const [inviteLink, setInviteLink] = useState<{ userId: string; url: string; emailSent?: boolean } | null>(null);
  const [inviteCopied, setInviteCopied] = useState(false);
  const [inviteGenerating, setInviteGenerating] = useState<string | null>(null);

  async function loadPortal() {
    if (portalLoaded) return;
    const res = await fetch(`/api/clients/${id}/portal`);
    const data = await res.json();
    setPortalUsers(data.portalUsers || []);
    setPortalSettings(data.portalSettings || {
      primaryColor: "#3b82f6", headerLogo: null, welcomeMessage: null,
      welcomeTitle: null, welcomeContent: null,
      showStats: true, showExpiring: true,
      showFamily: true, showSupplier: true, showDuration: true,
      showQuantity: false, showComParc: false, showHeaderRow: true, footerText: null,
    });
    setPortalLoaded(true);
  }

  async function savePortalSettings() {
    if (!portalSettings) return;
    setPortalSaving(true);
    await fetch(`/api/clients/${id}/portal`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(portalSettings),
    });
    setPortalSaving(false);
  }

  async function createPortalUser() {
    if (!newPortalUser.name || !newPortalUser.email) return;
    setPortalUserCreating(true);
    const res = await fetch(`/api/clients/${id}/portal/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newPortalUser),
    });
    if (res.ok) {
      const user = await res.json();
      setPortalUsers((prev) => [user, ...prev]);
      setNewPortalUser({ name: "", email: "" });
      // Auto-generate invite link for the new user
      await generateInviteLink(user.id);
    } else {
      const err = await res.json();
      alert(err.error || "Erreur");
    }
    setPortalUserCreating(false);
  }

  async function generateInviteLink(userId: string) {
    setInviteGenerating(userId);
    try {
      const res = await fetch(`/api/clients/${id}/portal/users/${userId}/invite`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setInviteLink({ userId, url: data.inviteUrl, emailSent: data.emailSent });
        setInviteCopied(false);
      } else {
        const err = await res.json();
        alert(err.error || "Erreur lors de la génération du lien");
      }
    } catch {
      alert("Erreur de connexion");
    }
    setInviteGenerating(null);
  }

  function copyInviteLink() {
    if (!inviteLink) return;
    // Fallback for non-HTTPS contexts where navigator.clipboard is unavailable
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(inviteLink.url);
    } else {
      const textarea = document.createElement("textarea");
      textarea.value = inviteLink.url;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }
    setInviteCopied(true);
    setTimeout(() => setInviteCopied(false), 3000);
  }

  async function togglePortalUser(userId: string, active: boolean) {
    await fetch(`/api/clients/${id}/portal/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active }),
    });
    setPortalUsers((prev) => prev.map((u) => u.id === userId ? { ...u, active } : u));
  }

  async function deletePortalUser(userId: string) {
    if (!confirm("Supprimer cet accès client ?")) return;
    await fetch(`/api/clients/${id}/portal/users/${userId}`, { method: "DELETE" });
    setPortalUsers((prev) => prev.filter((u) => u.id !== userId));
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function sortedInstallations(installations: Installation[]): Installation[] {
    return [...installations].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "product": cmp = a.product.name.localeCompare(b.product.name); break;
        case "family": cmp = (a.family || "").localeCompare(b.family || ""); break;
        case "supplier": cmp = (a.supplier || "").localeCompare(b.supplier || ""); break;
        case "startDate": cmp = new Date(a.startDate).getTime() - new Date(b.startDate).getTime(); break;
        case "durationMonths": cmp = a.durationMonths - b.durationMonths; break;
        case "endDate": cmp = new Date(a.endDate).getTime() - new Date(b.endDate).getTime(); break;
        case "status": cmp = a.status.localeCompare(b.status); break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }

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

  async function toggleAlwaysInFleet(installId: string, currentValue: boolean) {
    setUpdatingStatus(installId);
    await fetch(`/api/installations/${installId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ alwaysInFleet: !currentValue }),
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

  async function refreshFromAxonaut() {
    if (!client?.axonautId) return;
    setRefreshing(true);
    try {
      await fetch("/api/sync/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "client", axonautId: client.axonautId }),
      });
      const res = await fetch(`/api/clients/${id}`);
      const data = await res.json();
      setClient(data);
    } catch {
      alert("Erreur lors de l'actualisation");
    }
    setRefreshing(false);
  }

  function buildReportHtml(): string | null {
    if (!client) return null;

    // Escape HTML to prevent XSS in report
    function esc(str: string): string {
      return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    }

    const title = esc(reportSettings.report_title || "Rapport de suivi des garanties");
    const subtitle = esc(reportSettings.report_subtitle || "");
    const message = esc(reportSettings.report_message || "");
    const companyLogo = reportSettings.company_logo || "";
    const companyName = esc(reportSettings.company_name || "");
    const showVerticalName = reportSettings.report_show_vertical_name !== "false";
    const groupByFamily = reportSettings.report_group_mode === "family";
    const primaryColor = reportSettings.report_primary_color || "#3b82f6";
    const showStats = reportSettings.report_show_stats !== "false";
    const showFamily = reportSettings.report_show_family !== "false";
    const showSupplier = reportSettings.report_show_supplier !== "false";
    const showDuration = reportSettings.report_show_duration !== "false";
    const footerText = esc(reportSettings.report_footer_text || "");
    const orientation = reportSettings.report_orientation || "portrait";
    const includeHorsParc = reportSettings.report_include_hors_parc !== "false";
    const showRenewedCount = reportSettings.report_show_renewed_count === "true";
    const coverBg = reportSettings.report_cover_bg || "";
    const coverBgOpacity = parseInt(reportSettings.report_cover_bg_opacity || "15") / 100;
    const showQuantity = reportSettings.report_show_quantity === "true";
    const showComParc = reportSettings.report_show_com_parc === "true";
    const showHeaderRow = reportSettings.report_show_header_row !== "false";
    const today = new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });

    function getReportStatusLabel(status: string, endDate: string, alwaysInFleet?: boolean): string {
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
      const expired = new Date(endDate).getTime() < Date.now();
      if (status === "RENOUVELE") return "color: #2563eb; font-weight: 700;";
      if (status === "HORS_PARC" || status === "EN_PARC_HORS_GARANTIE") return "color: #dc2626; font-weight: 700;";
      if (expired) return "color: #dc2626; font-weight: 700;";
      const days = Math.ceil((new Date(endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      if (days <= 90) return "color: #ea580c; font-weight: 700;";
      return "color: #16a34a; font-weight: 700;";
    }

    function buildInstRows(installations: Installation[]): string {
      return installations.map((inst) => `
        <tr>
          <td>${esc(inst.product.name)}</td>
          ${showFamily ? `<td>${esc(inst.family || "—")}</td>` : ""}
          ${showSupplier ? `<td>${esc(inst.supplier || "—")}</td>` : ""}
          ${showQuantity ? `<td>${inst.quantity}</td>` : ""}
          ${showComParc ? `<td>${esc(inst.comParc || "—")}</td>` : ""}
          <td>${formatDate(inst.startDate)}</td>
          <td>${formatDate(inst.endDate)}</td>
          ${showDuration ? `<td>${inst.durationMonths} mois</td>` : ""}
          <td style="${getStatusStyle(inst.status, inst.endDate, inst.alwaysInFleet)}">${getReportStatusLabel(inst.status, inst.endDate, inst.alwaysInFleet)}</td>
        </tr>
      `).join("");
    }

    // Exclude renewed installations from report, and optionally hors parc
    const reportInstallations = client.installations.filter(i => {
      if (i.status === "RENOUVELE") return false;
      if (!includeHorsParc && (i.status === "HORS_PARC" || i.status === "EN_PARC_HORS_GARANTIE")) return false;
      return true;
    });

    function buildColgroup(includeFamily: boolean): string {
      const colW = 75;
      const narrow = 45;
      let fixedCols = 3; // Début, Fin, Statut
      if (includeFamily) fixedCols++;
      if (showSupplier) fixedCols++;
      if (showQuantity) fixedCols++;
      if (showComParc) fixedCols++;
      if (showDuration) fixedCols++;
      const fixedWidth = fixedCols * colW + (showQuantity ? narrow - colW : 0);
      return `<colgroup><col style="width: calc(100% - ${fixedWidth}px);" />${includeFamily ? `<col style="width: ${colW}px;" />` : ""}${showSupplier ? `<col style="width: ${colW}px;" />` : ""}${showQuantity ? `<col style="width: ${narrow}px;" />` : ""}${showComParc ? `<col style="width: ${colW}px;" />` : ""}<col style="width: ${colW}px;" /><col style="width: ${colW}px;" />${showDuration ? `<col style="width: ${colW}px;" />` : ""}<col style="width: ${colW}px;" /></colgroup>`;
    }

    function buildTableHead(includeFamily: boolean): string {
      if (!showHeaderRow) return "";
      return `<thead><tr>
        <th>Produit</th>
        ${includeFamily ? `<th>Famille</th>` : ""}
        ${showSupplier ? `<th>Fournisseur</th>` : ""}
        ${showQuantity ? `<th>Qté</th>` : ""}
        ${showComParc ? `<th>Com. Parc</th>` : ""}
        <th>Début</th>
        <th>Fin</th>
        ${showDuration ? `<th>Durée</th>` : ""}
        <th>Statut</th>
      </tr></thead>`;
    }

    let tableContent = "";
    if (groupByFamily) {
      const families = new Map<string, Installation[]>();
      reportInstallations.forEach((inst) => {
        const fam = inst.family || "Autre";
        if (!families.has(fam)) families.set(fam, []);
        families.get(fam)!.push(inst);
      });
      const sortedFamilies = Array.from(families.entries()).sort((a, b) => a[0].localeCompare(b[0]));
      tableContent = sortedFamilies.map(([family, installs]) => `
        <div style="margin-top: 20px;">
          <h3 style="font-size: 14px; font-weight: 700; color: ${primaryColor}; margin-bottom: 8px; padding: 6px 10px; background: ${primaryColor}11; border-radius: 4px;">${esc(family)} (${installs.length})</h3>
          <table>
            ${buildColgroup(false)}
            ${buildTableHead(false)}
            <tbody>
              ${installs.map((inst) => `
                <tr>
                  <td>${esc(inst.product.name)}</td>
                  ${showSupplier ? `<td>${esc(inst.supplier || "—")}</td>` : ""}
                  ${showQuantity ? `<td>${inst.quantity}</td>` : ""}
                  ${showComParc ? `<td>${esc(inst.comParc || "—")}</td>` : ""}
                  <td>${formatDate(inst.startDate)}</td>
                  <td>${formatDate(inst.endDate)}</td>
                  ${showDuration ? `<td>${inst.durationMonths} mois</td>` : ""}
                  <td style="${getStatusStyle(inst.status, inst.endDate, inst.alwaysInFleet)}">${getReportStatusLabel(inst.status, inst.endDate, inst.alwaysInFleet)}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      `).join("");
    } else {
      const sorted = [...reportInstallations].sort((a, b) => new Date(a.endDate).getTime() - new Date(b.endDate).getTime());
      tableContent = `
        <table>
          ${buildColgroup(showFamily)}
          ${buildTableHead(showFamily)}
          <tbody>
            ${buildInstRows(sorted)}
          </tbody>
        </table>
      `;
    }

    const enParc = reportInstallations.filter(i => i.status === "EN_PARC" || i.status === "EN_PARC_GARANTIE");
    const horsParc = reportInstallations.filter(i => i.status === "HORS_PARC" || i.status === "EN_PARC_HORS_GARANTIE");
    const renewedCount = client.installations.filter(i => i.status === "RENOUVELE").length;

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
  <title>Rapport de suivi des garanties informatique - ${esc(client.name)}</title>
  <style>
    @media print {
      @page { margin: 10mm; size: ${orientation === "landscape" ? "landscape" : "portrait"}; }
      @page:first { margin: 0; }
      html, body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #1a1a2e; }

    .cover-page {
      position: relative;
      width: 100%;
      height: ${orientation === "landscape" ? "210mm" : "297mm"};
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      background: #ffffff;
      color: #1a1a2e;
      padding: 20px;
      overflow: hidden;
      margin: 0;
    }
    .cover-bg {
      position: absolute;
      inset: 0;
      background-size: cover;
      background-position: center;
      background-repeat: no-repeat;
      opacity: ${coverBgOpacity};
      z-index: 0;
    }
    .cover-page > *:not(.cover-bg) { position: relative; z-index: 1; }
    .cover-logos { display: flex; align-items: center; justify-content: center; gap: 40px; margin-bottom: 40px; }
    .cover-logos img { border-radius: 12px; background: white; padding: 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .client-logo-inline { margin-top: 16px; margin-bottom: 16px; }
    .client-logo-inline img { border-radius: 12px; background: white; padding: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .cover-page h1 { font-size: 32px; font-weight: 700; margin-bottom: 12px; color: #1e293b; }
    .cover-page .client-name { font-size: 42px; font-weight: 800; color: ${primaryColor}; margin-bottom: 30px; }
    .cover-page .subtitle { font-size: 18px; color: #64748b; margin-bottom: 8px; }
    .cover-page .date { font-size: 16px; color: #94a3b8; margin-top: 40px; }
    .cover-page .message { font-size: 14px; color: #64748b; margin-top: 20px; max-width: 500px; line-height: 1.6; }
    .cover-page .vertical-text { position: absolute; right: 0; top: 0; bottom: 0; writing-mode: vertical-rl; text-orientation: mixed; display: flex; align-items: center; justify-content: center; font-size: 17px; font-weight: 800; color: ${primaryColor}90; letter-spacing: 5px; text-transform: uppercase; white-space: nowrap; padding-right: 5px; }
    @media print { .cover-page { page-break-after: always; } .cover-page .vertical-text { top: 50%; bottom: auto; transform: translateY(-50%); } }

    .report-content { padding: 10mm; }
    .section-title { font-size: 18px; font-weight: 700; margin-bottom: 16px; color: #0f172a; border-bottom: 2px solid ${primaryColor}; padding-bottom: 8px; }

    .stats { display: flex; gap: 16px; margin-bottom: 30px; flex-wrap: wrap; }
    .stat-card { flex: 1; min-width: 120px; padding: 16px; border-radius: 8px; text-align: center; border: 1px solid #e2e8f0; }
    .stat-card .value { font-size: 28px; font-weight: 800; }
    .stat-card .label { font-size: 11px; color: #64748b; margin-top: 4px; }
    .stat-green { border-color: #10b981; } .stat-green .value { color: #10b981; }
    .stat-red { border-color: #ef4444; } .stat-red .value { color: #ef4444; }
    .stat-blue { border-color: ${primaryColor}; } .stat-blue .value { color: ${primaryColor}; }
    .footer { text-align: center; font-size: 11px; color: #94a3b8; padding-top: 20px; margin-top: 40px; border-top: 1px solid #e2e8f0; }

    table { width: 100%; border-collapse: collapse; font-size: 13px; margin-top: 10px; table-layout: fixed; }
    th { background: #f1f5f9; padding: 10px 8px; text-align: left; font-weight: 600; font-size: 11px; text-transform: uppercase; color: #475569; white-space: nowrap; border-bottom: 2px solid #e2e8f0; }
    td { padding: 8px; border-bottom: 1px solid #f1f5f9; white-space: nowrap; }
    th:first-child, td:first-child { white-space: normal; word-wrap: break-word; }
    th:not(:first-child), td:not(:first-child) { text-align: center; padding: 8px 6px; }
    tr:nth-child(even) { background: #fafafa; }

    .header-bar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; padding-bottom: 16px; border-bottom: 1px solid #e2e8f0; }
    .header-bar .client-info h2 { font-size: 22px; font-weight: 700; }
    .header-bar .client-info p { font-size: 12px; color: #64748b; }
    .header-bar .report-date { font-size: 12px; color: #64748b; text-align: right; }
  </style>
</head>
<body>
  <div class="cover-page">
    ${coverBg ? `<div class="cover-bg" style="background-image: url('${coverBg}');"></div>` : ""}
    ${showVerticalName ? `<div class="vertical-text">${esc(client.name)}</div>` : ""}
    ${companyLogoHtml ? `<div class="cover-logos">${companyLogoHtml}</div>` : ""}
    <h1>${title}</h1>
    <div class="client-name">${esc(client.name)}</div>
    ${clientLogoHtml ? `<div class="client-logo-inline">${clientLogoHtml}</div>` : ""}
    ${subtitle ? `<div class="subtitle">${subtitle}</div>` : ""}
    <div class="date">${today}</div>
    ${message ? `<div class="message">${message}</div>` : ""}
  </div>

  <div class="report-content">
    <div class="header-bar">
      <div class="client-info">
        <h2>${esc(client.name)}</h2>
        <p>${[client.email, client.phone, client.city].filter(Boolean).map(s => esc(s!)).join(" • ")}</p>
      </div>
      <div class="report-date">
        <p>Généré le ${today}</p>
        <p>${reportInstallations.length} installation(s)</p>
      </div>
    </div>

    ${showStats ? `<div class="stats">
      <div class="stat-card">
        <div class="value">${reportInstallations.length}</div>
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
      ${showRenewedCount ? `<div class="stat-card stat-blue">
        <div class="value">${renewedCount}</div>
        <div class="label">Renouvelés</div>
      </div>` : ""}
    </div>` : ""}

    <div class="section-title">Détail des installations</div>
    ${tableContent}
    ${footerText ? `<div class="footer">${footerText}</div>` : ""}
  </div>

  <script>
    (function() {
      document.title = 'Rapport de suivi des garanties informatique - ${esc(client.name).replace(/'/g, "\\&#039;")}';
    })();
  </script>
</body>
</html>`;

    return html;
  }

  function printReport() {
    const html = buildReportHtml();
    if (!html) return;
    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.onload = () => {
        printWindow.print();
      };
    }
  }

  async function downloadPdf() {
    const html = buildReportHtml();
    if (!html) return;
    const html2pdf = (await import("html2pdf.js")).default;
    const container = document.createElement("div");
    container.innerHTML = html;
    // Extract just the body content for html2pdf
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
    if (bodyMatch) container.innerHTML = bodyMatch[1];
    // Apply styles from the HTML
    const styleMatch = html.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
    if (styleMatch) {
      const style = document.createElement("style");
      style.textContent = styleMatch[1];
      container.prepend(style);
    }
    document.body.appendChild(container);
    const fileName = `rapport-${client!.name.replace(/[^a-zA-Z0-9]/g, "_")}-${new Date().toISOString().split("T")[0]}`;
    await html2pdf().set({
      margin: [0, 0, 0, 0],
      filename: `${fileName}.pdf`,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: "mm", format: "a4", orientation: reportSettings.report_orientation === "landscape" ? "landscape" : "portrait" },
    }).from(container).save();
    document.body.removeChild(container);
  }

  if (loading) return <LoadingSpinner />;
  if (!client) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-500">Client non trouvé</p>
        <button onClick={() => router.back()} className="mt-4 text-primary-600 hover:text-primary-700 text-sm">
          Retour
        </button>
      </div>
    );
  }

  const enParc = client.installations.filter((i) => i.status === "EN_PARC" || i.status === "EN_PARC_GARANTIE");
  const horsParc = client.installations.filter((i) => i.status === "HORS_PARC" || i.status === "EN_PARC_HORS_GARANTIE");
  const renouvele = client.installations.filter((i) => i.status === "RENOUVELE");

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <button
            onClick={() => router.back()}
            className="shrink-0 rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          {/* Logo */}
          <div className="relative group shrink-0">
            {client.logoUrl ? (
              <div className="relative">
                <img
                  src={client.logoUrl}
                  alt={`Logo ${client.name}`}
                  className="h-14 w-14 rounded-lg object-contain bg-white p-1 border border-slate-200"
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
                className="flex h-14 w-14 items-center justify-center rounded-lg border-2 border-dashed border-slate-200 text-slate-400 hover:border-primary-500 hover:text-primary-600 transition-colors"
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
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 truncate">{client.name}</h1>
              {client.installations.length > 0 && (
                <MiniDonut enParc={enParc.length} horsParc={horsParc.length} renouvele={renouvele.length} />
              )}
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
              {client.email && (
                <span className="flex items-center gap-1 text-xs text-slate-500">
                  <Mail className="h-3 w-3 shrink-0" /> <span className="truncate">{client.email}</span>
                </span>
              )}
              {client.phone && (
                <span className="flex items-center gap-1 text-xs text-slate-500">
                  <Phone className="h-3 w-3 shrink-0" /> {client.phone}
                </span>
              )}
              {client.city && (
                <span className="flex items-center gap-1 text-xs text-slate-500">
                  <MapPin className="h-3 w-3 shrink-0" /> {client.city}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          {client.logoUrl && (
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingLogo}
              className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-500 hover:bg-slate-50 transition-colors"
            >
              <Upload className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Changer le logo</span>
            </button>
          )}
          {client.axonautId && (
            <button
              onClick={refreshFromAxonaut}
              disabled={refreshing}
              className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-500 hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Actualiser</span>
            </button>
          )}
          <button
            onClick={printReport}
            className="flex items-center gap-2 rounded-lg border border-primary-600 px-4 py-2 text-xs font-medium text-primary-600 hover:bg-primary-50 transition-colors"
          >
            <Printer className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Imprimer</span>
          </button>
          <button
            onClick={downloadPdf}
            className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-xs font-medium text-white hover:bg-primary-700 transition-colors"
          >
            <Download className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">PDF</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <button
          onClick={() => setStatusFilter(statusFilter === "all" ? "all" : "all")}
          className={`rounded-xl border p-4 text-center transition-all cursor-pointer ${statusFilter === "all" ? "border-slate-400 ring-2 ring-slate-300 bg-white" : "border-slate-200 bg-white hover:border-slate-300"}`}
        >
          <p className="text-2xl font-bold text-slate-900">{client.installations.length}</p>
          <p className="text-xs text-slate-500 mt-1">Total</p>
        </button>
        <button
          onClick={() => setStatusFilter(statusFilter === "en_parc" ? "all" : "en_parc")}
          className={`rounded-xl border p-4 text-center transition-all cursor-pointer ${statusFilter === "en_parc" ? "border-emerald-400 ring-2 ring-emerald-300 bg-emerald-50" : "border-emerald-200 bg-emerald-50 hover:border-emerald-300"}`}
        >
          <p className="text-2xl font-bold text-emerald-600">{enParc.length}</p>
          <p className="text-xs text-slate-500 mt-1">En parc</p>
        </button>
        <button
          onClick={() => setStatusFilter(statusFilter === "hors_parc" ? "all" : "hors_parc")}
          className={`rounded-xl border p-4 text-center transition-all cursor-pointer ${statusFilter === "hors_parc" ? "border-red-400 ring-2 ring-red-300 bg-red-50" : "border-red-200 bg-red-50 hover:border-red-300"}`}
        >
          <p className="text-2xl font-bold text-red-600">{horsParc.length}</p>
          <p className="text-xs text-slate-500 mt-1">Hors parc</p>
        </button>
        <button
          onClick={() => setStatusFilter(statusFilter === "renouvele" ? "all" : "renouvele")}
          className={`rounded-xl border p-4 text-center transition-all cursor-pointer ${statusFilter === "renouvele" ? "border-blue-400 ring-2 ring-blue-300 bg-blue-50" : "border-blue-200 bg-blue-50 hover:border-blue-300"}`}
        >
          <p className="text-2xl font-bold text-blue-600">{renouvele.length}</p>
          <p className="text-xs text-slate-500 mt-1">Renouvelés</p>
        </button>
      </div>

      {/* Informations client et contacts */}
      {(client.address || client.phone || client.mobile || client.website || client.siret || client.notes || (client.contacts && client.contacts.length > 0)) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Informations détaillées */}
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="text-sm font-medium text-slate-900 mb-3 flex items-center gap-2">
              <Building2 className="h-4 w-4 text-slate-400" />
              Informations
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              {client.address && (
                <div className="sm:col-span-2">
                  <p className="text-xs text-slate-400 mb-0.5">Adresse</p>
                  <p className="text-slate-700">
                    {client.address}
                    {client.addressComplement && <><br />{client.addressComplement}</>}
                    {(client.zipCode || client.city) && <><br />{[client.zipCode, client.city].filter(Boolean).join(" ")}</>}
                    {client.country && <><br />{client.country}</>}
                  </p>
                </div>
              )}
              {client.phone && (
                <div>
                  <p className="text-xs text-slate-400 mb-0.5">Téléphone</p>
                  <p className="text-slate-700 flex items-center gap-1"><Phone className="h-3 w-3 text-slate-400" />{client.phone}</p>
                </div>
              )}
              {client.mobile && (
                <div>
                  <p className="text-xs text-slate-400 mb-0.5">Mobile</p>
                  <p className="text-slate-700 flex items-center gap-1"><Smartphone className="h-3 w-3 text-slate-400" />{client.mobile}</p>
                </div>
              )}
              {client.fax && (
                <div>
                  <p className="text-xs text-slate-400 mb-0.5">Fax</p>
                  <p className="text-slate-700">{client.fax}</p>
                </div>
              )}
              {client.email && (
                <div>
                  <p className="text-xs text-slate-400 mb-0.5">Email</p>
                  <p className="text-slate-700 flex items-center gap-1"><Mail className="h-3 w-3 text-slate-400" /><span className="truncate">{client.email}</span></p>
                </div>
              )}
              {client.website && (
                <div>
                  <p className="text-xs text-slate-400 mb-0.5">Site web</p>
                  <p className="text-slate-700 flex items-center gap-1">
                    <Globe className="h-3 w-3 text-slate-400" />
                    <a href={client.website.startsWith("http") ? client.website : `https://${client.website}`} target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline truncate">{client.website}</a>
                  </p>
                </div>
              )}
              {client.siret && (
                <div>
                  <p className="text-xs text-slate-400 mb-0.5">SIRET</p>
                  <p className="text-slate-700">{client.siret}</p>
                </div>
              )}
              {client.notes && (
                <div className="sm:col-span-2">
                  <p className="text-xs text-slate-400 mb-0.5">Notes</p>
                  <p className="text-slate-700 whitespace-pre-line text-xs">{client.notes}</p>
                </div>
              )}
            </div>
          </div>

          {/* Contacts */}
          {client.contacts && client.contacts.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <h3 className="text-sm font-medium text-slate-900 mb-3 flex items-center gap-2">
                <Users className="h-4 w-4 text-slate-400" />
                Contacts ({client.contacts.length})
              </h3>
              <div className="space-y-3">
                {client.contacts.map((contact) => (
                  <div key={contact.id} className="flex items-start gap-3 rounded-lg border border-slate-100 bg-slate-50 p-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-100 text-primary-600 text-xs font-medium shrink-0">
                      {(contact.firstName?.[0] || "").toUpperCase()}{(contact.lastName?.[0] || "").toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-slate-900 truncate">
                          {[contact.firstName, contact.lastName].filter(Boolean).join(" ") || "Sans nom"}
                        </p>
                        {contact.isBillingContact && (
                          <span className="inline-flex items-center rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                            Facturation
                          </span>
                        )}
                      </div>
                      {contact.jobTitle && (
                        <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                          <Briefcase className="h-3 w-3" />{contact.jobTitle}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                        {contact.email && (
                          <span className="text-xs text-slate-500 flex items-center gap-1">
                            <Mail className="h-3 w-3" /><span className="truncate">{contact.email}</span>
                          </span>
                        )}
                        {contact.phone && (
                          <span className="text-xs text-slate-500 flex items-center gap-1">
                            <Phone className="h-3 w-3" />{contact.phone}
                          </span>
                        )}
                        {contact.mobile && (
                          <span className="text-xs text-slate-500 flex items-center gap-1">
                            <Smartphone className="h-3 w-3" />{contact.mobile}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Cartes du tableau de bord */}
      {client.boardCards && client.boardCards.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-slate-900 flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-slate-400" />
              Cartes assignées ({client.boardCards.length})
            </h3>
            <Link href="/board" className="text-xs text-primary-600 hover:text-primary-700">
              Voir le tableau
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {client.boardCards.map((card) => {
              const isOverdue = card.dueDate && new Date(card.dueDate) < new Date();
              const priorityConfig: Record<number, { label: string; color: string }> = {
                1: { label: "Urgente", color: "bg-red-50 text-red-700 border-red-200" },
                2: { label: "Normale", color: "bg-orange-50 text-orange-700 border-orange-200" },
                3: { label: "Basse", color: "bg-slate-50 text-slate-600 border-slate-200" },
              };
              const p = priorityConfig[card.priority] || priorityConfig[3];
              const contactName = card.contact
                ? [card.contact.firstName, card.contact.lastName].filter(Boolean).join(" ")
                : null;
              return (
                <Link
                  key={card.id}
                  href={`/board?card=${card.id}`}
                  className="rounded-lg border border-slate-200 p-3 hover:bg-slate-50 hover:border-slate-300 transition-colors block"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: card.column.color }}
                    />
                    <span className="text-[10px] text-slate-400 truncate">{card.column.name}</span>
                    <span className={`ml-auto px-1.5 py-0.5 text-[10px] font-medium rounded border ${p.color}`}>
                      {p.label}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-slate-800 line-clamp-1 mb-1">{card.title}</p>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
                    {contactName && (
                      <span className="text-xs text-slate-500 flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {contactName}
                      </span>
                    )}
                    {card.dueDate && (
                      <span className={`text-xs flex items-center gap-1 ${isOverdue ? "text-red-500" : "text-slate-400"}`}>
                        <Calendar className="h-3 w-3" />
                        {new Date(card.dueDate).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}
                      </span>
                    )}
                    {card.tags.length > 0 && (
                      <div className="flex gap-1">
                        {card.tags.slice(0, 2).map((t) => (
                          <span
                            key={t.id}
                            className="px-1 py-0.5 text-[9px] rounded"
                            style={{ backgroundColor: t.tag.color + "20", color: t.tag.color }}
                          >
                            {t.tag.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Tableau principal des installations avec toutes les infos */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
          <h3 className="text-sm font-medium text-slate-900 shrink-0">Produits installés — Suivi des garanties</h3>
          <div className="relative max-w-xs w-full">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Rechercher un produit..."
              value={installSearch}
              onChange={(e) => setInstallSearch(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white py-1.5 pl-9 pr-4 text-sm text-slate-800 placeholder-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200">
                {([
                  { key: "product" as SortKey, label: "Produit" },
                  { key: "family" as SortKey, label: "Famille" },
                  { key: "supplier" as SortKey, label: "Fournisseur" },
                  { key: null, label: "Qté" },
                  { key: null, label: "Facture" },
                  { key: "startDate" as SortKey, label: "Début" },
                  { key: "durationMonths" as SortKey, label: "Durée" },
                  { key: "endDate" as SortKey, label: "Fin garantie" },
                  { key: null, label: "Compte à rebours" },
                  { key: "status" as SortKey, label: "Statut" },
                  { key: null, label: "Actions" },
                ] as { key: SortKey | null; label: string }[]).map((col) => (
                  <th
                    key={col.label}
                    className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-400 ${col.key ? "cursor-pointer select-none hover:text-slate-600" : ""}`}
                    onClick={() => col.key && toggleSort(col.key)}
                  >
                    <span className="inline-flex items-center gap-1">
                      {col.label}
                      {col.key && sortKey === col.key && (
                        <ArrowUpDown className="h-3 w-3 text-primary-500" />
                      )}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {sortedInstallations(client.installations.filter((inst) => {
                if (statusFilter === "en_parc") return inst.status === "EN_PARC" || inst.status === "EN_PARC_GARANTIE";
                if (statusFilter === "hors_parc") return inst.status === "HORS_PARC" || inst.status === "EN_PARC_HORS_GARANTIE";
                if (statusFilter === "renouvele") return inst.status === "RENOUVELE";
                return true;
              }).filter((inst) => {
                if (!installSearch) return true;
                const q = installSearch.toLowerCase();
                return inst.product.name.toLowerCase().includes(q) || (inst.product.code && inst.product.code.toLowerCase().includes(q)) || (inst.family && inst.family.toLowerCase().includes(q)) || (inst.supplier && inst.supplier.toLowerCase().includes(q));
              })).map((inst) => {
                const expired = isWarrantyExpired(inst.endDate);
                const isEnParc = inst.status === "EN_PARC" || inst.status === "EN_PARC_GARANTIE";
                return (
                <tr
                  key={inst.id}
                  className="hover:bg-slate-50 transition-colors"
                >
                  <td className="px-4 py-3 max-w-[350px]">
                    <Link href={`/installations/${inst.id}`} className="text-sm font-medium text-primary-600 hover:text-primary-700 block truncate" title={inst.product.name}>
                      {inst.product.name}
                    </Link>
                    {inst.product.code && <p className="text-[10px] text-slate-400 truncate">{inst.product.code}</p>}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600">{inst.family || "—"}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{inst.supplier || "—"}</td>
                  <td className="px-4 py-3 text-sm text-slate-600 text-center">{inst.quantity}</td>
                  <td className="px-4 py-3 text-sm text-slate-500">
                    {inst.invoice ? (
                      <Link href={`/invoices/${inst.invoice.id}`} className="text-primary-600 hover:text-primary-700">
                        {inst.invoice.invoiceNumber || formatDate(inst.invoice.invoiceDate)}
                      </Link>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">{formatDate(inst.startDate)}</td>
                  <td className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap font-medium">{inst.durationMonths} mois</td>
                  <td className={`px-4 py-3 text-sm whitespace-nowrap ${expired ? "text-red-600 font-medium" : "text-slate-600"}`}>{formatDate(inst.endDate)}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`text-xs font-bold ${inst.alwaysInFleet ? "text-amber-600" : expired ? "text-red-600" : getCountdownColor(inst.endDate)}`}>
                      {inst.alwaysInFleet ? "Toujours en parc" : inst.status === "RENOUVELE" ? "Renouvelé" : formatCountdown(inst.endDate)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center"><StatusBadge status={inst.status} endDate={inst.endDate} alwaysInFleet={inst.alwaysInFleet} /></td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button
                        onClick={(e) => { e.stopPropagation(); changeStatus(inst.id, isEnParc ? "HORS_PARC" : "EN_PARC"); }}
                        disabled={updatingStatus === inst.id}
                        title={isEnParc ? "Retirer du parc" : "Mettre en parc"}
                        className={`rounded p-1 transition-colors disabled:opacity-50 ${
                          isEnParc
                            ? "text-emerald-600 bg-emerald-50"
                            : "text-slate-400 hover:text-emerald-600 hover:bg-emerald-50"
                        }`}
                      >
                        <ShieldCheck className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleAlwaysInFleet(inst.id, inst.alwaysInFleet); }}
                        disabled={updatingStatus === inst.id}
                        title={inst.alwaysInFleet ? "Retirer toujours en parc" : "Toujours en parc"}
                        className={`rounded p-1 transition-colors disabled:opacity-50 ${
                          inst.alwaysInFleet
                            ? "text-amber-600 bg-amber-50"
                            : "text-slate-400 hover:text-amber-600 hover:bg-amber-50"
                        }`}
                      >
                        <ShieldAlert className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); changeStatus(inst.id, "RENOUVELE"); }}
                        disabled={updatingStatus === inst.id}
                        title="Renouvelé"
                        className={`rounded p-1 transition-colors disabled:opacity-50 ${
                          inst.status === "RENOUVELE"
                            ? "text-blue-600 bg-blue-50"
                            : "text-slate-400 hover:text-blue-600 hover:bg-blue-50"
                        }`}
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteInstallation(inst.id, inst.product.name); }}
                        title="Supprimer"
                        className="rounded p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
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
                  <td colSpan={11} className="px-4 py-8 text-center text-sm text-slate-400">Aucune installation</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {client.invoices.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200">
            <h3 className="text-sm font-medium text-slate-500">Historique des factures</h3>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-400">Numéro</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-400">Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-400">Montant</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {client.invoices.map((inv) => (
                <tr
                  key={inv.id}
                  className="hover:bg-slate-50 cursor-pointer transition-colors"
                  onClick={() => router.push(`/invoices/${inv.id}`)}
                >
                  <td className="px-4 py-3 text-sm text-slate-800">{inv.invoiceNumber || "—"}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{formatDate(inv.invoiceDate)}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{inv.totalAmount ? formatCurrency(inv.totalAmount) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Portail client */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <button
          onClick={() => { setPortalOpen(!portalOpen); if (!portalLoaded) loadPortal(); }}
          className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-slate-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary-50 p-2">
              <Globe className="h-4 w-4 text-primary-600" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-slate-900">Portail client</h3>
              <p className="text-xs text-slate-400">Gérer l&apos;accès et la personnalisation de l&apos;espace client</p>
            </div>
          </div>
          <span className="text-slate-400 text-xs">{portalOpen ? "▲" : "▼"}</span>
        </button>

        {portalOpen && portalSettings && (
          <div className="border-t border-slate-200 p-6 space-y-6">
            {/* Users section */}
            <div>
              <h4 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
                <UserPlus className="h-4 w-4" /> Comptes d&apos;accès
              </h4>

              {/* Existing users */}
              {portalUsers.length > 0 && (
                <div className="space-y-2 mb-4">
                  {portalUsers.map((u) => (
                    <div key={u.id}>
                      <div className="flex items-center justify-between rounded-lg border border-slate-100 p-3">
                        <div className="flex items-center gap-3">
                          <div className={`h-2 w-2 rounded-full ${u.active ? "bg-emerald-500" : "bg-slate-300"}`} />
                          <div>
                            <p className="text-sm font-medium text-slate-900">{u.name}</p>
                            <p className="text-xs text-slate-400">{u.email}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => generateInviteLink(u.id)}
                            disabled={inviteGenerating === u.id}
                            className="rounded-lg p-1.5 text-primary-500 hover:bg-primary-50 transition-colors"
                            title="Générer un lien d'invitation"
                          >
                            {inviteGenerating === u.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <LinkIcon className="h-4 w-4" />}
                          </button>
                          <button
                            onClick={() => togglePortalUser(u.id, !u.active)}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 transition-colors"
                            title={u.active ? "Désactiver" : "Activer"}
                          >
                            {u.active ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                          </button>
                          <button
                            onClick={() => deletePortalUser(u.id)}
                            className="rounded-lg p-1.5 text-red-400 hover:bg-red-50 transition-colors"
                            title="Supprimer"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                      {inviteLink && inviteLink.userId === u.id && (
                        <div className="mt-1 ml-5 space-y-1">
                          {inviteLink.emailSent && (
                            <p className="text-xs text-emerald-600 flex items-center gap-1">
                              <Check className="h-3 w-3" /> Email d&apos;invitation envoyé à {u.email}
                            </p>
                          )}
                          {inviteLink.emailSent === false && (
                            <p className="text-xs text-orange-600">
                              Email non envoyé (SMTP non configuré). Partagez le lien manuellement :
                            </p>
                          )}
                          <div className="flex items-center gap-2 rounded-lg border border-primary-100 bg-primary-50 p-2">
                            <input
                              type="text"
                              readOnly
                              value={inviteLink.url}
                              className="flex-1 bg-transparent text-xs font-mono text-primary-700 outline-none truncate"
                            />
                            <button
                              onClick={copyInviteLink}
                              className="rounded-md bg-primary-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-primary-700 transition-colors flex items-center gap-1 shrink-0"
                            >
                              {inviteCopied ? <><Check className="h-3 w-3" /> Copié</> : <><Copy className="h-3 w-3" /> Copier</>}
                            </button>
                            <button
                              onClick={() => setInviteLink(null)}
                              className="rounded-md p-1 text-primary-400 hover:bg-primary-100 transition-colors"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* New user form */}
              <div className="flex flex-wrap gap-2">
                <input
                  type="text"
                  placeholder="Nom"
                  value={newPortalUser.name}
                  onChange={(e) => setNewPortalUser({ ...newPortalUser, name: e.target.value })}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm flex-1 min-w-[120px] focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
                <input
                  type="email"
                  placeholder="Email"
                  value={newPortalUser.email}
                  onChange={(e) => setNewPortalUser({ ...newPortalUser, email: e.target.value })}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm flex-1 min-w-[160px] focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
                <button
                  onClick={createPortalUser}
                  disabled={portalUserCreating || !newPortalUser.name || !newPortalUser.email}
                  className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50 transition-colors flex items-center gap-1.5"
                >
                  {portalUserCreating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5" />}
                  Créer et inviter
                </button>
              </div>
              <p className="text-xs text-slate-400 mt-2">
                L&apos;utilisateur recevra un lien d&apos;invitation pour définir son mot de passe.
                {portalUsers.length > 0 && (
                  <> URL de connexion : <span className="font-mono text-slate-600">{typeof window !== "undefined" ? window.location.origin : ""}/portal/login</span></>
                )}
              </p>
            </div>

            {/* Settings section */}
            <div className="border-t border-slate-100 pt-6">
              <h4 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <Palette className="h-4 w-4" /> Personnalisation du portail
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Couleur principale</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={portalSettings.primaryColor}
                      onChange={(e) => setPortalSettings({ ...portalSettings, primaryColor: e.target.value })}
                      className="h-9 w-9 rounded border border-slate-200 cursor-pointer"
                    />
                    <input
                      type="text"
                      value={portalSettings.primaryColor}
                      onChange={(e) => setPortalSettings({ ...portalSettings, primaryColor: e.target.value })}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono w-28 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Logo en-tête (URL)</label>
                  <input
                    type="text"
                    placeholder="https://..."
                    value={portalSettings.headerLogo || ""}
                    onChange={(e) => setPortalSettings({ ...portalSettings, headerLogo: e.target.value || null })}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-500 mb-1">Titre d&apos;accueil</label>
                  <input
                    type="text"
                    placeholder="Bienvenue sur votre espace client"
                    value={portalSettings.welcomeTitle || ""}
                    onChange={(e) => setPortalSettings({ ...portalSettings, welcomeTitle: e.target.value || null })}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-500 mb-1">Sous-titre d&apos;accueil</label>
                  <input
                    type="text"
                    placeholder="Bienvenue sur votre espace de suivi..."
                    value={portalSettings.welcomeMessage || ""}
                    onChange={(e) => setPortalSettings({ ...portalSettings, welcomeMessage: e.target.value || null })}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-500 mb-1">Contenu d&apos;accueil</label>
                  <textarea
                    placeholder="Texte affiché sur la page d'accueil du portail..."
                    value={portalSettings.welcomeContent || ""}
                    onChange={(e) => setPortalSettings({ ...portalSettings, welcomeContent: e.target.value || null })}
                    rows={3}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 resize-y"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-500 mb-1">Texte de pied de page</label>
                  <input
                    type="text"
                    placeholder="© 2026 Votre entreprise"
                    value={portalSettings.footerText || ""}
                    onChange={(e) => setPortalSettings({ ...portalSettings, footerText: e.target.value || null })}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-500 mb-2">Sections de l&apos;accueil</label>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {([
                      ["showStats", "Statistiques"],
                      ["showExpiring", "Expirations proches"],
                    ] as const).map(([key, label]) => (
                      <button
                        key={key}
                        onClick={() => setPortalSettings({ ...portalSettings, [key]: !portalSettings[key] })}
                        className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                          portalSettings[key]
                            ? "border-primary-300 bg-primary-50 text-primary-700"
                            : "border-slate-200 text-slate-400"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-500 mb-2">Colonnes visibles</label>
                  <div className="flex flex-wrap gap-2">
                    {([
                      ["showFamily", "Famille"],
                      ["showSupplier", "Fournisseur"],
                      ["showDuration", "Durée"],
                      ["showQuantity", "Quantité"],
                      ["showComParc", "Com. Parc"],
                    ] as const).map(([key, label]) => (
                      <button
                        key={key}
                        onClick={() => setPortalSettings({ ...portalSettings, [key]: !portalSettings[key] })}
                        className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                          portalSettings[key]
                            ? "border-primary-300 bg-primary-50 text-primary-700"
                            : "border-slate-200 text-slate-400"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-500 mb-2">Options du tableau</label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setPortalSettings({ ...portalSettings, showHeaderRow: !portalSettings.showHeaderRow })}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                        portalSettings.showHeaderRow
                          ? "border-primary-300 bg-primary-50 text-primary-700"
                          : "border-slate-200 text-slate-400"
                      }`}
                    >
                      Ligne d&apos;en-têtes
                    </button>
                  </div>
                </div>
              </div>

              <button
                onClick={savePortalSettings}
                disabled={portalSaving}
                className="mt-4 flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50 transition-colors"
              >
                {portalSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                Enregistrer
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MiniDonut({ enParc, horsParc, renouvele }: { enParc: number; horsParc: number; renouvele: number }) {
  const total = enParc + horsParc + renouvele;
  if (total === 0) return null;
  const r = 12;
  const c = 2 * Math.PI * r;
  const slices = [
    { value: enParc, color: "#10b981" },
    { value: horsParc, color: "#ef4444" },
    { value: renouvele, color: "#3b82f6" },
  ].filter((s) => s.value > 0);

  let offset = 0;
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" className="shrink-0">
      <title>{`${enParc} en parc · ${horsParc} hors parc · ${renouvele} renouvelés`}</title>
      {slices.map((s, i) => {
        const len = (s.value / total) * c;
        const dashArray = `${len} ${c - len}`;
        const dashOffset = -offset;
        offset += len;
        return (
          <circle
            key={i}
            cx="16" cy="16" r={r}
            fill="none"
            stroke={s.color}
            strokeWidth="5"
            strokeDasharray={dashArray}
            strokeDashoffset={dashOffset}
            transform="rotate(-90 16 16)"
          />
        );
      })}
      <text x="16" y="16" textAnchor="middle" dominantBaseline="central" className="fill-slate-700" style={{ fontSize: "8px", fontWeight: 700 }}>{total}</text>
    </svg>
  );
}
