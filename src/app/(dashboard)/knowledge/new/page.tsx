"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { ArrowLeft, Save, Loader2 } from "lucide-react";

interface Category {
  id: string;
  name: string;
}

export default function NewArticlePage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [visibility, setVisibility] = useState("internal");
  const [categories, setCategories] = useState<Category[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/knowledge/categories")
      .then((r) => r.json())
      .then(setCategories)
      .catch(() => {});
  }, []);

  async function handleCreate() {
    if (!title.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, categoryId: categoryId || null, visibility }),
      });
      if (res.ok) {
        const article = await res.json();
        router.push(`/knowledge/${article.id}`);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <a href="/knowledge" className="text-slate-400 hover:text-slate-600 transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </a>
        <h1 className="text-2xl font-bold text-slate-900">Nouvel article</h1>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Titre</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Titre de l'article"
            className="w-full px-4 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            autoFocus
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Catégorie</label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">Sans catégorie</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Visibilité</label>
            <select
              value={visibility}
              onChange={(e) => setVisibility(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="internal">Interne — visible uniquement par les administrateurs</option>
              <option value="public">Public — visible par tous les clients sur leur portail</option>
              <option value="client">Clients ciblés — visible uniquement par les clients sélectionnés</option>
            </select>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <a href="/knowledge" className="px-4 py-2.5 rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition-colors">
            Annuler
          </a>
          <button
            onClick={handleCreate}
            disabled={!title.trim() || saving}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary-600 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50 transition-colors"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Créer et éditer
          </button>
        </div>
      </div>
    </div>
  );
}
