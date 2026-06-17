"use client";

import { useState } from "react";
import {
  Globe,
  UserPlus,
  Eye,
  EyeOff,
  Trash2,
  Palette,
  Save,
  Loader2,
  Link as LinkIcon,
  Check,
  Copy,
  X,
} from "lucide-react";

interface PortalUser {
  id: string;
  name: string;
  email: string;
  active: boolean;
  createdAt: string;
}

interface PortalSettings {
  primaryColor: string;
  headerLogo: string | null;
  welcomeMessage: string | null;
  welcomeTitle: string | null;
  welcomeContent: string | null;
  showStats: boolean;
  showExpiring: boolean;
  showFamily: boolean;
  showSupplier: boolean;
  showDuration: boolean;
  showQuantity: boolean;
  showComParc: boolean;
  showHeaderRow: boolean;
  footerText: string | null;
}

const DEFAULT_PORTAL_SETTINGS: PortalSettings = {
  primaryColor: "#3b82f6",
  headerLogo: null,
  welcomeMessage: null,
  welcomeTitle: null,
  welcomeContent: null,
  showStats: true,
  showExpiring: true,
  showFamily: true,
  showSupplier: true,
  showDuration: true,
  showQuantity: false,
  showComParc: false,
  showHeaderRow: true,
  footerText: null,
};

export default function ClientPortalSection({ clientId }: { clientId: string }) {
  const [portalOpen, setPortalOpen] = useState(false);
  const [portalUsers, setPortalUsers] = useState<PortalUser[]>([]);
  const [portalSettings, setPortalSettings] = useState<PortalSettings | null>(null);
  const [portalLoaded, setPortalLoaded] = useState(false);
  const [portalSaving, setPortalSaving] = useState(false);
  const [newPortalUser, setNewPortalUser] = useState({ name: "", email: "" });
  const [portalUserCreating, setPortalUserCreating] = useState(false);
  const [inviteLink, setInviteLink] = useState<{ userId: string; url: string; emailSent?: boolean } | null>(null);
  const [inviteCopied, setInviteCopied] = useState(false);
  const [inviteGenerating, setInviteGenerating] = useState<string | null>(null);

  async function loadPortal() {
    if (portalLoaded) return;
    const res = await fetch(`/api/clients/${clientId}/portal`);
    const data = await res.json();
    setPortalUsers(data.portalUsers || []);
    setPortalSettings(data.portalSettings || DEFAULT_PORTAL_SETTINGS);
    setPortalLoaded(true);
  }

  async function savePortalSettings() {
    if (!portalSettings) return;
    setPortalSaving(true);
    await fetch(`/api/clients/${clientId}/portal`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(portalSettings),
    });
    setPortalSaving(false);
  }

  async function createPortalUser() {
    if (!newPortalUser.name || !newPortalUser.email) return;
    setPortalUserCreating(true);
    const res = await fetch(`/api/clients/${clientId}/portal/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newPortalUser),
    });
    if (res.ok) {
      const user = await res.json();
      setPortalUsers((prev) => [user, ...prev]);
      setNewPortalUser({ name: "", email: "" });
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
      const res = await fetch(`/api/clients/${clientId}/portal/users/${userId}/invite`, { method: "POST" });
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
    await fetch(`/api/clients/${clientId}/portal/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active }),
    });
    setPortalUsers((prev) => prev.map((u) => u.id === userId ? { ...u, active } : u));
  }

  async function deletePortalUser(userId: string) {
    if (!confirm("Supprimer cet accès client ?")) return;
    await fetch(`/api/clients/${clientId}/portal/users/${userId}`, { method: "DELETE" });
    setPortalUsers((prev) => prev.filter((u) => u.id !== userId));
  }

  return (
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
          <div>
            <h4 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
              <UserPlus className="h-4 w-4" /> Comptes d&apos;accès
            </h4>

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
  );
}
