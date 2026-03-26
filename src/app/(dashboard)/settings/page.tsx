"use client";

import { useEffect, useState, useRef } from "react";
import { Save, Loader2, Key, Globe, Users, Plus, Pencil, Trash2, X, Check, Eye, EyeOff, Mail, Bell, Send, Plug, FileText, Upload, ImageIcon, Palette, CalendarClock, AlertTriangle, Merge, Search, Megaphone, Bold, Italic, Underline, List, ListOrdered, Link, Type, Heading1, Heading2, AlignLeft, AlignCenter, AlignRight, Strikethrough, ChevronDown } from "lucide-react";

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

  // Collapsible sections
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    tools: true,
  });
  function toggleSection(key: string) {
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));
  }

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

        setReportFooterText(data.report_footer_text || "");
        setReportOrientation(data.report_orientation || "portrait");
        setReportCoverBg(data.report_cover_bg || "");
        setReportCoverBgOpacity(data.report_cover_bg_opacity || "15");
        setSiteLogo(data.site_logo || "");
        setSiteFavicon(data.site_favicon || "");
        setBroadcastEnabled(data.broadcast_enabled === "true");
        setBroadcastMessage(data.broadcast_message || "");
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

        report_footer_text: reportFooterText,
        report_orientation: reportOrientation,
        report_cover_bg: reportCoverBg,
        report_cover_bg_opacity: reportCoverBgOpacity,
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
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="lg:col-span-2">
        <h1 className="text-2xl font-bold text-slate-900">Paramètres</h1>
        <p className="text-sm text-slate-500 mt-1">Configuration de l&apos;application</p>
      </div>

      {/* Outils */}
      <div className="lg:col-span-2 rounded-xl border border-slate-200 bg-white p-6">
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
      <div className="lg:col-span-2 rounded-xl border border-slate-200 bg-white overflow-hidden">
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
      {isAdmin && <div className="lg:col-span-2 rounded-xl border border-red-200 bg-white overflow-hidden">
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

    </div>
  );
}
