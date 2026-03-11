"use client";

import { useEffect, useState, useRef } from "react";
import { Save, Loader2, Key, Globe, Users, Plus, Pencil, Trash2, X, Check, Eye, EyeOff, Mail, Bell, Send, Plug, FileText, Upload, ImageIcon } from "lucide-react";

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
}

export default function SettingsPage() {
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

  // Report settings
  const [reportTitle, setReportTitle] = useState("");
  const [reportSubtitle, setReportSubtitle] = useState("");
  const [reportMessage, setReportMessage] = useState("");
  const [companyLogo, setCompanyLogo] = useState("");
  const [reportGroupMode, setReportGroupMode] = useState("date");
  const [savingReport, setSavingReport] = useState(false);
  const [savedReport, setSavedReport] = useState(false);
  const companyLogoRef = useRef<HTMLInputElement>(null);

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
        setReportTitle(data.report_title || "");
        setReportSubtitle(data.report_subtitle || "");
        setReportMessage(data.report_message || "");
        setCompanyLogo(data.company_logo || "");
        setReportGroupMode(data.report_group_mode || "date");
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
    const res = await fetch("/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "test" }),
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
        report_group_mode: reportGroupMode,
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
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Paramètres</h1>
        <p className="text-sm text-surface-400 mt-1">Configuration de l&apos;application</p>
      </div>

      {/* API Axonaut */}
      <div className="rounded-xl border border-surface-800 bg-surface-900 p-6 space-y-5">
        <div className="flex items-center gap-3 mb-2">
          <div className="rounded-lg bg-primary-600/20 p-2">
            <Key className="h-4 w-4 text-primary-400" />
          </div>
          <h3 className="text-sm font-medium text-white">API Axonaut</h3>
        </div>

        <div>
          <label className="block text-sm font-medium text-surface-300 mb-1.5">
            Clé API actuelle
          </label>
          <p className="text-sm text-surface-500 font-mono">
            {settings.axonaut_api_key || "Non configurée"}
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-surface-300 mb-1.5">
            Nouvelle clé API
          </label>
          <input
            type="password"
            value={newApiKey}
            onChange={(e) => setNewApiKey(e.target.value)}
            placeholder="Entrer une nouvelle clé API..."
            className="w-full rounded-lg border border-surface-700 bg-surface-800 px-4 py-2.5 text-sm text-white placeholder-surface-500 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-surface-300 mb-1.5">
            URL de l&apos;API
          </label>
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-surface-500" />
            <input
              type="text"
              value={apiUrl}
              onChange={(e) => setApiUrl(e.target.value)}
              className="flex-1 rounded-lg border border-surface-700 bg-surface-800 px-4 py-2.5 text-sm text-white placeholder-surface-500 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
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
            <span className="text-xs text-emerald-400">Paramètres enregistrés</span>
          )}
        </div>
      </div>

      {/* Configuration SMTP */}
      <div className="rounded-xl border border-surface-800 bg-surface-900 p-6 space-y-5">
        <div className="flex items-center gap-3 mb-2">
          <div className="rounded-lg bg-primary-600/20 p-2">
            <Mail className="h-4 w-4 text-primary-400" />
          </div>
          <h3 className="text-sm font-medium text-white">Configuration SMTP</h3>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-surface-300 mb-1.5">Serveur SMTP</label>
            <input
              type="text"
              value={smtpHost}
              onChange={(e) => setSmtpHost(e.target.value)}
              placeholder="smtp.gmail.com"
              className="w-full rounded-lg border border-surface-700 bg-surface-800 px-4 py-2.5 text-sm text-white placeholder-surface-500 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-surface-300 mb-1.5">Port</label>
              <input
                type="text"
                value={smtpPort}
                onChange={(e) => setSmtpPort(e.target.value)}
                placeholder="587"
                className="w-full rounded-lg border border-surface-700 bg-surface-800 px-4 py-2.5 text-sm text-white placeholder-surface-500 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-surface-300 mb-1.5">SSL/TLS</label>
              <button
                onClick={() => setSmtpSecure(!smtpSecure)}
                className={`w-full rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${
                  smtpSecure
                    ? "border-emerald-500 bg-emerald-500/20 text-emerald-400"
                    : "border-surface-700 bg-surface-800 text-surface-400"
                }`}
              >
                {smtpSecure ? "Activé (465)" : "Désactivé (587)"}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-surface-300 mb-1.5">Identifiant</label>
            <input
              type="text"
              value={smtpUser}
              onChange={(e) => setSmtpUser(e.target.value)}
              placeholder="user@exemple.com"
              className="w-full rounded-lg border border-surface-700 bg-surface-800 px-4 py-2.5 text-sm text-white placeholder-surface-500 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-surface-300 mb-1.5">Mot de passe</label>
            <input
              type="password"
              value={smtpPass}
              onChange={(e) => setSmtpPass(e.target.value)}
              placeholder="Mot de passe SMTP..."
              className="w-full rounded-lg border border-surface-700 bg-surface-800 px-4 py-2.5 text-sm text-white placeholder-surface-500 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-surface-300 mb-1.5">Adresse expéditeur</label>
            <input
              type="text"
              value={smtpFrom}
              onChange={(e) => setSmtpFrom(e.target.value)}
              placeholder="COMET CEDELIA <noreply@cedelia.fr>"
              className="w-full rounded-lg border border-surface-700 bg-surface-800 px-4 py-2.5 text-sm text-white placeholder-surface-500 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
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
            className="flex items-center gap-2 rounded-lg border border-surface-600 px-4 py-2.5 text-sm font-medium text-surface-300 hover:bg-surface-800 disabled:opacity-50 transition-colors"
          >
            {testingSmtp ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plug className="h-4 w-4" />}
            Tester la connexion
          </button>
          {savedSmtp && <span className="text-xs text-emerald-400">Paramètres enregistrés</span>}
        </div>

        {smtpTestResult && (
          <div className={`rounded-lg border px-4 py-2 text-sm ${
            smtpTestResult.success
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
              : "border-red-500/30 bg-red-500/10 text-red-400"
          }`}>
            {smtpTestResult.success ? "Connexion SMTP réussie" : `Erreur : ${smtpTestResult.error}`}
          </div>
        )}
      </div>

      {/* Notifications par email */}
      <div className="rounded-xl border border-surface-800 bg-surface-900 p-6 space-y-5">
        <div className="flex items-center gap-3 mb-2">
          <div className="rounded-lg bg-primary-600/20 p-2">
            <Bell className="h-4 w-4 text-primary-400" />
          </div>
          <h3 className="text-sm font-medium text-white">Notifications par email</h3>
        </div>

        <div>
          <label className="block text-sm font-medium text-surface-300 mb-1.5">
            Adresses de notification
          </label>
          <input
            type="text"
            value={notifEmails}
            onChange={(e) => setNotifEmails(e.target.value)}
            placeholder="email1@exemple.com, email2@exemple.com"
            className="w-full rounded-lg border border-surface-700 bg-surface-800 px-4 py-2.5 text-sm text-white placeholder-surface-500 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
          <p className="text-xs text-surface-500 mt-1">Séparer les adresses par des virgules</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-surface-300 mb-1.5">
            Délai de prévention (jours avant échéance)
          </label>
          <div className="flex items-center gap-3">
            <input
              type="number"
              value={notifDelay}
              onChange={(e) => setNotifDelay(e.target.value)}
              min="1"
              max="365"
              className="w-32 rounded-lg border border-surface-700 bg-surface-800 px-4 py-2.5 text-sm text-white placeholder-surface-500 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
            <span className="text-sm text-surface-400">jours avant la fin de garantie</span>
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
              ? "border-red-500/30 bg-red-500/10 text-red-400"
              : "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
          }`}>
            {notifResult}
          </div>
        )}
      </div>

      {/* Personnalisation du rapport */}
      <div className="rounded-xl border border-surface-800 bg-surface-900 p-6 space-y-5">
        <div className="flex items-center gap-3 mb-2">
          <div className="rounded-lg bg-primary-600/20 p-2">
            <FileText className="h-4 w-4 text-primary-400" />
          </div>
          <h3 className="text-sm font-medium text-white">Personnalisation du rapport client</h3>
        </div>
        <p className="text-xs text-surface-500">
          Ces paramètres personnalisent la première page du rapport imprimable depuis la fiche client.
        </p>

        <div>
          <label className="block text-sm font-medium text-surface-300 mb-1.5">
            Logo de votre société
          </label>
          <div className="flex items-center gap-4">
            {companyLogo ? (
              <div className="relative group">
                <img
                  src={companyLogo}
                  alt="Logo société"
                  className="h-20 w-auto max-w-[200px] rounded-lg bg-white p-2 border border-surface-700 object-contain"
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
                className="flex h-20 w-40 items-center justify-center gap-2 rounded-lg border-2 border-dashed border-surface-700 text-surface-500 hover:border-primary-500 hover:text-primary-400 transition-colors"
              >
                <ImageIcon className="h-5 w-5" />
                <span className="text-xs">Ajouter un logo</span>
              </button>
            )}
            {companyLogo && (
              <button
                onClick={() => companyLogoRef.current?.click()}
                className="flex items-center gap-2 rounded-lg border border-surface-700 px-3 py-2 text-xs font-medium text-surface-400 hover:bg-surface-800 transition-colors"
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
          <p className="text-xs text-surface-500 mt-1">Ce logo apparaîtra sur la page de garde du rapport (max 2 Mo)</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-surface-300 mb-1.5">
            Titre du rapport
          </label>
          <input
            type="text"
            value={reportTitle}
            onChange={(e) => setReportTitle(e.target.value)}
            placeholder="Rapport de suivi des garanties"
            className="w-full rounded-lg border border-surface-700 bg-surface-800 px-4 py-2.5 text-sm text-white placeholder-surface-500 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-surface-300 mb-1.5">
            Sous-titre
          </label>
          <input
            type="text"
            value={reportSubtitle}
            onChange={(e) => setReportSubtitle(e.target.value)}
            placeholder="Ex: CEDELIA - Solutions informatiques"
            className="w-full rounded-lg border border-surface-700 bg-surface-800 px-4 py-2.5 text-sm text-white placeholder-surface-500 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-surface-300 mb-1.5">
            Message de la page de garde
          </label>
          <textarea
            value={reportMessage}
            onChange={(e) => setReportMessage(e.target.value)}
            placeholder="Ex: Document confidentiel — Suivi des garanties et échéances de vos produits installés."
            rows={3}
            className="w-full rounded-lg border border-surface-700 bg-surface-800 px-4 py-2.5 text-sm text-white placeholder-surface-500 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 resize-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-surface-300 mb-1.5">
            Classement des produits dans le rapport
          </label>
          <div className="flex gap-3">
            <button
              onClick={() => setReportGroupMode("date")}
              className={`flex-1 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${
                reportGroupMode === "date"
                  ? "border-primary-500 bg-primary-500/20 text-primary-400"
                  : "border-surface-700 bg-surface-800 text-surface-400 hover:border-surface-600"
              }`}
            >
              Par date de fin
            </button>
            <button
              onClick={() => setReportGroupMode("family")}
              className={`flex-1 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${
                reportGroupMode === "family"
                  ? "border-primary-500 bg-primary-500/20 text-primary-400"
                  : "border-surface-700 bg-surface-800 text-surface-400 hover:border-surface-600"
              }`}
            >
              Par famille
            </button>
          </div>
          <p className="text-xs text-surface-500 mt-1">Détermine comment les produits sont organisés dans le rapport imprimé</p>
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
          {savedReport && <span className="text-xs text-emerald-400">Paramètres enregistrés</span>}
        </div>
      </div>

      {/* Gestion des utilisateurs */}
      <div className="rounded-xl border border-surface-800 bg-surface-900 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary-600/20 p-2">
              <Users className="h-4 w-4 text-primary-400" />
            </div>
            <h3 className="text-sm font-medium text-white">Gestion des utilisateurs</h3>
          </div>
          <button
            onClick={() => { setShowCreateForm(!showCreateForm); setUserError(""); }}
            className="flex items-center gap-2 rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-700 transition-colors"
          >
            <Plus className="h-3 w-3" />
            Nouvel utilisateur
          </button>
        </div>

        {userError && (
          <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-400">
            {userError}
          </div>
        )}

        {/* Create form */}
        {showCreateForm && (
          <div className="mb-4 rounded-lg border border-surface-700 bg-surface-800 p-4 space-y-3">
            <h4 className="text-sm font-medium text-surface-300">Créer un utilisateur</h4>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <input
                type="text"
                placeholder="Nom"
                value={userForm.name}
                onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
                className="rounded-lg border border-surface-600 bg-surface-900 px-3 py-2 text-sm text-white placeholder-surface-500 focus:border-primary-500 focus:outline-none"
              />
              <input
                type="email"
                placeholder="Email"
                value={userForm.email}
                onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                className="rounded-lg border border-surface-600 bg-surface-900 px-3 py-2 text-sm text-white placeholder-surface-500 focus:border-primary-500 focus:outline-none"
              />
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Mot de passe"
                  value={userForm.password}
                  onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                  className="w-full rounded-lg border border-surface-600 bg-surface-900 px-3 py-2 pr-10 text-sm text-white placeholder-surface-500 focus:border-primary-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-surface-500 hover:text-surface-300"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <select
                value={userForm.role}
                onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}
                className="rounded-lg border border-surface-600 bg-surface-900 px-3 py-2 text-sm text-surface-300 focus:border-primary-500 focus:outline-none"
              >
                <option value="USER">Utilisateur</option>
                <option value="ADMIN">Administrateur</option>
              </select>
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
                className="flex items-center gap-1.5 rounded-lg border border-surface-600 px-3 py-1.5 text-xs font-medium text-surface-400 hover:bg-surface-700 transition-colors"
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
          <p className="text-sm text-surface-500 text-center py-6">Aucun utilisateur trouvé</p>
        ) : (
          <div className="space-y-2">
            {users.map((user) => (
              <div
                key={user.id}
                className="rounded-lg border border-surface-700 bg-surface-800/50 p-3"
              >
                {editingUser === user.id ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <input
                        type="text"
                        placeholder="Nom"
                        value={editForm.name}
                        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                        className="rounded-lg border border-surface-600 bg-surface-900 px-3 py-2 text-sm text-white placeholder-surface-500 focus:border-primary-500 focus:outline-none"
                      />
                      <input
                        type="email"
                        placeholder="Email"
                        value={editForm.email}
                        onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                        className="rounded-lg border border-surface-600 bg-surface-900 px-3 py-2 text-sm text-white placeholder-surface-500 focus:border-primary-500 focus:outline-none"
                      />
                      <div className="relative">
                        <input
                          type={showPassword ? "text" : "password"}
                          placeholder="Nouveau mot de passe (laisser vide pour ne pas changer)"
                          value={editForm.password}
                          onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                          className="w-full rounded-lg border border-surface-600 bg-surface-900 px-3 py-2 pr-10 text-sm text-white placeholder-surface-500 focus:border-primary-500 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-surface-500 hover:text-surface-300"
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      <select
                        value={editForm.role}
                        onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                        className="rounded-lg border border-surface-600 bg-surface-900 px-3 py-2 text-sm text-surface-300 focus:border-primary-500 focus:outline-none"
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
                        className="flex items-center gap-1.5 rounded-lg border border-surface-600 px-3 py-1.5 text-xs font-medium text-surface-400 hover:bg-surface-700 transition-colors"
                      >
                        <X className="h-3 w-3" />
                        Annuler
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-600/20 text-sm font-bold text-primary-400">
                        {user.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">{user.name}</p>
                        <p className="text-xs text-surface-500">{user.email}</p>
                      </div>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        user.role === "ADMIN"
                          ? "bg-amber-500/20 text-amber-400"
                          : "bg-surface-700 text-surface-400"
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
                        className="rounded-lg p-2 text-surface-400 hover:bg-surface-700 hover:text-white transition-colors"
                        title="Modifier"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => deleteUser(user.id, user.name)}
                        className="rounded-lg p-2 text-surface-400 hover:bg-red-500/20 hover:text-red-400 transition-colors"
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
      </div>
    </div>
  );
}
