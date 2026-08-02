"use client";

import { useEffect, useState, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { sanitizeHtml } from "@/lib/sanitize";
import {
  ArrowLeft,
  Save,
  Loader2,
  Eye,
  EyeOff,
  Paperclip,
  Trash2,
  Download,
  Upload,
  Globe,
  Lock,
  Users,
  FileText,
  Image as ImageIcon,
  X,
  Building2,
  Edit3,
  FolderOpen,
} from "lucide-react";

const RichTextEditor = dynamic(() => import("@/components/ui/RichTextEditor"), { ssr: false });

interface Category {
  id: string;
  name: string;
}

interface ClientOption {
  id: string;
  name: string;
  logoUrl: string | null;
}

interface Attachment {
  id: string;
  fileName: string;
  fileUrl: string;
  fileType: string;
  fileSize: number;
  createdAt: string;
}

interface Article {
  id: string;
  title: string;
  slug: string;
  content: string;
  categoryId: string | null;
  category: Category | null;
  visibility: string;
  published: boolean;
  clientIds: string | null;
  attachments: Attachment[];
  createdAt: string;
  updatedAt: string;
}

function formatSize(bytes: number): string {
  if (bytes > 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
  if (bytes > 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${bytes} o`;
}

function fileIcon(type: string) {
  if (type.startsWith("image/")) return <ImageIcon className="h-4 w-4 text-purple-500" />;
  if (type.includes("pdf")) return <FileText className="h-4 w-4 text-red-500" />;
  return <FileText className="h-4 w-4 text-slate-400" />;
}

function visibilityInfo(v: string) {
  if (v === "internal") return { label: "Interne", desc: "Visible uniquement par les administrateurs", icon: Lock, color: "text-amber-500", bg: "bg-amber-50" };
  if (v === "client") return { label: "Clients ciblés", desc: "Visible par les clients sélectionnés", icon: Users, color: "text-blue-500", bg: "bg-blue-50" };
  return { label: "Public", desc: "Visible par tous les clients", icon: Globe, color: "text-emerald-500", bg: "bg-emerald-50" };
}

export default function ArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [article, setArticle] = useState<Article | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);

  // Edit state
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [visibility, setVisibility] = useState("internal");
  const [published, setPublished] = useState(false);
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>([]);
  const [clientSearch, setClientSearch] = useState("");

  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const fetchArticle = useCallback(async () => {
    try {
      const [articleRes, catRes, clientsRes] = await Promise.all([
        fetch(`/api/knowledge?id=${id}`),
        fetch("/api/knowledge/categories"),
        fetch("/api/knowledge/clients"),
      ]);
      if (articleRes.ok) {
        const data = await articleRes.json();
        setArticle(data);
        setTitle(data.title);
        setContent(data.content);
        setCategoryId(data.categoryId || "");
        setVisibility(data.visibility);
        setPublished(data.published);
        setSelectedClientIds(data.clientIds ? JSON.parse(data.clientIds) : []);
      }
      if (catRes.ok) setCategories(await catRes.json());
      if (clientsRes.ok) setClients(await clientsRes.json());
    } catch { /* ignore */ }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    fetchArticle();
  }, [fetchArticle]);

  function enterEdit() {
    if (!article) return;
    setTitle(article.title);
    setContent(article.content);
    setCategoryId(article.categoryId || "");
    setVisibility(article.visibility);
    setPublished(article.published);
    setSelectedClientIds(article.clientIds ? JSON.parse(article.clientIds) : []);
    setEditing(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/knowledge", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          title,
          content,
          categoryId: categoryId || null,
          visibility,
          published,
          clientIds: selectedClientIds.length > 0 ? JSON.stringify(selectedClientIds) : null,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setArticle(data);
        setEditing(false);
      }
    } finally {
      setSaving(false);
    }
  }

  function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadProgress(0);

    const xhr = new XMLHttpRequest();
    xhr.upload.addEventListener("progress", (evt) => {
      if (evt.lengthComputable) {
        setUploadProgress(Math.round((evt.loaded / evt.total) * 100));
      }
    });
    xhr.addEventListener("load", () => {
      setUploading(false);
      setUploadProgress(0);
      fetchArticle();
    });
    xhr.addEventListener("error", () => {
      setUploading(false);
      setUploadProgress(0);
    });

    const formData = new FormData();
    formData.append("file", file);
    formData.append("articleId", id);
    xhr.open("POST", "/api/knowledge/attachments");
    xhr.send(formData);

    e.target.value = "";
  }

  async function deleteAttachment(attId: string) {
    await fetch(`/api/knowledge/attachments?id=${attId}`, { method: "DELETE" });
    fetchArticle();
  }

  function toggleClient(clientId: string) {
    setSelectedClientIds(prev =>
      prev.includes(clientId) ? prev.filter(i => i !== clientId) : [...prev, clientId]
    );
  }

  const filteredClients = clients.filter(c =>
    !clientSearch || c.name.toLowerCase().includes(clientSearch.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!article) {
    return (
      <div className="text-center py-20">
        <p className="text-slate-500">Article non trouvé</p>
        <a href="/knowledge" className="text-primary-600 text-sm mt-2 inline-block">Retour</a>
      </div>
    );
  }

  const vis = visibilityInfo(article.visibility);
  const assignedClients = article.clientIds ? clients.filter(c => {
    try { return JSON.parse(article.clientIds!).includes(c.id); } catch { return false; }
  }) : [];

  // ─── PREVIEW MODE ───────────────────────────────────
  if (!editing) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <a href="/knowledge" className="text-slate-400 hover:text-slate-600 transition-colors">
              <ArrowLeft className="h-5 w-5" />
            </a>
            <div>
              <h1 className="text-xl font-bold text-slate-900">{article.title}</h1>
              <div className="flex items-center gap-3 mt-1">
                {article.category && (
                  <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                    <FolderOpen className="h-3 w-3" />
                    {article.category.name}
                  </span>
                )}
                <span className="text-xs text-slate-400">
                  Modifié le {new Date(article.updatedAt).toLocaleDateString("fr-FR")}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${vis.bg} ${vis.color}`}>
              <vis.icon className="h-3.5 w-3.5" />
              {vis.label}
            </span>
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${article.published ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
              {article.published ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
              {article.published ? "Publié" : "Brouillon"}
            </span>
            <button
              onClick={enterEdit}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-600 text-sm font-medium text-white hover:bg-primary-700 transition-colors"
            >
              <Edit3 className="h-4 w-4" />
              Éditer
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Article content */}
          <div className="lg:col-span-2 space-y-4">
            <div className="rounded-xl border border-slate-200 bg-white p-6">
              {article.content ? (
                <div className="prose prose-slate max-w-none text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: sanitizeHtml(article.content) }} />
              ) : (
                <p className="text-sm text-slate-400 italic">Aucun contenu. Cliquez sur Éditer pour rédiger l&apos;article.</p>
              )}
            </div>

            {/* Attachments (read-only) */}
            {article.attachments.length > 0 && (
              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <h3 className="text-sm font-medium text-slate-900 flex items-center gap-2 mb-3">
                  <Paperclip className="h-4 w-4 text-slate-400" />
                  Pièces jointes ({article.attachments.length})
                </h3>
                <div className="space-y-2">
                  {article.attachments.map((att) => (
                    <a
                      key={att.id}
                      href={att.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 p-3 rounded-lg border border-slate-100 hover:border-slate-200 hover:bg-slate-50 transition-colors"
                    >
                      {fileIcon(att.fileType)}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-700 truncate">{att.fileName}</p>
                        <p className="text-xs text-slate-400">{formatSize(att.fileSize)}</p>
                      </div>
                      <Download className="h-4 w-4 text-slate-400" />
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar info */}
          <div className="space-y-4">
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <h3 className="text-sm font-medium text-slate-900 mb-3">Informations</h3>
              <div className="space-y-3 text-xs text-slate-500">
                <div>
                  <span className="text-slate-400">Créé le</span>
                  <p className="text-slate-700">{new Date(article.createdAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })}</p>
                </div>
                <div>
                  <span className="text-slate-400">Modifié le</span>
                  <p className="text-slate-700">{new Date(article.updatedAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })}</p>
                </div>
                <div>
                  <span className="text-slate-400">Pièces jointes</span>
                  <p className="text-slate-700">{article.attachments.length}</p>
                </div>
              </div>
            </div>

            {/* Assigned clients */}
            {assignedClients.length > 0 && (
              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <h3 className="text-sm font-medium text-slate-900 flex items-center gap-2 mb-3">
                  <Building2 className="h-4 w-4 text-slate-400" />
                  Clients assignés
                </h3>
                <div className="space-y-2">
                  {assignedClients.map(c => (
                    <div key={c.id} className="flex items-center gap-2 text-sm text-slate-600">
                      {c.logoUrl ? (
                        <img src={c.logoUrl} alt="" className="h-6 w-6 rounded-full object-cover border border-slate-200" />
                      ) : (
                        <div className="h-6 w-6 rounded-full bg-slate-100 flex items-center justify-center border border-slate-200">
                          <Building2 className="h-3.5 w-3.5 text-slate-400" />
                        </div>
                      )}
                      {c.name}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={() => { if (confirm("Supprimer cet article ?")) { fetch(`/api/knowledge?id=${id}`, { method: "DELETE" }).then(() => router.push("/knowledge")); } }}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-red-200 text-sm text-red-600 hover:bg-red-50 transition-colors"
            >
              <Trash2 className="h-4 w-4" />
              Supprimer l&apos;article
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── EDIT MODE ──────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => setEditing(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Éditer l&apos;article</h1>
            <p className="text-xs text-slate-400 mt-0.5">/{article.slug}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => { setPublished(!published); }}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              published
                ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {published ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            {published ? "Publié" : "Brouillon"}
          </button>
          <button
            onClick={() => setEditing(false)}
            className="px-4 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-100 transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-600 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50 transition-colors"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Enregistrer
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main editor */}
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-1">Titre</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-slate-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Contenu</label>
              <RichTextEditor content={content} onChange={setContent} />
            </div>
          </div>

          {/* Attachments */}
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-slate-900 flex items-center gap-2">
                <Paperclip className="h-4 w-4 text-slate-400" />
                Pièces jointes
                {article.attachments.length > 0 && (
                  <span className="text-xs text-slate-400">({article.attachments.length})</span>
                )}
              </h3>
              <label className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 cursor-pointer transition-colors">
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                Ajouter (max 500 Mo)
                <input type="file" onChange={handleUpload} disabled={uploading} className="hidden" />
              </label>
            </div>

            {/* Upload progress bar */}
            {uploading && (
              <div className="mb-4">
                <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                  <span>Envoi en cours...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary-500 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}

            {article.attachments.length === 0 && !uploading ? (
              <div className="text-center py-8 text-slate-400">
                <Paperclip className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Aucune pièce jointe</p>
              </div>
            ) : (
              <div className="space-y-2">
                {article.attachments.map((att) => (
                  <div key={att.id} className="flex items-center gap-3 p-3 rounded-lg border border-slate-100 hover:border-slate-200 transition-colors">
                    {fileIcon(att.fileType)}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-700 truncate">{att.fileName}</p>
                      <p className="text-xs text-slate-400">{formatSize(att.fileSize)}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <a
                        href={att.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                      >
                        <Download className="h-4 w-4" />
                      </a>
                      <button
                        onClick={() => deleteAttachment(att.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar: settings */}
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
            <h3 className="text-sm font-medium text-slate-900">Paramètres</h3>

            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Catégorie</label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">Sans catégorie</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Visibilité</label>
              <div className="space-y-2">
                {[
                  { value: "internal", label: "Interne", desc: "Visible uniquement par les administrateurs de l'application", icon: Lock, color: "text-amber-500" },
                  { value: "public", label: "Public", desc: "Visible par tous les clients sur leur portail", icon: Globe, color: "text-emerald-500" },
                  { value: "client", label: "Clients ciblés", desc: "Visible uniquement par les clients que vous sélectionnez ci-dessous", icon: Users, color: "text-blue-500" },
                ].map((opt) => (
                  <label
                    key={opt.value}
                    className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      visibility === opt.value
                        ? "border-primary-300 bg-primary-50"
                        : "border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <input
                      type="radio"
                      name="visibility"
                      value={opt.value}
                      checked={visibility === opt.value}
                      onChange={(e) => setVisibility(e.target.value)}
                      className="mt-0.5"
                    />
                    <div>
                      <div className="flex items-center gap-1.5">
                        <opt.icon className={`h-3.5 w-3.5 ${opt.color}`} />
                        <span className="text-sm font-medium text-slate-700">{opt.label}</span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">{opt.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Client assignment — only for "client" visibility */}
          {visibility === "client" && <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
            <h3 className="text-sm font-medium text-slate-900 flex items-center gap-2">
              <Building2 className="h-4 w-4 text-slate-400" />
              Clients assignés
              {selectedClientIds.length > 0 && (
                <span className="text-xs bg-primary-100 text-primary-700 px-1.5 py-0.5 rounded-full">{selectedClientIds.length}</span>
              )}
            </h3>

            {/* Selected clients */}
            {selectedClientIds.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {selectedClientIds.map(cid => {
                  const client = clients.find(c => c.id === cid);
                  if (!client) return null;
                  return (
                    <span key={cid} className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-slate-100 text-xs text-slate-700">
                      {client.logoUrl ? (
                        <img src={client.logoUrl} alt="" className="h-4 w-4 rounded-full object-cover" />
                      ) : (
                        <Building2 className="h-3 w-3 text-slate-400" />
                      )}
                      <span className="truncate max-w-[120px]">{client.name}</span>
                      <button onClick={() => toggleClient(cid)} className="text-slate-400 hover:text-red-500">
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  );
                })}
              </div>
            )}

            {/* Client search & list */}
            <input
              type="text"
              placeholder="Rechercher un client..."
              value={clientSearch}
              onChange={(e) => setClientSearch(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
            <div className="max-h-40 overflow-y-auto space-y-0.5">
              {filteredClients.slice(0, 20).map(client => (
                <label
                  key={client.id}
                  className={`flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-colors text-xs ${
                    selectedClientIds.includes(client.id) ? "bg-primary-50 text-primary-700" : "hover:bg-slate-50 text-slate-600"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedClientIds.includes(client.id)}
                    onChange={() => toggleClient(client.id)}
                    className="rounded text-primary-600"
                  />
                  {client.logoUrl ? (
                    <img src={client.logoUrl} alt="" className="h-5 w-5 rounded-full object-cover" />
                  ) : (
                    <div className="h-5 w-5 rounded-full bg-slate-200 flex items-center justify-center">
                      <Building2 className="h-3 w-3 text-slate-400" />
                    </div>
                  )}
                  <span className="truncate">{client.name}</span>
                </label>
              ))}
              {filteredClients.length === 0 && (
                <p className="text-xs text-slate-400 text-center py-2">Aucun client trouvé</p>
              )}
            </div>
          </div>}

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="text-sm font-medium text-slate-900 mb-3">Informations</h3>
            <div className="space-y-2 text-xs text-slate-500">
              <p>Créé le {new Date(article.createdAt).toLocaleDateString("fr-FR")}</p>
              <p>Modifié le {new Date(article.updatedAt).toLocaleDateString("fr-FR")}</p>
              <p>{article.attachments.length} pièce(s) jointe(s)</p>
            </div>
          </div>

          <button
            onClick={() => { if (confirm("Supprimer cet article ?")) { fetch(`/api/knowledge?id=${id}`, { method: "DELETE" }).then(() => router.push("/knowledge")); } }}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-red-200 text-sm text-red-600 hover:bg-red-50 transition-colors"
          >
            <Trash2 className="h-4 w-4" />
            Supprimer l&apos;article
          </button>
        </div>
      </div>
    </div>
  );
}
