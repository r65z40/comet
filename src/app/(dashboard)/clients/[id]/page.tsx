"use client";

import { useEffect, useState, use, useRef } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Mail, Phone, MapPin, Shield, ShieldCheck, ShieldX, ShieldAlert, ShieldOff, RefreshCw, Upload, Printer, X, ImageIcon, Trash2, ArrowUpDown, Search, Download, Loader2, Check, Globe, Eye, EyeOff, Building2, Users, Briefcase, Smartphone, FileText, ChevronDown, Calendar, ClipboardList, BookOpen, HardDrive, Server, CheckCircle, AlertTriangle, XCircle, FolderOpen, Clock, Monitor, Bug } from "lucide-react";
import { cn } from "@/lib/utils";
import StatusBadge from "@/components/ui/StatusBadge";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { formatDate, formatCountdown, getCountdownColor, formatCurrency, getStatusLabel, isWarrantyExpired } from "@/lib/utils";
import Link from "next/link";
import ClientPortalSection from "./ClientPortalSection";
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
  oxiboxId: string | null;
  emsisoftId: string | null;
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
  const [hideRenewed, setHideRenewed] = useState(false);
  const [installSearch, setInstallSearch] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [kbArticles, setKbArticles] = useState<{ id: string; title: string; updatedAt: string; category: { name: string } | null }[]>([]);

  // Emsisoft state
  const [emsisoftData, setEmsisoftData] = useState<{
    linked: boolean;
    found?: boolean;
    workspace?: {
      name: string;
      deviceCount: number;
      findingsLastMonth: number;
      findingType: string | null;
      lastAlert: string | null;
      isExpired: boolean;
      isExpiresSoon: boolean;
      totalSeat: number;
      usedSeat: number;
      unusedSeat: number;
    };
  } | null>(null);
  const [emsisoftLoading, setEmsisoftLoading] = useState(false);

  // Editable integration IDs
  const [editingOxiboxId, setEditingOxiboxId] = useState(false);
  const [editingEmsisoftId, setEditingEmsisoftId] = useState(false);
  const [oxiboxIdDraft, setOxiboxIdDraft] = useState("");
  const [emsisoftIdDraft, setEmsisoftIdDraft] = useState("");
  const [savingIntegrationId, setSavingIntegrationId] = useState<string | null>(null);


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
    fetch(`/api/knowledge/by-client?clientId=${id}`)
      .then((r) => r.json())
      .then((data) => setKbArticles(data.articles || []))
      .catch(() => {});
  }, [id]);

  // Fetch Emsisoft data when client is loaded
  useEffect(() => {
    if (!client) return;
    setEmsisoftLoading(true);
    fetch(`/api/emsisoft/client?clientId=${client.id}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data) setEmsisoftData(data); })
      .catch(() => {})
      .finally(() => setEmsisoftLoading(false));
  }, [client?.id, client?.emsisoftId]);

  async function saveIntegrationId(field: "oxiboxId" | "emsisoftId", value: string) {
    setSavingIntegrationId(field);
    try {
      const res = await fetch(`/api/clients/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });
      if (res.ok) {
        setClient((prev) => prev ? { ...prev, [field]: value || null } : prev);
        if (field === "oxiboxId") setEditingOxiboxId(false);
        if (field === "emsisoftId") setEditingEmsisoftId(false);
      }
    } catch {
      alert("Erreur lors de la sauvegarde");
    }
    setSavingIntegrationId(null);
  }

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
    const res = await fetch(`/api/installations/${installId}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error || "Erreur lors de la suppression");
      return;
    }
    const clientRes = await fetch(`/api/clients/${id}`);
    const data = await clientRes.json();
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
    const showStatus = reportSettings.report_show_status !== "false";
    const includeRenewed = reportSettings.report_include_renewed === "true";
    const companyLogoPosition = reportSettings.report_company_logo_position || "top-center";
    const companyLogoSizePx = parseInt(reportSettings.report_company_logo_size || "180");
    const companyLogoTopPct = parseInt(reportSettings.report_company_logo_top || "5");
    const clientLogoPosition = reportSettings.report_client_logo_position || "center";
    const clientLogoSizePx = parseInt(reportSettings.report_client_logo_size || "150");
    const clientLogoTopPct = parseInt(reportSettings.report_client_logo_top || "70");
    const showDate = reportSettings.report_show_date !== "false";
    const coverTemplate = reportSettings.report_cover_template || "classic";
    const corporateTitle = esc(reportSettings.report_corporate_title || "Rapport client");
    const corporateTagline = esc(reportSettings.report_corporate_tagline || "");
    const corpLogoHeight = parseInt(reportSettings.report_corp_logo_height || "90");
    const corpLogoGap = parseInt(reportSettings.report_corp_logo_gap || "28");
    const corpDividerHeight = parseInt(reportSettings.report_corp_divider_height || "70");
    const corpDividerWidth = parseFloat(reportSettings.report_corp_divider_width || "1.5");
    const corpDividerColor = reportSettings.report_corp_divider_color || primaryColor;
    const corpTitleSize = parseInt(reportSettings.report_corp_title_size || "36");
    const corpTitleColor = reportSettings.report_corp_title_color || "#1e293b";
    const corpNameSize = parseInt(reportSettings.report_corp_name_size || "26");
    const corpHrWidth = parseInt(reportSettings.report_corp_hr_width || "200");
    const corpHrHeight = parseInt(reportSettings.report_corp_hr_height || "2");
    const corpTaglineSize = parseInt(reportSettings.report_corp_tagline_size || "15");
    const corpDateSize = parseInt(reportSettings.report_corp_date_size || "14");
    // Executive template
    const execBandAngle = parseInt(reportSettings.report_exec_band_angle || "12");
    const execBandWidth = parseInt(reportSettings.report_exec_band_width || "45");
    const execBandColor = reportSettings.report_exec_band_color || primaryColor;
    const execTitleSize = parseInt(reportSettings.report_exec_title_size || "44");
    const execSubtitleSize = parseInt(reportSettings.report_exec_subtitle_size || "18");
    const execTitle = esc(reportSettings.report_exec_title || "Rapport client");
    const execSubtitle = esc(reportSettings.report_exec_subtitle || "");
    const execAccentWidth = parseInt(reportSettings.report_exec_accent_width || "60");
    const execAccentHeight = parseInt(reportSettings.report_exec_accent_height || "4");
    const hasClientLogo = !!client.logoUrl;
    const today = new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
    const todayShort = new Date().toLocaleDateString("fr-FR");

    // Custom cover layout
    function buildCustomCover(): string {
      try {
        const raw = reportSettings.report_cover_layout;
        if (!raw) return "";
        const layout = JSON.parse(raw);
        if (!layout.elements) return "";

        function resolveVar(s: string): string {
          return s
            .replace(/\{\{client_name\}\}/g, esc(client!.name))
            .replace(/\{\{company_name\}\}/g, esc(companyName))
            .replace(/\{\{date\}\}/g, todayShort)
            .replace(/\{\{date_long\}\}/g, today)
            .replace(/\{\{nb_installations\}\}/g, String(reportInstallations.length))
            .replace(/\{\{nb_en_parc\}\}/g, String(reportInstallations.filter(i => i.status === "EN_PARC").length))
            .replace(/\{\{nb_hors_parc\}\}/g, String(reportInstallations.filter(i => i.status === "HORS_PARC").length))
            .replace(/\{\{company_logo\}\}/g, companyLogo);
        }

        const bg = layout.background || "#ffffff";
        let bgImgHtml = "";
        if (layout.backgroundImage) {
          bgImgHtml = `<div style="position:absolute;inset:0;background-image:url('${layout.backgroundImage}');background-size:cover;background-position:center;opacity:${layout.backgroundOpacity ?? 0.15};"></div>`;
        }

        const elHtml = (layout.elements as Array<Record<string, unknown>>).map((el: Record<string, unknown>) => {
          const style = `position:absolute;left:${el.x}%;top:${el.y}%;width:${el.width}%;height:${el.height}%;${el.rotation ? `transform:rotate(${el.rotation}deg);` : ""}`;

          if (el.type === "text") {
            const content = resolveVar(String(el.content || ""));
            return `<div style="${style}display:flex;align-items:center;justify-content:${el.textAlign === "left" ? "flex-start" : el.textAlign === "right" ? "flex-end" : "center"};font-size:${el.fontSize || 16}px;font-weight:${el.fontWeight || "400"};font-style:${el.fontStyle || "normal"};color:${el.color || "#000"};text-align:${el.textAlign || "center"};letter-spacing:${el.letterSpacing || 0}px;text-transform:${el.textTransform || "none"};line-height:${el.lineHeight || 1.3};opacity:${el.opacity ?? 1};overflow:hidden;">${content}</div>`;
          }
          if (el.type === "rect" || el.type === "line") {
            return `<div style="${style}background-color:${el.backgroundColor || primaryColor};border-radius:${el.borderRadius ?? 0}px;${el.borderWidth ? `border:${el.borderWidth}px solid ${el.borderColor || "#000"};` : ""}opacity:${el.opacity ?? 1};"></div>`;
          }
          if (el.type === "circle") {
            return `<div style="${style}background-color:${el.backgroundColor || primaryColor};border-radius:50%;${el.borderWidth ? `border:${el.borderWidth}px solid ${el.borderColor || "#000"};` : ""}opacity:${el.opacity ?? 1};"></div>`;
          }
          if (el.type === "image") {
            const src = resolveVar(String(el.src || ""));
            if (!src) return `<div style="${style}"></div>`;
            return `<div style="${style}display:flex;align-items:center;justify-content:center;overflow:hidden;"><img src="${src}" style="max-width:100%;max-height:100%;object-fit:${el.objectFit || "contain"};opacity:${el.opacity ?? 1};" /></div>`;
          }
          return "";
        }).join("\n    ");

        return `<div style="position:relative;width:100%;height:${orientation === "landscape" ? "210mm" : "297mm"};background:${bg};overflow:hidden;margin:0;">
    ${bgImgHtml}
    ${elHtml}
  </div>`;
      } catch {
        return "";
      }
    }

    function getReportStatusLabel(status: string, endDate: string, alwaysInFleet?: boolean): string {
      if (alwaysInFleet) return "Toujours en parc";
      if (status === "EN_PARC") {
        const days = Math.ceil((new Date(endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        if (days > 0 && days <= 90) return `En parc (${days}j)`;
        return "En parc";
      }
      if (status === "HORS_PARC") return "Hors parc";
      if (status === "RENOUVELE") return "Renouvelé";
      return status;
    }

    function getStatusStyle(status: string, endDate: string, alwaysInFleet?: boolean): string {
      if (alwaysInFleet) return "color: #6b7280; font-weight: 700;";
      const expired = new Date(endDate).getTime() < Date.now();
      if (status === "RENOUVELE") return "color: #2563eb; font-weight: 700;";
      if (status === "HORS_PARC") return "color: #dc2626; font-weight: 700;";
      if (expired) return "color: #dc2626; font-weight: 700;";
      const days = Math.ceil((new Date(endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      if (days <= 90) return "color: #ea580c; font-weight: 700;";
      return "color: #16a34a; font-weight: 700;";
    }

    function getEndDateBgStyle(status: string, endDate: string, alwaysInFleet?: boolean): string {
      if (alwaysInFleet) return "background-color: #e5e7eb;";
      const expired = new Date(endDate).getTime() < Date.now();
      if (status === "HORS_PARC" || expired) return "background-color: #fecaca;";
      const days = Math.ceil((new Date(endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      if (days <= 90) return "background-color: #fed7aa;";
      return "background-color: #bbf7d0;";
    }

    function buildInstRows(installations: Installation[]): string {
      return installations.map((inst) => {
        const name = inst.product.name.length > 50 ? inst.product.name.slice(0, 50) + "…" : inst.product.name;
        return `
        <tr>
          <td>${esc(name)}</td>
          ${showFamily ? `<td>${esc(inst.family || "—")}</td>` : ""}
          ${showSupplier ? `<td>${esc(inst.supplier || "—")}</td>` : ""}
          ${showComParc ? `<td style="white-space:normal;word-wrap:break-word;text-align:left;">${esc(inst.comParc || "—")}</td>` : ""}
          ${showQuantity ? `<td>${inst.quantity}</td>` : ""}
          <td>${formatDate(inst.startDate)}</td>
          <td style="${getEndDateBgStyle(inst.status, inst.endDate, inst.alwaysInFleet)}">${formatDate(inst.endDate)}</td>
          ${showDuration ? `<td>${inst.durationMonths} mois</td>` : ""}
          ${showStatus ? `<td style="${getStatusStyle(inst.status, inst.endDate, inst.alwaysInFleet)}">${getReportStatusLabel(inst.status, inst.endDate, inst.alwaysInFleet)}</td>` : ""}
        </tr>
      `;}).join("");
    }

    // Exclude renewed installations from report, and optionally hors parc
    const reportInstallations = client.installations.filter(i => {
      if (i.status === "RENOUVELE" && !includeRenewed) return false;
      if (!includeHorsParc && (i.status === "HORS_PARC")) return false;
      return true;
    });

    function buildColgroup(includeFamily: boolean): string {
      const colW = 80;
      const narrow = 45;
      const comParcW = 140;
      let fixedCols = 2; // Début, Fin
      if (includeFamily) fixedCols++;
      if (showSupplier) fixedCols++;
      if (showQuantity) fixedCols++;
      if (showDuration) fixedCols++;
      if (showStatus) fixedCols++;
      let fixedWidth = fixedCols * colW + (showQuantity ? narrow - colW : 0);
      if (showComParc) fixedWidth += comParcW;
      return `<colgroup><col style="width: calc(100% - ${fixedWidth}px);" />${includeFamily ? `<col style="width: ${colW}px;" />` : ""}${showSupplier ? `<col style="width: ${colW}px;" />` : ""}${showComParc ? `<col style="width: ${comParcW}px;" />` : ""}${showQuantity ? `<col style="width: ${narrow}px;" />` : ""}<col style="width: ${colW}px;" /><col style="width: ${colW}px;" />${showDuration ? `<col style="width: ${colW}px;" />` : ""}${showStatus ? `<col style="width: ${colW}px;" />` : ""}</colgroup>`;
    }

    function buildTableHead(includeFamily: boolean): string {
      if (!showHeaderRow) return "";
      return `<thead><tr>
        <th>Produit</th>
        ${includeFamily ? `<th>Famille</th>` : ""}
        ${showSupplier ? `<th>Fournisseur</th>` : ""}
        ${showComParc ? `<th>Com. Parc</th>` : ""}
        ${showQuantity ? `<th>Qté</th>` : ""}
        <th>Début</th>
        <th>Fin</th>
        ${showDuration ? `<th>Durée</th>` : ""}
        ${showStatus ? `<th>Statut</th>` : ""}
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
      tableContent = sortedFamilies.map(([family, installs], idx) => `
        <div style="margin-top: ${idx === 0 ? 6 : 8}px;">
          <h3 style="font-size: 12px; font-weight: 700; color: ${primaryColor}; margin-bottom: 2px; padding: 3px 8px; background: ${primaryColor}11; border-radius: 3px;">${esc(family)} (${installs.length})</h3>
          <table>
            ${buildColgroup(false)}
            ${buildTableHead(false)}
            <tbody>
              ${installs.map((inst) => { const name = inst.product.name.length > 50 ? inst.product.name.slice(0, 50) + "…" : inst.product.name; return `
                <tr>
                  <td>${esc(name)}</td>
                  ${showSupplier ? `<td>${esc(inst.supplier || "—")}</td>` : ""}
                  ${showComParc ? `<td style="white-space:normal;word-wrap:break-word;text-align:left;">${esc(inst.comParc || "—")}</td>` : ""}
                  ${showQuantity ? `<td>${inst.quantity}</td>` : ""}
                  <td>${formatDate(inst.startDate)}</td>
                  <td style="${getEndDateBgStyle(inst.status, inst.endDate, inst.alwaysInFleet)}">${formatDate(inst.endDate)}</td>
                  ${showDuration ? `<td>${inst.durationMonths} mois</td>` : ""}
                  ${showStatus ? `<td style="${getStatusStyle(inst.status, inst.endDate, inst.alwaysInFleet)}">${getReportStatusLabel(inst.status, inst.endDate, inst.alwaysInFleet)}</td>` : ""}
                </tr>
              `;}).join("")}
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

    const enParc = reportInstallations.filter(i => i.status === "EN_PARC");
    const horsParc = reportInstallations.filter(i => i.status === "HORS_PARC");
    const renewedCount = client.installations.filter(i => i.status === "RENOUVELE").length;

    const clientLogoHtml = client.logoUrl
      ? `<img src="${client.logoUrl}" alt="Logo client" style="max-width: ${clientLogoSizePx}px; max-height: ${Math.round(clientLogoSizePx * 0.67)}px; object-fit: contain;" />`
      : "";
    const companyLogoHtml = companyLogo
      ? `<img src="${companyLogo}" alt="Logo société" style="max-width: ${companyLogoSizePx}px; max-height: ${Math.round(companyLogoSizePx * 0.67)}px; object-fit: contain;" />`
      : "";

    const html = `<!DOCTYPE html>
<html lang="fr" style="background:#ffffff;">
<head>
  <meta charset="UTF-8" />
  <title>Rapport de suivi des garanties informatique - ${esc(client.name)}</title>
  <style>
    @media print {
      @page { margin: 5mm; size: ${orientation === "landscape" ? "landscape" : "portrait"}; }
      @page:first { margin: 0; }
      * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }
      html, body { background: #ffffff !important; }
      .cover-bg img { filter: brightness(1.03) saturate(1.02); }
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html { background: #ffffff; }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #1a1a2e; background: #ffffff; }

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
      z-index: 0;
      overflow: hidden;
    }
    .cover-bg img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      object-position: center;
      opacity: ${coverBgOpacity};
    }
    .cover-page > *:not(.cover-bg):not(.cover-logo-abs):not(.vertical-text) { position: relative; z-index: 1; }
    .cover-logo-abs { position: absolute; z-index: 1; }
    .cover-logo-abs img { object-fit: contain; }
    .cover-page h1 { font-size: 32px; font-weight: 700; margin-bottom: 12px; color: #1e293b; }
    .cover-page .client-name { font-size: 42px; font-weight: 800; color: ${primaryColor}; margin-bottom: 30px; }
    .cover-page .subtitle { font-size: 18px; color: #64748b; margin-bottom: 8px; }
    .cover-page .date { font-size: 16px; color: #94a3b8; margin-top: 40px; }
    .cover-page .message { font-size: 14px; color: #64748b; margin-top: 20px; max-width: 500px; line-height: 1.6; }
    .cover-page .vertical-text { position: absolute; right: 15px; top: 50%; transform: translateY(-50%); writing-mode: vertical-rl; text-orientation: mixed; font-size: 17px; font-weight: 800; color: ${primaryColor}90; letter-spacing: 5px; text-transform: uppercase; white-space: nowrap; }

    /* Corporate template */
    .corporate-inner { position: relative; z-index: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; flex: 1; gap: 0; }
    .corporate-logos { display: flex; align-items: center; justify-content: center; gap: ${corpLogoGap}px; margin-bottom: 40px; }
    .corporate-logos img { max-height: ${corpLogoHeight}px; max-width: ${Math.round(corpLogoHeight * 2)}px; object-fit: contain; }
    .corporate-logos .logo-divider { width: ${corpDividerWidth}px; height: ${corpDividerHeight}px; background: ${corpDividerColor}; flex-shrink: 0; }
    .corporate-title { font-size: ${corpTitleSize}px; font-weight: 300; color: ${corpTitleColor}; letter-spacing: 1px; margin-bottom: 20px; line-height: 1.2; }
    .corporate-client-name { font-size: ${corpNameSize}px; font-weight: 700; color: ${primaryColor}; margin-bottom: 24px; letter-spacing: 0.5px; }
    .corporate-hr { width: ${corpHrWidth}px; height: ${corpHrHeight}px; background: ${primaryColor}; border: none; margin: 0 auto 24px; }
    .corporate-tagline { font-size: ${corpTaglineSize}px; color: #64748b; font-style: italic; margin-bottom: 20px; letter-spacing: 0.5px; }
    .corporate-date { font-size: ${corpDateSize}px; color: #64748b; font-weight: 500; letter-spacing: 2px; text-transform: uppercase; margin-top: 8px; }

    /* Executive template */
    .exec-cover { position: relative; width: 100%; height: ${orientation === "landscape" ? "210mm" : "297mm"}; background: #ffffff; overflow: hidden; margin: 0; display: flex; }
    .exec-band { position: absolute; top: 0; left: 0; width: ${execBandWidth}%; height: 100%; background: ${execBandColor}; transform-origin: top left; transform: skewX(-${execBandAngle}deg); z-index: 1; }
    .exec-band::after { content: ''; position: absolute; top: 0; right: -30px; width: 30px; height: 100%; background: ${execBandColor}30; }
    .exec-left { position: relative; z-index: 2; width: ${execBandWidth}%; display: flex; flex-direction: column; justify-content: flex-end; padding: 60px 50px; color: #ffffff; }
    .exec-left .exec-company-logo { position: absolute; top: 50px; left: 50px; }
    .exec-left .exec-company-logo img { max-height: 50px; max-width: 160px; object-fit: contain; filter: brightness(0) invert(1); }
    .exec-title { font-size: ${execTitleSize}px; font-weight: 800; line-height: 1.1; letter-spacing: -0.5px; margin-bottom: 16px; color: #ffffff; }
    .exec-accent { width: ${execAccentWidth}px; height: ${execAccentHeight}px; background: #ffffff; border-radius: 2px; margin-bottom: 20px; opacity: 0.8; }
    .exec-subtitle { font-size: ${execSubtitleSize}px; font-weight: 300; color: rgba(255,255,255,0.85); letter-spacing: 0.5px; line-height: 1.4; }
    .exec-right { position: relative; z-index: 2; flex: 1; display: flex; flex-direction: column; justify-content: center; align-items: flex-start; padding: 60px 50px; }
    .exec-client-logo { margin-bottom: 30px; }
    .exec-client-logo img { max-height: 80px; max-width: 200px; object-fit: contain; }
    .exec-client-name { font-size: 28px; font-weight: 700; color: #1e293b; letter-spacing: -0.3px; margin-bottom: 10px; }
    .exec-meta { display: flex; flex-direction: column; gap: 8px; margin-top: auto; padding-top: 40px; }
    .exec-meta-item { font-size: 12px; color: #94a3b8; letter-spacing: 1px; text-transform: uppercase; }
    .exec-meta-value { font-size: 14px; color: #475569; font-weight: 600; letter-spacing: 0.3px; }
    .exec-dots { position: absolute; bottom: 40px; right: 40px; display: grid; grid-template-columns: repeat(5, 6px); gap: 6px; opacity: 0.15; z-index: 2; }
    .exec-dots span { width: 6px; height: 6px; border-radius: 50%; background: ${execBandColor}; }

    @media print { .cover-page, .exec-cover { page-break-after: always; } .report-content { background: #ffffff !important; } }

    .report-content { padding: 5mm; background: #ffffff; }
    .section-title { font-size: 18px; font-weight: 700; margin-bottom: 16px; color: #0f172a; border-bottom: 2px solid ${primaryColor}; padding-bottom: 8px; }

    .stats { display: flex; gap: 16px; margin-bottom: 30px; flex-wrap: wrap; }
    .stat-card { flex: 1; min-width: 120px; padding: 16px; border-radius: 8px; text-align: center; border: 1px solid #e2e8f0; }
    .stat-card .value { font-size: 28px; font-weight: 800; }
    .stat-card .label { font-size: 11px; color: #64748b; margin-top: 4px; }
    .stat-green { border-color: #10b981; } .stat-green .value { color: #10b981; }
    .stat-red { border-color: #ef4444; } .stat-red .value { color: #ef4444; }
    .stat-blue { border-color: ${primaryColor}; } .stat-blue .value { color: ${primaryColor}; }
    .footer { text-align: center; font-size: 11px; color: #94a3b8; padding-top: 20px; margin-top: 40px; border-top: 1px solid #e2e8f0; }

    table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 2px; table-layout: fixed; }
    th { background: #f1f5f9; padding: 2px 4px; text-align: left; font-weight: 600; font-size: 10px; text-transform: uppercase; color: #475569; white-space: nowrap; border-bottom: 2px solid #e2e8f0; }
    td { padding: 1px 4px; border-bottom: 1px solid #f1f5f9; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.2; }
    th:first-child, td:first-child { white-space: normal; word-wrap: break-word; }
    th:not(:first-child), td:not(:first-child) { text-align: center; padding: 1px 3px; }
    tr:nth-child(even) { background: #fafafa; }

    .header-bar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; padding-bottom: 16px; border-bottom: 1px solid #e2e8f0; }
    .header-bar .client-info h2 { font-size: 22px; font-weight: 700; }
    .header-bar .client-info p { font-size: 12px; color: #64748b; }
    .header-bar .report-date { font-size: 12px; color: #64748b; text-align: right; }
  </style>
</head>
<body>
  ${coverTemplate === "custom" ? buildCustomCover() : coverTemplate === "executive" ? `<div class="exec-cover">
    ${coverBg ? `<div class="cover-bg"><img src="${coverBg}" alt="" /></div>` : ""}
    <div class="exec-band"></div>
    <div class="exec-left">
      ${companyLogo ? `<div class="exec-company-logo"><img src="${companyLogo}" alt="Logo société" /></div>` : ""}
      <div class="exec-title">${execTitle}</div>
      <div class="exec-accent"></div>
      ${execSubtitle ? `<div class="exec-subtitle">${execSubtitle}</div>` : ""}
    </div>
    <div class="exec-right">
      ${client.logoUrl ? `<div class="exec-client-logo"><img src="${client.logoUrl}" alt="Logo client" /></div>` : ""}
      <div class="exec-client-name">${esc(client.name)}</div>
      ${showDate ? `<div class="exec-meta">
        <div><span class="exec-meta-item">Date</span></div>
        <div><span class="exec-meta-value">${today}</span></div>
      </div>` : ""}
    </div>
    <div class="exec-dots">${Array(15).fill('<span></span>').join('')}</div>
  </div>` : coverTemplate === "corporate" ? `<div class="cover-page">
    ${coverBg ? `<div class="cover-bg"><img src="${coverBg}" alt="" /></div>` : ""}
    ${showVerticalName ? `<div class="vertical-text">${esc(client.name)}</div>` : ""}
    <div class="corporate-inner">
      ${(companyLogo || client.logoUrl) ? `<div class="corporate-logos">
        ${companyLogo ? `<img src="${companyLogo}" alt="Logo société" />` : ""}
        ${companyLogo && client.logoUrl ? `<div class="logo-divider"></div>` : ""}
        ${client.logoUrl ? `<img src="${client.logoUrl}" alt="Logo client" />` : ""}
      </div>` : ""}
      <div class="corporate-title">${corporateTitle}</div>
      <div class="corporate-client-name">${esc(client.name)}</div>
      <hr class="corporate-hr" />
      ${corporateTagline ? `<div class="corporate-tagline">${corporateTagline}</div>` : ""}
      ${showDate ? `<div class="corporate-date">${today}</div>` : ""}
    </div>
  </div>` : `<div class="cover-page">
    ${coverBg ? `<div class="cover-bg"><img src="${coverBg}" alt="" /></div>` : ""}
    ${showVerticalName ? `<div class="vertical-text">${esc(client.name)}</div>` : ""}
    ${companyLogoHtml ? (() => {
      const hAlign = companyLogoPosition === "top-left" ? "left: 30px;" : companyLogoPosition === "top-right" ? "right: 30px;" : "left: 50%; transform: translateX(-50%);";
      return `<div class="cover-logo-abs" style="top: ${companyLogoTopPct}%; ${hAlign}">${companyLogoHtml}</div>`;
    })() : ""}
    ${clientLogoHtml ? (() => {
      const hAlign = clientLogoPosition === "top-left" ? "left: 30px;" : clientLogoPosition === "top-right" ? "right: 30px;" : "left: 50%; transform: translateX(-50%);";
      return `<div class="cover-logo-abs" style="top: ${clientLogoTopPct}%; ${hAlign}">${clientLogoHtml}</div>`;
    })() : ""}
    <h1>${title}</h1>
    ${!hasClientLogo ? `<div class="client-name">${esc(client.name)}</div>` : ""}
    ${subtitle ? `<div class="subtitle">${subtitle}</div>` : ""}
    ${showDate ? `<div class="date">${today}</div>` : ""}
    ${message ? `<div class="message">${message}</div>` : ""}
  </div>`}

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

  const enParc = client.installations.filter((i) => i.status === "EN_PARC");
  const horsParc = client.installations.filter((i) => i.status === "HORS_PARC");
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

      {/* Backup error alert */}
      {client.oxiboxId && <BackupAlertBanner oxiboxId={client.oxiboxId} />}

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
          className={`rounded-xl border p-4 text-center transition-all cursor-pointer relative ${statusFilter === "renouvele" ? "border-blue-400 ring-2 ring-blue-300 bg-blue-50" : "border-blue-200 bg-blue-50 hover:border-blue-300"}`}
        >
          <p className="text-2xl font-bold text-blue-600">{renouvele.length}</p>
          <p className="text-xs text-slate-500 mt-1">Renouvelés</p>
          <span
            onClick={(e) => { e.stopPropagation(); setHideRenewed(!hideRenewed); }}
            className={`absolute top-2 right-2 p-1 rounded-full transition-colors ${hideRenewed ? "bg-blue-200 text-blue-700" : "hover:bg-blue-100 text-blue-400 hover:text-blue-600"}`}
            title={hideRenewed ? "Afficher les renouvelés" : "Masquer les renouvelés"}
          >
            {hideRenewed ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
          </span>
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
              {/* Oxibox ID */}
              <div>
                <p className="text-xs text-slate-400 mb-0.5">Oxibox ID</p>
                {editingOxiboxId ? (
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      value={oxiboxIdDraft}
                      onChange={(e) => setOxiboxIdDraft(e.target.value)}
                      className="flex-1 rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-primary-500"
                      placeholder="ID workspace Oxibox"
                    />
                    <button
                      onClick={() => saveIntegrationId("oxiboxId", oxiboxIdDraft)}
                      disabled={savingIntegrationId === "oxiboxId"}
                      className="rounded bg-primary-600 px-2 py-1 text-xs text-white hover:bg-primary-700 disabled:opacity-50"
                    >
                      {savingIntegrationId === "oxiboxId" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                    </button>
                    <button
                      onClick={() => { setEditingOxiboxId(false); setOxiboxIdDraft(client.oxiboxId || ""); }}
                      className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-500 hover:bg-slate-50"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <p className="text-slate-700 flex items-center gap-1">
                    <HardDrive className="h-3 w-3 text-slate-400" />
                    <span className="font-mono text-xs">{client.oxiboxId || "—"}</span>
                    <button
                      onClick={() => { setOxiboxIdDraft(client.oxiboxId || ""); setEditingOxiboxId(true); }}
                      className="ml-1 text-slate-400 hover:text-primary-600"
                    >
                      <FileText className="h-3 w-3" />
                    </button>
                  </p>
                )}
              </div>
              {/* Emsisoft ID */}
              <div>
                <p className="text-xs text-slate-400 mb-0.5">Emsisoft ID</p>
                {editingEmsisoftId ? (
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      value={emsisoftIdDraft}
                      onChange={(e) => setEmsisoftIdDraft(e.target.value)}
                      className="flex-1 rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-primary-500"
                      placeholder="ID workspace Emsisoft"
                    />
                    <button
                      onClick={() => saveIntegrationId("emsisoftId", emsisoftIdDraft)}
                      disabled={savingIntegrationId === "emsisoftId"}
                      className="rounded bg-primary-600 px-2 py-1 text-xs text-white hover:bg-primary-700 disabled:opacity-50"
                    >
                      {savingIntegrationId === "emsisoftId" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                    </button>
                    <button
                      onClick={() => { setEditingEmsisoftId(false); setEmsisoftIdDraft(client.emsisoftId || ""); }}
                      className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-500 hover:bg-slate-50"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <p className="text-slate-700 flex items-center gap-1">
                    <Shield className="h-3 w-3 text-slate-400" />
                    <span className="font-mono text-xs">{client.emsisoftId || "—"}</span>
                    <button
                      onClick={() => { setEmsisoftIdDraft(client.emsisoftId || ""); setEditingEmsisoftId(true); }}
                      className="ml-1 text-slate-400 hover:text-primary-600"
                    >
                      <FileText className="h-3 w-3" />
                    </button>
                  </p>
                )}
              </div>
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

      {/* Sauvegardes Oxibox */}
      {client.oxiboxId && <OxiboxBackupSection oxiboxId={client.oxiboxId} />}

      {/* Sécurité Emsisoft — compact summary, only when linked */}
      {client.emsisoftId && (
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-slate-900 flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-purple-500" />
            Sécurité Emsisoft
          </h3>
          <Link href="/antivirus" className="text-[11px] text-purple-600 hover:text-purple-800 font-medium">
            Voir détails →
          </Link>
        </div>
        {emsisoftLoading ? (
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            Chargement...
          </div>
        ) : !emsisoftData?.linked || !emsisoftData?.found || !emsisoftData?.workspace ? (
          <p className="text-xs text-slate-400">Workspace introuvable ou Emsisoft non configuré</p>
        ) : (() => {
          const ws = emsisoftData.workspace;
          return (
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <Monitor className="h-3.5 w-3.5 text-emerald-500" />
                <span className="text-sm font-semibold text-slate-900">{ws.deviceCount}</span>
                <span className="text-xs text-slate-400">appareil{ws.deviceCount > 1 ? "s" : ""}</span>
              </div>
              <div className="h-4 w-px bg-slate-200" />
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">Sièges</span>
                <span className="text-sm font-semibold text-slate-700">{ws.usedSeat}/{ws.totalSeat}</span>
              </div>
              <div className="h-4 w-px bg-slate-200" />
              <div className="flex items-center gap-2">
                <Bug className="h-3.5 w-3.5 text-amber-500" />
                <span className={cn("text-sm font-semibold", ws.findingsLastMonth > 0 ? "text-amber-600" : "text-slate-400")}>{ws.findingsLastMonth}</span>
                <span className="text-xs text-slate-400">détection{ws.findingsLastMonth > 1 ? "s" : ""}/mois</span>
              </div>
              <div className="h-4 w-px bg-slate-200" />
              {ws.isExpired ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-700">
                  <ShieldX className="h-3 w-3" /> Licence expirée
                </span>
              ) : ws.isExpiresSoon ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                  <ShieldAlert className="h-3 w-3" /> Expire bientôt
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                  <ShieldCheck className="h-3 w-3" /> Actif
                </span>
              )}
            </div>
          );
        })()}
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

      {/* Articles de la base de connaissances */}
      {kbArticles.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-slate-900 flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-slate-400" />
              Articles assignés ({kbArticles.length})
            </h3>
            <Link href="/knowledge" className="text-xs text-primary-600 hover:text-primary-700">
              Voir la base de connaissances
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {kbArticles.map((art) => (
              <Link
                key={art.id}
                href={`/knowledge/${art.id}`}
                className="rounded-lg border border-slate-200 p-3 hover:bg-slate-50 hover:border-slate-300 transition-colors block"
              >
                <p className="text-sm font-medium text-slate-800 line-clamp-1 mb-1">{art.title}</p>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  {art.category && <span>{art.category.name}</span>}
                  <span>{new Date(art.updatedAt).toLocaleDateString("fr-FR")}</span>
                </div>
              </Link>
            ))}
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
                  { key: null, label: "Com. Parc" },
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
                if (hideRenewed && inst.status === "RENOUVELE") return false;
                if (statusFilter === "en_parc") return inst.status === "EN_PARC";
                if (statusFilter === "hors_parc") return inst.status === "HORS_PARC";
                if (statusFilter === "renouvele") return inst.status === "RENOUVELE";
                return true;
              }).filter((inst) => {
                if (!installSearch) return true;
                const q = installSearch.toLowerCase();
                return inst.product.name.toLowerCase().includes(q) || (inst.product.code && inst.product.code.toLowerCase().includes(q)) || (inst.family && inst.family.toLowerCase().includes(q)) || (inst.supplier && inst.supplier.toLowerCase().includes(q));
              })).map((inst) => {
                const expired = isWarrantyExpired(inst.endDate);
                const isEnParc = inst.status === "EN_PARC";
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
                  <td className="px-4 py-3 text-sm text-slate-600">{inst.comParc || "—"}</td>
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

      <ClientPortalSection clientId={id} />
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

function OxiboxBackupSection({ oxiboxId }: { oxiboxId: string }) {
  const [data, setData] = useState<{ status: string; ongoingBackup: boolean; machines: { id: string; status: string; ongoingBackup: boolean; jobs?: { path: string; status: string; ongoingBackup: boolean; lastRelevantBackupLog?: { success: boolean; startedAt: string; endedAt: string; totalBytesProcessed: number } }[] }[] } | null>(null);
  const [usage, setUsage] = useState<{ allocatedQuota: number; currentUsage: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch(`/api/oxibox/status?orgId=${encodeURIComponent(oxiboxId)}&include=jobs`).then((r) => r.ok ? r.json() : Promise.reject()),
      fetch(`/api/oxibox/usage?orgId=${encodeURIComponent(oxiboxId)}`).then((r) => r.ok ? r.json() : null),
    ])
      .then(([statusData, usageData]) => { setData(statusData); setUsage(usageData); })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [oxiboxId]);

  if (loading) return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center gap-2 text-sm text-slate-400">
        <Loader2 className="h-4 w-4 animate-spin" />
        Chargement des sauvegardes...
      </div>
    </div>
  );

  if (error || !data) return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center gap-2 text-sm text-slate-400">
        <HardDrive className="h-4 w-4" />
        Impossible de charger les sauvegardes
      </div>
    </div>
  );

  const statusCfg: Record<string, { icon: typeof CheckCircle; color: string; bg: string; label: string; dot: string }> = {
    OK: { icon: CheckCircle, color: "text-emerald-600", bg: "bg-emerald-50", label: "OK", dot: "bg-emerald-500" },
    ALERT: { icon: AlertTriangle, color: "text-amber-600", bg: "bg-amber-50", label: "Alerte", dot: "bg-amber-500" },
    ERROR: { icon: XCircle, color: "text-red-600", bg: "bg-red-50", label: "Erreur", dot: "bg-red-500" },
  };

  const cfg = statusCfg[data.status] || statusCfg.OK;
  const StatusIcon = cfg.icon;
  const usagePercent = usage ? Math.round((usage.currentUsage / usage.allocatedQuota) * 100) : null;

  function fmtBytes(bytes: number): string {
    if (bytes === 0) return "0 o";
    const units = ["o", "Ko", "Mo", "Go", "To"];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(i > 1 ? 1 : 0)} ${units[i]}`;
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 p-4 hover:bg-slate-50/50 transition-colors text-left"
      >
        <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${cfg.bg} shrink-0`}>
          <HardDrive className={`h-4 w-4 ${cfg.color}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-900">Sauvegardes Oxibox</span>
            <span className={`flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${cfg.bg} ${cfg.color}`}>
              <StatusIcon className="h-3 w-3" />
              {cfg.label}
            </span>
            {data.ongoingBackup && (
              <span className="flex items-center gap-1 text-[10px] text-purple-500">
                <RefreshCw className="h-3 w-3 animate-spin" />
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-[11px] text-slate-400">{data.machines.length} machine{data.machines.length > 1 ? "s" : ""}</span>
            {usage && (
              <div className="flex items-center gap-2 flex-1">
                <div className="flex-1 max-w-[140px] h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${usagePercent! > 90 ? "bg-red-500" : usagePercent! > 70 ? "bg-amber-500" : "bg-emerald-500"}`}
                    style={{ width: `${Math.min(100, usagePercent!)}%` }}
                  />
                </div>
                <span className="text-[10px] text-slate-400">{fmtBytes(usage.currentUsage)} / {fmtBytes(usage.allocatedQuota)} ({usagePercent}%)</span>
              </div>
            )}
          </div>
        </div>
        <ChevronDown className={`h-4 w-4 text-slate-400 shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`} />
      </button>

      {expanded && (
        <div className="border-t border-slate-100 px-4 pb-4 pt-3">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] text-slate-400 font-mono">{oxiboxId}</span>
            <Link href="/backups" className="text-[10px] text-primary-600 hover:underline">Voir toutes les sauvegardes</Link>
          </div>
          {data.machines.length === 0 ? (
            <p className="text-xs text-slate-400">Aucune machine configurée</p>
          ) : (
            <div className="space-y-2">
              {data.machines.map((m) => {
                const mCfg = statusCfg[m.status] || statusCfg.OK;
                const MIcon = mCfg.icon;
                return (
                  <div key={m.id} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                    <div className="flex items-center gap-2 mb-1.5">
                      <Server className="h-3.5 w-3.5 text-slate-400" />
                      <span className="text-xs font-medium text-slate-700 flex-1 truncate">{m.id}</span>
                      {m.ongoingBackup && <RefreshCw className="h-3 w-3 text-purple-500 animate-spin" />}
                      <span className={`flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${mCfg.bg} ${mCfg.color}`}>
                        <MIcon className="h-3 w-3" />
                        {mCfg.label}
                      </span>
                    </div>
                    {m.jobs && m.jobs.length > 0 && (
                      <div className="space-y-1 mt-2">
                        {m.jobs.map((j, i) => {
                          const jCfg = statusCfg[j.status] || statusCfg.OK;
                          const log = j.lastRelevantBackupLog;
                          return (
                            <div key={i} className="flex items-center gap-2 text-[11px] bg-white rounded px-2 py-1.5 border border-slate-100">
                              <FolderOpen className="h-3 w-3 text-slate-300 shrink-0" />
                              <span className="font-mono text-slate-500 truncate flex-1">{j.path}</span>
                              {log && (
                                <span className="text-slate-400 flex items-center gap-1 shrink-0">
                                  <Clock className="h-3 w-3" />
                                  {new Date(log.endedAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}
                                </span>
                              )}
                              <span className={`text-[10px] font-medium ${jCfg.color}`}>{jCfg.label}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function BackupAlertBanner({ oxiboxId }: { oxiboxId: string }) {
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/oxibox/status?orgId=${encodeURIComponent(oxiboxId)}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data?.status) setStatus(data.status); })
      .catch(() => {});
  }, [oxiboxId]);

  if (status !== "ERROR") return null;

  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-red-200 bg-red-50 animate-pulse">
      <XCircle className="h-5 w-5 text-red-500 shrink-0" />
      <div>
        <p className="text-sm font-medium text-red-800">Alerte Sauvegarde</p>
        <p className="text-xs text-red-600">Une ou plusieurs sauvegardes Oxibox de ce client sont en erreur</p>
      </div>
      <Link href="/backups" className="ml-auto text-xs text-red-700 hover:text-red-900 font-medium shrink-0">
        Voir les sauvegardes →
      </Link>
    </div>
  );
}
