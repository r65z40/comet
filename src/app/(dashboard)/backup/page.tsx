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
} from "lucide-react";

interface BackupInfo {
  filename: string;
  size: number;
  sizeFormatted: string;
  createdAt: string;
  type: "auto" | "manual";
}

interface BackupSettings {
  enabled: boolean;
  frequency: "daily" | "weekly" | "monthly";
  time: string;
  day: number;
  retention: number;
  notifyOnFailure: boolean;
}

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
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmRestore, setConfirmRestore] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
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
        setMessage({ type: "success", text: "Base de données restaurée avec succès" });
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

  function handleDownload(filename: string) {
    window.open(`/api/backup/${encodeURIComponent(filename)}`, "_blank");
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

  if (!isAdmin && !loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-slate-500">Accès réservé aux administrateurs</p>
      </div>
    );
  }

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
          {/* Toggle */}
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
              {/* Fréquence */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Fréquence</label>
                <select
                  value={settings.frequency}
                  onChange={(e) => setSettings({ ...settings, frequency: e.target.value as BackupSettings["frequency"] })}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="daily">Quotidien</option>
                  <option value="weekly">Hebdomadaire</option>
                  <option value="monthly">Mensuel</option>
                </select>
              </div>

              {/* Heure */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Heure (Europe/Paris)</label>
                <input
                  type="time"
                  value={settings.time}
                  onChange={(e) => setSettings({ ...settings, time: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Jour */}
              {settings.frequency === "weekly" && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Jour de la semaine</label>
                  <select
                    value={settings.day}
                    onChange={(e) => setSettings({ ...settings, day: parseInt(e.target.value) })}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
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
                  <select
                    value={settings.day}
                    onChange={(e) => setSettings({ ...settings, day: parseInt(e.target.value) })}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {Array.from({ length: 28 }, (_, i) => (
                      <option key={i + 1} value={i + 1}>{i + 1}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Rétention */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Rétention (nombre de backups conservés)
                </label>
                <input
                  type="number"
                  min={1}
                  max={90}
                  value={settings.retention}
                  onChange={(e) => setSettings({ ...settings, retention: parseInt(e.target.value) || 7 })}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Notification en cas d'échec */}
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.notifyOnFailure}
                  onChange={(e) => setSettings({ ...settings, notifyOnFailure: e.target.checked })}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-slate-700">Notification email en cas d&apos;échec</span>
              </label>
            </>
          )}

          <button
            onClick={handleSaveSettings}
            disabled={saving}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saved ? "Enregistré !" : "Enregistrer"}
          </button>
        </div>
      </div>

      {/* Backup manuel + stats */}
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="rounded-lg bg-emerald-100 p-2">
            <Database className="h-4 w-4 text-emerald-600" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-slate-900">Backup manuel</h3>
            <p className="text-xs text-slate-400">Créer un backup immédiat de la base</p>
          </div>
        </div>

        <div className="space-y-4">
          <button
            onClick={handleCreate}
            disabled={creating}
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-3 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
          >
            {creating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Backup en cours...
              </>
            ) : (
              <>
                <Plus className="h-4 w-4" />
                Créer un backup maintenant
              </>
            )}
          </button>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3">
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
          </div>

          {backups.length > 0 && (
            <div className="rounded-lg bg-blue-50 border border-blue-100 p-3">
              <div className="flex items-center gap-2 text-sm text-blue-700">
                <Clock className="h-4 w-4" />
                <span>Dernier backup: {formatDate(backups[0].createdAt)}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Liste des backups */}
      <div className="lg:col-span-2 rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="rounded-lg bg-purple-100 p-2">
            <HardDrive className="h-4 w-4 text-purple-600" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-slate-900">Historique des backups</h3>
            <p className="text-xs text-slate-400">{backups.length} backup(s) disponible(s)</p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          </div>
        ) : backups.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <Database className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Aucun backup disponible</p>
            <p className="text-xs mt-1">Créez votre premier backup ou activez les backups automatiques</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase">Fichier</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase">Type</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase">Taille</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase">Date</th>
                  <th className="text-right py-3 px-4 text-xs font-medium text-slate-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody>
                {backups.map((backup) => (
                  <tr key={backup.filename} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <Database className="h-4 w-4 text-slate-400" />
                        <span className="font-mono text-xs text-slate-700 truncate max-w-[300px]">{backup.filename}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        backup.type === "auto"
                          ? "bg-blue-50 text-blue-700"
                          : "bg-emerald-50 text-emerald-700"
                      }`}>
                        {backup.type === "auto" ? "Automatique" : "Manuel"}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600">{backup.sizeFormatted}</td>
                    <td className="py-3 px-4 text-slate-600">{formatDate(backup.createdAt)}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-end gap-1">
                        {/* Download */}
                        <button
                          onClick={() => handleDownload(backup.filename)}
                          className="rounded-lg p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                          title="Télécharger"
                        >
                          <Download className="h-4 w-4" />
                        </button>

                        {/* Restore */}
                        {confirmRestore === backup.filename ? (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleRestore(backup.filename)}
                              disabled={restoring === backup.filename}
                              className="rounded-lg px-2 py-1 text-xs bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50"
                            >
                              {restoring === backup.filename ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                "Confirmer"
                              )}
                            </button>
                            <button
                              onClick={() => setConfirmRestore(null)}
                              className="rounded-lg px-2 py-1 text-xs bg-slate-200 text-slate-600 hover:bg-slate-300"
                            >
                              Annuler
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmRestore(backup.filename)}
                            className="rounded-lg p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                            title="Restaurer"
                          >
                            <RotateCcw className="h-4 w-4" />
                          </button>
                        )}

                        {/* Delete */}
                        {confirmDelete === backup.filename ? (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleDelete(backup.filename)}
                              disabled={deleting === backup.filename}
                              className="rounded-lg px-2 py-1 text-xs bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                            >
                              {deleting === backup.filename ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                "Supprimer"
                              )}
                            </button>
                            <button
                              onClick={() => setConfirmDelete(null)}
                              className="rounded-lg px-2 py-1 text-xs bg-slate-200 text-slate-600 hover:bg-slate-300"
                            >
                              Annuler
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmDelete(backup.filename)}
                            className="rounded-lg p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                            title="Supprimer"
                          >
                            <Trash2 className="h-4 w-4" />
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

        {/* Warning banner */}
        <div className="mt-4 rounded-lg bg-amber-50 border border-amber-100 p-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
            <div className="text-xs text-amber-700">
              <p className="font-medium">Attention lors de la restauration</p>
              <p className="mt-1">
                La restauration remplace les données actuelles par celles du backup.
                Créez un backup manuel avant de restaurer pour pouvoir revenir en arrière si nécessaire.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
