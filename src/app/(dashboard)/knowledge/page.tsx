"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  BookOpen,
  Plus,
  Search,
  FolderOpen,
  Trash2,
  Edit3,
  Eye,
  EyeOff,
  Paperclip,
  Tag,
  Loader2,
  X,
  Check,
  Globe,
  Lock,
  Users,
  Building2,
} from "lucide-react";

interface Category {
  id: string;
  name: string;
  slug: string;
  _count: { articles: number };
}

interface Article {
  id: string;
  title: string;
  slug: string;
  visibility: string;
  published: boolean;
  categoryId: string | null;
  category: { id: string; name: string } | null;
  clientIds: string | null;
  updatedAt: string;
  _count: { attachments: number };
}

interface ClientInfo {
  id: string;
  name: string;
  logoUrl: string | null;
}

export default function KnowledgePage() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [allClients, setAllClients] = useState<ClientInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterVisibility, setFilterVisibility] = useState("");

  // Category management
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [editCategoryName, setEditCategoryName] = useState("");
  const [deletingArticle, setDeletingArticle] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (filterCategory) params.set("categoryId", filterCategory);
      if (filterVisibility) params.set("visibility", filterVisibility);

      const [articlesRes, categoriesRes, clientsRes] = await Promise.all([
        fetch(`/api/knowledge?${params}`),
        fetch("/api/knowledge/categories"),
        fetch("/api/knowledge/clients"),
      ]);
      if (articlesRes.ok) setArticles(await articlesRes.json());
      if (categoriesRes.ok) setCategories(await categoriesRes.json());
      if (clientsRes.ok) setAllClients(await clientsRes.json());
    } catch { /* ignore */ }
    setLoading(false);
  }, [search, filterCategory, filterVisibility]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function createCategory() {
    if (!newCategoryName.trim()) return;
    await fetch("/api/knowledge/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newCategoryName }),
    });
    setNewCategoryName("");
    setShowNewCategory(false);
    fetchData();
  }

  async function updateCategory(id: string) {
    if (!editCategoryName.trim()) return;
    await fetch("/api/knowledge/categories", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, name: editCategoryName }),
    });
    setEditingCategory(null);
    fetchData();
  }

  async function deleteCategory(id: string) {
    await fetch(`/api/knowledge/categories?id=${id}`, { method: "DELETE" });
    if (filterCategory === id) setFilterCategory("");
    fetchData();
  }

  async function deleteArticle(id: string) {
    await fetch(`/api/knowledge?id=${id}`, { method: "DELETE" });
    setDeletingArticle(null);
    fetchData();
  }

  async function togglePublished(id: string, published: boolean) {
    await fetch("/api/knowledge", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, published: !published }),
    });
    fetchData();
  }

  function visibilityIcon(v: string) {
    if (v === "internal") return <Lock className="h-3.5 w-3.5 text-amber-500" />;
    if (v === "client") return <Users className="h-3.5 w-3.5 text-blue-500" />;
    return <Globe className="h-3.5 w-3.5 text-emerald-500" />;
  }

  function visibilityLabel(v: string) {
    if (v === "internal") return "Interne";
    if (v === "client") return "Clients ciblés";
    return "Public";
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Base de connaissances</h1>
          <p className="text-sm text-slate-500 mt-1">
            {articles.length} article{articles.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Link
          href="/knowledge/new"
          className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Nouvel article
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar: categories */}
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-slate-900 flex items-center gap-2">
                <FolderOpen className="h-4 w-4 text-slate-400" />
                Catégories
              </h3>
              <button
                onClick={() => setShowNewCategory(true)}
                className="text-primary-600 hover:text-primary-700"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-1">
              <button
                onClick={() => setFilterCategory("")}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                  !filterCategory
                    ? "bg-primary-50 text-primary-700 font-medium"
                    : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                Tous les articles
              </button>

              {categories.map((cat) => (
                <div key={cat.id} className="group flex items-center">
                  {editingCategory === cat.id ? (
                    <div className="flex items-center gap-1 flex-1 px-2">
                      <input
                        type="text"
                        value={editCategoryName}
                        onChange={(e) => setEditCategoryName(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && updateCategory(cat.id)}
                        className="flex-1 px-2 py-1 text-sm border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
                        autoFocus
                      />
                      <button onClick={() => updateCategory(cat.id)} className="text-emerald-600 p-1"><Check className="h-3 w-3" /></button>
                      <button onClick={() => setEditingCategory(null)} className="text-slate-400 p-1"><X className="h-3 w-3" /></button>
                    </div>
                  ) : (
                    <>
                      <button
                        onClick={() => setFilterCategory(cat.id)}
                        className={`flex-1 text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                          filterCategory === cat.id
                            ? "bg-primary-50 text-primary-700 font-medium"
                            : "text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        {cat.name}
                        <span className="ml-1 text-xs text-slate-400">({cat._count.articles})</span>
                      </button>
                      <div className="hidden group-hover:flex items-center gap-0.5">
                        <button
                          onClick={() => { setEditingCategory(cat.id); setEditCategoryName(cat.name); }}
                          className="p-1 text-slate-400 hover:text-slate-600"
                        >
                          <Edit3 className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() => deleteCategory(cat.id)}
                          className="p-1 text-slate-400 hover:text-red-600"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}

              {showNewCategory && (
                <div className="flex items-center gap-1 px-2 mt-2">
                  <input
                    type="text"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && createCategory()}
                    placeholder="Nouvelle catégorie"
                    className="flex-1 px-2 py-1 text-sm border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
                    autoFocus
                  />
                  <button onClick={createCategory} className="text-emerald-600 p-1"><Check className="h-3 w-3" /></button>
                  <button onClick={() => { setShowNewCategory(false); setNewCategoryName(""); }} className="text-slate-400 p-1"><X className="h-3 w-3" /></button>
                </div>
              )}
            </div>
          </div>

          {/* Visibility filter */}
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h3 className="text-sm font-medium text-slate-900 mb-3 flex items-center gap-2">
              <Tag className="h-4 w-4 text-slate-400" />
              Visibilité
            </h3>
            <div className="space-y-1">
              {[
                { value: "", label: "Tous" },
                { value: "public", label: "Public", icon: Globe },
                { value: "internal", label: "Interne", icon: Lock },
                { value: "client", label: "Clients ciblés", icon: Users },
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setFilterVisibility(opt.value)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                    filterVisibility === opt.value
                      ? "bg-primary-50 text-primary-700 font-medium"
                      : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Main content: articles list */}
        <div className="lg:col-span-3 space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Rechercher un article..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          {/* Articles */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            </div>
          ) : articles.length === 0 ? (
            <div className="text-center py-20 rounded-xl border border-slate-200 bg-white">
              <BookOpen className="h-12 w-12 mx-auto text-slate-300 mb-3" />
              <p className="text-slate-500 text-sm">Aucun article trouvé</p>
              <Link
                href="/knowledge/new"
                className="inline-flex items-center gap-2 mt-4 text-sm text-primary-600 hover:text-primary-700 font-medium"
              >
                <Plus className="h-4 w-4" />
                Créer un article
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {articles.map((article) => (
                <div
                  key={article.id}
                  className="rounded-xl border border-slate-200 bg-white p-4 hover:border-slate-300 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Link
                          href={`/knowledge/${article.id}`}
                          className="text-sm font-medium text-slate-900 hover:text-primary-600 truncate"
                        >
                          {article.title}
                        </Link>
                        {!article.published && (
                          <span className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded bg-slate-100 text-slate-500">
                            <EyeOff className="h-3 w-3" />
                            Brouillon
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-400">
                        <span className="inline-flex items-center gap-1">
                          {visibilityIcon(article.visibility)}
                          {visibilityLabel(article.visibility)}
                        </span>
                        {article.category && (
                          <span className="inline-flex items-center gap-1">
                            <FolderOpen className="h-3 w-3" />
                            {article.category.name}
                          </span>
                        )}
                        {article._count.attachments > 0 && (
                          <span className="inline-flex items-center gap-1">
                            <Paperclip className="h-3 w-3" />
                            {article._count.attachments}
                          </span>
                        )}
                        <span>Modifié le {formatDate(article.updatedAt)}</span>
                      </div>
                      {/* Client logos */}
                      {article.clientIds && (() => {
                        const ids: string[] = JSON.parse(article.clientIds);
                        const assignedClients = allClients.filter(c => ids.includes(c.id));
                        if (assignedClients.length === 0) return null;
                        return (
                          <div className="flex items-center gap-1 mt-1.5">
                            {assignedClients.slice(0, 5).map(c => (
                              c.logoUrl ? (
                                <img key={c.id} src={c.logoUrl} alt={c.name} title={c.name} className="h-5 w-5 rounded-full object-cover border border-slate-200" />
                              ) : (
                                <div key={c.id} title={c.name} className="h-5 w-5 rounded-full bg-slate-100 flex items-center justify-center border border-slate-200">
                                  <Building2 className="h-3 w-3 text-slate-400" />
                                </div>
                              )
                            ))}
                            {assignedClients.length > 5 && (
                              <span className="text-[10px] text-slate-400 ml-1">+{assignedClients.length - 5}</span>
                            )}
                          </div>
                        );
                      })()}
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => togglePublished(article.id, article.published)}
                        className={`rounded-lg p-2 transition-colors ${
                          article.published
                            ? "text-emerald-600 hover:bg-emerald-50"
                            : "text-slate-400 hover:bg-slate-50"
                        }`}
                        title={article.published ? "Dépublier" : "Publier"}
                      >
                        {article.published ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                      </button>
                      <Link
                        href={`/knowledge/${article.id}`}
                        className="rounded-lg p-2 text-slate-400 hover:text-primary-600 hover:bg-primary-50 transition-colors"
                      >
                        <Edit3 className="h-4 w-4" />
                      </Link>
                      {deletingArticle === article.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => deleteArticle(article.id)}
                            className="rounded-lg px-2 py-1 text-xs bg-red-600 text-white hover:bg-red-700"
                          >
                            Supprimer
                          </button>
                          <button
                            onClick={() => setDeletingArticle(null)}
                            className="rounded-lg px-2 py-1 text-xs bg-slate-200 text-slate-600"
                          >
                            Annuler
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeletingArticle(article.id)}
                          className="rounded-lg p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
