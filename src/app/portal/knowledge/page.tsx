"use client";

import { useEffect, useState } from "react";
import { sanitizeHtml } from "@/lib/sanitize";
import { usePortal } from "../layout";
import {
  BookOpen,
  Search,
  FolderOpen,
  Paperclip,
  Download,
  ArrowLeft,
  Loader2,
  FileText,
  Image as ImageIcon,
} from "lucide-react";

interface Category {
  id: string;
  name: string;
  slug: string;
}

interface Attachment {
  id: string;
  fileName: string;
  fileUrl: string;
  fileType: string;
  fileSize: number;
}

interface Article {
  id: string;
  title: string;
  slug: string;
  content: string;
  categoryId: string | null;
  category: Category | null;
  updatedAt: string;
  attachments?: Attachment[];
  _count?: { attachments: number };
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

// Render content: supports HTML (from rich editor) and plain text fallback
function renderContent(text: string) {
  // If content looks like HTML (contains tags), render as sanitized HTML
  if (text.includes("<") && text.includes(">")) {
    return <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(text) }} />;
  }
  // Fallback: simple markdown-like rendering for old content
  return text.split("\n").map((line, i) => {
    if (line.startsWith("### ")) return <h3 key={i} className="text-base font-semibold text-slate-800 mt-4 mb-2">{line.slice(4)}</h3>;
    if (line.startsWith("## ")) return <h2 key={i} className="text-lg font-bold text-slate-900 mt-5 mb-2">{line.slice(3)}</h2>;
    if (line.startsWith("# ")) return <h1 key={i} className="text-xl font-bold text-slate-900 mt-6 mb-3">{line.slice(2)}</h1>;
    if (line.startsWith("- ")) return <li key={i} className="ml-4 text-sm text-slate-600 list-disc">{line.slice(2)}</li>;
    if (line.trim() === "") return <br key={i} />;
    return <p key={i} className="text-sm text-slate-600 leading-relaxed">{line}</p>;
  });
}

export default function PortalKnowledgePage() {
  const { portalSettings } = usePortal();
  const [articles, setArticles] = useState<Article[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [loadingArticle, setLoadingArticle] = useState(false);

  const primaryColor = portalSettings?.primaryColor || "#3b82f6";

  useEffect(() => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (filterCategory) params.set("categoryId", filterCategory);

    fetch(`/api/portal/knowledge?${params}`)
      .then((r) => r.json())
      .then((data) => {
        setArticles(data.articles || []);
        setCategories(data.categories || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [search, filterCategory]);

  async function openArticle(id: string) {
    setLoadingArticle(true);
    try {
      const res = await fetch(`/api/portal/knowledge?id=${id}`);
      if (res.ok) {
        setSelectedArticle(await res.json());
      }
    } catch { /* ignore */ }
    setLoadingArticle(false);
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  }

  // Article detail view
  if (selectedArticle) {
    return (
      <div className="max-w-5xl mx-auto space-y-6">
        <button
          onClick={() => setSelectedArticle(null)}
          className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour aux articles
        </button>

        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <div className="mb-1">
            {selectedArticle.category && (
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                {selectedArticle.category.name}
              </span>
            )}
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mt-2 mb-1">{selectedArticle.title}</h1>
          <p className="text-xs text-slate-400 mb-6">Mis à jour le {formatDate(selectedArticle.updatedAt)}</p>

          <div className="prose prose-slate max-w-none">
            {renderContent(selectedArticle.content)}
          </div>
        </div>

        {/* Attachments */}
        {selectedArticle.attachments && selectedArticle.attachments.length > 0 && (
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <h3 className="text-sm font-medium text-slate-900 flex items-center gap-2 mb-4">
              <Paperclip className="h-4 w-4 text-slate-400" />
              Pièces jointes ({selectedArticle.attachments.length})
            </h3>
            <div className="space-y-2">
              {selectedArticle.attachments.map((att) => (
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
    );
  }

  // Articles list view
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Base de connaissances</h1>
        <p className="text-sm text-slate-500 mt-1">Documentation et guides</p>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <input
          type="text"
          placeholder="Rechercher un article..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:border-transparent"
          style={{ ["--tw-ring-color" as string]: primaryColor } as React.CSSProperties}
        />
      </div>

      {/* Category pills */}
      {categories.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setFilterCategory("")}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              !filterCategory
                ? "text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
            style={!filterCategory ? { backgroundColor: primaryColor } : {}}
          >
            Tous
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setFilterCategory(cat.id)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                filterCategory === cat.id
                  ? "text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
              style={filterCategory === cat.id ? { backgroundColor: primaryColor } : {}}
            >
              {cat.name}
            </button>
          ))}
        </div>
      )}

      {/* Articles */}
      {loading || loadingArticle ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        </div>
      ) : articles.length === 0 ? (
        <div className="text-center py-20 rounded-xl border border-slate-200 bg-white">
          <BookOpen className="h-12 w-12 mx-auto text-slate-300 mb-3" />
          <p className="text-slate-500 text-sm">Aucun article disponible</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {articles.map((article) => (
            <button
              key={article.id}
              onClick={() => openArticle(article.id)}
              className="text-left rounded-xl border border-slate-200 bg-white p-5 hover:border-slate-300 hover:shadow-sm transition-all"
            >
              <div className="flex items-start gap-3">
                <div className="rounded-lg p-2 shrink-0" style={{ backgroundColor: `${primaryColor}15` }}>
                  <BookOpen className="h-5 w-5" style={{ color: primaryColor }} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-medium text-slate-900 mb-1">{article.title}</h3>
                  <div className="flex items-center gap-3 text-xs text-slate-400">
                    {article.category && (
                      <span className="inline-flex items-center gap-1">
                        <FolderOpen className="h-3 w-3" />
                        {article.category.name}
                      </span>
                    )}
                    {(article._count?.attachments ?? 0) > 0 && (
                      <span className="inline-flex items-center gap-1">
                        <Paperclip className="h-3 w-3" />
                        {article._count?.attachments}
                      </span>
                    )}
                    <span>{formatDate(article.updatedAt)}</span>
                  </div>
                  {article.content && (
                    <p className="text-xs text-slate-500 mt-2 line-clamp-2">
                      {article.content.replace(/<[^>]*>/g, "").slice(0, 120)}{article.content.replace(/<[^>]*>/g, "").length > 120 ? "…" : ""}
                    </p>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
