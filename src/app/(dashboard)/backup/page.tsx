"use client";

import { useEffect, useState } from "react";
import {
  Database,
  Download,
  Trash2,
  RotateCcw,
  Loader2,
  Save,
  HardDrive,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Plus,
  Settings,
  ArrowLeft,
  Cloud,
  Server,
  Plug,
  Upload,
} from "lucide-react";

interface BackupInfo {
  filename: string;
  size: number;
  sizeFormatted: string;
  createdAt: string;
  type: "auto" | "manual";
  location: "local" | "cloud" | "both";
}

interface BackupSettings {
  enabled: boolean;
  frequency: "daily" | "weekly" | "monthly";
  time: string;
  day: number;
  retention: number;
  notifyOnFailure: boolean;
}

interface CloudConfig {
  provider: "s3" | "ftp" | "none";
  s3Endpoint: string;
  s3Region: string;
  s3Bucket: string;
  s3AccessKey: string;
  s3SecretKey: string;
  s3Prefix: string;
  ftpHost: string;
  ftpPort: number;
  ftpUser: string;
  ftpPassword: string;
  ftpSecure: boolean;
  ftpPath: string;
}

const defaultCloud: CloudConfig = {
  provider: "none",
  s3Endpoint: "",
  s3Region: "us-east-1",
  s3Bucket: "",
  s3AccessKey: "",
  s3SecretKey: "",
  s3Prefix: "backups/",
  ftpHost: "",
  ftpPort: 21,
  ftpUser: "",
  ftpPassword: "",
  ftpSecure: false,
  ftpPath: "/backups",
};

export default function BackupPage() {
  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [settings, setSettings] = useState<BackupSettings>({
    enabled: false,
    frequency: "daily",
    time: "02:00",
    day: 1,
    retention: 7,
    notifyOnFailure: true,
  });
  const [cloud, setCloud] = useState<CloudConfig>(defaultCloud);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [savingCloud, setSavingCloud] = useState(false);
  const [savedCloud, setSavedCloud] = useState(false);
  const [testingCloud, setTestingCloud] = useState(false);
  const [cloudTestResult, setCloudTestResult] = useState<{ success: boolean; error?: string } | null>(null);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmRestore, setConfirmRestore] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((data) => {
        if (data?.user?.role === "ADMIN") setIsAdmin(true);
      })
      .catch(() => {});
    loadBackups();
  }, []);

  async function loadBackups() {
    setLoading(true);
    try {
      const res = await fetch("/api/backup");
      if (!res.ok) throw new Error("Non autorisé");
      const data = await res.json();
      setBackups(data.backups || []);
      if (data.settings) setSettings(data.settings);
      if (data.cloud) setCloud({ ...defaultCloud, ...data.cloud });
    } catch {
      // will show empty state
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate() {
    setCreating(true);
    setMessage(null);
    try {
      const res = await fetch("/api/backup", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setMessage({ type: "success", text: `Backup créé: ${data.backup.filename} (${data.backup.sizeFormatted})` });
        await loadBackups();
      } else {
        setMessage({ type: "error", text: data.error || "Erreur lors de la création du backup" });
      }
    } catch {
      setMessage({ type: "error", text: "Erreur de connexion" });
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(filename: string) {
    setDeleting(filename);
    setMessage(null);
    try {
      const res = await fetch(`/api/backup/${encodeURIComponent(filename)}`, { method: "DELETE" });
      if (res.ok) {
        setMessage({ type: "success", text: "Backup supprimé" });
        await loadBackups();
      } else {
        const data = await res.json();
        setMessage({ type: "error", text: data.error || "Erreur" });
      }
    } catch {
      setMessage({ type: "error", text: "Erreur de connexion" });
    } finally {
      setDeleting(null);
      setConfirmDelete(null);
    }
  }

  async function handleRestore(filename: string) {
    setRestoring(filename);
    setMessage(null);
    try {
      const res = await fetch(`/api/backup/${encodeURIComponent(filename)}`, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        const secrets = data.clearedSecrets as string[] | undefined;
        if (secrets && secrets.length > 0) {
          setMessage({
            type: "success",
            text: `Base de données restaurée. Secrets à re-saisir dans Paramètres : ${secrets.join(", ")}`,
          });
        } else {
          setMessage({ type: "success", text: "Base de données restaurée avec succès" });
        }
      } else {
        setMessage({ type: "error", text: data.error || "Erreur lors de la restauration" });
      }
    } catch {
      setMessage({ type: "error", text: "Erreur de connexion" });
    } finally {
      setRestoring(null);
      setConfirmRestore(null);
    }
  }

  async function handleSaveSettings() {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch("/api/backup", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          backup_enabled: settings.enabled ? "true" : "false",
          backup_frequency: settings.frequency,
          backup_time: settings.time,
          backup_day: String(settings.day),
          backup_retention: String(settings.retention),
          backup_notify_failure: settings.notifyOnFailure ? "true" : "false",
        }),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } catch {
      // silent
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveCloud() {
    setSavingCloud(true);
    setSavedCloud(false);
    try {
      const res = await fetch("/api/backup", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cloud_provider: cloud.provider,
          cloud_s3_endpoint: cloud.s3Endpoint,
          cloud_s3_region: cloud.s3Region,
          cloud_s3_bucket: cloud.s3Bucket,
          cloud_s3_access_key: cloud.s3AccessKey,
          cloud_s3_secret_key: cloud.s3SecretKey,
          cloud_s3_prefix: cloud.s3Prefix,
          cloud_ftp_host: cloud.ftpHost,
          cloud_ftp_port: String(cloud.ftpPort),
          cloud_ftp_user: cloud.ftpUser,
          cloud_ftp_password: cloud.ftpPassword,
          cloud_ftp_secure: cloud.ftpSecure ? "true" : "false",
          cloud_ftp_path: cloud.ftpPath,
        }),
      });
      if (res.ok) {
        setSavedCloud(true);
        setTimeout(() => setSavedCloud(false), 3000);
      }
    } catch {
      // silent
    } finally {
      setSavingCloud(false);
    }
  }

  async function handleTestCloud() {
    setTestingCloud(true);
    setCloudTestResult(null);
    try {
      const res = await fetch("/api/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "test_cloud",
          config: cloud,
        }),
      });
      const data = await res.json();
      setCloudTestResult(data);
    } catch {
      setCloudTestResult({ success: false, error: "Erreur de connexion" });
    } finally {
      setTestingCloud(false);
    }
  }

  function handleDownload(filename: string) {
    window.open(`/api/backup/${encodeURIComponent(filename)}`, "_blank");
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setMessage(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/backup/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (res.ok) {
        setMessage({ type: "success", text: `Backup importé: ${data.backup.filename} (${data.backup.sizeFormatted})` });
        await loadBackups();
      } else {
        setMessage({ type: "error", text: data.error || "Erreur lors de l'import" });
      }
    } catch {
      setMessage({ type: "error", text: "Erreur de connexion" });
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleString("fr-FR", {
      timeZone: "Europe/Paris",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function locationBadge(location: string) {
    switch (location) {
      case "both":
        return <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700"><Server className="h-3 w-3" /><Cloud className="h-3 w-3" /></span>;
      case "cloud":
        return <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-700"><Cloud className="h-3 w-3" /> Cloud</span>;
      default:
        return <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600"><Server className="h-3 w-3" /> Local</span>;
    }
  }

  if (!isAdmin && !loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-slate-500">Accès réservé aux administrateurs</p>
      </div>
    );
  }

  const inputClass = "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="lg:col-span-2">
        <div className="flex items-center gap-3 mb-1">
          <a href="/settings" className="text-slate-400 hover:text-slate-600 transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </a>
          <h1 className="text-2xl font-bold text-slate-900">Sauvegardes</h1>
        </div>
        <p className="text-sm text-slate-500 ml-8">Gestion des backups de la base de données</p>
      </div>

      {/* Message */}
      {message && (
        <div className={`lg:col-span-2 rounded-xl border p-4 flex items-center gap-3 ${
          message.type === "success"
            ? "bg-emerald-50 border-emerald-200 text-emerald-700"
            : "bg-red-50 border-red-200 text-red-700"
        }`}>
          {message.type === "success" ? (
            <CheckCircle2 className="h-5 w-5 shrink-0" />
          ) : (
            <AlertTriangle className="h-5 w-5 shrink-0" />
          )}
          <p className="text-sm">{message.text}</p>
          <button onClick={() => setMessage(null)} className="ml-auto text-current opacity-60 hover:opacity-100">
            &times;
          </button>
        </div>
      )}

      {/* Configuration backup automatique */}
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="rounded-lg bg-blue-100 p-2">
            <Settings className="h-4 w-4 text-blue-600" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-slate-900">Backup automatique</h3>
            <p className="text-xs text-slate-400">Configuration de la planification</p>
          </div>
        </div>

        <div className="space-y-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <div
              className={`relative w-11 h-6 rounded-full transition-colors ${settings.enabled ? "bg-blue-600" : "bg-slate-300"}`}
              onClick={() => setSettings({ ...settings, enabled: !settings.enabled })}
            >
              <div className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${settings.enabled ? "translate-x-5" : ""}`} />
            </div>
            <span className="text-sm text-slate-700">Activer les backups automatiques</span>
          </label>

          {settings.enabled && (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Fréquence</label>
                <select
                  value={settings.frequency}
                  onChange={(e) => setSettings({ ...settings, frequency: e.target.value as BackupSettings["frequency"] })}
                  className={inputClass}
                >
                  <option value="daily">Quotidien</option>
                  <option value="weekly">Hebdomadaire</option>
                  <option value="monthly">Mensuel</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Heure (Europe/Paris)</label>
                <input type="time" value={settings.time} onChange={(e) => setSettings({ ...settings, time: e.target.value })} className={inputClass} />
              </div>

              {settings.frequency === "weekly" && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Jour de la semaine</label>
                  <select value={settings.day} onChange={(e) => setSettings({ ...settings, day: parseInt(e.target.value) })} className={inputClass}>
                    <option value={1}>Lundi</option>
                    <option value={2}>Mardi</option>
                    <option value={3}>Mercredi</option>
                    <option value={4}>Jeudi</option>
                    <option value={5}>Vendredi</option>
                    <option value={6}>Samedi</option>
                    <option value={0}>Dimanche</option>
                  </select>
                </div>
              )}

              {settings.frequency === "monthly" && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Jour du mois</label>
                  <select value={settings.day} onChange={(e) => setSettings({ ...settings, day: parseInt(e.target.value) })} className={inputClass}>
                    {Array.from({ length: 28 }, (_, i) => (
                      <option key={i + 1} value={i + 1}>{i + 1}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Rétention (nombre de backups conservés)</label>
                <input type="number" min={1} max={90} value={settings.retention} onChange={(e) => setSettings({ ...settings, retention: parseInt(e.target.value) || 7 })} className={inputClass} />
              </div>

              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={settings.notifyOnFailure} onChange={(e) => setSettings({ ...settings, notifyOnFailure: e.target.checked })} className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                <span className="text-sm text-slate-700">Notification email en cas d&apos;échec</span>
              </label>
            </>
          )}

          <button onClick={handleSaveSettings} disabled={saving} className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saved ? "Enregistré !" : "Enregistrer"}
          </button>
        </div>
      </div>

      {/* Backup manuel + liste + upload */}
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="rounded-lg bg-emerald-100 p-2">
            <Database className="h-4 w-4 text-emerald-600" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-slate-900">Backup manuel</h3>
            <p className="text-xs text-slate-400">Créer, importer ou gérer les backups</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex gap-3">
            <button onClick={handleCreate} disabled={creating} className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-3 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors">
              {creating ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Backup en cours...</>
              ) : (
                <><Plus className="h-4 w-4" /> Créer un backup</>
              )}
            </button>
            <label className="flex-1 flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-300 px-4 py-3 text-sm font-medium text-slate-600 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 cursor-pointer transition-colors">
              {uploading ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Import en cours...</>
              ) : (
                <><Upload className="h-4 w-4" /> Importer un backup</>
              )}
              <input type="file" accept=".sql,.gz,.dump" onChange={handleUpload} disabled={uploading} className="hidden" />
            </label>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg bg-slate-50 p-3 text-center">
              <p className="text-2xl font-bold text-slate-900">{backups.length}</p>
              <p className="text-xs text-slate-500">Backups stockés</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-3 text-center">
              <p className="text-2xl font-bold text-slate-900">
                {backups.length > 0
                  ? backups.reduce((sum, b) => sum + b.size, 0) > 1024 * 1024
                    ? `${(backups.reduce((sum, b) => sum + b.size, 0) / (1024 * 1024)).toFixed(1)} Mo`
                    : `${(backups.reduce((sum, b) => sum + b.size, 0) / 1024).toFixed(0)} Ko`
                  : "0"}
              </p>
              <p className="text-xs text-slate-500">Espace total</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-3 text-center">
              <p className="text-2xl font-bold text-slate-900 truncate text-sm">
                {backups.length > 0 ? formatDate(backups[0].createdAt) : "—"}
              </p>
              <p className="text-xs text-slate-500">Dernier backup</p>
            </div>
          </div>

          {cloud.provider !== "none" && (
            <div className="rounded-lg bg-indigo-50 border border-indigo-100 p-3">
              <div className="flex items-center gap-2 text-sm text-indigo-700">
                <Cloud className="h-4 w-4" />
                <span>Cloud actif: {cloud.provider === "s3" ? `S3 (${cloud.s3Bucket})` : `FTP (${cloud.ftpHost})`}</span>
              </div>
            </div>
          )}

          {/* Backup list */}
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            </div>
          ) : backups.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <Database className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Aucun backup disponible</p>
              <p className="text-xs mt-1">Créez votre premier backup ou importez-en un</p>
            </div>
          ) : (
            <div className="overflow-x-auto -mx-6 px-6">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left py-2 px-3 text-xs font-medium text-slate-500 uppercase">Fichier</th>
                    <th className="text-left py-2 px-3 text-xs font-medium text-slate-500 uppercase">Type</th>
                    <th className="text-left py-2 px-3 text-xs font-medium text-slate-500 uppercase">Stockage</th>
                    <th className="text-left py-2 px-3 text-xs font-medium text-slate-500 uppercase">Taille</th>
                    <th className="text-left py-2 px-3 text-xs font-medium text-slate-500 uppercase">Date</th>
                    <th className="text-right py-2 px-3 text-xs font-medium text-slate-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {backups.map((backup) => (
                    <tr key={backup.filename} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                      <td className="py-2 px-3">
                        <div className="flex items-center gap-2">
                          <Database className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <span className="font-mono text-xs text-slate-700 truncate max-w-[250px]">{backup.filename}</span>
                        </div>
                      </td>
                      <td className="py-2 px-3">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          backup.type === "auto"
                            ? "bg-blue-50 text-blue-700"
                            : "bg-emerald-50 text-emerald-700"
                        }`}>
                          {backup.type === "auto" ? "Auto" : "Manuel"}
                        </span>
                      </td>
                      <td className="py-2 px-3">{locationBadge(backup.location)}</td>
                      <td className="py-2 px-3 text-slate-600 text-xs">{backup.sizeFormatted}</td>
                      <td className="py-2 px-3 text-slate-600 text-xs">{formatDate(backup.createdAt)}</td>
                      <td className="py-2 px-3">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => handleDownload(backup.filename)} className="rounded-lg p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors" title="Télécharger">
                            <Download className="h-3.5 w-3.5" />
                          </button>

                          {confirmRestore === backup.filename ? (
                            <div className="flex items-center gap-1">
                              <button onClick={() => handleRestore(backup.filename)} disabled={restoring === backup.filename} className="rounded-lg px-2 py-1 text-xs bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50">
                                {restoring === backup.filename ? <Loader2 className="h-3 w-3 animate-spin" /> : "Confirmer"}
                              </button>
                              <button onClick={() => setConfirmRestore(null)} className="rounded-lg px-2 py-1 text-xs bg-slate-200 text-slate-600 hover:bg-slate-300">Annuler</button>
                            </div>
                          ) : (
                            <button onClick={() => setConfirmRestore(backup.filename)} className="rounded-lg p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors" title="Restaurer">
                              <RotateCcw className="h-3.5 w-3.5" />
                            </button>
                          )}

                          {confirmDelete === backup.filename ? (
                            <div className="flex items-center gap-1">
                              <button onClick={() => handleDelete(backup.filename)} disabled={deleting === backup.filename} className="rounded-lg px-2 py-1 text-xs bg-red-600 text-white hover:bg-red-700 disabled:opacity-50">
                                {deleting === backup.filename ? <Loader2 className="h-3 w-3 animate-spin" /> : "Supprimer"}
                              </button>
                              <button onClick={() => setConfirmDelete(null)} className="rounded-lg px-2 py-1 text-xs bg-slate-200 text-slate-600 hover:bg-slate-300">Annuler</button>
                            </div>
                          ) : (
                            <button onClick={() => setConfirmDelete(backup.filename)} className="rounded-lg p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors" title="Supprimer">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="rounded-lg bg-amber-50 border border-amber-100 p-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
              <div className="text-xs text-amber-700">
                <p className="font-medium">Attention lors de la restauration</p>
                <p className="mt-1">
                  La restauration remplace toutes les données actuelles. Un backup de sécurité est créé automatiquement avant la restauration.
                </p>
                <p className="mt-1">
                  Les mots de passe chiffrés (SMTP, S3, FTP, clés API) sont automatiquement réinitialisés après la restauration. Vous devrez les re-saisir dans Paramètres.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Cloud Storage Configuration */}
      <div className="lg:col-span-2 rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="rounded-lg bg-sky-100 p-2">
            <Cloud className="h-4 w-4 text-sky-600" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-slate-900">Stockage cloud</h3>
            <p className="text-xs text-slate-400">Envoyer automatiquement les backups vers un stockage distant</p>
          </div>
        </div>

        <div className="space-y-4">
          {/* Provider selector */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Fournisseur</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: "none" as const, label: "Aucun (local uniquement)", icon: HardDrive },
                { value: "s3" as const, label: "S3 / Compatible S3", icon: Cloud },
                { value: "ftp" as const, label: "FTP / SFTP", icon: Server },
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setCloud({ ...cloud, provider: opt.value })}
                  className={`flex items-center gap-2 rounded-lg border p-3 text-left text-sm transition-colors ${
                    cloud.provider === opt.value
                      ? "border-blue-500 bg-blue-50 text-blue-700"
                      : "border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <opt.icon className="h-4 w-4 shrink-0" />
                  <span className="font-medium">{opt.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* S3 Configuration */}
          {cloud.provider === "s3" && (
            <div className="rounded-lg border border-slate-100 bg-slate-50 p-4 space-y-3">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Configuration S3</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Endpoint (vide = AWS)</label>
                  <input
                    type="text"
                    placeholder="https://s3.eu-west-1.amazonaws.com"
                    value={cloud.s3Endpoint}
                    onChange={(e) => setCloud({ ...cloud, s3Endpoint: e.target.value })}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Région</label>
                  <input
                    type="text"
                    placeholder="us-east-1"
                    value={cloud.s3Region}
                    onChange={(e) => setCloud({ ...cloud, s3Region: e.target.value })}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Bucket *</label>
                  <input
                    type="text"
                    placeholder="mon-bucket-backups"
                    value={cloud.s3Bucket}
                    onChange={(e) => setCloud({ ...cloud, s3Bucket: e.target.value })}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Préfixe (dossier)</label>
                  <input
                    type="text"
                    placeholder="backups/"
                    value={cloud.s3Prefix}
                    onChange={(e) => setCloud({ ...cloud, s3Prefix: e.target.value })}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Access Key *</label>
                  <input
                    type="text"
                    placeholder="AKIA..."
                    value={cloud.s3AccessKey}
                    onChange={(e) => setCloud({ ...cloud, s3AccessKey: e.target.value })}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Secret Key *</label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={cloud.s3SecretKey}
                    onChange={(e) => setCloud({ ...cloud, s3SecretKey: e.target.value })}
                    className={inputClass}
                  />
                </div>
              </div>
              <p className="text-xs text-slate-400">
                Compatible avec AWS S3, MinIO, OVH Object Storage, Scaleway, DigitalOcean Spaces, Backblaze B2, etc.
              </p>
            </div>
          )}

          {/* FTP Configuration */}
          {cloud.provider === "ftp" && (
            <div className="rounded-lg border border-slate-100 bg-slate-50 p-4 space-y-3">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Configuration FTP / SFTP</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Serveur *</label>
                  <input
                    type="text"
                    placeholder="ftp.exemple.com"
                    value={cloud.ftpHost}
                    onChange={(e) => setCloud({ ...cloud, ftpHost: e.target.value })}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Port</label>
                  <input
                    type="number"
                    placeholder="21"
                    value={cloud.ftpPort}
                    onChange={(e) => setCloud({ ...cloud, ftpPort: parseInt(e.target.value) || 21 })}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Utilisateur *</label>
                  <input
                    type="text"
                    placeholder="backup_user"
                    value={cloud.ftpUser}
                    onChange={(e) => setCloud({ ...cloud, ftpUser: e.target.value })}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Mot de passe *</label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={cloud.ftpPassword}
                    onChange={(e) => setCloud({ ...cloud, ftpPassword: e.target.value })}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Dossier distant</label>
                  <input
                    type="text"
                    placeholder="/backups"
                    value={cloud.ftpPath}
                    onChange={(e) => setCloud({ ...cloud, ftpPath: e.target.value })}
                    className={inputClass}
                  />
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 cursor-pointer pb-2">
                    <input
                      type="checkbox"
                      checked={cloud.ftpSecure}
                      onChange={(e) => setCloud({ ...cloud, ftpSecure: e.target.checked })}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-slate-700">Connexion sécurisée (FTPS)</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Cloud actions */}
          {cloud.provider !== "none" && (
            <div className="flex items-center gap-3">
              <button
                onClick={handleTestCloud}
                disabled={testingCloud}
                className="flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors"
              >
                {testingCloud ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plug className="h-4 w-4" />}
                Tester la connexion
              </button>
              <button
                onClick={handleSaveCloud}
                disabled={savingCloud}
                className="flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50 transition-colors"
              >
                {savingCloud ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {savedCloud ? "Enregistré !" : "Enregistrer la config cloud"}
              </button>
            </div>
          )}

          {cloudTestResult && (
            <div className={`rounded-lg border p-3 text-sm ${
              cloudTestResult.success
                ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                : "bg-red-50 border-red-200 text-red-700"
            }`}>
              {cloudTestResult.success ? (
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Connexion réussie !</span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  <span>Échec: {cloudTestResult.error}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Guide de migration */}
      <div className="lg:col-span-2 rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="rounded-lg bg-violet-100 p-2">
            <HardDrive className="h-4 w-4 text-violet-600" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-slate-900">Migration vers une nouvelle machine</h3>
            <p className="text-xs text-slate-400">Procédure pour transférer toutes les données</p>
          </div>
        </div>

        <div className="space-y-3">
          {[
            {
              step: "1",
              title: "Créer un backup sur l'ancienne machine",
              desc: "Cliquez sur « Créer un backup » ci-dessus. Le fichier .tar.gz contient la base de données complète et les fichiers uploadés.",
            },
            {
              step: "2",
              title: "Télécharger le backup",
              desc: "Téléchargez le fichier .tar.gz sur votre poste. Si le stockage cloud est configuré, le backup y est aussi disponible.",
            },
            {
              step: "3",
              title: "Installer sur la nouvelle machine",
              desc: "Lancez setup.sh ou docker compose up -d. L'application démarre avec une base vide et un compte admin par défaut. Pas besoin de copier le .env — le script en génère un nouveau.",
            },
            {
              step: "4",
              title: "Importer et restaurer le backup",
              desc: "Connectez-vous avec le compte admin par défaut, allez dans /backup, importez le fichier .tar.gz, puis cliquez sur « Restaurer ». Toutes les données, paramètres et comptes utilisateurs seront restaurés.",
            },
            {
              step: "5",
              title: "Re-saisir les mots de passe",
              desc: "Les mots de passe chiffrés (SMTP, clés API, cloud) sont automatiquement réinitialisés. Allez dans Paramètres pour les re-saisir.",
            },
          ].map((item) => (
            <div key={item.step} className="flex gap-3">
              <div className="shrink-0 w-7 h-7 rounded-full bg-violet-100 flex items-center justify-center">
                <span className="text-xs font-bold text-violet-700">{item.step}</span>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-800">{item.title}</p>
                <p className="text-xs text-slate-500 mt-0.5">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 rounded-lg bg-violet-50 border border-violet-100 p-3">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 text-violet-600 mt-0.5 shrink-0" />
            <div className="text-xs text-violet-700">
              <p className="font-medium">Données incluses dans le backup</p>
              <p className="mt-1">
                Base de données complète (clients, factures, produits, installations, paramètres, comptes utilisateurs, historique d&apos;activité)
                + fichiers uploadés (logos, pièces jointes). Aucun fichier à copier manuellement — seuls les mots de passe chiffrés sont à re-saisir après restauration.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
