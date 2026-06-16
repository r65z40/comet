"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { Save, Loader2, Key, Globe, Users, Plus, Pencil, Trash2, X, Check, Eye, EyeOff, Mail, Bell, Send, Plug, FileText, Upload, ImageIcon, Palette, CalendarClock, AlertTriangle, Merge, Search, Megaphone, Bold, Italic, Underline, List, ListOrdered, Link, Type, Heading1, Heading2, AlignLeft, AlignCenter, AlignRight, Strikethrough, ChevronDown, HardDrive, Settings2, Shield, Music, LogIn, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
}

export default function SettingsPage() {
  const [userRole, setUserRole] = useState<string>("");
  const isAdmin = userRole === "ADMIN";
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [newApiKey, setNewApiKey] = useState("");
  const [apiUrl, setApiUrl] = useState("");

  // SMTP settings
  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState("587");
  const [smtpSecure, setSmtpSecure] = useState(false);
  const [smtpUser, setSmtpUser] = useState("");
  const [smtpPass, setSmtpPass] = useState("");
  const [smtpFrom, setSmtpFrom] = useState("");
  const [notifEmails, setNotifEmails] = useState("");
  const [notifDelay, setNotifDelay] = useState("30");
  const [savingSmtp, setSavingSmtp] = useState(false);
  const [savedSmtp, setSavedSmtp] = useState(false);
  const [testingSmtp, setTestingSmtp] = useState(false);
  const [smtpTestResult, setSmtpTestResult] = useState<{ success: boolean; error?: string } | null>(null);
  const [sendingNotif, setSendingNotif] = useState(false);
  const [notifResult, setNotifResult] = useState<string | null>(null);

  // Alert scheduling settings
  const [alertEnabled, setAlertEnabled] = useState(false);
  const [alertFrequency, setAlertFrequency] = useState("weekly"); // daily, weekly, monthly
  const [alertDay, setAlertDay] = useState("1"); // day of week (1=Monday) or day of month
  const [alertTime, setAlertTime] = useState("08:00");
  const [alertTypes, setAlertTypes] = useState({
    expiring: true,
    expired: true,
    renewed: false,
    summary: true,
  });
  const [alertThresholds, setAlertThresholds] = useState({
    days7: true,
    days30: true,
    days60: false,
    days90: false,
  });
  const [savingAlerts, setSavingAlerts] = useState(false);
  const [savedAlerts, setSavedAlerts] = useState(false);
  const [cronDebug, setCronDebug] = useState<Record<string, unknown> | null>(null);
  const [debuggingCron, setDebuggingCron] = useState(false);

  // Site branding
  const [siteLogo, setSiteLogo] = useState("");
  const [savingSiteLogo, setSavingSiteLogo] = useState(false);
  const [savedSiteLogo, setSavedSiteLogo] = useState(false);
  const siteLogoRef = useRef<HTMLInputElement>(null);
  const [siteFavicon, setSiteFavicon] = useState("");
  const siteFaviconRef = useRef<HTMLInputElement>(null);

  // Report settings
  const [reportTitle, setReportTitle] = useState("");
  const [reportSubtitle, setReportSubtitle] = useState("");
  const [reportMessage, setReportMessage] = useState("");
  const [companyLogo, setCompanyLogo] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [reportGroupMode, setReportGroupMode] = useState("date");
  const [reportPrimaryColor, setReportPrimaryColor] = useState("#3b82f6");
  const [reportShowStats, setReportShowStats] = useState(true);
  const [reportShowFamily, setReportShowFamily] = useState(true);
  const [reportShowSupplier, setReportShowSupplier] = useState(true);
  const [reportShowDuration, setReportShowDuration] = useState(true);
  const [reportShowVerticalName, setReportShowVerticalName] = useState(true);
  const [reportIncludeHorsParc, setReportIncludeHorsParc] = useState(true);
  const [reportShowRenewedCount, setReportShowRenewedCount] = useState(false);
  const [reportIncludeRenewed, setReportIncludeRenewed] = useState(false);
  const [reportShowQuantity, setReportShowQuantity] = useState(false);
  const [reportShowComParc, setReportShowComParc] = useState(false);
  const [reportShowHeaderRow, setReportShowHeaderRow] = useState(true);
  const [reportShowStatus, setReportShowStatus] = useState(true);

  const [reportFooterText, setReportFooterText] = useState("");
  const [reportOrientation, setReportOrientation] = useState("portrait");
  const [reportCoverBg, setReportCoverBg] = useState("");
  const [reportCoverBgOpacity, setReportCoverBgOpacity] = useState("15");
  const reportCoverBgRef = useRef<HTMLInputElement>(null);
  const [savingReport, setSavingReport] = useState(false);
  const [savedReport, setSavedReport] = useState(false);
  const companyLogoRef = useRef<HTMLInputElement>(null);

  // Cover logo position/size settings
  const [companyLogoPosition, setCompanyLogoPosition] = useState("top-center");
  const [companyLogoSize, setCompanyLogoSize] = useState("180");
  const [companyLogoTop, setCompanyLogoTop] = useState("5");
  const [clientLogoPosition, setClientLogoPosition] = useState("center");
  const [clientLogoSize, setClientLogoSize] = useState("150");
  const [clientLogoTop, setClientLogoTop] = useState("70");
  const [reportShowDate, setReportShowDate] = useState(true);

  // Cover template settings
  const [coverTemplate, setCoverTemplate] = useState("classic");
  const [corporateTitle, setCorporateTitle] = useState("Rapport client");
  const [corporateTagline, setCorporateTagline] = useState("");
  const [corpLogoHeight, setCorpLogoHeight] = useState("90");
  const [corpLogoGap, setCorpLogoGap] = useState("28");
  const [corpDividerHeight, setCorpDividerHeight] = useState("70");
  const [corpDividerWidth, setCorpDividerWidth] = useState("1.5");
  const [corpDividerColor, setCorpDividerColor] = useState("");
  const [corpTitleSize, setCorpTitleSize] = useState("36");
  const [corpTitleColor, setCorpTitleColor] = useState("#1e293b");
  const [corpNameSize, setCorpNameSize] = useState("26");
  const [corpHrWidth, setCorpHrWidth] = useState("200");
  const [corpHrHeight, setCorpHrHeight] = useState("2");
  const [corpTaglineSize, setCorpTaglineSize] = useState("15");
  const [corpDateSize, setCorpDateSize] = useState("14");
  // Executive template settings
  const [execBandAngle, setExecBandAngle] = useState("12");
  const [execBandWidth, setExecBandWidth] = useState("45");
  const [execBandColor, setExecBandColor] = useState("");
  const [execTitleSize, setExecTitleSize] = useState("44");
  const [execSubtitleSize, setExecSubtitleSize] = useState("18");
  const [execTitle, setExecTitle] = useState("Rapport client");
  const [execSubtitle, setExecSubtitle] = useState("");
  const [execAccentWidth, setExecAccentWidth] = useState("60");
  const [execAccentHeight, setExecAccentHeight] = useState("4");

  // Client merge (two separate searches for target and source)
  type MergeClient = { id: string; name: string; _count: { installations: number; invoices: number } };
  const [mergeTargetSearch, setMergeTargetSearch] = useState("");
  const [mergeTargetResults, setMergeTargetResults] = useState<MergeClient[]>([]);
  const [mergeTarget, setMergeTarget] = useState<MergeClient | null>(null);
  const [mergeSourceSearch, setMergeSourceSearch] = useState("");
  const [mergeSourceResults, setMergeSourceResults] = useState<MergeClient[]>([]);
  const [mergeSource, setMergeSource] = useState<MergeClient | null>(null);
  const [merging, setMerging] = useState(false);
  const [mergeResult, setMergeResult] = useState<{ success: boolean; message: string } | null>(null);

  // Broadcast message
  const [broadcastEnabled, setBroadcastEnabled] = useState(false);
  const [broadcastMessage, setBroadcastMessage] = useState("");
  const [broadcastSaving, setBroadcastSaving] = useState(false);
  const [broadcastSaved, setBroadcastSaved] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);
  const [editorReady, setEditorReady] = useState(false);

  useEffect(() => {
    if (editorRef.current && broadcastMessage && !editorReady) {
      editorRef.current.innerHTML = broadcastMessage;
      setEditorReady(true);
    }
  }, [broadcastMessage, editorReady]);

  function execCmd(command: string, value?: string) {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
  }

  async function saveBroadcast() {
    setBroadcastSaving(true);
    setBroadcastSaved(false);
    const html = editorRef.current?.innerHTML || "";
    try {
      await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          broadcast_enabled: broadcastEnabled ? "true" : "false",
          broadcast_message: html,
        }),
      });
      setBroadcastMessage(html);
      setBroadcastSaved(true);
      // Clear dismissed state so users see updated message
      setTimeout(() => setBroadcastSaved(false), 3000);
    } catch {
      // silent
    } finally {
      setBroadcastSaving(false);
    }
  }

  // Atera settings
  const [ateraApiKey, setAteraApiKey] = useState("");
  const [ateraEnabled, setAteraEnabled] = useState(false);
  const [savingAtera, setSavingAtera] = useState(false);
  const [savedAtera, setSavedAtera] = useState(false);
  const [testingAtera, setTestingAtera] = useState(false);
  const [ateraTestResult, setAteraTestResult] = useState<{ success: boolean; error?: string } | null>(null);

  // Oxibox settings
  const [oxiboxApiKey, setOxiboxApiKey] = useState("");
  const [savingOxibox, setSavingOxibox] = useState(false);
  const [savedOxibox, setSavedOxibox] = useState(false);
  const [testingOxibox, setTestingOxibox] = useState(false);
  const [oxiboxTestResult, setOxiboxTestResult] = useState<{ success: boolean; error?: string; total?: number } | null>(null);

  // Emsisoft settings
  const [emsisoftApiKey, setEmsisoftApiKey] = useState("");
  const [emsisoftApiUrl, setEmsisoftApiUrl] = useState("https://api.emsisoft.com/v1");
  const [emsisoftEnabled, setEmsisoftEnabled] = useState(false);
  const [savingEmsisoft, setSavingEmsisoft] = useState(false);
  const [savedEmsisoft, setSavedEmsisoft] = useState(false);
  const [testingEmsisoft, setTestingEmsisoft] = useState(false);
  const [emsisoftTestResult, setEmsisoftTestResult] = useState<{ success: boolean; error?: string; workspaces?: number } | null>(null);

  // Quota alert settings
  const [quotaAlertEnabled, setQuotaAlertEnabled] = useState(false);
  const [quotaWarning, setQuotaWarning] = useState("80");
  const [quotaExceeded, setQuotaExceeded] = useState("100");
  const [quotaAutoSend, setQuotaAutoSend] = useState(true);
  const [quotaRepeatMode, setQuotaRepeatMode] = useState<"once" | "recurring">("once");
  const [quotaRepeatDays, setQuotaRepeatDays] = useState("7");
  const [quotaSendToPortal, setQuotaSendToPortal] = useState(false);
  const [quotaCcAdmins, setQuotaCcAdmins] = useState(false);
  const [quotaSubjectWarning, setQuotaSubjectWarning] = useState("Votre espace de sauvegarde approche de sa limite");
  const [quotaSubjectExceeded, setQuotaSubjectExceeded] = useState("Votre espace de sauvegarde est plein");
  const [quotaBodyWarning, setQuotaBodyWarning] = useState("Bonjour {clientName},\n\nNous vous informons que votre espace de sauvegarde atteint {usagePercent}% de sa capacité ({currentUsage} utilisés sur {allocatedQuota} alloués).\n\nNous vous recommandons de vérifier vos données ou de nous contacter pour augmenter votre quota avant d'atteindre la limite.");
  const [quotaBodyExceeded, setQuotaBodyExceeded] = useState("Bonjour {clientName},\n\nVotre espace de sauvegarde a atteint {usagePercent}% de sa capacité ({currentUsage} utilisés sur {allocatedQuota} alloués).\n\nVos prochaines sauvegardes risquent d'échouer. Veuillez nous contacter rapidement pour augmenter votre quota.");
  const [quotaEmailFooter, setQuotaEmailFooter] = useState("Cet email a été envoyé automatiquement. Pour toute question, contactez votre prestataire informatique.");
  const [savingQuota, setSavingQuota] = useState(false);
  const [savedQuota, setSavedQuota] = useState(false);
  const [sendingQuotaAlert, setSendingQuotaAlert] = useState(false);
  const [quotaAlertResult, setQuotaAlertResult] = useState<string | null>(null);
  const [quotaClients, setQuotaClients] = useState<{ organizationId: string; clientName: string | null; clientEmail: string | null; usagePercent: number; allocatedQuota: string | null; currentUsage: string | null; alertLevel: string; lastAlert: { alertType: string; sentAt: string; manual: boolean } | null }[]>([]);
  const [loadingQuotaClients, setLoadingQuotaClients] = useState(false);
  const [quotaSelectedIds, setQuotaSelectedIds] = useState<Set<string>>(new Set());
  const [quotaHistory, setQuotaHistory] = useState<{ id: string; organizationId: string; clientName: string | null; alertType: string; usagePercent: number; allocatedQuota: string | null; currentUsage: string | null; recipients: string[]; sentAt: string; manual: boolean }[]>([]);
  const [quotaHistoryTotal, setQuotaHistoryTotal] = useState(0);
  const [loadingQuotaHistory, setLoadingQuotaHistory] = useState(false);
  const [showQuotaHistory, setShowQuotaHistory] = useState(false);
  const [quotaTestEmail, setQuotaTestEmail] = useState("");
  const [quotaTestType, setQuotaTestType] = useState<"warning" | "exceeded">("warning");
  const [sendingQuotaTest, setSendingQuotaTest] = useState(false);
  const [quotaTestResult, setQuotaTestResult] = useState<string | null>(null);
  const [quotaPreviewHtml, setQuotaPreviewHtml] = useState<string | null>(null);
  const [loadingQuotaPreviewHtml, setLoadingQuotaPreviewHtml] = useState(false);

  // Spotify settings
  const [spotifyClientId, setSpotifyClientId] = useState("");
  const [spotifyClientSecret, setSpotifyClientSecret] = useState("");
  const [spotifyRedirectUri, setSpotifyRedirectUri] = useState("");
  const [spotifyConnected, setSpotifyConnected] = useState(false);
  const [savingSpotify, setSavingSpotify] = useState(false);
  const [savedSpotify, setSavedSpotify] = useState(false);
  const [disconnectingSpotify, setDisconnectingSpotify] = useState(false);
  const [spotifyMessage, setSpotifyMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const searchParams = useSearchParams();
  const spotifyParamsHandled = useRef(false);
  useEffect(() => {
    if (spotifyParamsHandled.current) return;
    const connected = searchParams.get("spotify_connected");
    const error = searchParams.get("spotify_error");
    if (connected === "true") {
      spotifyParamsHandled.current = true;
      setSpotifyConnected(true);
      setSpotifyMessage({ type: "success", text: "Spotify connecté avec succès !" });
      setActiveTab("integrations");
      setOpenSections(prev => ({ ...prev, spotify: true }));
      window.history.replaceState({}, "", "/settings");
    } else if (error) {
      spotifyParamsHandled.current = true;
      setSpotifyMessage({ type: "error", text: `Erreur Spotify : ${error}` });
      setActiveTab("integrations");
      setOpenSections(prev => ({ ...prev, spotify: true }));
      window.history.replaceState({}, "", "/settings");
    }
  }, [searchParams]);

  // Collapsible sections
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    tools: true,
  });
  function toggleSection(key: string) {
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));
  }

  // Tabbed navigation
  const [activeTab, setActiveTab] = useState<string>("general");
  const SETTINGS_TABS = [
    { id: "general", label: "Général", icon: Settings2 },
    { id: "integrations", label: "Intégrations", icon: Plug },
    { id: "email", label: "Email & Alertes", icon: Mail },
    { id: "reports", label: "Rapports", icon: FileText },
    { id: "admin", label: "Administration", icon: Users },
  ];

  // Product merge
  const [mergeProductSearch, setMergeProductSearch] = useState("");
  const [mergeProducts, setMergeProducts] = useState<{ id: string; name: string; _count: { installations: number; invoiceLines: number } }[]>([]);
  const [mergeProductTarget, setMergeProductTarget] = useState<string | null>(null);
  const [mergeProductSource, setMergeProductSource] = useState<string | null>(null);
  const [mergingProduct, setMergingProduct] = useState(false);
  const [mergeProductResult, setMergeProductResult] = useState<{ success: boolean; message: string } | null>(null);

  async function searchMergeProducts(q: string) {
    setMergeProductSearch(q);
    if (q.length < 2) { setMergeProducts([]); return; }
    const res = await fetch(`/api/products?search=${encodeURIComponent(q)}&limit=20`);
    const data = await res.json();
    setMergeProducts(data.products || []);
  }

  async function handleProductMerge() {
    if (!mergeProductTarget || !mergeProductSource) return;
    setMergingProduct(true);
    setMergeProductResult(null);
    try {
      const res = await fetch("/api/products/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetId: mergeProductTarget, sourceId: mergeProductSource }),
      });
      const data = await res.json();
      if (res.ok) {
        setMergeProductResult({ success: true, message: data.message });
        setMergeProductTarget(null);
        setMergeProductSource(null);
        setMergeProducts([]);
        setMergeProductSearch("");
      } else {
        setMergeProductResult({ success: false, message: data.error || "Erreur" });
      }
    } catch {
      setMergeProductResult({ success: false, message: "Erreur de connexion" });
    } finally {
      setMergingProduct(false);
    }
  }

  async function searchMergeTarget(q: string) {
    setMergeTargetSearch(q);
    if (q.length < 2) { setMergeTargetResults([]); return; }
    const res = await fetch(`/api/clients?search=${encodeURIComponent(q)}&limit=20&showAll=true`);
    const data = await res.json();
    setMergeTargetResults(data.clients || []);
  }

  async function searchMergeSource(q: string) {
    setMergeSourceSearch(q);
    if (q.length < 2) { setMergeSourceResults([]); return; }
    const res = await fetch(`/api/clients?search=${encodeURIComponent(q)}&limit=20&showAll=true`);
    const data = await res.json();
    setMergeSourceResults(data.clients || []);
  }

  async function handleMerge() {
    if (!mergeTarget || !mergeSource) return;
    setMerging(true);
    setMergeResult(null);
    try {
      const res = await fetch("/api/clients/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetId: mergeTarget.id, sourceId: mergeSource.id }),
      });
      const data = await res.json();
      if (res.ok) {
        setMergeResult({ success: true, message: data.message });
        setMergeTarget(null);
        setMergeSource(null);
        setMergeTargetSearch("");
        setMergeSourceSearch("");
        setMergeTargetResults([]);
        setMergeSourceResults([]);
      } else {
        setMergeResult({ success: false, message: data.error || "Erreur" });
      }
    } catch {
      setMergeResult({ success: false, message: "Erreur de connexion" });
    } finally {
      setMerging(false);
    }
  }

  // Bulk delete
  const [deleteTypes, setDeleteTypes] = useState<string[]>([]);
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleteResult, setDeleteResult] = useState<{ success: boolean; message: string } | null>(null);

  // User management
  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [userForm, setUserForm] = useState({ name: "", email: "", password: "", role: "USER" });
  const [editForm, setEditForm] = useState({ name: "", email: "", password: "", role: "" });
  const [userError, setUserError] = useState("");
  const [savingUser, setSavingUser] = useState(false);
  const [showPassword, setShowPassword] = useState(false);


  useEffect(() => {
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((data) => { if (data?.user?.role) setUserRole(data.user.role); })
      .catch(() => {});
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        setSettings(data);
        setApiUrl(data.axonaut_api_url || "https://axonaut.com/api/v2");
        setSmtpHost(data.smtp_host || "");
        setSmtpPort(data.smtp_port || "587");
        setSmtpSecure(data.smtp_secure === "true");
        setSmtpUser(data.smtp_user || "");
        setSmtpPass(data.smtp_pass || "");
        setSmtpFrom(data.smtp_from || "");
        setNotifEmails(data.notification_emails || "");
        setNotifDelay(data.notification_delay_days || "30");
        // Alert scheduling
        setAlertEnabled(data.alert_enabled === "true");
        setAlertFrequency(data.alert_frequency || "weekly");
        setAlertDay(data.alert_day || "1");
        setAlertTime(data.alert_time || "08:00");
        try {
          if (data.alert_types) setAlertTypes(JSON.parse(data.alert_types));
        } catch { /* keep defaults */ }
        try {
          if (data.alert_thresholds) setAlertThresholds(JSON.parse(data.alert_thresholds));
        } catch { /* keep defaults */ }
        setReportTitle(data.report_title || "");
        setReportSubtitle(data.report_subtitle || "");
        setReportMessage(data.report_message || "");
        setCompanyLogo(data.company_logo || "");
        setCompanyName(data.company_name || "");
        setReportGroupMode(data.report_group_mode || "date");
        setReportPrimaryColor(data.report_primary_color || "#3b82f6");
        setReportShowStats(data.report_show_stats !== "false");
        setReportShowFamily(data.report_show_family !== "false");
        setReportShowSupplier(data.report_show_supplier !== "false");
        setReportShowDuration(data.report_show_duration !== "false");
        setReportShowVerticalName(data.report_show_vertical_name !== "false");
        setReportIncludeHorsParc(data.report_include_hors_parc !== "false");
        setReportShowRenewedCount(data.report_show_renewed_count === "true");
        setReportShowQuantity(data.report_show_quantity === "true");
        setReportShowComParc(data.report_show_com_parc === "true");
        setReportShowHeaderRow(data.report_show_header_row !== "false");
        setReportShowStatus(data.report_show_status !== "false");
        setReportIncludeRenewed(data.report_include_renewed === "true");

        setReportFooterText(data.report_footer_text || "");
        setReportOrientation(data.report_orientation || "portrait");
        setReportCoverBg(data.report_cover_bg || "");
        setReportCoverBgOpacity(data.report_cover_bg_opacity || "15");
        setCompanyLogoPosition(data.report_company_logo_position || "top-center");
        setCompanyLogoSize(data.report_company_logo_size || "180");
        setCompanyLogoTop(data.report_company_logo_top || "5");
        setClientLogoPosition(data.report_client_logo_position || "center");
        setClientLogoSize(data.report_client_logo_size || "150");
        setClientLogoTop(data.report_client_logo_top || "70");
        setReportShowDate(data.report_show_date !== "false");
        setCoverTemplate(data.report_cover_template || "classic");
        setCorporateTitle(data.report_corporate_title || "Rapport client");
        setCorporateTagline(data.report_corporate_tagline || "");
        setCorpLogoHeight(data.report_corp_logo_height || "90");
        setCorpLogoGap(data.report_corp_logo_gap || "28");
        setCorpDividerHeight(data.report_corp_divider_height || "70");
        setCorpDividerWidth(data.report_corp_divider_width || "1.5");
        setCorpDividerColor(data.report_corp_divider_color || "");
        setCorpTitleSize(data.report_corp_title_size || "36");
        setCorpTitleColor(data.report_corp_title_color || "#1e293b");
        setCorpNameSize(data.report_corp_name_size || "26");
        setCorpHrWidth(data.report_corp_hr_width || "200");
        setCorpHrHeight(data.report_corp_hr_height || "2");
        setCorpTaglineSize(data.report_corp_tagline_size || "15");
        setCorpDateSize(data.report_corp_date_size || "14");
        setExecBandAngle(data.report_exec_band_angle || "12");
        setExecBandWidth(data.report_exec_band_width || "45");
        setExecBandColor(data.report_exec_band_color || "");
        setExecTitleSize(data.report_exec_title_size || "44");
        setExecSubtitleSize(data.report_exec_subtitle_size || "18");
        setExecTitle(data.report_exec_title || "Rapport client");
        setExecSubtitle(data.report_exec_subtitle || "");
        setExecAccentWidth(data.report_exec_accent_width || "60");
        setExecAccentHeight(data.report_exec_accent_height || "4");
        setSiteLogo(data.site_logo || "");
        setSiteFavicon(data.site_favicon || "");
        setBroadcastEnabled(data.broadcast_enabled === "true");
        setBroadcastMessage(data.broadcast_message || "");
        setAteraApiKey(data.atera_api_key || "");
        setAteraEnabled(data.atera_enabled === "true");
        setOxiboxApiKey(data.oxibox_api_key || "");
        setEmsisoftApiKey(data.emsisoft_api_key || "");
        setEmsisoftApiUrl(data.emsisoft_api_url || "https://api.emsisoft.com/v1");
        setEmsisoftEnabled(data.emsisoft_enabled === "true");
        // Quota alerts
        setQuotaAlertEnabled(data.quota_alert_enabled === "true");
        setQuotaWarning(data.quota_alert_warning || "80");
        setQuotaExceeded(data.quota_alert_exceeded || "100");
        setQuotaAutoSend(data.quota_alert_auto_send !== "false");
        setQuotaRepeatMode(data.quota_alert_repeat_mode === "recurring" ? "recurring" : "once");
        setQuotaRepeatDays(data.quota_alert_repeat_days || "7");
        setQuotaSendToPortal(data.quota_alert_send_to_portal_users === "true");
        setQuotaCcAdmins(data.quota_alert_cc_admins === "true");
        if (data.quota_alert_subject_warning) setQuotaSubjectWarning(data.quota_alert_subject_warning);
        if (data.quota_alert_subject_exceeded) setQuotaSubjectExceeded(data.quota_alert_subject_exceeded);
        if (data.quota_alert_body_warning) setQuotaBodyWarning(data.quota_alert_body_warning);
        if (data.quota_alert_body_exceeded) setQuotaBodyExceeded(data.quota_alert_body_exceeded);
        if (data.quota_alert_email_footer) setQuotaEmailFooter(data.quota_alert_email_footer);
        setSpotifyClientId(data.spotify_client_id || "");
        setSpotifyClientSecret(data.spotify_client_secret || "");
        setSpotifyRedirectUri(data.spotify_redirect_uri || "");
        setSpotifyConnected(!!(data.spotify_access_token || data.spotify_refresh_token));
      })
      .finally(() => setLoading(false));

    fetchUsers();
  }, []);

  async function fetchUsers() {
    setLoadingUsers(true);
    try {
      const res = await fetch("/api/users");
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users);
      }
    } catch {
      // not admin or error
    } finally {
      setLoadingUsers(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    const body: Record<string, string> = {
      axonaut_api_url: apiUrl,
    };
    if (newApiKey) body.axonaut_api_key = newApiKey;

    await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    setSaving(false);
    setSaved(true);
    setNewApiKey("");
    setTimeout(() => setSaved(false), 3000);
  }

  async function handleSaveSmtp() {
    setSavingSmtp(true);
    await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        smtp_host: smtpHost,
        smtp_port: smtpPort,
        smtp_secure: smtpSecure ? "true" : "false",
        smtp_user: smtpUser,
        smtp_pass: smtpPass,
        smtp_from: smtpFrom,
        notification_emails: notifEmails,
        notification_delay_days: notifDelay,
      }),
    });
    setSavingSmtp(false);
    setSavedSmtp(true);
    setTimeout(() => setSavedSmtp(false), 3000);
  }

  async function handleTestSmtp() {
    setTestingSmtp(true);
    setSmtpTestResult(null);

    // Save settings first, then test with current form values
    await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        smtp_host: smtpHost,
        smtp_port: smtpPort,
        smtp_secure: smtpSecure ? "true" : "false",
        smtp_user: smtpUser,
        smtp_pass: smtpPass,
        smtp_from: smtpFrom,
        notification_emails: notifEmails,
        notification_delay_days: notifDelay,
      }),
    });

    const res = await fetch("/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "test",
        smtp: {
          host: smtpHost,
          port: smtpPort,
          secure: smtpSecure,
          user: smtpUser,
          pass: smtpPass,
          from: smtpFrom,
        },
      }),
    });
    const result = await res.json();
    setSmtpTestResult(result);
    setTestingSmtp(false);
  }

  async function handleSendNotif() {
    setSendingNotif(true);
    setNotifResult(null);
    try {
      const res = await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send" }),
      });
      const result = await res.json();
      if (result.sent) {
        setNotifResult(`Email envoyé : ${result.count} installation(s) signalée(s)`);
      } else if (result.error) {
        setNotifResult(`Erreur : ${result.error}`);
      } else {
        setNotifResult(result.reason || "Aucune notification à envoyer");
      }
    } catch {
      setNotifResult("Erreur lors de l'envoi");
    }
    setSendingNotif(false);
  }

  async function handleDebugCron() {
    setDebuggingCron(true);
    try {
      const res = await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "debug-cron" }),
      });
      const data = await res.json();
      setCronDebug(data);
    } catch {
      setCronDebug({ error: "Erreur de connexion" });
    }
    setDebuggingCron(false);
  }

  async function handleSaveAlerts() {
    setSavingAlerts(true);
    await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        alert_enabled: alertEnabled ? "true" : "false",
        alert_frequency: alertFrequency,
        alert_day: alertDay,
        alert_time: alertTime,
        alert_types: JSON.stringify(alertTypes),
        alert_thresholds: JSON.stringify(alertThresholds),
      }),
    });
    setSavingAlerts(false);
    setSavedAlerts(true);
    setTimeout(() => setSavedAlerts(false), 3000);
  }

  async function handleSaveQuotaAlerts() {
    setSavingQuota(true);
    await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        quota_alert_enabled: quotaAlertEnabled ? "true" : "false",
        quota_alert_warning: quotaWarning,
        quota_alert_exceeded: quotaExceeded,
        quota_alert_auto_send: quotaAutoSend ? "true" : "false",
        quota_alert_repeat_mode: quotaRepeatMode,
        quota_alert_repeat_days: quotaRepeatDays,
        quota_alert_send_to_portal_users: quotaSendToPortal ? "true" : "false",
        quota_alert_cc_admins: quotaCcAdmins ? "true" : "false",
        quota_alert_subject_warning: quotaSubjectWarning,
        quota_alert_subject_exceeded: quotaSubjectExceeded,
        quota_alert_body_warning: quotaBodyWarning,
        quota_alert_body_exceeded: quotaBodyExceeded,
        quota_alert_email_footer: quotaEmailFooter,
      }),
    });
    setSavingQuota(false);
    setSavedQuota(true);
    setTimeout(() => setSavedQuota(false), 3000);
  }

  async function handleLoadQuotaClients() {
    setLoadingQuotaClients(true);
    try {
      await handleSaveQuotaAlerts();
      const res = await fetch("/api/quota-alerts?action=clients");
      const data = await res.json();
      setQuotaClients(data.clients || []);
      setQuotaSelectedIds(new Set());
    } catch {
      setQuotaClients([]);
    }
    setLoadingQuotaClients(false);
  }

  async function handleSendToSelected() {
    if (quotaSelectedIds.size === 0) return;
    setSendingQuotaAlert(true);
    setQuotaAlertResult(null);
    try {
      const res = await fetch("/api/quota-alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send-selected", organizationIds: Array.from(quotaSelectedIds) }),
      });
      const result = await res.json();
      if (result.error) {
        setQuotaAlertResult(`Erreur : ${result.error}`);
      } else if (result.sent) {
        const errors = (result.results || []).filter((r: Record<string, unknown>) => r.error);
        if (errors.length > 0) {
          setQuotaAlertResult(`${result.count} email(s) envoyé(s), ${errors.length} erreur(s)`);
        } else {
          setQuotaAlertResult(`${result.count} email(s) envoyé(s) avec succès`);
        }
        setQuotaSelectedIds(new Set());
        handleLoadQuotaClients();
      } else {
        setQuotaAlertResult("Aucun email envoyé");
      }
    } catch {
      setQuotaAlertResult("Erreur lors de l'envoi");
    }
    setSendingQuotaAlert(false);
  }

  function toggleQuotaSelect(orgId: string) {
    setQuotaSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(orgId)) next.delete(orgId);
      else next.add(orgId);
      return next;
    });
  }

  function toggleQuotaSelectAll() {
    const selectable = quotaClients.filter(c => c.clientEmail);
    if (quotaSelectedIds.size === selectable.length) {
      setQuotaSelectedIds(new Set());
    } else {
      setQuotaSelectedIds(new Set(selectable.map(c => c.organizationId)));
    }
  }

  async function handleLoadQuotaHistory() {
    setLoadingQuotaHistory(true);
    setShowQuotaHistory(true);
    try {
      const res = await fetch("/api/quota-alerts?action=history&limit=30");
      const data = await res.json();
      setQuotaHistory(data.alerts || []);
      setQuotaHistoryTotal(data.total || 0);
    } catch {
      setQuotaHistory([]);
    }
    setLoadingQuotaHistory(false);
  }

  async function handleSendQuotaTest() {
    if (!quotaTestEmail) return;
    setSendingQuotaTest(true);
    setQuotaTestResult(null);
    try {
      await handleSaveQuotaAlerts();
      const res = await fetch("/api/quota-alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "test", email: quotaTestEmail, alertType: quotaTestType }),
      });
      const data = await res.json();
      if (data.sent) {
        setQuotaTestResult(`Email de test envoyé à ${quotaTestEmail}`);
      } else {
        setQuotaTestResult(`Erreur : ${data.error}`);
      }
    } catch {
      setQuotaTestResult("Erreur lors de l'envoi");
    }
    setSendingQuotaTest(false);
  }

  async function handlePreviewQuotaHtml() {
    setLoadingQuotaPreviewHtml(true);
    try {
      await handleSaveQuotaAlerts();
      const res = await fetch("/api/quota-alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "preview-html", alertType: quotaTestType }),
      });
      const data = await res.json();
      setQuotaPreviewHtml(data.html || null);
    } catch {
      setQuotaPreviewHtml(null);
    }
    setLoadingQuotaPreviewHtml(false);
  }

  async function handleSaveSiteLogo() {
    setSavingSiteLogo(true);
    await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ site_logo: siteLogo, site_favicon: siteFavicon }),
    });
    setSavingSiteLogo(false);
    setSavedSiteLogo(true);
    setTimeout(() => setSavedSiteLogo(false), 3000);
  }

  async function handleSaveReport() {
    setSavingReport(true);
    await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        report_title: reportTitle,
        report_subtitle: reportSubtitle,
        report_message: reportMessage,
        company_logo: companyLogo,
        company_name: companyName,
        report_group_mode: reportGroupMode,
        report_primary_color: reportPrimaryColor,
        report_show_stats: reportShowStats ? "true" : "false",
        report_show_family: reportShowFamily ? "true" : "false",
        report_show_supplier: reportShowSupplier ? "true" : "false",
        report_show_duration: reportShowDuration ? "true" : "false",
        report_show_vertical_name: reportShowVerticalName ? "true" : "false",
        report_include_hors_parc: reportIncludeHorsParc ? "true" : "false",
        report_show_renewed_count: reportShowRenewedCount ? "true" : "false",
        report_show_quantity: reportShowQuantity ? "true" : "false",
        report_show_com_parc: reportShowComParc ? "true" : "false",
        report_show_header_row: reportShowHeaderRow ? "true" : "false",
        report_show_status: reportShowStatus ? "true" : "false",
        report_include_renewed: reportIncludeRenewed ? "true" : "false",

        report_footer_text: reportFooterText,
        report_orientation: reportOrientation,
        report_cover_bg: reportCoverBg,
        report_cover_bg_opacity: reportCoverBgOpacity,
        report_company_logo_position: companyLogoPosition,
        report_company_logo_size: companyLogoSize,
        report_company_logo_top: companyLogoTop,
        report_client_logo_position: clientLogoPosition,
        report_client_logo_size: clientLogoSize,
        report_client_logo_top: clientLogoTop,
        report_show_date: reportShowDate ? "true" : "false",
        report_cover_template: coverTemplate,
        report_corporate_title: corporateTitle,
        report_corporate_tagline: corporateTagline,
        report_corp_logo_height: corpLogoHeight,
        report_corp_logo_gap: corpLogoGap,
        report_corp_divider_height: corpDividerHeight,
        report_corp_divider_width: corpDividerWidth,
        report_corp_divider_color: corpDividerColor,
        report_corp_title_size: corpTitleSize,
        report_corp_title_color: corpTitleColor,
        report_corp_name_size: corpNameSize,
        report_corp_hr_width: corpHrWidth,
        report_corp_hr_height: corpHrHeight,
        report_corp_tagline_size: corpTaglineSize,
        report_corp_date_size: corpDateSize,
        report_exec_band_angle: execBandAngle,
        report_exec_band_width: execBandWidth,
        report_exec_band_color: execBandColor,
        report_exec_title_size: execTitleSize,
        report_exec_subtitle_size: execSubtitleSize,
        report_exec_title: execTitle,
        report_exec_subtitle: execSubtitle,
        report_exec_accent_width: execAccentWidth,
        report_exec_accent_height: execAccentHeight,
      }),
    });
    setSavingReport(false);
    setSavedReport(true);
    setTimeout(() => setSavedReport(false), 3000);
  }

  async function createUser() {
    if (!userForm.name || !userForm.email || !userForm.password) {
      setUserError("Tous les champs sont requis");
      return;
    }
    setSavingUser(true);
    setUserError("");

    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(userForm),
    });

    if (res.ok) {
      setShowCreateForm(false);
      setUserForm({ name: "", email: "", password: "", role: "USER" });
      fetchUsers();
    } else {
      const err = await res.json();
      setUserError(err.error || "Erreur lors de la création");
    }
    setSavingUser(false);
  }

  async function updateUser(id: string) {
    setSavingUser(true);
    setUserError("");

    const payload: Record<string, string> = {};
    if (editForm.name) payload.name = editForm.name;
    if (editForm.email) payload.email = editForm.email;
    if (editForm.password) payload.password = editForm.password;
    if (editForm.role) payload.role = editForm.role;

    const res = await fetch(`/api/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      setEditingUser(null);
      fetchUsers();
    } else {
      const err = await res.json();
      setUserError(err.error || "Erreur lors de la modification");
    }
    setSavingUser(false);
  }

  async function deleteUser(id: string, name: string) {
    if (!confirm(`Supprimer l'utilisateur "${name}" ?`)) return;

    const res = await fetch(`/api/users/${id}`, { method: "DELETE" });
    if (res.ok) {
      fetchUsers();
    } else {
      const err = await res.json();
      alert(err.error || "Erreur lors de la suppression");
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Paramètres</h1>
        <p className="text-sm text-slate-500 mt-1">Configuration de l&apos;application</p>
      </div>

      {/* Mobile tab bar */}
      <div className="lg:hidden flex gap-1 overflow-x-auto pb-2 -mx-4 px-4">
        {SETTINGS_TABS.filter(tab => tab.id !== "admin" || isAdmin).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex items-center gap-2 whitespace-nowrap rounded-full px-3.5 py-2 text-sm font-medium transition-colors shrink-0",
              activeTab === tab.id
                ? "bg-primary-50 text-primary-700"
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            )}
          >
            <tab.icon className={cn("h-4 w-4", activeTab === tab.id ? "text-primary-600" : "text-slate-400")} />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex gap-6">
        {/* Sidebar navigation */}
        <nav className="w-56 shrink-0 hidden lg:block">
          <div className="sticky top-6 space-y-1">
            {SETTINGS_TABS.filter(tab => tab.id !== "admin" || isAdmin).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-3 w-full rounded-lg px-3 py-2.5 text-sm font-medium transition-colors text-left",
                  activeTab === tab.id
                    ? "bg-primary-50 text-primary-700"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                )}
              >
                <tab.icon className={cn("h-4 w-4", activeTab === tab.id ? "text-primary-600" : "text-slate-400")} />
                {tab.label}
              </button>
            ))}
          </div>
        </nav>

        {/* Content area */}
        <div className="flex-1 min-w-0 space-y-6">

      {activeTab === "general" && (<>
      {/* Outils */}
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="rounded-lg bg-slate-100 p-2">
            <Plug className="h-4 w-4 text-slate-600" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-slate-900">Outils</h3>
            <p className="text-xs text-slate-400">Accédez aux outils de gestion de données</p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <a href="/import" className="flex items-center gap-3 rounded-lg border border-slate-200 p-4 hover:bg-slate-50 transition-colors">
            <div className="rounded-lg bg-primary-50 p-2">
              <Upload className="h-4 w-4 text-primary-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-900">Import / Export</p>
              <p className="text-xs text-slate-400">Importer ou exporter des données CSV</p>
            </div>
          </a>
          <a href="/sync" className="flex items-center gap-3 rounded-lg border border-slate-200 p-4 hover:bg-slate-50 transition-colors">
            <div className="rounded-lg bg-cyan-50 p-2">
              <FileText className="h-4 w-4 text-cyan-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-900">Synchronisation</p>
              <p className="text-xs text-slate-400">Synchroniser avec une source externe</p>
            </div>
          </a>
          <a href="/activity" className="flex items-center gap-3 rounded-lg border border-slate-200 p-4 hover:bg-slate-50 transition-colors">
            <div className="rounded-lg bg-amber-50 p-2">
              <Bell className="h-4 w-4 text-amber-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-900">Journal d&apos;activité</p>
              <p className="text-xs text-slate-400">Historique des actions</p>
            </div>
          </a>
          {isAdmin && (
            <a href="/backup" className="flex items-center gap-3 rounded-lg border border-slate-200 p-4 hover:bg-slate-50 transition-colors">
              <div className="rounded-lg bg-purple-50 p-2">
                <Save className="h-4 w-4 text-purple-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-900">Sauvegardes</p>
                <p className="text-xs text-slate-400">Backups de la base de données</p>
              </div>
            </a>
          )}
        </div>
      </div>

      {/* Apparence du site (admin only) */}
      {isAdmin && <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <button onClick={() => toggleSection("appearance")} className="w-full flex items-center justify-between p-6 text-left hover:bg-slate-50 transition-colors">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary-50 p-2">
              <Palette className="h-4 w-4 text-primary-600" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-slate-900">Apparence du site</h3>
              <p className="text-xs text-slate-400">Personnalisez le logo affiché dans la barre latérale et la page de connexion.</p>
            </div>
          </div>
          <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${openSections.appearance ? "rotate-180" : ""}`} />
        </button>
        {openSections.appearance && <div className="px-6 pb-6 space-y-5 border-t border-slate-100 pt-5">

        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1.5">
            Logo du site
          </label>
          <div className="flex items-center gap-4">
            {siteLogo ? (
              <div className="relative group">
                <img
                  src={siteLogo}
                  alt="Logo site"
                  className="h-16 w-16 rounded-lg bg-white p-1 border border-slate-200 object-contain"
                />
                <button
                  onClick={() => setSiteLogo("")}
                  className="absolute -top-1.5 -right-1.5 rounded-full bg-red-500 p-0.5 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <img src="/logo.png" alt="Logo par défaut" className="h-16 w-16 rounded-lg bg-white p-1 border border-slate-200 object-contain" />
                <span className="text-xs text-slate-400">Logo par défaut</span>
              </div>
            )}
            <button
              onClick={() => siteLogoRef.current?.click()}
              className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-500 hover:bg-slate-50 transition-colors"
            >
              <Upload className="h-3.5 w-3.5" />
              {siteLogo ? "Changer" : "Personnaliser"}
            </button>
          </div>
          <input
            ref={siteLogoRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              if (file.size > 2 * 1024 * 1024) { alert("Max 2 Mo"); return; }
              const reader = new FileReader();
              reader.onload = () => setSiteLogo(reader.result as string);
              reader.readAsDataURL(file);
            }}
          />
          <p className="text-xs text-slate-400 mt-1">Ce logo remplace le logo par défaut dans la barre latérale et la page de connexion (max 2 Mo)</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1.5">
            Favicon du site
          </label>
          <div className="flex items-center gap-4">
            {siteFavicon ? (
              <div className="relative group">
                <img
                  src={siteFavicon}
                  alt="Favicon"
                  className="h-12 w-12 rounded-lg bg-white p-1 border border-slate-200 object-contain"
                />
                <button
                  onClick={() => setSiteFavicon("")}
                  className="absolute -top-1.5 -right-1.5 rounded-full bg-red-500 p-0.5 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center">
                  <Globe className="h-5 w-5 text-slate-400" />
                </div>
                <span className="text-xs text-slate-400">Favicon par défaut</span>
              </div>
            )}
            <button
              onClick={() => siteFaviconRef.current?.click()}
              className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-500 hover:bg-slate-50 transition-colors"
            >
              <Upload className="h-3.5 w-3.5" />
              {siteFavicon ? "Changer" : "Personnaliser"}
            </button>
          </div>
          <input
            ref={siteFaviconRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              if (file.size > 2 * 1024 * 1024) { alert("Max 2 Mo"); return; }
              const reader = new FileReader();
              reader.onload = () => setSiteFavicon(reader.result as string);
              reader.readAsDataURL(file);
            }}
          />
          <p className="text-xs text-slate-400 mt-1">Icône affichée dans l&apos;onglet du navigateur (max 2 Mo, format carré recommandé)</p>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={handleSaveSiteLogo}
            disabled={savingSiteLogo}
            className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50 transition-colors"
          >
            {savingSiteLogo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Enregistrer
          </button>
          {savedSiteLogo && <span className="text-xs text-emerald-600">Apparence enregistrée — rechargez la page pour voir le changement</span>}
        </div>
      </div>}
      </div>}
      </>)}

      {activeTab === "integrations" && (<>
      {/* API Axonaut (admin only) */}
      {isAdmin && <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <button onClick={() => toggleSection("axonaut")} className="w-full flex items-center justify-between p-6 text-left hover:bg-slate-50 transition-colors">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary-50 p-2">
              <Key className="h-4 w-4 text-primary-600" />
            </div>
            <h3 className="text-sm font-medium text-slate-900">API Axonaut</h3>
          </div>
          <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${openSections.axonaut ? "rotate-180" : ""}`} />
        </button>
        {openSections.axonaut && <div className="px-6 pb-6 space-y-5 border-t border-slate-100 pt-5">

        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1.5">
            Clé API actuelle
          </label>
          <p className="text-sm text-slate-400 font-mono">
            {settings.axonaut_api_key || "Non configurée"}
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1.5">
            Nouvelle clé API
          </label>
          <input
            type="password"
            value={newApiKey}
            onChange={(e) => setNewApiKey(e.target.value)}
            placeholder="Entrer une nouvelle clé API..."
            className="w-full rounded-lg border border-slate-200 bg-slate-100 px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1.5">
            URL de l&apos;API
          </label>
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={apiUrl}
              onChange={(e) => setApiUrl(e.target.value)}
              className="flex-1 rounded-lg border border-slate-200 bg-slate-100 px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50 transition-colors"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Enregistrer
          </button>
          {saved && (
            <span className="text-xs text-emerald-600">Paramètres enregistrés</span>
          )}
        </div>
      </div>}
      </div>}
      </>)}

      {activeTab === "email" && (<>
      {/* Configuration SMTP (admin only) */}
      {isAdmin && <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <button onClick={() => toggleSection("smtp")} className="w-full flex items-center justify-between p-6 text-left hover:bg-slate-50 transition-colors">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary-50 p-2">
              <Mail className="h-4 w-4 text-primary-600" />
            </div>
            <h3 className="text-sm font-medium text-slate-900">Configuration SMTP</h3>
          </div>
          <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${openSections.smtp ? "rotate-180" : ""}`} />
        </button>
        {openSections.smtp && <div className="px-6 pb-6 space-y-5 border-t border-slate-100 pt-5">

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1.5">Serveur SMTP</label>
            <input
              type="text"
              value={smtpHost}
              onChange={(e) => setSmtpHost(e.target.value)}
              placeholder="smtp.gmail.com"
              className="w-full rounded-lg border border-slate-200 bg-slate-100 px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1.5">Port</label>
              <input
                type="text"
                value={smtpPort}
                onChange={(e) => setSmtpPort(e.target.value)}
                placeholder="587"
                className="w-full rounded-lg border border-slate-200 bg-slate-100 px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1.5">SSL/TLS</label>
              <button
                onClick={() => {
                  const next = !smtpSecure;
                  setSmtpSecure(next);
                  setSmtpPort(next ? "465" : "587");
                }}
                className={`w-full rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${
                  smtpSecure
                    ? "border-emerald-500 bg-emerald-50 text-emerald-600"
                    : "border-slate-200 bg-slate-100 text-slate-500"
                }`}
              >
                {smtpSecure ? "SSL direct (465)" : "STARTTLS (587)"}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1.5">Identifiant</label>
            <input
              type="text"
              value={smtpUser}
              onChange={(e) => setSmtpUser(e.target.value)}
              placeholder="user@exemple.com"
              className="w-full rounded-lg border border-slate-200 bg-slate-100 px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1.5">Mot de passe</label>
            <input
              type="password"
              value={smtpPass}
              onChange={(e) => setSmtpPass(e.target.value)}
              placeholder="Mot de passe SMTP..."
              className="w-full rounded-lg border border-slate-200 bg-slate-100 px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-slate-600 mb-1.5">Adresse expéditeur</label>
            <input
              type="text"
              value={smtpFrom}
              onChange={(e) => setSmtpFrom(e.target.value)}
              placeholder="COMET CEDELIA <noreply@cedelia.fr>"
              className="w-full rounded-lg border border-slate-200 bg-slate-100 px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={handleSaveSmtp}
            disabled={savingSmtp}
            className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50 transition-colors"
          >
            {savingSmtp ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Enregistrer
          </button>
          <button
            onClick={handleTestSmtp}
            disabled={testingSmtp}
            className="flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors"
          >
            {testingSmtp ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plug className="h-4 w-4" />}
            Tester la connexion
          </button>
          <button
            onClick={async () => {
              setSmtpTestResult(null);
              setTestingSmtp(true);
              try {
                const res = await fetch("/api/notifications", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ action: "test-email" }),
                });
                const data = await res.json();
                if (res.ok) {
                  setSmtpTestResult({ success: true, error: data.message });
                } else {
                  setSmtpTestResult({ success: false, error: data.error });
                }
              } catch {
                setSmtpTestResult({ success: false, error: "Erreur de connexion" });
              } finally {
                setTestingSmtp(false);
              }
            }}
            disabled={testingSmtp}
            className="flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-50 transition-colors"
          >
            {testingSmtp ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Envoyer un email de test
          </button>
          {savedSmtp && <span className="text-xs text-emerald-600">Paramètres enregistrés</span>}
        </div>

        {smtpTestResult && (
          <div className={`rounded-lg border px-4 py-2 text-sm ${
            smtpTestResult.success
              ? "border-emerald-200 bg-emerald-50 text-emerald-600"
              : "border-red-200 bg-red-50 text-red-600"
          }`}>
            {smtpTestResult.success
              ? (smtpTestResult.error || "Connexion SMTP réussie")
              : `Erreur : ${smtpTestResult.error}`}
          </div>
        )}
      </div>}
      </div>}
      </>)}

      {activeTab === "integrations" && (<>
      {/* Atera Integration */}
      {isAdmin && <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <button onClick={() => toggleSection("atera")} className="w-full flex items-center justify-between p-6 text-left hover:bg-slate-50 transition-colors">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-indigo-50 p-2">
              <Plug className="h-4 w-4 text-indigo-600" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-slate-900">Intégration Atera</h3>
              <p className="text-xs text-slate-400">Synchronisation des tickets avec Atera</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {ateraEnabled && <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 font-medium">Actif</span>}
            <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${openSections.atera ? "rotate-180" : ""}`} />
          </div>
        </button>
        {openSections.atera && <div className="px-6 pb-6 space-y-5 border-t border-slate-100 pt-5">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1.5">Clé API Atera</label>
            <input
              type="password"
              value={ateraApiKey}
              onChange={(e) => setAteraApiKey(e.target.value)}
              placeholder="Votre clé API Atera (Admin > API dans Atera)"
              className="w-full rounded-lg border border-slate-200 bg-slate-100 px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <p className="text-xs text-slate-400 mt-1">Trouvez votre clé API dans Atera : Admin &gt; API</p>
          </div>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={ateraEnabled}
              onChange={(e) => setAteraEnabled(e.target.checked)}
              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            <div>
              <span className="text-sm font-medium text-slate-700">Activer la synchronisation</span>
              <p className="text-xs text-slate-400">Les tickets créés seront automatiquement envoyés à Atera</p>
            </div>
          </label>

          <div className="flex items-center gap-3">
            <button
              onClick={async () => {
                setSavingAtera(true);
                setSavedAtera(false);
                try {
                  await fetch("/api/settings", {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      atera_api_key: ateraApiKey,
                      atera_enabled: ateraEnabled ? "true" : "false",
                    }),
                  });
                  setSavedAtera(true);
                  setTimeout(() => setSavedAtera(false), 3000);
                } finally {
                  setSavingAtera(false);
                }
              }}
              disabled={savingAtera}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {savingAtera ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Enregistrer
            </button>
            <button
              onClick={async () => {
                setTestingAtera(true);
                setAteraTestResult(null);
                try {
                  // Save first so test uses latest key
                  await fetch("/api/settings", {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      atera_api_key: ateraApiKey,
                      atera_enabled: ateraEnabled ? "true" : "false",
                    }),
                  });
                  const res = await fetch("/api/atera", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ action: "test" }),
                  });
                  const data = await res.json();
                  setAteraTestResult(data);
                } catch {
                  setAteraTestResult({ success: false, error: "Erreur de connexion" });
                } finally {
                  setTestingAtera(false);
                }
              }}
              disabled={testingAtera || !ateraApiKey}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors"
            >
              {testingAtera ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Tester la connexion
            </button>
            {savedAtera && <span className="text-xs text-emerald-600">Enregistré</span>}
          </div>

          {ateraTestResult && (
            <div className={`p-3 rounded-lg text-sm ${ateraTestResult.success ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
              {ateraTestResult.success ? "Connexion Atera réussie !" : `Erreur : ${ateraTestResult.error}`}
            </div>
          )}
        </div>}
      </div>}

      {/* Oxibox Backup Integration */}
      {isAdmin && <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <button onClick={() => toggleSection("oxibox")} className="w-full flex items-center justify-between p-6 text-left hover:bg-slate-50 transition-colors">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-emerald-50 p-2">
              <HardDrive className="h-4 w-4 text-emerald-600" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-slate-900">Sauvegardes Oxibox</h3>
              <p className="text-xs text-slate-400">Supervision des sauvegardes clients via Oxibox</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {oxiboxApiKey && !oxiboxApiKey.startsWith("••••") && <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 font-medium">Configuré</span>}
            {oxiboxApiKey && oxiboxApiKey.startsWith("••••") && <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 font-medium">Configuré</span>}
            <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${openSections.oxibox ? "rotate-180" : ""}`} />
          </div>
        </button>
        {openSections.oxibox && <div className="px-6 pb-6 space-y-5 border-t border-slate-100 pt-5">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1.5">Clé API Oxibox (Bearer Token)</label>
            <input
              type="password"
              value={oxiboxApiKey}
              onChange={(e) => setOxiboxApiKey(e.target.value)}
              placeholder="Token communiqué par Oxibox"
              className="w-full rounded-lg border border-slate-200 bg-slate-100 px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
            <p className="text-xs text-slate-400 mt-1">Ce token est utilisé pour accéder à l&apos;API Oxibox (https://api.oxibox.com). Contactez Oxibox pour l&apos;obtenir.</p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={async () => {
                setSavingOxibox(true);
                setSavedOxibox(false);
                try {
                  await fetch("/api/settings", {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ oxibox_api_key: oxiboxApiKey }),
                  });
                  setSavedOxibox(true);
                  setTimeout(() => setSavedOxibox(false), 3000);
                } finally {
                  setSavingOxibox(false);
                }
              }}
              disabled={savingOxibox}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors"
            >
              {savingOxibox ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Enregistrer
            </button>
            <button
              onClick={async () => {
                setTestingOxibox(true);
                setOxiboxTestResult(null);
                try {
                  await fetch("/api/settings", {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ oxibox_api_key: oxiboxApiKey }),
                  });
                  const res = await fetch("/api/oxibox/status", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ action: "test" }),
                  });
                  const data = await res.json();
                  setOxiboxTestResult(data);
                } catch {
                  setOxiboxTestResult({ success: false, error: "Erreur de connexion" });
                } finally {
                  setTestingOxibox(false);
                }
              }}
              disabled={testingOxibox || !oxiboxApiKey}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors"
            >
              {testingOxibox ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Tester la connexion
            </button>
            {savedOxibox && <span className="text-xs text-emerald-600">Enregistré</span>}
          </div>

          {oxiboxTestResult && (
            <div className={`p-3 rounded-lg text-sm ${oxiboxTestResult.success ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
              {oxiboxTestResult.success ? `Connexion Oxibox réussie ! ${oxiboxTestResult.total} compte(s) trouvé(s).` : `Erreur : ${oxiboxTestResult.error}`}
            </div>
          )}
        </div>}
      </div>}

      {/* Emsisoft Integration */}
      {isAdmin && <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <button onClick={() => toggleSection("emsisoft")} className="w-full flex items-center justify-between p-6 text-left hover:bg-slate-50 transition-colors">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-purple-50 p-2">
              <Shield className="h-4 w-4 text-purple-600" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-slate-900">Emsisoft</h3>
              <p className="text-xs text-slate-400">Protection antivirus et gestion des menaces</p>
            </div>
          </div>
          <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${openSections.emsisoft ? "rotate-180" : ""}`} />
        </button>
        {openSections.emsisoft && <div className="px-6 pb-6 space-y-4 border-t border-slate-100 pt-5">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1.5">URL de l&apos;API</label>
            <input
              type="text"
              value={emsisoftApiUrl}
              onChange={(e) => setEmsisoftApiUrl(e.target.value)}
              placeholder="https://api.emsisoft.com/v1"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
            <p className="text-[11px] text-slate-400 mt-1">URL de base de l&apos;API Emsisoft Management Console</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1.5">Clé API</label>
            <input
              type="password"
              value={emsisoftApiKey}
              onChange={(e) => setEmsisoftApiKey(e.target.value)}
              placeholder="Votre clé API Emsisoft"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
            <p className="text-[11px] text-slate-400 mt-1">Disponible dans Emsisoft Management Console &gt; Settings &gt; API</p>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={emsisoftEnabled} onChange={(e) => setEmsisoftEnabled(e.target.checked)} className="rounded border-slate-300 text-purple-600 focus:ring-purple-500" />
            <span className="text-sm text-slate-700">Activer l&apos;intégration Emsisoft</span>
          </label>

          <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
            <p className="text-xs font-medium text-purple-800 mb-1">URL Webhook</p>
            <code className="text-[11px] text-purple-600 break-all">{typeof window !== "undefined" ? `${window.location.origin}/api/webhooks/emsisoft` : "/api/webhooks/emsisoft"}</code>
            <p className="text-[10px] text-purple-500 mt-1">Configurez cette URL dans Emsisoft pour recevoir les alertes automatiquement.</p>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={async () => {
                setSavingEmsisoft(true);
                setSavedEmsisoft(false);
                setEmsisoftTestResult(null);
                await fetch("/api/settings", {
                  method: "PUT",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    emsisoft_api_key: emsisoftApiKey,
                    emsisoft_api_url: emsisoftApiUrl,
                    emsisoft_enabled: emsisoftEnabled ? "true" : "false",
                  }),
                });
                setSavingEmsisoft(false);
                setSavedEmsisoft(true);
                setTimeout(() => setSavedEmsisoft(false), 3000);
              }}
              disabled={savingEmsisoft}
              className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50 transition-colors"
            >
              {savingEmsisoft ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Enregistrer
            </button>
            <button
              onClick={async () => {
                setTestingEmsisoft(true);
                setEmsisoftTestResult(null);
                await fetch("/api/settings", {
                  method: "PUT",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    emsisoft_api_key: emsisoftApiKey,
                    emsisoft_api_url: emsisoftApiUrl,
                    emsisoft_enabled: emsisoftEnabled ? "true" : "false",
                  }),
                });
                const res = await fetch("/api/emsisoft", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ action: "test" }),
                });
                const data = await res.json();
                setEmsisoftTestResult(data);
                setTestingEmsisoft(false);
              }}
              disabled={testingEmsisoft || !emsisoftApiKey}
              className="flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors"
            >
              {testingEmsisoft ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plug className="h-4 w-4" />}
              Tester la connexion
            </button>
            {savedEmsisoft && <span className="text-xs text-emerald-600">Paramètres enregistrés</span>}
          </div>

          {emsisoftTestResult && (
            <div className={`p-3 rounded-lg text-sm ${emsisoftTestResult.success ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
              {emsisoftTestResult.success ? `Connexion Emsisoft réussie ! ${emsisoftTestResult.workspaces} workspace(s) trouvé(s).` : `Erreur : ${emsisoftTestResult.error}`}
            </div>
          )}
        </div>}
      </div>}

      {/* Spotify Integration */}
      {isAdmin && <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <button onClick={() => toggleSection("spotify")} className="w-full flex items-center justify-between p-6 text-left hover:bg-slate-50 transition-colors">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-green-50 p-2">
              <Music className="h-4 w-4 text-green-600" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-slate-900">Spotify</h3>
              <p className="text-xs text-slate-400">Lecteur de musique intégré au Board Screen</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {spotifyConnected && <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-50 text-green-600 font-medium">Connecté</span>}
            <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${openSections.spotify ? "rotate-180" : ""}`} />
          </div>
        </button>
        {openSections.spotify && <div className="px-6 pb-6 space-y-5 border-t border-slate-100 pt-5">
          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
            <p className="text-xs text-green-800">
              Pour utiliser Spotify, créez une application sur{" "}
              <a href="https://developer.spotify.com/dashboard" target="_blank" rel="noopener noreferrer" className="underline font-medium">developer.spotify.com</a>
              {" "}et ajoutez l&apos;URL de callback :{" "}
              <code className="text-[11px] bg-green-100 px-1 py-0.5 rounded">{typeof window !== "undefined" ? `${window.location.origin}/api/spotify/callback` : "/api/spotify/callback"}</code>
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1.5">Client ID</label>
            <input
              type="text"
              value={spotifyClientId}
              onChange={(e) => setSpotifyClientId(e.target.value)}
              placeholder="Votre Client ID Spotify"
              className="w-full rounded-lg border border-slate-200 bg-slate-100 px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1.5">Client Secret</label>
            <input
              type="password"
              value={spotifyClientSecret}
              onChange={(e) => setSpotifyClientSecret(e.target.value)}
              placeholder="Votre Client Secret Spotify"
              className="w-full rounded-lg border border-slate-200 bg-slate-100 px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1.5">Redirect URI</label>
            <input
              type="text"
              value={spotifyRedirectUri}
              onChange={(e) => setSpotifyRedirectUri(e.target.value)}
              placeholder={typeof window !== "undefined" ? `${window.location.origin}/api/spotify/callback` : "https://votre-domaine.com/api/spotify/callback"}
              className="w-full rounded-lg border border-slate-200 bg-slate-100 px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
            />
            <p className="text-xs text-slate-400 mt-1">Doit correspondre exactement à l&apos;URL configurée dans le dashboard Spotify. Ex: <code className="text-[11px] bg-slate-100 px-1 rounded">https://comet-cedelia.duckdns.org/api/spotify/callback</code></p>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={async () => {
                setSavingSpotify(true);
                setSavedSpotify(false);
                try {
                  await fetch("/api/settings", {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      spotify_client_id: spotifyClientId,
                      spotify_client_secret: spotifyClientSecret,
                      spotify_redirect_uri: spotifyRedirectUri,
                    }),
                  });
                  setSavedSpotify(true);
                  setTimeout(() => setSavedSpotify(false), 3000);
                } finally {
                  setSavingSpotify(false);
                }
              }}
              disabled={savingSpotify}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              {savingSpotify ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Enregistrer
            </button>
            {savedSpotify && <span className="text-xs text-emerald-600">Enregistré</span>}
          </div>

          <div className="border-t border-slate-100 pt-4">
            <p className="text-sm font-medium text-slate-700 mb-3">Compte Spotify</p>
            {spotifyConnected ? (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-50 border border-green-200">
                  <div className="h-2 w-2 rounded-full bg-green-500" />
                  <span className="text-sm text-green-700 font-medium">Spotify connecté</span>
                </div>
                <button
                  onClick={async () => {
                    setDisconnectingSpotify(true);
                    try {
                      await fetch("/api/spotify/disconnect", { method: "POST" });
                      setSpotifyConnected(false);
                    } finally {
                      setDisconnectingSpotify(false);
                    }
                  }}
                  disabled={disconnectingSpotify}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium border border-red-200 text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-50 transition-colors"
                >
                  {disconnectingSpotify ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
                  Déconnecter
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="h-2 w-2 rounded-full bg-slate-400" />
                  <span className="text-sm text-slate-500">Non connecté</span>
                </div>
                <a
                  href="/api/spotify/auth"
                  onClick={async (e) => {
                    e.preventDefault();
                    setSavingSpotify(true);
                    await fetch("/api/settings", {
                      method: "PUT",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        spotify_client_id: spotifyClientId,
                        spotify_client_secret: spotifyClientSecret,
                        spotify_redirect_uri: spotifyRedirectUri,
                      }),
                    });
                    setSavingSpotify(false);
                    window.location.href = "/api/spotify/auth";
                  }}
                  className={cn(
                    "flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-colors",
                    spotifyClientId && spotifyClientSecret
                      ? "bg-green-600 text-white hover:bg-green-700"
                      : "bg-slate-200 text-slate-400 pointer-events-none"
                  )}
                >
                  <LogIn className="h-4 w-4" />
                  Connecter Spotify
                </a>
                {(!spotifyClientId || !spotifyClientSecret) && (
                  <span className="text-xs text-slate-400">Renseignez le Client ID et Secret d&apos;abord</span>
                )}
              </div>
            )}
            <p className="text-xs text-slate-400 mt-2">Un compte Spotify Premium est requis pour la lecture de musique.</p>
          </div>

          {spotifyMessage && (
            <div className={cn("p-3 rounded-lg text-sm", spotifyMessage.type === "success" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700")}>
              {spotifyMessage.text}
            </div>
          )}
        </div>}
      </div>}
      </>)}

      {activeTab === "email" && (<>
      {/* Notifications par email */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <button onClick={() => toggleSection("notifications")} className="w-full flex items-center justify-between p-6 text-left hover:bg-slate-50 transition-colors">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary-50 p-2">
              <Bell className="h-4 w-4 text-primary-600" />
            </div>
            <h3 className="text-sm font-medium text-slate-900">Notifications par email</h3>
          </div>
          <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${openSections.notifications ? "rotate-180" : ""}`} />
        </button>
        {openSections.notifications && <div className="px-6 pb-6 space-y-5 border-t border-slate-100 pt-5">

        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1.5">
            Adresses de notification
          </label>
          <input
            type="text"
            value={notifEmails}
            onChange={(e) => setNotifEmails(e.target.value)}
            placeholder="email1@exemple.com, email2@exemple.com"
            className="w-full rounded-lg border border-slate-200 bg-slate-100 px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
          <p className="text-xs text-slate-400 mt-1">Séparer les adresses par des virgules</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1.5">
            Délai de prévention (jours avant échéance)
          </label>
          <div className="flex items-center gap-3">
            <input
              type="number"
              value={notifDelay}
              onChange={(e) => setNotifDelay(e.target.value)}
              min="1"
              max="365"
              className="w-32 rounded-lg border border-slate-200 bg-slate-100 px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
            <span className="text-sm text-slate-500">jours avant la fin de garantie</span>
          </div>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={handleSaveSmtp}
            disabled={savingSmtp}
            className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50 transition-colors"
          >
            {savingSmtp ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Enregistrer
          </button>
          <button
            onClick={handleSendNotif}
            disabled={sendingNotif}
            className="flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50 transition-colors"
          >
            {sendingNotif ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Envoyer maintenant
          </button>
        </div>

        {notifResult && (
          <div className={`rounded-lg border px-4 py-2 text-sm ${
            notifResult.startsWith("Erreur")
              ? "border-red-200 bg-red-50 text-red-600"
              : "border-emerald-200 bg-emerald-50 text-emerald-600"
          }`}>
            {notifResult}
          </div>
        )}
      </div>}
      </div>

      {/* Planification des alertes email */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <button onClick={() => toggleSection("alerts")} className="w-full flex items-center justify-between p-6 text-left hover:bg-slate-50 transition-colors">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary-50 p-2">
              <CalendarClock className="h-4 w-4 text-primary-600" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-slate-900">Planification des alertes</h3>
              <p className="text-xs text-slate-400">Configurez l&apos;envoi automatique des alertes par email</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span onClick={(e) => { e.stopPropagation(); setAlertEnabled(!alertEnabled); }}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                alertEnabled ? "bg-primary-600" : "bg-slate-300"
              }`}
            >
              <span className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
                alertEnabled ? "translate-x-6" : "translate-x-1"
              }`} />
            </span>
            <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${openSections.alerts ? "rotate-180" : ""}`} />
          </div>
        </button>
        {openSections.alerts && <div className="px-6 pb-6 space-y-5 border-t border-slate-100 pt-5">

        {alertEnabled && (
          <>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-2">Fréquence d&apos;envoi</label>
                <div className="flex gap-2">
                  {[
                    { value: "daily", label: "Quotidien" },
                    { value: "weekly", label: "Hebdomadaire" },
                    { value: "monthly", label: "Mensuel" },
                  ].map((opt) => (
                    <button key={opt.value} onClick={() => setAlertFrequency(opt.value)}
                      className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                        alertFrequency === opt.value
                          ? "border-primary-500 bg-primary-50 text-primary-600"
                          : "border-slate-200 bg-slate-100 text-slate-500 hover:border-slate-300"
                      }`}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-600 mb-2">Heure d&apos;envoi</label>
                <input
                  type="time"
                  value={alertTime}
                  onChange={(e) => setAlertTime(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-slate-100 px-4 py-2 text-sm text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
              </div>

              {alertFrequency === "weekly" && (
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-2">Jour de la semaine</label>
                  <select value={alertDay} onChange={(e) => setAlertDay(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-slate-100 px-4 py-2 text-sm text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500">
                    <option value="1">Lundi</option>
                    <option value="2">Mardi</option>
                    <option value="3">Mercredi</option>
                    <option value="4">Jeudi</option>
                    <option value="5">Vendredi</option>
                    <option value="6">Samedi</option>
                    <option value="0">Dimanche</option>
                  </select>
                </div>
              )}

              {alertFrequency === "monthly" && (
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-2">Jour du mois</label>
                  <select value={alertDay} onChange={(e) => setAlertDay(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-slate-100 px-4 py-2 text-sm text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500">
                    {Array.from({ length: 28 }, (_, i) => (
                      <option key={i + 1} value={String(i + 1)}>{i + 1}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-600 mb-2">Types d&apos;alertes à envoyer</label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {[
                  { key: "expiring" as const, label: "Garanties bientôt expirées", desc: "Installations dont la garantie arrive à échéance" },
                  { key: "expired" as const, label: "Garanties expirées", desc: "Installations dont la garantie est dépassée" },
                  { key: "renewed" as const, label: "Renouvellements effectués", desc: "Installations renouvelées récemment" },
                  { key: "summary" as const, label: "Résumé hebdomadaire", desc: "Vue d'ensemble de l'état des garanties" },
                ].map((item) => (
                  <label key={item.key}
                    className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                      alertTypes[item.key] ? "border-primary-300 bg-primary-50/50" : "border-slate-200 hover:bg-slate-50"
                    }`}>
                    <input
                      type="checkbox"
                      checked={alertTypes[item.key]}
                      onChange={(e) => setAlertTypes({ ...alertTypes, [item.key]: e.target.checked })}
                      className="h-4 w-4 mt-0.5 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                    />
                    <div>
                      <p className="text-sm font-medium text-slate-700">{item.label}</p>
                      <p className="text-xs text-slate-400">{item.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-600 mb-2">Seuils d&apos;alerte (jours avant expiration)</label>
              <div className="flex flex-wrap gap-2">
                {[
                  { key: "days7" as const, label: "7 jours", active: "border-red-300 bg-red-50 text-red-600" },
                  { key: "days30" as const, label: "30 jours", active: "border-orange-300 bg-orange-50 text-orange-600" },
                  { key: "days60" as const, label: "60 jours", active: "border-amber-300 bg-amber-50 text-amber-600" },
                  { key: "days90" as const, label: "90 jours", active: "border-yellow-300 bg-yellow-50 text-yellow-600" },
                ].map((item) => (
                  <button key={item.key}
                    onClick={() => setAlertThresholds({ ...alertThresholds, [item.key]: !alertThresholds[item.key] })}
                    className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                      alertThresholds[item.key]
                        ? item.active
                        : "border-slate-200 bg-slate-100 text-slate-400"
                    }`}>
                    {alertThresholds[item.key] ? "\u2713 " : ""}{item.label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-slate-400 mt-1.5">Sélectionnez les seuils pour lesquels vous souhaitez recevoir des alertes</p>
            </div>
          </>
        )}

        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={handleSaveAlerts}
            disabled={savingAlerts}
            className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50 transition-colors"
          >
            {savingAlerts ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Enregistrer
          </button>
          <button
            onClick={handleDebugCron}
            disabled={debuggingCron}
            className="flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-500 hover:bg-slate-50 disabled:opacity-50 transition-colors"
          >
            {debuggingCron ? <Loader2 className="h-4 w-4 animate-spin" /> : <AlertTriangle className="h-4 w-4" />}
            Diagnostiquer
          </button>
          {savedAlerts && <span className="text-xs text-emerald-600">Configuration des alertes enregistrée</span>}
        </div>
        {cronDebug && (
          <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs font-mono text-slate-600 space-y-2">
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-slate-700">Diagnostic des alertes planifiées</span>
              <button onClick={() => setCronDebug(null)} className="text-slate-400 hover:text-slate-600">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <div><span className="text-slate-400">Heure Paris :</span> {String((cronDebug as Record<string, unknown>).parisTime || "—")}</div>
            <div><span className="text-slate-400">CRON_SECRET :</span> {String((cronDebug as Record<string, unknown>).cronSecret || "—")}</div>
            <div className="pt-1"><span className="text-slate-400">Paramètres enregistrés :</span></div>
            <pre className="bg-white rounded p-2 border border-slate-100 overflow-x-auto">{JSON.stringify((cronDebug as Record<string, unknown>).alertSettings, null, 2)}</pre>
            <div className="pt-1"><span className="text-slate-400">Derniers logs :</span></div>
            <pre className="bg-white rounded p-2 border border-slate-100 overflow-x-auto max-h-40 overflow-y-auto">{JSON.stringify((cronDebug as Record<string, unknown>).recentLogs, null, 2)}</pre>
          </div>
        )}
      </div>}
      </div>

      {/* Alertes quota de sauvegarde — emails clients */}
      {isAdmin && (
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <button onClick={() => toggleSection("quotaAlerts")} className="w-full flex items-center justify-between p-6 text-left hover:bg-slate-50 transition-colors">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-amber-50 p-2">
              <HardDrive className="h-4 w-4 text-amber-600" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-slate-900">Alertes quota de sauvegarde</h3>
              <p className="text-xs text-slate-400">Envoyez un email aux clients quand leur quota approche ou dépasse la limite</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span onClick={(e) => { e.stopPropagation(); setQuotaAlertEnabled(!quotaAlertEnabled); }}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                quotaAlertEnabled ? "bg-primary-600" : "bg-slate-300"
              }`}
            >
              <span className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
                quotaAlertEnabled ? "translate-x-6" : "translate-x-1"
              }`} />
            </span>
            <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${openSections.quotaAlerts ? "rotate-180" : ""}`} />
          </div>
        </button>
        {openSections.quotaAlerts && <div className="px-6 pb-6 space-y-5 border-t border-slate-100 pt-5">

        {/* Seuils + Mode */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="h-2.5 w-2.5 rounded-full bg-amber-400" />
              <span className="text-sm font-medium text-amber-700">Seuil avertissement</span>
            </div>
            <p className="text-xs text-amber-600/70 mb-2">Approche de la limite</p>
            <div className="flex items-center gap-2">
              <input type="number" value={quotaWarning} onChange={(e) => setQuotaWarning(e.target.value)} min="1" max="100"
                className="w-20 rounded-lg border border-amber-200 bg-white px-3 py-1.5 text-sm text-slate-900 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400" />
              <span className="text-sm text-amber-600">%</span>
            </div>
          </div>
          <div className="rounded-lg border border-red-200 bg-red-50/50 p-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="h-2.5 w-2.5 rounded-full bg-red-500" />
              <span className="text-sm font-medium text-red-700">Seuil dépassement</span>
            </div>
            <p className="text-xs text-red-600/70 mb-2">Quota atteint ou dépassé</p>
            <div className="flex items-center gap-2">
              <input type="number" value={quotaExceeded} onChange={(e) => setQuotaExceeded(e.target.value)} min="1" max="200"
                className="w-20 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-sm text-slate-900 focus:border-red-400 focus:outline-none focus:ring-1 focus:ring-red-400" />
              <span className="text-sm text-red-600">%</span>
            </div>
          </div>
        </div>

        {/* Mode d'envoi */}
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-2">Mode d&apos;envoi</label>
          <div className="flex gap-2 mb-3">
            <button onClick={() => setQuotaAutoSend(true)} className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${quotaAutoSend ? "border-primary-500 bg-primary-50 text-primary-600" : "border-slate-200 bg-slate-100 text-slate-500 hover:border-slate-300"}`}>
              Automatique
            </button>
            <button onClick={() => setQuotaAutoSend(false)} className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${!quotaAutoSend ? "border-primary-500 bg-primary-50 text-primary-600" : "border-slate-200 bg-slate-100 text-slate-500 hover:border-slate-300"}`}>
              Manuel uniquement
            </button>
          </div>
          <p className="text-xs text-slate-400">{quotaAutoSend ? "Les emails sont envoyés automatiquement aux clients après chaque collecte Oxibox" : "Vous choisissez manuellement à qui envoyer depuis le tableau ci-dessous"}</p>
        </div>

        {/* Fréquence de rappel */}
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-2">Fréquence de rappel</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className={`flex items-start gap-3 rounded-lg border p-4 cursor-pointer transition-colors ${
              quotaRepeatMode === "once" ? "border-primary-300 bg-primary-50/50 ring-1 ring-primary-200" : "border-slate-200 hover:bg-slate-50"
            }`}>
              <input type="radio" name="quotaRepeat" checked={quotaRepeatMode === "once"} onChange={() => setQuotaRepeatMode("once")}
                className="h-4 w-4 mt-0.5 border-slate-300 text-primary-600 focus:ring-primary-500" />
              <div>
                <p className="text-sm font-medium text-slate-700">Un seul envoi</p>
                <p className="text-xs text-slate-400 mt-0.5">Le client reçoit un seul email par niveau d&apos;alerte. Pas de rappel tant que le niveau ne change pas.</p>
              </div>
            </label>
            <label className={`flex items-start gap-3 rounded-lg border p-4 cursor-pointer transition-colors ${
              quotaRepeatMode === "recurring" ? "border-primary-300 bg-primary-50/50 ring-1 ring-primary-200" : "border-slate-200 hover:bg-slate-50"
            }`}>
              <input type="radio" name="quotaRepeat" checked={quotaRepeatMode === "recurring"} onChange={() => setQuotaRepeatMode("recurring")}
                className="h-4 w-4 mt-0.5 border-slate-300 text-primary-600 focus:ring-primary-500" />
              <div>
                <p className="text-sm font-medium text-slate-700">Rappels récurrents</p>
                <p className="text-xs text-slate-400 mt-0.5">Le client reçoit un rappel tous les X jours tant que le quota dépasse le seuil.</p>
              </div>
            </label>
          </div>
          {quotaRepeatMode === "recurring" && (
            <div className="mt-3 flex items-center gap-2 pl-1">
              <span className="text-sm text-slate-600">Rappeler tous les</span>
              <input type="number" value={quotaRepeatDays} onChange={(e) => setQuotaRepeatDays(e.target.value)} min="1" max="90"
                className="w-20 rounded-lg border border-slate-200 bg-slate-100 px-3 py-1.5 text-sm text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500" />
              <span className="text-sm text-slate-600">jours</span>
            </div>
          )}
        </div>

        {/* Options destinataires */}
        <div className="space-y-2">
          <label className="flex items-center gap-2.5 cursor-pointer rounded-lg border border-slate-200 p-3 hover:bg-slate-50 transition-colors">
            <input type="checkbox" checked={quotaSendToPortal} onChange={(e) => setQuotaSendToPortal(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500" />
            <div>
              <span className="text-sm text-slate-700">Envoyer aussi aux utilisateurs portail du client</span>
              <p className="text-xs text-slate-400">Tous les utilisateurs actifs du portail recevront l&apos;email</p>
            </div>
          </label>
          <label className="flex items-center gap-2.5 cursor-pointer rounded-lg border border-slate-200 p-3 hover:bg-slate-50 transition-colors">
            <input type="checkbox" checked={quotaCcAdmins} onChange={(e) => setQuotaCcAdmins(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500" />
            <div>
              <span className="text-sm text-slate-700">Mettre les administrateurs en copie (CC)</span>
              <p className="text-xs text-slate-400">Les adresses de notification générales recevront une copie</p>
            </div>
          </label>
        </div>

        {/* Templates email */}
        <div className="border-t border-slate-100 pt-5">
          <label className="block text-sm font-medium text-slate-600 mb-2">Personnalisation des emails</label>
          <p className="text-xs text-slate-400 mb-3">
            Variables : <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-600">{"{clientName}"}</code> <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-600">{"{usagePercent}"}</code> <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-600">{"{currentUsage}"}</code> <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-600">{"{allocatedQuota}"}</code>
          </p>

          <div className="rounded-lg border border-amber-100 bg-amber-50/30 p-4 mb-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-2 w-2 rounded-full bg-amber-400" />
              <span className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Email d&apos;avertissement</span>
            </div>
            <div className="space-y-3">
              <div><label className="block text-xs text-slate-500 mb-1">Objet</label>
                <input type="text" value={quotaSubjectWarning} onChange={(e) => setQuotaSubjectWarning(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400" /></div>
              <div><label className="block text-xs text-slate-500 mb-1">Contenu</label>
                <textarea value={quotaBodyWarning} onChange={(e) => setQuotaBodyWarning(e.target.value)} rows={4}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400 resize-y" /></div>
            </div>
          </div>

          <div className="rounded-lg border border-red-100 bg-red-50/30 p-4 mb-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-2 w-2 rounded-full bg-red-500" />
              <span className="text-xs font-semibold text-red-700 uppercase tracking-wide">Email de dépassement</span>
            </div>
            <div className="space-y-3">
              <div><label className="block text-xs text-slate-500 mb-1">Objet</label>
                <input type="text" value={quotaSubjectExceeded} onChange={(e) => setQuotaSubjectExceeded(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-red-400 focus:outline-none focus:ring-1 focus:ring-red-400" /></div>
              <div><label className="block text-xs text-slate-500 mb-1">Contenu</label>
                <textarea value={quotaBodyExceeded} onChange={(e) => setQuotaBodyExceeded(e.target.value)} rows={4}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-red-400 focus:outline-none focus:ring-1 focus:ring-red-400 resize-y" /></div>
            </div>
          </div>

          <div><label className="block text-xs text-slate-500 mb-1">Pied de page</label>
            <input type="text" value={quotaEmailFooter} onChange={(e) => setQuotaEmailFooter(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500" /></div>
        </div>

        {/* Zone de test */}
        <div className="border-t border-slate-100 pt-5">
          <label className="block text-sm font-medium text-slate-600 mb-3">Test & aperçu</label>
          <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-4 space-y-3">
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex-1 min-w-[200px]">
                <label className="block text-xs text-slate-500 mb-1">Email de test</label>
                <input type="email" value={quotaTestEmail} onChange={(e) => setQuotaTestEmail(e.target.value)}
                  placeholder="votre@email.com"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500" />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Type de mail</label>
                <div className="flex gap-1">
                  <button onClick={() => setQuotaTestType("warning")}
                    className={`rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${quotaTestType === "warning" ? "border-amber-300 bg-amber-50 text-amber-700" : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"}`}>
                    Avertissement
                  </button>
                  <button onClick={() => setQuotaTestType("exceeded")}
                    className={`rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${quotaTestType === "exceeded" ? "border-red-300 bg-red-50 text-red-700" : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"}`}>
                    Dépassement
                  </button>
                </div>
              </div>
              <button onClick={handleSendQuotaTest} disabled={sendingQuotaTest || !quotaTestEmail}
                className="flex items-center gap-1.5 rounded-lg bg-slate-700 px-4 py-2 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50 transition-colors">
                {sendingQuotaTest ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                Envoyer le test
              </button>
              <button onClick={handlePreviewQuotaHtml} disabled={loadingQuotaPreviewHtml}
                className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50 transition-colors">
                {loadingQuotaPreviewHtml ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />}
                Aperçu
              </button>
            </div>
            {quotaTestResult && (
              <div className={`rounded-lg border px-3 py-2 text-xs ${
                quotaTestResult.includes("Erreur") ? "border-red-200 bg-red-50 text-red-600" : "border-emerald-200 bg-emerald-50 text-emerald-600"
              }`}>{quotaTestResult}</div>
            )}
            {quotaPreviewHtml && (
              <div className="mt-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-slate-500">Aperçu de l&apos;email ({quotaTestType === "exceeded" ? "dépassement" : "avertissement"})</span>
                  <button onClick={() => setQuotaPreviewHtml(null)} className="text-slate-400 hover:text-slate-600"><X className="h-3.5 w-3.5" /></button>
                </div>
                <div className="rounded-lg border border-slate-200 bg-white overflow-hidden shadow-sm">
                  <iframe srcDoc={quotaPreviewHtml} className="w-full border-0" style={{ height: "420px" }} title="Aperçu email" />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Actions principales */}
        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100">
          <button onClick={handleSaveQuotaAlerts} disabled={savingQuota}
            className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50 transition-colors">
            {savingQuota ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Enregistrer
          </button>
          <button onClick={handleLoadQuotaClients} disabled={loadingQuotaClients}
            className="flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50 transition-colors">
            {loadingQuotaClients ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
            Voir les clients concernés
          </button>
          <button onClick={handleLoadQuotaHistory} disabled={loadingQuotaHistory}
            className="flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors">
            {loadingQuotaHistory ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarClock className="h-4 w-4" />}
            Historique
          </button>
          {savedQuota && <span className="text-xs text-emerald-600">Configuration enregistrée</span>}
        </div>

        {/* Résultat envoi */}
        {quotaAlertResult && (
          <div className={`rounded-lg border px-4 py-2.5 text-sm ${
            quotaAlertResult.includes("Erreur") ? "border-red-200 bg-red-50 text-red-600"
            : quotaAlertResult.includes("succès") || quotaAlertResult.includes("envoyé") ? "border-emerald-200 bg-emerald-50 text-emerald-600"
            : "border-amber-200 bg-amber-50 text-amber-600"
          }`}>
            {quotaAlertResult}
          </div>
        )}

        {/* Tableau des clients concernés */}
        {quotaClients.length > 0 && (
          <div className="rounded-lg border border-slate-200 overflow-hidden">
            <div className="bg-slate-50 px-4 py-3 flex items-center justify-between border-b border-slate-200">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-slate-700">{quotaClients.length} client(s) au-dessus des seuils</span>
                {quotaSelectedIds.size > 0 && (
                  <span className="text-xs bg-primary-100 text-primary-700 px-2 py-0.5 rounded-full font-medium">{quotaSelectedIds.size} sélectionné(s)</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {quotaSelectedIds.size > 0 && (
                  <button onClick={handleSendToSelected} disabled={sendingQuotaAlert}
                    className="flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700 disabled:opacity-50 transition-colors">
                    {sendingQuotaAlert ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                    Envoyer aux sélectionnés
                  </button>
                )}
                <button onClick={() => { setQuotaClients([]); setQuotaSelectedIds(new Set()); }} className="text-slate-400 hover:text-slate-600">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Header */}
            <div className="grid grid-cols-[32px_1fr_1fr_100px_120px_80px] gap-2 px-4 py-2 bg-slate-50/50 border-b border-slate-100 text-[11px] font-medium text-slate-400 uppercase tracking-wide">
              <div className="flex items-center">
                <input type="checkbox"
                  checked={quotaSelectedIds.size === quotaClients.filter(c => c.clientEmail).length && quotaClients.filter(c => c.clientEmail).length > 0}
                  onChange={toggleQuotaSelectAll}
                  className="h-3.5 w-3.5 rounded border-slate-300 text-primary-600 focus:ring-primary-500" />
              </div>
              <div>Client</div>
              <div>Utilisation</div>
              <div>Type</div>
              <div>Dernier envoi</div>
              <div>Statut</div>
            </div>

            {/* Rows */}
            <div className="max-h-[400px] overflow-y-auto divide-y divide-slate-100">
              {quotaClients.map((client) => {
                const isSelected = quotaSelectedIds.has(client.organizationId);
                const hasEmail = !!client.clientEmail;
                const lastAlert = client.lastAlert;
                const barWidth = Math.min(client.usagePercent, 100);
                const isExceeded = client.alertLevel === "exceeded";
                const barColor = isExceeded ? "bg-red-500" : "bg-amber-400";

                return (
                  <div key={client.organizationId}
                    className={cn(
                      "grid grid-cols-[32px_1fr_1fr_100px_120px_80px] gap-2 px-4 py-3 items-center transition-colors",
                      isSelected ? "bg-primary-50/50" : "hover:bg-slate-50",
                      !hasEmail && "opacity-60",
                    )}>
                    <div>
                      <input type="checkbox" disabled={!hasEmail} checked={isSelected}
                        onChange={() => toggleQuotaSelect(client.organizationId)}
                        className="h-3.5 w-3.5 rounded border-slate-300 text-primary-600 focus:ring-primary-500 disabled:opacity-30" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{client.clientName || client.organizationId}</p>
                      {hasEmail ? (
                        <p className="text-xs text-slate-400 truncate">{client.clientEmail}</p>
                      ) : (
                        <p className="text-xs text-red-400">Pas d&apos;email</p>
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${barColor}`} style={{ width: `${barWidth}%` }} />
                        </div>
                        <span className={`text-xs font-bold ${isExceeded ? "text-red-600" : "text-amber-600"}`}>{client.usagePercent}%</span>
                      </div>
                      <p className="text-[11px] text-slate-400">{client.currentUsage} / {client.allocatedQuota}</p>
                    </div>
                    <div>
                      <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-full ${
                        isExceeded ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"
                      }`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${isExceeded ? "bg-red-500" : "bg-amber-500"}`} />
                        {isExceeded ? "Dépassé" : "Attention"}
                      </span>
                    </div>
                    <div>
                      {lastAlert ? (
                        <div>
                          <p className="text-xs text-slate-600">{new Date(lastAlert.sentAt).toLocaleDateString("fr-FR")}</p>
                          <p className="text-[10px] text-slate-400">{new Date(lastAlert.sentAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })} — {lastAlert.manual ? "Manuel" : "Auto"}</p>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-300">—</span>
                      )}
                    </div>
                    <div>
                      {lastAlert ? (
                        <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-full ${
                          lastAlert.alertType === "exceeded"
                            ? "bg-red-50 text-red-600 border border-red-200"
                            : "bg-amber-50 text-amber-600 border border-amber-200"
                        }`}>
                          <Check className="h-3 w-3" />
                          Envoyé
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-full bg-slate-100 text-slate-400">
                          Jamais
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Historique des envois */}
        {showQuotaHistory && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-slate-700">Historique des envois ({quotaHistoryTotal})</span>
              <button onClick={() => setShowQuotaHistory(false)} className="text-slate-400 hover:text-slate-600"><X className="h-3.5 w-3.5" /></button>
            </div>
            {loadingQuotaHistory ? (
              <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>
            ) : quotaHistory.length === 0 ? (
              <p className="text-sm text-slate-400">Aucune alerte envoyée.</p>
            ) : (
              <div className="space-y-1.5 max-h-72 overflow-y-auto">
                {quotaHistory.map((alert) => (
                  <div key={alert.id} className="flex items-center justify-between rounded-lg bg-white border border-slate-100 px-3 py-2.5 text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`h-2 w-2 rounded-full flex-shrink-0 ${alert.alertType === "exceeded" ? "bg-red-500" : "bg-amber-400"}`} />
                      <span className="font-medium text-slate-700 truncate">{alert.clientName || alert.organizationId}</span>
                      <span className={`flex-shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium ${alert.alertType === "exceeded" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
                        {alert.alertType === "exceeded" ? "Dépassé" : "Avertissement"}
                      </span>
                      <span className="text-slate-400 flex-shrink-0">{alert.usagePercent}%</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-400 flex-shrink-0 ml-2">
                      <span className="text-[10px] truncate max-w-[140px]" title={alert.recipients?.join(", ")}>{alert.recipients?.[0]}</span>
                      {alert.manual && <span className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">Manuel</span>}
                      {!alert.manual && <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">Auto</span>}
                      <span>{new Date(alert.sentAt).toLocaleDateString("fr-FR")} {new Date(alert.sentAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>}
      </div>
      )}
      </>)}

      {activeTab === "reports" && (<>
      {/* Personnalisation du rapport */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <button onClick={() => toggleSection("report")} className="w-full flex items-center justify-between p-6 text-left hover:bg-slate-50 transition-colors">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary-50 p-2">
              <FileText className="h-4 w-4 text-primary-600" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-slate-900">Personnalisation du rapport client</h3>
              <p className="text-xs text-slate-400">Personnalisez la première page du rapport imprimable depuis la fiche client.</p>
            </div>
          </div>
          <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${openSections.report ? "rotate-180" : ""}`} />
        </button>
        {openSections.report && <div className="px-6 pb-6 space-y-5 border-t border-slate-100 pt-5">

        {/* Template selector */}
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-3">
            Modèle de page de garde
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* Classic card */}
            <button
              onClick={() => setCoverTemplate("classic")}
              className={`relative rounded-xl border-2 p-4 text-left transition-all ${
                coverTemplate === "classic"
                  ? "border-primary-500 bg-primary-50 ring-1 ring-primary-200"
                  : "border-slate-200 bg-white hover:border-slate-300"
              }`}
            >
              {coverTemplate === "classic" && (
                <div className="absolute top-2.5 right-2.5 rounded-full bg-primary-600 p-0.5">
                  <Check className="h-3 w-3 text-white" />
                </div>
              )}
              <div className="flex flex-col items-center gap-3">
                <div className="w-full h-28 rounded-lg border border-slate-200 bg-white flex flex-col items-center justify-center gap-1.5 px-3">
                  <div className="w-10 h-5 rounded bg-slate-200" />
                  <div className="w-24 h-2.5 rounded bg-slate-300" />
                  <div className="w-28 h-3 rounded bg-primary-300 mt-1" />
                  <div className="w-16 h-2 rounded bg-slate-200 mt-0.5" />
                  <div className="w-12 h-2 rounded bg-slate-100 mt-1" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">Classique</p>
                  <p className="text-xs text-slate-400 mt-0.5">Logo centré, titre et nom du client.</p>
                </div>
              </div>
            </button>
            {/* Corporate card */}
            <button
              onClick={() => setCoverTemplate("corporate")}
              className={`relative rounded-xl border-2 p-4 text-left transition-all ${
                coverTemplate === "corporate"
                  ? "border-primary-500 bg-primary-50 ring-1 ring-primary-200"
                  : "border-slate-200 bg-white hover:border-slate-300"
              }`}
            >
              {coverTemplate === "corporate" && (
                <div className="absolute top-2.5 right-2.5 rounded-full bg-primary-600 p-0.5">
                  <Check className="h-3 w-3 text-white" />
                </div>
              )}
              <div className="flex flex-col items-center gap-3">
                <div className="w-full h-28 rounded-lg border border-slate-200 bg-white flex flex-col items-center justify-center gap-1.5 px-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-5 rounded bg-slate-200" />
                    <div className="w-px h-6 bg-primary-400" />
                    <div className="w-8 h-5 rounded bg-slate-200" />
                  </div>
                  <div className="w-20 h-2.5 rounded bg-slate-800 mt-1" />
                  <div className="w-24 h-px bg-primary-400 mt-0.5" />
                  <div className="w-16 h-2 rounded bg-slate-200 mt-0.5" />
                  <div className="w-14 h-2 rounded bg-slate-100 mt-1" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">Corporate</p>
                  <p className="text-xs text-slate-400 mt-0.5">Logos côte à côte, trait de séparation.</p>
                </div>
              </div>
            </button>
            {/* Executive card */}
            <button
              onClick={() => setCoverTemplate("executive")}
              className={`relative rounded-xl border-2 p-4 text-left transition-all ${
                coverTemplate === "executive"
                  ? "border-primary-500 bg-primary-50 ring-1 ring-primary-200"
                  : "border-slate-200 bg-white hover:border-slate-300"
              }`}
            >
              {coverTemplate === "executive" && (
                <div className="absolute top-2.5 right-2.5 rounded-full bg-primary-600 p-0.5">
                  <Check className="h-3 w-3 text-white" />
                </div>
              )}
              <div className="flex flex-col items-center gap-3">
                <div className="w-full h-28 rounded-lg border border-slate-200 bg-white relative overflow-hidden">
                  {/* Diagonal band */}
                  <div className="absolute -left-4 bottom-0 w-[60%] h-full bg-primary-500 origin-bottom-left" style={{ transform: "skewX(-12deg)" }} />
                  <div className="absolute left-3 bottom-3 flex flex-col gap-1 z-10">
                    <div className="w-6 h-3 rounded-sm bg-white/80" />
                    <div className="w-16 h-2 rounded bg-white/90" />
                    <div className="w-12 h-1.5 rounded bg-white/60" />
                  </div>
                  <div className="absolute right-3 top-3 z-10">
                    <div className="w-7 h-4 rounded-sm bg-slate-200" />
                  </div>
                  <div className="absolute right-3 bottom-4 z-10">
                    <div className="w-10 h-1.5 rounded bg-slate-300" />
                  </div>
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">Executive</p>
                  <p className="text-xs text-slate-400 mt-0.5">Bande colorée diagonale, design premium.</p>
                </div>
              </div>
            </button>
            {/* Custom editor card */}
            <button
              onClick={() => { setCoverTemplate("custom"); window.open("/settings/cover-editor", "_blank"); }}
              className={`relative rounded-xl border-2 p-4 text-left transition-all ${
                coverTemplate === "custom"
                  ? "border-primary-500 bg-primary-50 ring-1 ring-primary-200"
                  : "border-slate-200 bg-white hover:border-slate-300"
              }`}
            >
              {coverTemplate === "custom" && (
                <div className="absolute top-2.5 right-2.5 rounded-full bg-primary-600 p-0.5">
                  <Check className="h-3 w-3 text-white" />
                </div>
              )}
              <div className="flex flex-col items-center gap-3">
                <div className="w-full h-28 rounded-lg border border-slate-200 bg-gradient-to-br from-primary-50 to-violet-50 flex flex-col items-center justify-center gap-1">
                  <Palette className="h-6 w-6 text-primary-400" />
                  <div className="flex items-center gap-1">
                    <div className="w-4 h-4 rounded bg-primary-200/60" />
                    <div className="w-6 h-1.5 rounded bg-primary-300/60" />
                    <div className="w-3 h-3 rounded-full bg-violet-200/60" />
                  </div>
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">Personnalisé</p>
                  <p className="text-xs text-slate-400 mt-0.5">Éditeur visuel drag & drop.</p>
                </div>
              </div>
            </button>
          </div>
          {coverTemplate === "custom" && (
            <a href="/settings/cover-editor" target="_blank" className="inline-flex items-center gap-1.5 mt-2 text-sm text-primary-600 hover:text-primary-700 font-medium">
              <Palette className="h-4 w-4" /> Ouvrir l&apos;éditeur visuel
            </a>
          )}
        </div>

        {/* Corporate-specific settings */}
        {coverTemplate === "corporate" && (
          <div className="rounded-lg border border-primary-100 bg-primary-50/30 p-4 space-y-5">
            <p className="text-xs font-semibold text-primary-700 uppercase tracking-wider">Options du modèle Corporate</p>

            {/* Textes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1.5">Titre</label>
                <input type="text" value={corporateTitle} onChange={(e) => setCorporateTitle(e.target.value)} placeholder="Rapport client" className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1.5">Accroche</label>
                <input type="text" value={corporateTagline} onChange={(e) => setCorporateTagline(e.target.value)} placeholder="Ex: Suivi des garanties et échéances" className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500" />
              </div>
            </div>

            {/* Logos */}
            <div>
              <p className="text-xs font-medium text-slate-500 mb-2">Logos</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Hauteur max ({corpLogoHeight}px)</label>
                  <input type="range" min="40" max="200" value={corpLogoHeight} onChange={(e) => setCorpLogoHeight(e.target.value)} className="w-full accent-primary-600" />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Espacement ({corpLogoGap}px)</label>
                  <input type="range" min="10" max="80" value={corpLogoGap} onChange={(e) => setCorpLogoGap(e.target.value)} className="w-full accent-primary-600" />
                </div>
              </div>
            </div>

            {/* Trait vertical (séparateur logos) */}
            <div>
              <p className="text-xs font-medium text-slate-500 mb-2">Trait vertical (entre les logos)</p>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Hauteur ({corpDividerHeight}px)</label>
                  <input type="range" min="20" max="150" value={corpDividerHeight} onChange={(e) => setCorpDividerHeight(e.target.value)} className="w-full accent-primary-600" />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Épaisseur ({corpDividerWidth}px)</label>
                  <input type="range" min="0.5" max="5" step="0.5" value={corpDividerWidth} onChange={(e) => setCorpDividerWidth(e.target.value)} className="w-full accent-primary-600" />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Couleur</label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={corpDividerColor || reportPrimaryColor} onChange={(e) => setCorpDividerColor(e.target.value)} className="w-8 h-8 rounded border border-slate-200 cursor-pointer" />
                    <button onClick={() => setCorpDividerColor("")} className="text-xs text-slate-400 hover:text-slate-600">Auto</button>
                  </div>
                </div>
              </div>
            </div>

            {/* Taille et couleur du titre */}
            <div>
              <p className="text-xs font-medium text-slate-500 mb-2">Titre principal</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Taille ({corpTitleSize}px)</label>
                  <input type="range" min="20" max="60" value={corpTitleSize} onChange={(e) => setCorpTitleSize(e.target.value)} className="w-full accent-primary-600" />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Couleur</label>
                  <input type="color" value={corpTitleColor} onChange={(e) => setCorpTitleColor(e.target.value)} className="w-8 h-8 rounded border border-slate-200 cursor-pointer" />
                </div>
              </div>
            </div>

            {/* Nom du client */}
            <div>
              <p className="text-xs font-medium text-slate-500 mb-2">Nom du client</p>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Taille ({corpNameSize}px)</label>
                <input type="range" min="16" max="50" value={corpNameSize} onChange={(e) => setCorpNameSize(e.target.value)} className="w-full accent-primary-600" />
              </div>
            </div>

            {/* Ligne horizontale */}
            <div>
              <p className="text-xs font-medium text-slate-500 mb-2">Trait horizontal</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Largeur ({corpHrWidth}px)</label>
                  <input type="range" min="50" max="500" value={corpHrWidth} onChange={(e) => setCorpHrWidth(e.target.value)} className="w-full accent-primary-600" />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Épaisseur ({corpHrHeight}px)</label>
                  <input type="range" min="1" max="6" value={corpHrHeight} onChange={(e) => setCorpHrHeight(e.target.value)} className="w-full accent-primary-600" />
                </div>
              </div>
            </div>

            {/* Accroche et date */}
            <div>
              <p className="text-xs font-medium text-slate-500 mb-2">Accroche et date</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Taille accroche ({corpTaglineSize}px)</label>
                  <input type="range" min="10" max="24" value={corpTaglineSize} onChange={(e) => setCorpTaglineSize(e.target.value)} className="w-full accent-primary-600" />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Taille date ({corpDateSize}px)</label>
                  <input type="range" min="10" max="22" value={corpDateSize} onChange={(e) => setCorpDateSize(e.target.value)} className="w-full accent-primary-600" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Executive-specific settings */}
        {coverTemplate === "executive" && (
          <div className="rounded-lg border border-primary-100 bg-primary-50/30 p-4 space-y-5">
            <p className="text-xs font-semibold text-primary-700 uppercase tracking-wider">Options du modèle Executive</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1.5">Titre</label>
                <input type="text" value={execTitle} onChange={(e) => setExecTitle(e.target.value)} placeholder="Rapport client" className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1.5">Sous-titre</label>
                <input type="text" value={execSubtitle} onChange={(e) => setExecSubtitle(e.target.value)} placeholder="Ex: Suivi des garanties informatiques" className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500" />
              </div>
            </div>

            <div>
              <p className="text-xs font-medium text-slate-500 mb-2">Bande diagonale</p>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Largeur ({execBandWidth}%)</label>
                  <input type="range" min="25" max="65" value={execBandWidth} onChange={(e) => setExecBandWidth(e.target.value)} className="w-full accent-primary-600" />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Inclinaison ({execBandAngle}deg)</label>
                  <input type="range" min="5" max="25" value={execBandAngle} onChange={(e) => setExecBandAngle(e.target.value)} className="w-full accent-primary-600" />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Couleur</label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={execBandColor || reportPrimaryColor} onChange={(e) => setExecBandColor(e.target.value)} className="w-8 h-8 rounded border border-slate-200 cursor-pointer" />
                    <button onClick={() => setExecBandColor("")} className="text-xs text-slate-400 hover:text-slate-600">Auto</button>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <p className="text-xs font-medium text-slate-500 mb-2">Typographie</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Taille titre ({execTitleSize}px)</label>
                  <input type="range" min="28" max="64" value={execTitleSize} onChange={(e) => setExecTitleSize(e.target.value)} className="w-full accent-primary-600" />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Taille sous-titre ({execSubtitleSize}px)</label>
                  <input type="range" min="12" max="28" value={execSubtitleSize} onChange={(e) => setExecSubtitleSize(e.target.value)} className="w-full accent-primary-600" />
                </div>
              </div>
            </div>

            <div>
              <p className="text-xs font-medium text-slate-500 mb-2">Trait d&apos;accent</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Largeur ({execAccentWidth}px)</label>
                  <input type="range" min="30" max="120" value={execAccentWidth} onChange={(e) => setExecAccentWidth(e.target.value)} className="w-full accent-primary-600" />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Épaisseur ({execAccentHeight}px)</label>
                  <input type="range" min="2" max="8" value={execAccentHeight} onChange={(e) => setExecAccentHeight(e.target.value)} className="w-full accent-primary-600" />
                </div>
              </div>
            </div>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1.5">
            Logo de votre société
          </label>
          <div className="flex items-center gap-4">
            {companyLogo ? (
              <div className="relative group">
                <img
                  src={companyLogo}
                  alt="Logo société"
                  className="h-20 w-auto max-w-[200px] rounded-lg bg-white p-2 border border-slate-200 object-contain"
                />
                <button
                  onClick={() => setCompanyLogo("")}
                  className="absolute -top-1.5 -right-1.5 rounded-full bg-red-500 p-0.5 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => companyLogoRef.current?.click()}
                className="flex h-20 w-40 items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-200 text-slate-400 hover:border-primary-500 hover:text-primary-600 transition-colors"
              >
                <ImageIcon className="h-5 w-5" />
                <span className="text-xs">Ajouter un logo</span>
              </button>
            )}
            {companyLogo && (
              <button
                onClick={() => companyLogoRef.current?.click()}
                className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-500 hover:bg-slate-50 transition-colors"
              >
                <Upload className="h-3.5 w-3.5" />
                Changer
              </button>
            )}
          </div>
          <input
            ref={companyLogoRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              if (file.size > 2 * 1024 * 1024) { alert("Max 2 Mo"); return; }
              const reader = new FileReader();
              reader.onload = () => setCompanyLogo(reader.result as string);
              reader.readAsDataURL(file);
            }}
          />
          <p className="text-xs text-slate-400 mt-1">Ce logo apparaîtra sur la page de garde du rapport (max 2 Mo)</p>
        </div>

        {companyLogo && (
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1.5">
                Position du logo société
              </label>
              <select
                value={companyLogoPosition}
                onChange={(e) => setCompanyLogoPosition(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-slate-100 px-3 py-2.5 text-sm text-slate-900 focus:border-primary-500 focus:outline-none"
              >
                <option value="top-left">Gauche</option>
                <option value="top-center">Centre</option>
                <option value="top-right">Droite</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1.5">
                Taille ({companyLogoSize}px)
              </label>
              <input
                type="range"
                min="60"
                max="400"
                step="10"
                value={companyLogoSize}
                onChange={(e) => setCompanyLogoSize(e.target.value)}
                className="w-full h-2 rounded-lg appearance-none bg-slate-200 accent-primary-600"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1.5">
                Hauteur ({companyLogoTop}%)
              </label>
              <input
                type="range"
                min="0"
                max="90"
                step="1"
                value={companyLogoTop}
                onChange={(e) => setCompanyLogoTop(e.target.value)}
                className="w-full h-2 rounded-lg appearance-none bg-slate-200 accent-primary-600"
              />
            </div>
          </div>
        )}

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1.5">
              Position du logo client
            </label>
            <select
              value={clientLogoPosition}
              onChange={(e) => setClientLogoPosition(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-slate-100 px-3 py-2.5 text-sm text-slate-900 focus:border-primary-500 focus:outline-none"
            >
              <option value="top-left">Gauche</option>
              <option value="top-center">Centre</option>
              <option value="top-right">Droite</option>
            </select>
            <p className="text-xs text-slate-400 mt-1">Logo défini sur la fiche client</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1.5">
              Taille ({clientLogoSize}px)
            </label>
            <input
              type="range"
              min="60"
              max="400"
              step="10"
              value={clientLogoSize}
              onChange={(e) => setClientLogoSize(e.target.value)}
              className="w-full h-2 rounded-lg appearance-none bg-slate-200 accent-primary-600"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1.5">
              Hauteur ({clientLogoTop}%)
            </label>
            <input
              type="range"
              min="0"
              max="90"
              step="1"
              value={clientLogoTop}
              onChange={(e) => setClientLogoTop(e.target.value)}
              className="w-full h-2 rounded-lg appearance-none bg-slate-200 accent-primary-600"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1.5">
            Image de fond de la page de garde
          </label>
          <div className="flex items-center gap-4">
            {reportCoverBg ? (
              <div className="relative group">
                <img
                  src={reportCoverBg}
                  alt="Fond page de garde"
                  className="h-24 w-auto max-w-[300px] rounded-lg bg-white border border-slate-200 object-cover"
                />
                <button
                  onClick={() => setReportCoverBg("")}
                  className="absolute -top-1.5 -right-1.5 rounded-full bg-red-500 p-0.5 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => reportCoverBgRef.current?.click()}
                className="flex h-24 w-48 items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-200 text-slate-400 hover:border-primary-500 hover:text-primary-600 transition-colors"
              >
                <ImageIcon className="h-5 w-5" />
                <span className="text-xs">Ajouter une image</span>
              </button>
            )}
            {reportCoverBg && (
              <button
                onClick={() => reportCoverBgRef.current?.click()}
                className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-500 hover:bg-slate-50 transition-colors"
              >
                <Upload className="h-3.5 w-3.5" />
                Changer
              </button>
            )}
          </div>
          <input
            ref={reportCoverBgRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              if (file.size > 5 * 1024 * 1024) { alert("Max 5 Mo"); return; }
              const reader = new FileReader();
              reader.onload = () => setReportCoverBg(reader.result as string);
              reader.readAsDataURL(file);
            }}
          />
          <p className="text-xs text-slate-400 mt-1">Image affichée en fond de la première page du rapport (max 5 Mo, recommandé : 1920x1080)</p>
        </div>

        {reportCoverBg && (
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1.5">
              Opacité de l&apos;image de fond ({reportCoverBgOpacity}%)
            </label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="5"
                max="100"
                value={reportCoverBgOpacity}
                onChange={(e) => setReportCoverBgOpacity(e.target.value)}
                className="flex-1 h-2 rounded-lg appearance-none bg-slate-200 accent-primary-600"
              />
              <input
                type="number"
                min="5"
                max="100"
                value={reportCoverBgOpacity}
                onChange={(e) => setReportCoverBgOpacity(e.target.value)}
                className="w-16 rounded-lg border border-slate-200 bg-slate-100 px-2 py-1.5 text-sm text-center text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>
            <p className="text-xs text-slate-400 mt-1">Contrôle la transparence de l&apos;image de fond (5% = très transparent, 100% = opaque)</p>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1.5">
            Nom de votre société
          </label>
          <input
            type="text"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="Ex: CEDELIA"
            className="w-full rounded-lg border border-slate-200 bg-slate-100 px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
          <p className="text-xs text-slate-400 mt-1">Nom affiché dans l&apos;en-tête du rapport</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1.5">
            Titre du rapport
          </label>
          <input
            type="text"
            value={reportTitle}
            onChange={(e) => setReportTitle(e.target.value)}
            placeholder="Rapport de suivi des garanties"
            className="w-full rounded-lg border border-slate-200 bg-slate-100 px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1.5">
            Sous-titre
          </label>
          <input
            type="text"
            value={reportSubtitle}
            onChange={(e) => setReportSubtitle(e.target.value)}
            placeholder="Ex: CEDELIA - Solutions informatiques"
            className="w-full rounded-lg border border-slate-200 bg-slate-100 px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1.5">
            Message de la page de garde
          </label>
          <textarea
            value={reportMessage}
            onChange={(e) => setReportMessage(e.target.value)}
            placeholder="Ex: Document confidentiel — Suivi des garanties et échéances de vos produits installés."
            rows={3}
            className="w-full rounded-lg border border-slate-200 bg-slate-100 px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 resize-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1.5">
            Classement des produits dans le rapport
          </label>
          <div className="flex gap-3">
            <button
              onClick={() => setReportGroupMode("date")}
              className={`flex-1 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${
                reportGroupMode === "date"
                  ? "border-primary-500 bg-primary-50 text-primary-600"
                  : "border-slate-200 bg-slate-100 text-slate-500 hover:border-slate-300"
              }`}
            >
              Par date de fin
            </button>
            <button
              onClick={() => setReportGroupMode("family")}
              className={`flex-1 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${
                reportGroupMode === "family"
                  ? "border-primary-500 bg-primary-50 text-primary-600"
                  : "border-slate-200 bg-slate-100 text-slate-500 hover:border-slate-300"
              }`}
            >
              Par famille
            </button>
          </div>
          <p className="text-xs text-slate-400 mt-1">Détermine comment les produits sont organisés dans le rapport imprimé</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1.5">
            Couleur principale du rapport
          </label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={reportPrimaryColor}
              onChange={(e) => setReportPrimaryColor(e.target.value)}
              className="h-10 w-14 rounded-lg border border-slate-200 cursor-pointer"
            />
            <input
              type="text"
              value={reportPrimaryColor}
              onChange={(e) => setReportPrimaryColor(e.target.value)}
              className="w-32 rounded-lg border border-slate-200 bg-slate-100 px-4 py-2.5 text-sm text-slate-900 font-mono focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
            <button
              onClick={() => setReportPrimaryColor("#3b82f6")}
              className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
            >
              Réinitialiser
            </button>
          </div>
          <p className="text-xs text-slate-400 mt-1">Couleur utilisée pour le nom du client, les en-têtes et les accents du rapport</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1.5">
            Orientation de la page
          </label>
          <div className="flex gap-3">
            <button
              onClick={() => setReportOrientation("portrait")}
              className={`flex-1 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${
                reportOrientation === "portrait"
                  ? "border-primary-500 bg-primary-50 text-primary-600"
                  : "border-slate-200 bg-slate-100 text-slate-500 hover:border-slate-300"
              }`}
            >
              Portrait
            </button>
            <button
              onClick={() => setReportOrientation("landscape")}
              className={`flex-1 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${
                reportOrientation === "landscape"
                  ? "border-primary-500 bg-primary-50 text-primary-600"
                  : "border-slate-200 bg-slate-100 text-slate-500 hover:border-slate-300"
              }`}
            >
              Paysage
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1.5">
            Éléments visibles dans le rapport
          </label>
          <div className="space-y-2">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={reportShowStats}
                onChange={(e) => setReportShowStats(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm text-slate-600">Cartes statistiques (Total, En parc, Hors parc, Renouvelé)</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={reportShowFamily}
                onChange={(e) => setReportShowFamily(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm text-slate-600">Colonne &quot;Famille&quot;</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={reportShowSupplier}
                onChange={(e) => setReportShowSupplier(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm text-slate-600">Colonne &quot;Fournisseur&quot;</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={reportShowDuration}
                onChange={(e) => setReportShowDuration(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm text-slate-600">Colonne &quot;Durée&quot;</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={reportShowVerticalName}
                onChange={(e) => setReportShowVerticalName(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm text-slate-600">Nom du client vertical sur la page de garde</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={reportShowDate}
                onChange={(e) => setReportShowDate(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm text-slate-600">Date sur la page de garde</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={reportIncludeHorsParc}
                onChange={(e) => setReportIncludeHorsParc(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm text-slate-600">Inclure les produits hors parc dans le rapport</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={reportShowRenewedCount}
                onChange={(e) => setReportShowRenewedCount(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm text-slate-600">Afficher le nombre de produits renouvelés dans le rapport</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={reportShowQuantity}
                onChange={(e) => setReportShowQuantity(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm text-slate-600">Colonne &quot;Quantité&quot;</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={reportShowComParc}
                onChange={(e) => setReportShowComParc(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm text-slate-600">Colonne &quot;Com Parc&quot;</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={reportShowHeaderRow}
                onChange={(e) => setReportShowHeaderRow(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm text-slate-600">Ligne d&apos;en-têtes de colonnes (Produit, Qté, Com., Parc, etc.)</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={reportShowStatus}
                onChange={(e) => setReportShowStatus(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm text-slate-600">Colonne &quot;Statut&quot; (En parc, Toujours en parc, Hors parc)</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={reportIncludeRenewed}
                onChange={(e) => setReportIncludeRenewed(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm text-slate-600">Inclure les produits renouvelés</span>
            </label>

          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1.5">
            Texte de pied de page
          </label>
          <input
            type="text"
            value={reportFooterText}
            onChange={(e) => setReportFooterText(e.target.value)}
            placeholder="Ex: CEDELIA - Document confidentiel"
            className="w-full rounded-lg border border-slate-200 bg-slate-100 px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
          <p className="text-xs text-slate-400 mt-1">Affiché en bas de chaque page du rapport</p>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={handleSaveReport}
            disabled={savingReport}
            className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50 transition-colors"
          >
            {savingReport ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Enregistrer
          </button>
          {savedReport && <span className="text-xs text-emerald-600">Paramètres enregistrés</span>}
        </div>
      </div>}
      </div>
      </>)}

      {activeTab === "admin" && (<>
      {/* Gestion des utilisateurs (admin only) */}
      {isAdmin && <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <button onClick={() => toggleSection("users")} className="w-full flex items-center justify-between p-6 text-left hover:bg-slate-50 transition-colors">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary-50 p-2">
              <Users className="h-4 w-4 text-primary-600" />
            </div>
            <h3 className="text-sm font-medium text-slate-900">Gestion des utilisateurs</h3>
          </div>
          <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${openSections.users ? "rotate-180" : ""}`} />
        </button>
        {openSections.users && <div className="px-6 pb-6 border-t border-slate-100 pt-5">
        <div className="flex items-center justify-end mb-4">
          <button
            onClick={() => { setShowCreateForm(!showCreateForm); setUserError(""); }}
            className="flex items-center gap-2 rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-700 transition-colors"
          >
            <Plus className="h-3 w-3" />
            Nouvel utilisateur
          </button>
        </div>

        {!smtpHost && (
          <div className="mb-4 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
            <Mail className="h-4 w-4 flex-shrink-0 text-red-500" />
            <span>
              <strong>SMTP non configuré :</strong> la fonctionnalité &quot;Mot de passe oublié&quot; ne fonctionnera pas tant que le serveur mail n&apos;est pas configuré dans la section Email ci-dessus.
            </span>
          </div>
        )}

        {userError && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600">
            {userError}
          </div>
        )}

        {/* Create form */}
        {showCreateForm && (
          <div className="mb-4 rounded-lg border border-slate-200 bg-slate-100 p-4 space-y-3">
            <h4 className="text-sm font-medium text-slate-600">Créer un utilisateur</h4>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <input
                type="text"
                placeholder="Nom"
                value={userForm.name}
                onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-primary-500 focus:outline-none"
              />
              <input
                type="email"
                placeholder="Email"
                value={userForm.email}
                onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-primary-500 focus:outline-none"
              />
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Mot de passe"
                  value={userForm.password}
                  onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 pr-10 text-sm text-slate-900 placeholder-slate-400 focus:border-primary-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <select
                value={userForm.role}
                onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-600 focus:border-primary-500 focus:outline-none"
              >
                <option value="USER">Utilisateur</option>
                <option value="ADMIN">Administrateur</option>
              </select>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500 space-y-1.5">
              <p className="font-medium text-slate-700">Différences entre les rôles :</p>
              <div className="flex items-start gap-2">
                <span className="inline-block rounded bg-slate-200 px-1.5 py-0.5 font-medium text-slate-600 shrink-0">Utilisateur</span>
                <span>Consultation des données, personnalisation du rapport, fusion de clients/produits et notifications par email.</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="inline-block rounded bg-primary-100 px-1.5 py-0.5 font-medium text-primary-700 shrink-0">Administrateur</span>
                <span>Tous les droits utilisateur + gestion des utilisateurs, message broadcast, apparence du site, configuration SMTP, API Axonaut, import de données et suppression en masse.</span>
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={createUser}
                disabled={savingUser}
                className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
              >
                {savingUser ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                Créer
              </button>
              <button
                onClick={() => { setShowCreateForm(false); setUserError(""); }}
                className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100 transition-colors"
              >
                <X className="h-3 w-3" />
                Annuler
              </button>
            </div>
          </div>
        )}

        {/* Users list */}
        {loadingUsers ? (
          <div className="flex justify-center py-6">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
          </div>
        ) : users.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-6">Aucun utilisateur trouvé</p>
        ) : (
          <div className="space-y-2">
            {users.map((user) => (
              <div
                key={user.id}
                className="rounded-lg border border-slate-200 bg-slate-50 p-3"
              >
                {editingUser === user.id ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <input
                        type="text"
                        placeholder="Nom"
                        value={editForm.name}
                        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-primary-500 focus:outline-none"
                      />
                      <input
                        type="email"
                        placeholder="Email"
                        value={editForm.email}
                        onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-primary-500 focus:outline-none"
                      />
                      <div className="relative">
                        <input
                          type={showPassword ? "text" : "password"}
                          placeholder="Nouveau mot de passe (laisser vide pour ne pas changer)"
                          value={editForm.password}
                          onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 pr-10 text-sm text-slate-900 placeholder-slate-400 focus:border-primary-500 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      <select
                        value={editForm.role}
                        onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-600 focus:border-primary-500 focus:outline-none"
                      >
                        <option value="USER">Utilisateur</option>
                        <option value="ADMIN">Administrateur</option>
                      </select>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => updateUser(user.id)}
                        disabled={savingUser}
                        className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                      >
                        {savingUser ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                        Enregistrer
                      </button>
                      <button
                        onClick={() => { setEditingUser(null); setUserError(""); }}
                        className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100 transition-colors"
                      >
                        <X className="h-3 w-3" />
                        Annuler
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-50 text-sm font-bold text-primary-600">
                        {user.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-900">{user.name}</p>
                        <p className="text-xs text-slate-400">{user.email}</p>
                      </div>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        user.role === "ADMIN"
                          ? "bg-amber-50 text-amber-600"
                          : "bg-slate-100 text-slate-500"
                      }`}>
                        {user.role === "ADMIN" ? "Admin" : "Utilisateur"}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          setEditingUser(user.id);
                          setEditForm({ name: user.name, email: user.email, password: "", role: user.role });
                          setUserError("");
                          setShowPassword(false);
                        }}
                        className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors"
                        title="Modifier"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => deleteUser(user.id, user.name)}
                        className="rounded-lg p-2 text-slate-500 hover:bg-red-50 hover:text-red-600 transition-colors"
                        title="Supprimer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>}
      </div>}
      </>)}

      {activeTab === "general" && (<>
      {/* Message broadcast (admin only) */}
      {isAdmin && <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <button onClick={() => toggleSection("broadcast")} className="w-full flex items-center justify-between p-6 text-left hover:bg-slate-50 transition-colors">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-amber-50 p-2">
              <Megaphone className="h-4 w-4 text-amber-600" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-slate-900">Message aux utilisateurs</h3>
              <p className="text-xs text-slate-400">Affichez un message visible par tous les utilisateurs en haut de l&apos;application.</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span onClick={(e) => { e.stopPropagation(); setBroadcastEnabled(!broadcastEnabled); }}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                broadcastEnabled ? "bg-primary-600" : "bg-slate-300"
              }`}
            >
              <span className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
                broadcastEnabled ? "translate-x-6" : "translate-x-1"
              }`} />
            </span>
            <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${openSections.broadcast ? "rotate-180" : ""}`} />
          </div>
        </button>
        {openSections.broadcast && <div className="px-6 pb-6 border-t border-slate-100 pt-5">

        <div className="space-y-3">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-1 rounded-t-lg border border-slate-200 bg-slate-50 p-1.5">
            <button type="button" onClick={() => execCmd("bold")} className="rounded p-1.5 text-slate-600 hover:bg-white hover:text-slate-900 transition-colors" title="Gras">
              <Bold className="h-3.5 w-3.5" />
            </button>
            <button type="button" onClick={() => execCmd("italic")} className="rounded p-1.5 text-slate-600 hover:bg-white hover:text-slate-900 transition-colors" title="Italique">
              <Italic className="h-3.5 w-3.5" />
            </button>
            <button type="button" onClick={() => execCmd("underline")} className="rounded p-1.5 text-slate-600 hover:bg-white hover:text-slate-900 transition-colors" title="Souligné">
              <Underline className="h-3.5 w-3.5" />
            </button>
            <button type="button" onClick={() => execCmd("strikeThrough")} className="rounded p-1.5 text-slate-600 hover:bg-white hover:text-slate-900 transition-colors" title="Barré">
              <Strikethrough className="h-3.5 w-3.5" />
            </button>

            <div className="mx-1 h-5 w-px bg-slate-300" />

            <button type="button" onClick={() => execCmd("formatBlock", "<h1>")} className="rounded p-1.5 text-slate-600 hover:bg-white hover:text-slate-900 transition-colors" title="Titre 1">
              <Heading1 className="h-3.5 w-3.5" />
            </button>
            <button type="button" onClick={() => execCmd("formatBlock", "<h2>")} className="rounded p-1.5 text-slate-600 hover:bg-white hover:text-slate-900 transition-colors" title="Titre 2">
              <Heading2 className="h-3.5 w-3.5" />
            </button>
            <button type="button" onClick={() => execCmd("formatBlock", "<p>")} className="rounded p-1.5 text-slate-600 hover:bg-white hover:text-slate-900 transition-colors" title="Paragraphe">
              <Type className="h-3.5 w-3.5" />
            </button>

            <div className="mx-1 h-5 w-px bg-slate-300" />

            <button type="button" onClick={() => execCmd("insertUnorderedList")} className="rounded p-1.5 text-slate-600 hover:bg-white hover:text-slate-900 transition-colors" title="Liste à puces">
              <List className="h-3.5 w-3.5" />
            </button>
            <button type="button" onClick={() => execCmd("insertOrderedList")} className="rounded p-1.5 text-slate-600 hover:bg-white hover:text-slate-900 transition-colors" title="Liste numérotée">
              <ListOrdered className="h-3.5 w-3.5" />
            </button>

            <div className="mx-1 h-5 w-px bg-slate-300" />

            <button type="button" onClick={() => execCmd("justifyLeft")} className="rounded p-1.5 text-slate-600 hover:bg-white hover:text-slate-900 transition-colors" title="Aligner à gauche">
              <AlignLeft className="h-3.5 w-3.5" />
            </button>
            <button type="button" onClick={() => execCmd("justifyCenter")} className="rounded p-1.5 text-slate-600 hover:bg-white hover:text-slate-900 transition-colors" title="Centrer">
              <AlignCenter className="h-3.5 w-3.5" />
            </button>
            <button type="button" onClick={() => execCmd("justifyRight")} className="rounded p-1.5 text-slate-600 hover:bg-white hover:text-slate-900 transition-colors" title="Aligner à droite">
              <AlignRight className="h-3.5 w-3.5" />
            </button>

            <div className="mx-1 h-5 w-px bg-slate-300" />

            <label className="rounded p-1.5 text-slate-600 hover:bg-white hover:text-slate-900 transition-colors cursor-pointer" title="Couleur du texte">
              <input
                type="color"
                className="sr-only"
                onChange={(e) => execCmd("foreColor", e.target.value)}
              />
              <Palette className="h-3.5 w-3.5" />
            </label>

            <button
              type="button"
              onClick={() => {
                const url = prompt("URL du lien :");
                if (url) execCmd("createLink", url);
              }}
              className="rounded p-1.5 text-slate-600 hover:bg-white hover:text-slate-900 transition-colors"
              title="Insérer un lien"
            >
              <Link className="h-3.5 w-3.5" />
            </button>

            <button
              type="button"
              onClick={() => {
                const url = prompt("URL de l'image :");
                if (url) execCmd("insertImage", url);
              }}
              className="rounded p-1.5 text-slate-600 hover:bg-white hover:text-slate-900 transition-colors"
              title="Insérer une image"
            >
              <ImageIcon className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Editor area */}
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            className="min-h-[120px] max-h-[300px] overflow-y-auto rounded-b-lg border border-t-0 border-slate-200 bg-white p-4 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-primary-500 [&_a]:text-primary-600 [&_a]:underline [&_img]:inline-block [&_img]:max-h-40 [&_img]:rounded"
            data-placeholder="Rédigez votre message ici..."
            onFocus={(e) => {
              if (e.currentTarget.innerHTML === "") {
                e.currentTarget.classList.remove("empty");
              }
            }}
          />

          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-400">
              {broadcastEnabled ? "Le message sera affiché à tous les utilisateurs." : "Le message est actuellement désactivé."}
            </p>
            <button
              onClick={saveBroadcast}
              disabled={broadcastSaving}
              className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50 transition-colors"
            >
              {broadcastSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {broadcastSaved ? "Enregistré !" : "Enregistrer le message"}
            </button>
          </div>
        </div>
      </div>}
      </div>}
      </>)}

      {activeTab === "admin" && (<>
      {/* Fusion de clients */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <button onClick={() => toggleSection("mergeClients")} className="w-full flex items-center justify-between p-6 text-left hover:bg-slate-50 transition-colors">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary-50 p-2">
              <Merge className="h-4 w-4 text-primary-600" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-slate-900">Fusionner des clients</h3>
              <p className="text-xs text-slate-400">Fusionnez deux clients en un seul, même avec des noms différents.</p>
            </div>
          </div>
          <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${openSections.mergeClients ? "rotate-180" : ""}`} />
        </button>
        {openSections.mergeClients && <div className="px-6 pb-6 border-t border-slate-100 pt-5">

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Target client (to keep) */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-emerald-700">Client cible (à conserver)</label>
              {mergeTarget ? (
                <div className="flex items-center justify-between rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2">
                  <div>
                    <span className="text-sm font-medium text-slate-900">{mergeTarget.name}</span>
                    <span className="ml-2 text-xs text-slate-400">{mergeTarget._count.installations} install. · {mergeTarget._count.invoices} fact.</span>
                  </div>
                  <button onClick={() => setMergeTarget(null)} className="text-slate-400 hover:text-slate-600">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Rechercher le client cible..."
                      value={mergeTargetSearch}
                      onChange={(e) => searchMergeTarget(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-10 pr-4 text-sm text-slate-800 placeholder-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                  {mergeTargetResults.length > 0 && (
                    <div className="rounded-lg border border-slate-200 max-h-48 overflow-y-auto divide-y divide-slate-100">
                      {mergeTargetResults.map((c) => (
                        <button
                          key={c.id}
                          onClick={() => { setMergeTarget(c); setMergeTargetResults([]); setMergeTargetSearch(""); }}
                          className="w-full flex items-center justify-between px-3 py-2 text-sm text-left hover:bg-emerald-50 transition-colors"
                        >
                          <div>
                            <span className="font-medium text-slate-900">{c.name}</span>
                            <span className="ml-2 text-xs text-slate-400">{c._count.installations} install. · {c._count.invoices} fact.</span>
                          </div>
                          <Check className="h-3.5 w-3.5 text-emerald-500 opacity-0 group-hover:opacity-100" />
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Source client (to delete) */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-red-700">Client source (sera supprimé)</label>
              {mergeSource ? (
                <div className="flex items-center justify-between rounded-lg border border-red-300 bg-red-50 px-3 py-2">
                  <div>
                    <span className="text-sm font-medium text-slate-900">{mergeSource.name}</span>
                    <span className="ml-2 text-xs text-slate-400">{mergeSource._count.installations} install. · {mergeSource._count.invoices} fact.</span>
                  </div>
                  <button onClick={() => setMergeSource(null)} className="text-slate-400 hover:text-slate-600">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Rechercher le client à supprimer..."
                      value={mergeSourceSearch}
                      onChange={(e) => searchMergeSource(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-10 pr-4 text-sm text-slate-800 placeholder-slate-400 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                    />
                  </div>
                  {mergeSourceResults.length > 0 && (
                    <div className="rounded-lg border border-slate-200 max-h-48 overflow-y-auto divide-y divide-slate-100">
                      {mergeSourceResults.map((c) => (
                        <button
                          key={c.id}
                          onClick={() => { setMergeSource(c); setMergeSourceResults([]); setMergeSourceSearch(""); }}
                          className="w-full flex items-center justify-between px-3 py-2 text-sm text-left hover:bg-red-50 transition-colors"
                        >
                          <div>
                            <span className="font-medium text-slate-900">{c.name}</span>
                            <span className="ml-2 text-xs text-slate-400">{c._count.installations} install. · {c._count.invoices} fact.</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {mergeTarget && mergeSource && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <p className="text-sm text-amber-700 font-medium">
                  Le client &quot;{mergeSource.name}&quot; sera supprimé et ses données transférées vers &quot;{mergeTarget.name}&quot;.
                </p>
              </div>
              <button
                onClick={handleMerge}
                disabled={merging}
                className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50 transition-colors"
              >
                {merging ? <Loader2 className="h-4 w-4 animate-spin" /> : <Merge className="h-4 w-4" />}
                Fusionner
              </button>
            </div>
          )}

          {mergeResult && (
            <div className={`rounded-lg border p-3 text-sm ${
              mergeResult.success ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"
            }`}>
              {mergeResult.message}
            </div>
          )}
        </div>
      </div>}
      </div>

      {/* Fusion de produits */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <button onClick={() => toggleSection("mergeProducts")} className="w-full flex items-center justify-between p-6 text-left hover:bg-slate-50 transition-colors">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-violet-50 p-2">
              <Merge className="h-4 w-4 text-violet-600" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-slate-900">Fusionner des produits</h3>
              <p className="text-xs text-slate-400">Fusionnez deux produits en un seul.</p>
            </div>
          </div>
          <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${openSections.mergeProducts ? "rotate-180" : ""}`} />
        </button>
        {openSections.mergeProducts && <div className="px-6 pb-6 border-t border-slate-100 pt-5">

        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Rechercher un produit..."
              value={mergeProductSearch}
              onChange={(e) => searchMergeProducts(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-10 pr-4 text-sm text-slate-800 placeholder-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>

          {mergeProducts.length > 0 && (
            <div className="rounded-lg border border-slate-200 max-h-60 overflow-y-auto divide-y divide-slate-100">
              {mergeProducts.map((p) => {
                const isTarget = mergeProductTarget === p.id;
                const isSource = mergeProductSource === p.id;
                return (
                  <div key={p.id} className={`flex items-center justify-between px-4 py-2.5 text-sm ${isTarget ? "bg-emerald-50" : isSource ? "bg-red-50" : "hover:bg-slate-50"}`}>
                    <div>
                      <span className="font-medium text-slate-900">{p.name}</span>
                      <span className="ml-2 text-xs text-slate-400">{p._count.installations} install. · {p._count.invoiceLines} ligne(s)</span>
                    </div>
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => setMergeProductTarget(isTarget ? null : p.id)}
                        className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                          isTarget ? "bg-emerald-600 text-white" : "border border-emerald-300 text-emerald-600 hover:bg-emerald-50"
                        }`}
                      >
                        {isTarget ? "✓ Cible" : "Cible"}
                      </button>
                      <button
                        onClick={() => setMergeProductSource(isSource ? null : p.id)}
                        className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                          isSource ? "bg-red-600 text-white" : "border border-red-300 text-red-600 hover:bg-red-50"
                        }`}
                      >
                        {isSource ? "✓ À supprimer" : "À supprimer"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {mergeProductTarget && mergeProductSource && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <p className="text-sm text-amber-700 font-medium">
                  Le produit &quot;{mergeProducts.find((p) => p.id === mergeProductSource)?.name}&quot; sera supprimé et ses données transférées vers &quot;{mergeProducts.find((p) => p.id === mergeProductTarget)?.name}&quot;.
                </p>
              </div>
              <button
                onClick={handleProductMerge}
                disabled={mergingProduct}
                className="flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50 transition-colors"
              >
                {mergingProduct ? <Loader2 className="h-4 w-4 animate-spin" /> : <Merge className="h-4 w-4" />}
                Fusionner
              </button>
            </div>
          )}

          {mergeProductResult && (
            <div className={`rounded-lg border p-3 text-sm ${
              mergeProductResult.success ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"
            }`}>
              {mergeProductResult.message}
            </div>
          )}
        </div>
      </div>}
      </div>

      {/* Suppression de données (admin only) */}
      {isAdmin && <div className="rounded-xl border border-red-200 bg-white overflow-hidden">
        <button onClick={() => toggleSection("delete")} className="w-full flex items-center justify-between p-6 text-left hover:bg-slate-50 transition-colors">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-red-50 p-2">
              <Trash2 className="h-4 w-4 text-red-600" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-slate-900">Supprimer des données</h3>
              <p className="text-xs text-slate-400">Supprimez en masse les données de l&apos;application. Cette action est irréversible.</p>
            </div>
          </div>
          <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${openSections.delete ? "rotate-180" : ""}`} />
        </button>
        {openSections.delete && <div className="px-6 pb-6 border-t border-slate-100 pt-5">

        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { key: "installations", label: "Installations", desc: "Toutes les installations et garanties" },
              { key: "invoices", label: "Factures", desc: "Factures et lignes de facturation" },
              { key: "products", label: "Produits", desc: "Catalogue produits" },
              { key: "clients", label: "Clients", desc: "Tous les clients" },
            ].map(({ key, label, desc }) => (
              <label
                key={key}
                className={`flex flex-col gap-1 rounded-lg border-2 p-3 cursor-pointer transition-colors ${
                  deleteTypes.includes(key)
                    ? "border-red-400 bg-red-50"
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={deleteTypes.includes(key)}
                    onChange={(e) => {
                      if (e.target.checked) setDeleteTypes([...deleteTypes, key]);
                      else setDeleteTypes(deleteTypes.filter((t) => t !== key));
                      setDeleteConfirm("");
                      setDeleteResult(null);
                    }}
                    className="rounded border-slate-300 text-red-600 focus:ring-red-500"
                  />
                  <span className="text-sm font-medium text-slate-900">{label}</span>
                </div>
                <span className="text-xs text-slate-400">{desc}</span>
              </label>
            ))}
          </div>

          {deleteTypes.length > 0 && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                <p className="text-sm text-red-700 font-medium">
                  Vous allez supprimer : {deleteTypes.map((t) => {
                    const labels: Record<string, string> = { installations: "Installations", invoices: "Factures", products: "Produits", clients: "Clients" };
                    return labels[t];
                  }).join(", ")}
                </p>
              </div>
              <p className="text-xs text-red-600">
                Tapez <strong>SUPPRIMER</strong> pour confirmer :
              </p>
              <input
                type="text"
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                placeholder="SUPPRIMER"
                className="w-full rounded-lg border border-red-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
              />
              <button
                disabled={deleteConfirm !== "SUPPRIMER" || deleting}
                onClick={async () => {
                  setDeleting(true);
                  setDeleteResult(null);
                  try {
                    const res = await fetch("/api/data", {
                      method: "DELETE",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ types: deleteTypes }),
                    });
                    const data = await res.json();
                    if (res.ok) {
                      setDeleteResult({ success: true, message: data.message });
                      setDeleteTypes([]);
                      setDeleteConfirm("");
                    } else {
                      setDeleteResult({ success: false, message: data.error || "Erreur" });
                    }
                  } catch {
                    setDeleteResult({ success: false, message: "Erreur de connexion" });
                  } finally {
                    setDeleting(false);
                  }
                }}
                className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                Supprimer définitivement
              </button>
            </div>
          )}

          {deleteResult && (
            <div className={`rounded-lg border p-3 text-sm ${
              deleteResult.success ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"
            }`}>
              {deleteResult.message}
            </div>
          )}
        </div>
      </div>}
      </div>}
      </>)}

        </div>
      </div>
    </div>
  );
}
