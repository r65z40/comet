"use client";

import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import {
  Save,
  Loader2,
  Key,
  Globe,
  Plug,
  Send,
  ChevronDown,
  HardDrive,
  Shield,
  Music,
  LogIn,
  LogOut,
  Wifi,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { SettingsTabProps } from "./GeneralTab";

export default function IntegrationsTab({
  settings,
  isAdmin,
  openSections,
  toggleSection,
}: SettingsTabProps) {
  // Axonaut
  const [newApiKey, setNewApiKey] = useState("");
  const [apiUrl, setApiUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

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

  // Omada settings
  const [omadaClientId, setOmadaClientId] = useState("");
  const [omadaClientSecret, setOmadaClientSecret] = useState("");
  const [omadaBaseUrl, setOmadaBaseUrl] = useState("");
  const [omadaControllerId, setOmadaControllerId] = useState("");
  const [omadaUsername, setOmadaUsername] = useState("");
  const [omadaPassword, setOmadaPassword] = useState("");
  const [omadaAuthMode, setOmadaAuthMode] = useState<"openapi" | "web">("openapi");
  const [omadaEnabled, setOmadaEnabled] = useState(false);
  const [savingOmada, setSavingOmada] = useState(false);
  const [savedOmada, setSavedOmada] = useState(false);
  const [testingOmada, setTestingOmada] = useState(false);
  const [omadaTestResult, setOmadaTestResult] = useState<{ success: boolean; error?: string; sites?: number; devices?: number; debug?: string } | null>(null);

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
      window.history.replaceState({}, "", "/settings");
    } else if (error) {
      spotifyParamsHandled.current = true;
      setSpotifyMessage({ type: "error", text: `Erreur Spotify : ${error}` });
      window.history.replaceState({}, "", "/settings");
    }
  }, [searchParams]);

  useEffect(() => {
    setApiUrl(settings.axonaut_api_url || "https://axonaut.com/api/v2");
    setAteraApiKey(settings.atera_api_key || "");
    setAteraEnabled(settings.atera_enabled === "true");
    setOxiboxApiKey(settings.oxibox_api_key || "");
    setEmsisoftApiKey(settings.emsisoft_api_key || "");
    setEmsisoftApiUrl(settings.emsisoft_api_url || "https://api.emsisoft.com/v1");
    setEmsisoftEnabled(settings.emsisoft_enabled === "true");
    setOmadaClientId(settings.omada_client_id || "");
    setOmadaClientSecret(settings.omada_client_secret || "");
    setOmadaBaseUrl(settings.omada_base_url || "");
    setOmadaControllerId(settings.omada_controller_id || "");
    setOmadaUsername(settings.omada_username || "");
    setOmadaPassword(settings.omada_password || "");
    setOmadaAuthMode(settings.omada_username ? "web" : "openapi");
    setOmadaEnabled(settings.omada_enabled === "true");
    setSpotifyClientId(settings.spotify_client_id || "");
    setSpotifyClientSecret(settings.spotify_client_secret || "");
    setSpotifyRedirectUri(settings.spotify_redirect_uri || "");
    setSpotifyConnected(!!(settings.spotify_access_token || settings.spotify_refresh_token));
  }, [settings]);

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

  return (
    <>
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

      {/* Omada Integration */}
      {isAdmin && <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <button onClick={() => toggleSection("omada")} className="w-full flex items-center justify-between p-6 text-left hover:bg-slate-50 transition-colors">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-cyan-50 p-2">
              <Wifi className="h-4 w-4 text-cyan-600" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-slate-900">Omada</h3>
              <p className="text-xs text-slate-400">Supervision réseau TP-Link Omada</p>
            </div>
          </div>
          <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${openSections.omada ? "rotate-180" : ""}`} />
        </button>
        {openSections.omada && <div className="px-6 pb-6 space-y-4 border-t border-slate-100 pt-5">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1.5">URL du contrôleur</label>
            <input
              type="text"
              value={omadaBaseUrl}
              onChange={(e) => setOmadaBaseUrl(e.target.value)}
              placeholder="https://use1-omada-northbound.tplinkcloud.com"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
            />
            <p className="text-[11px] text-slate-400 mt-1">URL cloud (ex: use1-omada-northbound.tplinkcloud.com) ou locale (ex: https://192.168.1.1:8043)</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1.5">Controller ID (omadacId)</label>
            <input
              type="text"
              value={omadaControllerId}
              onChange={(e) => setOmadaControllerId(e.target.value)}
              placeholder="ID du contrôleur Omada"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
            />
            <p className="text-[11px] text-slate-400 mt-1">Visible dans Global View &gt; Settings &gt; Platform Integration &gt; Open API</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1.5">Mode d&apos;authentification</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setOmadaAuthMode("openapi")}
                className={cn("flex-1 px-3 py-2 text-sm rounded-lg border transition-colors", omadaAuthMode === "openapi" ? "bg-cyan-50 border-cyan-300 text-cyan-700 font-medium" : "border-slate-200 text-slate-500 hover:bg-slate-50")}
              >
                Open API (Client ID/Secret)
              </button>
              <button
                type="button"
                onClick={() => setOmadaAuthMode("web")}
                className={cn("flex-1 px-3 py-2 text-sm rounded-lg border transition-colors", omadaAuthMode === "web" ? "bg-cyan-50 border-cyan-300 text-cyan-700 font-medium" : "border-slate-200 text-slate-500 hover:bg-slate-50")}
              >
                Login Web (Username/Password)
              </button>
            </div>
          </div>

          {omadaAuthMode === "openapi" ? (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1.5">Client ID</label>
                  <input
                    type="text"
                    value={omadaClientId}
                    onChange={(e) => setOmadaClientId(e.target.value)}
                    placeholder="Client ID"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1.5">Client Secret</label>
                  <input
                    type="password"
                    value={omadaClientSecret}
                    onChange={(e) => setOmadaClientSecret(e.target.value)}
                    placeholder="Client Secret"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                  />
                </div>
              </div>
              <p className="text-[11px] text-slate-400 -mt-2">Créez une application dans Omada &gt; Global View &gt; Settings &gt; Platform Integration &gt; Open API</p>
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1.5">Nom d&apos;utilisateur</label>
                  <input
                    type="text"
                    value={omadaUsername}
                    onChange={(e) => setOmadaUsername(e.target.value)}
                    placeholder="admin"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1.5">Mot de passe</label>
                  <input
                    type="password"
                    value={omadaPassword}
                    onChange={(e) => setOmadaPassword(e.target.value)}
                    placeholder="Mot de passe Omada"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                  />
                </div>
              </div>
              <p className="text-[11px] text-slate-400 -mt-2">Identifiants de connexion à l&apos;interface web du contrôleur Omada</p>
            </>
          )}

          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={omadaEnabled} onChange={(e) => setOmadaEnabled(e.target.checked)} className="rounded border-slate-300 text-cyan-600 focus:ring-cyan-500" />
            <span className="text-sm text-slate-700">Activer l&apos;intégration Omada</span>
          </label>

          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={async () => {
                setSavingOmada(true);
                setSavedOmada(false);
                setOmadaTestResult(null);
                await fetch("/api/settings", {
                  method: "PUT",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    omada_base_url: omadaBaseUrl,
                    omada_controller_id: omadaControllerId,
                    omada_client_id: omadaAuthMode === "openapi" ? omadaClientId : "",
                    omada_client_secret: omadaAuthMode === "openapi" ? omadaClientSecret : "",
                    omada_username: omadaAuthMode === "web" ? omadaUsername : "",
                    omada_password: omadaAuthMode === "web" ? omadaPassword : "",
                    omada_enabled: omadaEnabled ? "true" : "false",
                  }),
                });
                setSavingOmada(false);
                setSavedOmada(true);
                setTimeout(() => setSavedOmada(false), 3000);
              }}
              disabled={savingOmada}
              className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50 transition-colors"
            >
              {savingOmada ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Enregistrer
            </button>
            <button
              onClick={async () => {
                setTestingOmada(true);
                setOmadaTestResult(null);
                await fetch("/api/settings", {
                  method: "PUT",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    omada_base_url: omadaBaseUrl,
                    omada_controller_id: omadaControllerId,
                    omada_client_id: omadaAuthMode === "openapi" ? omadaClientId : "",
                    omada_client_secret: omadaAuthMode === "openapi" ? omadaClientSecret : "",
                    omada_username: omadaAuthMode === "web" ? omadaUsername : "",
                    omada_password: omadaAuthMode === "web" ? omadaPassword : "",
                    omada_enabled: omadaEnabled ? "true" : "false",
                  }),
                });
                const res = await fetch("/api/omada", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ action: "test" }),
                });
                const data = await res.json();
                setOmadaTestResult(data);
                setTestingOmada(false);
              }}
              disabled={testingOmada || (omadaAuthMode === "openapi" ? (!omadaClientId || !omadaClientSecret) : (!omadaUsername || !omadaPassword))}
              className="flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors"
            >
              {testingOmada ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plug className="h-4 w-4" />}
              Tester la connexion
            </button>
            {savedOmada && <span className="text-xs text-emerald-600">Paramètres enregistrés</span>}
          </div>

          {omadaTestResult && (
            <div className={`p-3 rounded-lg text-sm ${omadaTestResult.success ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
              {omadaTestResult.success ? `Connexion Omada réussie ! ${omadaTestResult.sites} site(s), ${omadaTestResult.devices} appareil(s) trouvé(s).` : `Erreur : ${omadaTestResult.error}`}
              {omadaTestResult.debug && (
                <pre className="mt-2 text-xs opacity-70 whitespace-pre-wrap font-mono bg-black/5 rounded p-2">{omadaTestResult.debug}</pre>
              )}
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
    </>
  );
}
