"use client";

import { useEffect, useState, useCallback, use } from "react";
import { useRouter } from "next/navigation";
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
} from "lucide-react";

interface Category {
  id: string;
  name: string;
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

export default function ArticleEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [article, setArticle] = useState<Article | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  // Edit state
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [visibility, setVisibility] = useState("public");
  const [published, setPublished] = useState(false);

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState(false);

  const fetchArticle = useCallback(async () => {
    try {
      const [articleRes, catRes] = await Promise.all([
        fetch(`/api/knowledge?id=${id}`),
        fetch("/api/knowledge/categories"),
      ]);
      if (articleRes.ok) {
        const data = await articleRes.json();
        setArticle(data);
        setTitle(data.title);
        setContent(data.content);
        setCategoryId(data.categoryId || "");
        setVisibility(data.visibility);
        setPublished(data.published);
      }
      if (catRes.ok) setCategories(await catRes.json());
    } catch { /* ignore */ }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    fetchArticle();
  }, [fetchArticle]);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
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
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setArticle(data);
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("articleId", id);
      await fetch("/api/knowledge/attachments", { method: "POST", body: formData });
      fetchArticle();
    } catch { /* ignore */ }
    setUploading(false);
    e.target.value = "";
  }

  async function deleteAttachment(attId: string) {
    await fetch(`/api/knowledge/attachments?id=${attId}`, { method: "DELETE" });
    fetchArticle();
  }

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <a href="/knowledge" className="text-slate-400 hover:text-slate-600 transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </a>
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
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-600 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50 transition-colors"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saved ? "Enregistré !" : "Enregistrer"}
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
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={20}
                placeholder="Rédigez le contenu de l'article ici... (Markdown supporté)"
                className="w-full px-4 py-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono leading-relaxed resize-y"
              />
              <p className="text-xs text-slate-400 mt-1">Markdown supporté pour la mise en forme</p>
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
                Ajouter
                <input type="file" onChange={handleUpload} disabled={uploading} className="hidden" />
              </label>
            </div>

            {article.attachments.length === 0 ? (
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
                  { value: "public", label: "Public", desc: "Visible sur le portail client", icon: Globe, color: "text-emerald-500" },
                  { value: "internal", label: "Interne", desc: "Visible uniquement par les admins", icon: Lock, color: "text-amber-500" },
                  { value: "client", label: "Clients ciblés", desc: "Visible par certains clients", icon: Users, color: "text-blue-500" },
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
