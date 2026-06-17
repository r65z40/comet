"use client";

import { useState, useEffect } from "react";
import {
  Save,
  Loader2,
  Mail,
  Bell,
  Send,
  Plug,
  CalendarClock,
  AlertTriangle,
  ChevronDown,
  HardDrive,
  X,
  Check,
  Eye,
  EyeOff,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SettingsTabProps } from "./GeneralTab";

export default function EmailTab({ settings, isAdmin, openSections, toggleSection }: SettingsTabProps) {
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

  // Initialize state from settings prop
  useEffect(() => {
    if (!settings || Object.keys(settings).length === 0) return;
    setSmtpHost(settings.smtp_host || "");
    setSmtpPort(settings.smtp_port || "587");
    setSmtpSecure(settings.smtp_secure === "true");
    setSmtpUser(settings.smtp_user || "");
    setSmtpPass(settings.smtp_pass || "");
    setSmtpFrom(settings.smtp_from || "");
    setNotifEmails(settings.notification_emails || "");
    setNotifDelay(settings.notification_delay_days || "30");
    // Alert scheduling
    setAlertEnabled(settings.alert_enabled === "true");
    setAlertFrequency(settings.alert_frequency || "weekly");
    setAlertDay(settings.alert_day || "1");
    setAlertTime(settings.alert_time || "08:00");
    try {
      if (settings.alert_types) setAlertTypes(JSON.parse(settings.alert_types));
    } catch { /* keep defaults */ }
    try {
      if (settings.alert_thresholds) setAlertThresholds(JSON.parse(settings.alert_thresholds));
    } catch { /* keep defaults */ }
    // Quota alerts
    setQuotaAlertEnabled(settings.quota_alert_enabled === "true");
    setQuotaWarning(settings.quota_alert_warning || "80");
    setQuotaExceeded(settings.quota_alert_exceeded || "100");
    setQuotaAutoSend(settings.quota_alert_auto_send !== "false");
    setQuotaRepeatMode(settings.quota_alert_repeat_mode === "recurring" ? "recurring" : "once");
    setQuotaRepeatDays(settings.quota_alert_repeat_days || "7");
    setQuotaSendToPortal(settings.quota_alert_send_to_portal_users === "true");
    setQuotaCcAdmins(settings.quota_alert_cc_admins === "true");
    if (settings.quota_alert_subject_warning) setQuotaSubjectWarning(settings.quota_alert_subject_warning);
    if (settings.quota_alert_subject_exceeded) setQuotaSubjectExceeded(settings.quota_alert_subject_exceeded);
    if (settings.quota_alert_body_warning) setQuotaBodyWarning(settings.quota_alert_body_warning);
    if (settings.quota_alert_body_exceeded) setQuotaBodyExceeded(settings.quota_alert_body_exceeded);
    if (settings.quota_alert_email_footer) setQuotaEmailFooter(settings.quota_alert_email_footer);
  }, [settings]);

  // Handlers
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

  return (
    <>
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
              <label className="block text-sm font-medium text-slate-600 mb-2">Types d&apos;alertes a envoyer</label>
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
                    {alertThresholds[item.key] ? "✓ " : ""}{item.label}
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

      {/* Alertes quota de sauvegarde -- emails clients */}
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
          <label className="block text-sm font-medium text-slate-600 mb-3">Test & apercu</label>
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
          {savedQuota && <span className="text-xs text-emerald-600">Configuration enregistree</span>}
        </div>

        {/* Resultat envoi */}
        {quotaAlertResult && (
          <div className={`rounded-lg border px-4 py-2.5 text-sm ${
            quotaAlertResult.includes("Erreur") ? "border-red-200 bg-red-50 text-red-600"
            : quotaAlertResult.includes("succes") || quotaAlertResult.includes("envoye") ? "border-emerald-200 bg-emerald-50 text-emerald-600"
            : "border-amber-200 bg-amber-50 text-amber-600"
          }`}>
            {quotaAlertResult}
          </div>
        )}

        {/* Tableau des clients concernes */}
        {quotaClients.length > 0 && (
          <div className="rounded-lg border border-slate-200 overflow-hidden">
            <div className="bg-slate-50 px-4 py-3 flex items-center justify-between border-b border-slate-200">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-slate-700">{quotaClients.length} client(s) au-dessus des seuils</span>
                {quotaSelectedIds.size > 0 && (
                  <span className="text-xs bg-primary-100 text-primary-700 px-2 py-0.5 rounded-full font-medium">{quotaSelectedIds.size} selectionne(s)</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {quotaSelectedIds.size > 0 && (
                  <button onClick={handleSendToSelected} disabled={sendingQuotaAlert}
                    className="flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700 disabled:opacity-50 transition-colors">
                    {sendingQuotaAlert ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                    Envoyer aux selectionnes
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
                        {isExceeded ? "Depasse" : "Attention"}
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
                          Envoye
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
              <p className="text-sm text-slate-400">Aucune alerte envoyee.</p>
            ) : (
              <div className="space-y-1.5 max-h-72 overflow-y-auto">
                {quotaHistory.map((alert) => (
                  <div key={alert.id} className="flex items-center justify-between rounded-lg bg-white border border-slate-100 px-3 py-2.5 text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`h-2 w-2 rounded-full flex-shrink-0 ${alert.alertType === "exceeded" ? "bg-red-500" : "bg-amber-400"}`} />
                      <span className="font-medium text-slate-700 truncate">{alert.clientName || alert.organizationId}</span>
                      <span className={`flex-shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium ${alert.alertType === "exceeded" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
                        {alert.alertType === "exceeded" ? "Depasse" : "Avertissement"}
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
    </>
  );
}
