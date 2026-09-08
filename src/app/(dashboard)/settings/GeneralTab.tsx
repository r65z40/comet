"use client";

import { useState, useEffect, useRef } from "react";
import {
  Save,
  Loader2,
  Plug,
  Upload,
  Bell,
  FileText,
  Palette,
  Megaphone,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Heading1,
  Heading2,
  Type,
  List,
  ListOrdered,
  Link,
  AlignLeft,
  AlignCenter,
  AlignRight,
  ImageIcon,
  Globe,
  X,
  ChevronDown,
} from "lucide-react";

export interface SettingsTabProps {
  settings: Record<string, string>;
  isAdmin: boolean;
  openSections: Record<string, boolean>;
  toggleSection: (key: string) => void;
}

export default function GeneralTab({
  settings,
  isAdmin,
  openSections,
  toggleSection,
}: SettingsTabProps) {
  // Site branding
  const [siteLogo, setSiteLogo] = useState("");
  const [savingSiteLogo, setSavingSiteLogo] = useState(false);
  const [savedSiteLogo, setSavedSiteLogo] = useState(false);
  const siteLogoRef = useRef<HTMLInputElement>(null);
  const [siteFavicon, setSiteFavicon] = useState("");
  const siteFaviconRef = useRef<HTMLInputElement>(null);

  // Broadcast message
  const [broadcastEnabled, setBroadcastEnabled] = useState(false);
  const [broadcastMessage, setBroadcastMessage] = useState("");
  const [broadcastSaving, setBroadcastSaving] = useState(false);
  const [broadcastSaved, setBroadcastSaved] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);
  const [editorReady, setEditorReady] = useState(false);

  useEffect(() => {
    setSiteLogo(settings.site_logo || "");
    setSiteFavicon(settings.site_favicon || "");
    setBroadcastEnabled(settings.broadcast_enabled === "true");
    setBroadcastMessage(settings.broadcast_message || "");
  }, [settings]);

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
      setTimeout(() => setBroadcastSaved(false), 3000);
    } catch {
      // silent
    } finally {
      setBroadcastSaving(false);
    }
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

  return (
    <>
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
                <img src="/logo.svg" alt="Logo par défaut" className="h-16 w-16 rounded-lg bg-white p-1 border border-slate-200 object-contain" />
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
    </>
  );
}
