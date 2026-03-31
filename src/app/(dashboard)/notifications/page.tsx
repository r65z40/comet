"use client";

import { useState, useEffect } from "react";
import { Bell, Mail, VolumeX, Save, Check } from "lucide-react";

interface Preferences {
  cardAssigned: boolean;
  cardComment: boolean;
  cardMoved: boolean;
  cardArchived: boolean;
  cardDueDate: boolean;
  ticketNew: boolean;
  ticketReply: boolean;
  emailCardAssigned: boolean;
  emailCardComment: boolean;
  emailTicketNew: boolean;
  emailTicketReply: boolean;
  muteAll: boolean;
  emailEnabled: boolean;
}

const defaultPrefs: Preferences = {
  cardAssigned: true,
  cardComment: true,
  cardMoved: true,
  cardArchived: true,
  cardDueDate: true,
  ticketNew: true,
  ticketReply: true,
  emailCardAssigned: false,
  emailCardComment: false,
  emailTicketNew: true,
  emailTicketReply: true,
  muteAll: false,
  emailEnabled: true,
};

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
        disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
      } ${checked ? "bg-primary-600" : "bg-slate-300"}`}
    >
      <span
        className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
          checked ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}

export default function NotificationsPage() {
  const [prefs, setPrefs] = useState<Preferences>(defaultPrefs);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/notifications/preferences")
      .then((r) => r.json())
      .then((data) => {
        const merged = { ...defaultPrefs };
        for (const key of Object.keys(defaultPrefs)) {
          if (typeof data[key] === "boolean") {
            (merged as Record<string, boolean>)[key] = data[key];
          }
        }
        setPrefs(merged);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch("/api/notifications/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(prefs),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } finally {
      setSaving(false);
    }
  }

  function update(field: keyof Preferences, value: boolean) {
    setPrefs((p) => ({ ...p, [field]: value }));
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-2 border-primary-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  const inAppDisabled = prefs.muteAll;
  const emailDisabled = prefs.muteAll || !prefs.emailEnabled;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Préférences de notifications</h1>
        <p className="mt-1 text-sm text-slate-500">
          Gérez les notifications que vous recevez dans l&apos;application et par email.
        </p>
      </div>

      {/* Global toggles */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="p-5 space-y-4">
          <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
            <VolumeX className="h-5 w-5 text-slate-400" />
            Contrôles globaux
          </h2>

          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium text-slate-700">Désactiver toutes les notifications</p>
              <p className="text-xs text-slate-400">Aucune notification ne sera créée ni envoyée</p>
            </div>
            <Toggle checked={prefs.muteAll} onChange={(v) => update("muteAll", v)} />
          </div>

          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium text-slate-700">Activer les emails</p>
              <p className="text-xs text-slate-400">Recevoir des notifications par email en plus de l&apos;application</p>
            </div>
            <Toggle
              checked={prefs.emailEnabled}
              onChange={(v) => update("emailEnabled", v)}
              disabled={prefs.muteAll}
            />
          </div>
        </div>
      </div>

      {/* In-app notifications */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="p-5 space-y-4">
          <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
            <Bell className="h-5 w-5 text-slate-400" />
            Notifications dans l&apos;application
          </h2>

          <div className="space-y-1">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Board</p>
            {[
              { key: "cardAssigned" as const, label: "Carte assignée", desc: "Quand une carte vous est assignée" },
              { key: "cardComment" as const, label: "Commentaire sur carte", desc: "Quand quelqu'un commente sur votre carte" },
              { key: "cardMoved" as const, label: "Carte déplacée", desc: "Quand une de vos cartes change de colonne" },
              { key: "cardArchived" as const, label: "Carte archivée", desc: "Quand une de vos cartes est archivée" },
              { key: "cardDueDate" as const, label: "Date limite ajoutée", desc: "Quand une date limite est définie sur votre carte" },
            ].map((item) => (
              <div key={item.key} className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-slate-50">
                <div>
                  <p className="text-sm font-medium text-slate-700">{item.label}</p>
                  <p className="text-xs text-slate-400">{item.desc}</p>
                </div>
                <Toggle checked={prefs[item.key]} onChange={(v) => update(item.key, v)} disabled={inAppDisabled} />
              </div>
            ))}
          </div>

          <div className="space-y-1 pt-2 border-t border-slate-100">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Tickets</p>
            {[
              { key: "ticketNew" as const, label: "Nouveau ticket", desc: "Quand un client ouvre un ticket" },
              { key: "ticketReply" as const, label: "Réponse ticket", desc: "Quand un client répond à un ticket" },
            ].map((item) => (
              <div key={item.key} className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-slate-50">
                <div>
                  <p className="text-sm font-medium text-slate-700">{item.label}</p>
                  <p className="text-xs text-slate-400">{item.desc}</p>
                </div>
                <Toggle checked={prefs[item.key]} onChange={(v) => update(item.key, v)} disabled={inAppDisabled} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Email notifications */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="p-5 space-y-4">
          <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
            <Mail className="h-5 w-5 text-slate-400" />
            Notifications par email
          </h2>

          <div className="space-y-1">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Board</p>
            {[
              { key: "emailCardAssigned" as const, label: "Carte assignée", desc: "Recevoir un email quand une carte vous est assignée" },
              { key: "emailCardComment" as const, label: "Commentaire sur carte", desc: "Recevoir un email quand quelqu'un commente sur votre carte" },
            ].map((item) => (
              <div key={item.key} className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-slate-50">
                <div>
                  <p className="text-sm font-medium text-slate-700">{item.label}</p>
                  <p className="text-xs text-slate-400">{item.desc}</p>
                </div>
                <Toggle checked={prefs[item.key]} onChange={(v) => update(item.key, v)} disabled={emailDisabled} />
              </div>
            ))}
          </div>

          <div className="space-y-1 pt-2 border-t border-slate-100">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Tickets</p>
            {[
              { key: "emailTicketNew" as const, label: "Nouveau ticket", desc: "Recevoir un email quand un client ouvre un ticket" },
              { key: "emailTicketReply" as const, label: "Réponse ticket", desc: "Recevoir un email quand un client répond à un ticket" },
            ].map((item) => (
              <div key={item.key} className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-slate-50">
                <div>
                  <p className="text-sm font-medium text-slate-700">{item.label}</p>
                  <p className="text-xs text-slate-400">{item.desc}</p>
                </div>
                <Toggle checked={prefs[item.key]} onChange={(v) => update(item.key, v)} disabled={emailDisabled} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Save button */}
      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50 transition-colors"
        >
          {saving ? (
            <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
          ) : saved ? (
            <Check className="h-4 w-4" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {saved ? "Enregistré" : "Enregistrer"}
        </button>
        {saved && <span className="text-sm text-green-600">Préférences mises à jour</span>}
      </div>
    </div>
  );
}
