"use client";

import { useState, useEffect } from "react";
import {
  Loader2,
  Users,
  Plus,
  Pencil,
  Trash2,
  X,
  Check,
  Eye,
  EyeOff,
  Mail,
  Merge,
  Search,
  AlertTriangle,
  ChevronDown,
} from "lucide-react";
import { SettingsTabProps } from "./GeneralTab";

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
}

type MergeClient = { id: string; name: string; _count: { installations: number; invoices: number } };

export default function AdminTab({ settings, isAdmin, openSections, toggleSection }: SettingsTabProps) {
  // User management
  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [userForm, setUserForm] = useState({ name: "", email: "", password: "", role: "USER" });
  const [editForm, setEditForm] = useState({ name: "", email: "", password: "", role: "" });
  const [userError, setUserError] = useState("");
  const [savingUser, setSavingUser] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Client merge (two separate searches for target and source)
  const [mergeTargetSearch, setMergeTargetSearch] = useState("");
  const [mergeTargetResults, setMergeTargetResults] = useState<MergeClient[]>([]);
  const [mergeTarget, setMergeTarget] = useState<MergeClient | null>(null);
  const [mergeSourceSearch, setMergeSourceSearch] = useState("");
  const [mergeSourceResults, setMergeSourceResults] = useState<MergeClient[]>([]);
  const [mergeSource, setMergeSource] = useState<MergeClient | null>(null);
  const [merging, setMerging] = useState(false);
  const [mergeResult, setMergeResult] = useState<{ success: boolean; message: string } | null>(null);

  // Product merge
  const [mergeProductSearch, setMergeProductSearch] = useState("");
  const [mergeProducts, setMergeProducts] = useState<{ id: string; name: string; _count: { installations: number; invoiceLines: number } }[]>([]);
  const [mergeProductTarget, setMergeProductTarget] = useState<string | null>(null);
  const [mergeProductSource, setMergeProductSource] = useState<string | null>(null);
  const [mergingProduct, setMergingProduct] = useState(false);
  const [mergeProductResult, setMergeProductResult] = useState<{ success: boolean; message: string } | null>(null);

  // Bulk delete
  const [deleteTypes, setDeleteTypes] = useState<string[]>([]);
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleteResult, setDeleteResult] = useState<{ success: boolean; message: string } | null>(null);

  // Load users on mount
  useEffect(() => {
    fetchUsers();
  }, []);

  async function fetchUsers() {
    setLoadingUsers(true);
    try {
      const res = await fetch("/api/users");
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users);
      }
    } catch {
      // not admin or error
    } finally {
      setLoadingUsers(false);
    }
  }

  async function createUser() {
    if (!userForm.name || !userForm.email || !userForm.password) {
      setUserError("Tous les champs sont requis");
      return;
    }
    setSavingUser(true);
    setUserError("");

    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(userForm),
    });

    if (res.ok) {
      setShowCreateForm(false);
      setUserForm({ name: "", email: "", password: "", role: "USER" });
      fetchUsers();
    } else {
      const err = await res.json();
      setUserError(err.error || "Erreur lors de la création");
    }
    setSavingUser(false);
  }

  async function updateUser(id: string) {
    setSavingUser(true);
    setUserError("");

    const payload: Record<string, string> = {};
    if (editForm.name) payload.name = editForm.name;
    if (editForm.email) payload.email = editForm.email;
    if (editForm.password) payload.password = editForm.password;
    if (editForm.role) payload.role = editForm.role;

    const res = await fetch(`/api/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      setEditingUser(null);
      fetchUsers();
    } else {
      const err = await res.json();
      setUserError(err.error || "Erreur lors de la modification");
    }
    setSavingUser(false);
  }

  async function deleteUser(id: string, name: string) {
    if (!confirm(`Supprimer l'utilisateur "${name}" ?`)) return;

    const res = await fetch(`/api/users/${id}`, { method: "DELETE" });
    if (res.ok) {
      fetchUsers();
    } else {
      const err = await res.json();
      alert(err.error || "Erreur lors de la suppression");
    }
  }

  async function searchMergeTarget(q: string) {
    setMergeTargetSearch(q);
    if (q.length < 2) { setMergeTargetResults([]); return; }
    const res = await fetch(`/api/clients?search=${encodeURIComponent(q)}&limit=20&showAll=true`);
    const data = await res.json();
    setMergeTargetResults(data.clients || []);
  }

  async function searchMergeSource(q: string) {
    setMergeSourceSearch(q);
    if (q.length < 2) { setMergeSourceResults([]); return; }
    const res = await fetch(`/api/clients?search=${encodeURIComponent(q)}&limit=20&showAll=true`);
    const data = await res.json();
    setMergeSourceResults(data.clients || []);
  }

  async function handleMerge() {
    if (!mergeTarget || !mergeSource) return;
    setMerging(true);
    setMergeResult(null);
    try {
      const res = await fetch("/api/clients/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetId: mergeTarget.id, sourceId: mergeSource.id }),
      });
      const data = await res.json();
      if (res.ok) {
        setMergeResult({ success: true, message: data.message });
        setMergeTarget(null);
        setMergeSource(null);
        setMergeTargetSearch("");
        setMergeSourceSearch("");
        setMergeTargetResults([]);
        setMergeSourceResults([]);
      } else {
        setMergeResult({ success: false, message: data.error || "Erreur" });
      }
    } catch {
      setMergeResult({ success: false, message: "Erreur de connexion" });
    } finally {
      setMerging(false);
    }
  }

  async function searchMergeProducts(q: string) {
    setMergeProductSearch(q);
    if (q.length < 2) { setMergeProducts([]); return; }
    const res = await fetch(`/api/products?search=${encodeURIComponent(q)}&limit=20`);
    const data = await res.json();
    setMergeProducts(data.products || []);
  }

  async function handleProductMerge() {
    if (!mergeProductTarget || !mergeProductSource) return;
    setMergingProduct(true);
    setMergeProductResult(null);
    try {
      const res = await fetch("/api/products/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetId: mergeProductTarget, sourceId: mergeProductSource }),
      });
      const data = await res.json();
      if (res.ok) {
        setMergeProductResult({ success: true, message: data.message });
        setMergeProductTarget(null);
        setMergeProductSource(null);
        setMergeProducts([]);
        setMergeProductSearch("");
      } else {
        setMergeProductResult({ success: false, message: data.error || "Erreur" });
      }
    } catch {
      setMergeProductResult({ success: false, message: "Erreur de connexion" });
    } finally {
      setMergingProduct(false);
    }
  }

  return (
    <>
      {/* Gestion des utilisateurs (admin only) */}
      {isAdmin && <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <button onClick={() => toggleSection("users")} className="w-full flex items-center justify-between p-6 text-left hover:bg-slate-50 transition-colors">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary-50 p-2">
              <Users className="h-4 w-4 text-primary-600" />
            </div>
            <h3 className="text-sm font-medium text-slate-900">Gestion des utilisateurs</h3>
          </div>
          <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${openSections.users ? "rotate-180" : ""}`} />
        </button>
        {openSections.users && <div className="px-6 pb-6 border-t border-slate-100 pt-5">
        <div className="flex items-center justify-end mb-4">
          <button
            onClick={() => { setShowCreateForm(!showCreateForm); setUserError(""); }}
            className="flex items-center gap-2 rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-700 transition-colors"
          >
            <Plus className="h-3 w-3" />
            Nouvel utilisateur
          </button>
        </div>

        {!settings.smtp_host && (
          <div className="mb-4 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
            <Mail className="h-4 w-4 flex-shrink-0 text-red-500" />
            <span>
              <strong>SMTP non configur&eacute; :</strong> la fonctionnalit&eacute; &quot;Mot de passe oubli&eacute;&quot; ne fonctionnera pas tant que le serveur mail n&apos;est pas configur&eacute; dans la section Email ci-dessus.
            </span>
          </div>
        )}

        {userError && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600">
            {userError}
          </div>
        )}

        {/* Create form */}
        {showCreateForm && (
          <div className="mb-4 rounded-lg border border-slate-200 bg-slate-100 p-4 space-y-3">
            <h4 className="text-sm font-medium text-slate-600">Cr&eacute;er un utilisateur</h4>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <input
                type="text"
                placeholder="Nom"
                value={userForm.name}
                onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-primary-500 focus:outline-none"
              />
              <input
                type="email"
                placeholder="Email"
                value={userForm.email}
                onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-primary-500 focus:outline-none"
              />
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Mot de passe"
                  value={userForm.password}
                  onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 pr-10 text-sm text-slate-900 placeholder-slate-400 focus:border-primary-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <select
                value={userForm.role}
                onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-600 focus:border-primary-500 focus:outline-none"
              >
                <option value="USER">Utilisateur</option>
                <option value="ADMIN">Administrateur</option>
              </select>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500 space-y-1.5">
              <p className="font-medium text-slate-700">Diff&eacute;rences entre les r&ocirc;les :</p>
              <div className="flex items-start gap-2">
                <span className="inline-block rounded bg-slate-200 px-1.5 py-0.5 font-medium text-slate-600 shrink-0">Utilisateur</span>
                <span>Consultation des donn&eacute;es, personnalisation du rapport, fusion de clients/produits et notifications par email.</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="inline-block rounded bg-primary-100 px-1.5 py-0.5 font-medium text-primary-700 shrink-0">Administrateur</span>
                <span>Tous les droits utilisateur + gestion des utilisateurs, message broadcast, apparence du site, configuration SMTP, API Axonaut, import de donn&eacute;es et suppression en masse.</span>
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={createUser}
                disabled={savingUser}
                className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
              >
                {savingUser ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                Cr&eacute;er
              </button>
              <button
                onClick={() => { setShowCreateForm(false); setUserError(""); }}
                className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100 transition-colors"
              >
                <X className="h-3 w-3" />
                Annuler
              </button>
            </div>
          </div>
        )}

        {/* Users list */}
        {loadingUsers ? (
          <div className="flex justify-center py-6">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
          </div>
        ) : users.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-6">Aucun utilisateur trouv&eacute;</p>
        ) : (
          <div className="space-y-2">
            {users.map((user) => (
              <div
                key={user.id}
                className="rounded-lg border border-slate-200 bg-slate-50 p-3"
              >
                {editingUser === user.id ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <input
                        type="text"
                        placeholder="Nom"
                        value={editForm.name}
                        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-primary-500 focus:outline-none"
                      />
                      <input
                        type="email"
                        placeholder="Email"
                        value={editForm.email}
                        onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-primary-500 focus:outline-none"
                      />
                      <div className="relative">
                        <input
                          type={showPassword ? "text" : "password"}
                          placeholder="Nouveau mot de passe (laisser vide pour ne pas changer)"
                          value={editForm.password}
                          onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 pr-10 text-sm text-slate-900 placeholder-slate-400 focus:border-primary-500 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      <select
                        value={editForm.role}
                        onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-600 focus:border-primary-500 focus:outline-none"
                      >
                        <option value="USER">Utilisateur</option>
                        <option value="ADMIN">Administrateur</option>
                      </select>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => updateUser(user.id)}
                        disabled={savingUser}
                        className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                      >
                        {savingUser ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                        Enregistrer
                      </button>
                      <button
                        onClick={() => { setEditingUser(null); setUserError(""); }}
                        className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100 transition-colors"
                      >
                        <X className="h-3 w-3" />
                        Annuler
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-50 text-sm font-bold text-primary-600">
                        {user.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-900">{user.name}</p>
                        <p className="text-xs text-slate-400">{user.email}</p>
                      </div>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        user.role === "ADMIN"
                          ? "bg-amber-50 text-amber-600"
                          : "bg-slate-100 text-slate-500"
                      }`}>
                        {user.role === "ADMIN" ? "Admin" : "Utilisateur"}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          setEditingUser(user.id);
                          setEditForm({ name: user.name, email: user.email, password: "", role: user.role });
                          setUserError("");
                          setShowPassword(false);
                        }}
                        className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors"
                        title="Modifier"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => deleteUser(user.id, user.name)}
                        className="rounded-lg p-2 text-slate-500 hover:bg-red-50 hover:text-red-600 transition-colors"
                        title="Supprimer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>}
      </div>}

      {/* Fusion de clients */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <button onClick={() => toggleSection("mergeClients")} className="w-full flex items-center justify-between p-6 text-left hover:bg-slate-50 transition-colors">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary-50 p-2">
              <Merge className="h-4 w-4 text-primary-600" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-slate-900">Fusionner des clients</h3>
              <p className="text-xs text-slate-400">Fusionnez deux clients en un seul, m&ecirc;me avec des noms diff&eacute;rents.</p>
            </div>
          </div>
          <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${openSections.mergeClients ? "rotate-180" : ""}`} />
        </button>
        {openSections.mergeClients && <div className="px-6 pb-6 border-t border-slate-100 pt-5">

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Target client (to keep) */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-emerald-700">Client cible (&agrave; conserver)</label>
              {mergeTarget ? (
                <div className="flex items-center justify-between rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2">
                  <div>
                    <span className="text-sm font-medium text-slate-900">{mergeTarget.name}</span>
                    <span className="ml-2 text-xs text-slate-400">{mergeTarget._count.installations} install. &middot; {mergeTarget._count.invoices} fact.</span>
                  </div>
                  <button onClick={() => setMergeTarget(null)} className="text-slate-400 hover:text-slate-600">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Rechercher le client cible..."
                      value={mergeTargetSearch}
                      onChange={(e) => searchMergeTarget(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-10 pr-4 text-sm text-slate-800 placeholder-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                  {mergeTargetResults.length > 0 && (
                    <div className="rounded-lg border border-slate-200 max-h-48 overflow-y-auto divide-y divide-slate-100">
                      {mergeTargetResults.map((c) => (
                        <button
                          key={c.id}
                          onClick={() => { setMergeTarget(c); setMergeTargetResults([]); setMergeTargetSearch(""); }}
                          className="w-full flex items-center justify-between px-3 py-2 text-sm text-left hover:bg-emerald-50 transition-colors"
                        >
                          <div>
                            <span className="font-medium text-slate-900">{c.name}</span>
                            <span className="ml-2 text-xs text-slate-400">{c._count.installations} install. &middot; {c._count.invoices} fact.</span>
                          </div>
                          <Check className="h-3.5 w-3.5 text-emerald-500 opacity-0 group-hover:opacity-100" />
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Source client (to delete) */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-red-700">Client source (sera supprim&eacute;)</label>
              {mergeSource ? (
                <div className="flex items-center justify-between rounded-lg border border-red-300 bg-red-50 px-3 py-2">
                  <div>
                    <span className="text-sm font-medium text-slate-900">{mergeSource.name}</span>
                    <span className="ml-2 text-xs text-slate-400">{mergeSource._count.installations} install. &middot; {mergeSource._count.invoices} fact.</span>
                  </div>
                  <button onClick={() => setMergeSource(null)} className="text-slate-400 hover:text-slate-600">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Rechercher le client &agrave; supprimer..."
                      value={mergeSourceSearch}
                      onChange={(e) => searchMergeSource(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-10 pr-4 text-sm text-slate-800 placeholder-slate-400 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                    />
                  </div>
                  {mergeSourceResults.length > 0 && (
                    <div className="rounded-lg border border-slate-200 max-h-48 overflow-y-auto divide-y divide-slate-100">
                      {mergeSourceResults.map((c) => (
                        <button
                          key={c.id}
                          onClick={() => { setMergeSource(c); setMergeSourceResults([]); setMergeSourceSearch(""); }}
                          className="w-full flex items-center justify-between px-3 py-2 text-sm text-left hover:bg-red-50 transition-colors"
                        >
                          <div>
                            <span className="font-medium text-slate-900">{c.name}</span>
                            <span className="ml-2 text-xs text-slate-400">{c._count.installations} install. &middot; {c._count.invoices} fact.</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {mergeTarget && mergeSource && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <p className="text-sm text-amber-700 font-medium">
                  Le client &quot;{mergeSource.name}&quot; sera supprim&eacute; et ses donn&eacute;es transf&eacute;r&eacute;es vers &quot;{mergeTarget.name}&quot;.
                </p>
              </div>
              <button
                onClick={handleMerge}
                disabled={merging}
                className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50 transition-colors"
              >
                {merging ? <Loader2 className="h-4 w-4 animate-spin" /> : <Merge className="h-4 w-4" />}
                Fusionner
              </button>
            </div>
          )}

          {mergeResult && (
            <div className={`rounded-lg border p-3 text-sm ${
              mergeResult.success ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"
            }`}>
              {mergeResult.message}
            </div>
          )}
        </div>
      </div>}
      </div>

      {/* Fusion de produits */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <button onClick={() => toggleSection("mergeProducts")} className="w-full flex items-center justify-between p-6 text-left hover:bg-slate-50 transition-colors">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-violet-50 p-2">
              <Merge className="h-4 w-4 text-violet-600" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-slate-900">Fusionner des produits</h3>
              <p className="text-xs text-slate-400">Fusionnez deux produits en un seul.</p>
            </div>
          </div>
          <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${openSections.mergeProducts ? "rotate-180" : ""}`} />
        </button>
        {openSections.mergeProducts && <div className="px-6 pb-6 border-t border-slate-100 pt-5">

        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Rechercher un produit..."
              value={mergeProductSearch}
              onChange={(e) => searchMergeProducts(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-10 pr-4 text-sm text-slate-800 placeholder-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>

          {mergeProducts.length > 0 && (
            <div className="rounded-lg border border-slate-200 max-h-60 overflow-y-auto divide-y divide-slate-100">
              {mergeProducts.map((p) => {
                const isTarget = mergeProductTarget === p.id;
                const isSource = mergeProductSource === p.id;
                return (
                  <div key={p.id} className={`flex items-center justify-between px-4 py-2.5 text-sm ${isTarget ? "bg-emerald-50" : isSource ? "bg-red-50" : "hover:bg-slate-50"}`}>
                    <div>
                      <span className="font-medium text-slate-900">{p.name}</span>
                      <span className="ml-2 text-xs text-slate-400">{p._count.installations} install. &middot; {p._count.invoiceLines} ligne(s)</span>
                    </div>
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => setMergeProductTarget(isTarget ? null : p.id)}
                        className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                          isTarget ? "bg-emerald-600 text-white" : "border border-emerald-300 text-emerald-600 hover:bg-emerald-50"
                        }`}
                      >
                        {isTarget ? "✓ Cible" : "Cible"}
                      </button>
                      <button
                        onClick={() => setMergeProductSource(isSource ? null : p.id)}
                        className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                          isSource ? "bg-red-600 text-white" : "border border-red-300 text-red-600 hover:bg-red-50"
                        }`}
                      >
                        {isSource ? "✓ À supprimer" : "À supprimer"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {mergeProductTarget && mergeProductSource && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <p className="text-sm text-amber-700 font-medium">
                  Le produit &quot;{mergeProducts.find((p) => p.id === mergeProductSource)?.name}&quot; sera supprim&eacute; et ses donn&eacute;es transf&eacute;r&eacute;es vers &quot;{mergeProducts.find((p) => p.id === mergeProductTarget)?.name}&quot;.
                </p>
              </div>
              <button
                onClick={handleProductMerge}
                disabled={mergingProduct}
                className="flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50 transition-colors"
              >
                {mergingProduct ? <Loader2 className="h-4 w-4 animate-spin" /> : <Merge className="h-4 w-4" />}
                Fusionner
              </button>
            </div>
          )}

          {mergeProductResult && (
            <div className={`rounded-lg border p-3 text-sm ${
              mergeProductResult.success ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"
            }`}>
              {mergeProductResult.message}
            </div>
          )}
        </div>
      </div>}
      </div>

      {/* Suppression de donn&eacute;es (admin only) */}
      {isAdmin && <div className="rounded-xl border border-red-200 bg-white overflow-hidden">
        <button onClick={() => toggleSection("delete")} className="w-full flex items-center justify-between p-6 text-left hover:bg-slate-50 transition-colors">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-red-50 p-2">
              <Trash2 className="h-4 w-4 text-red-600" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-slate-900">Supprimer des donn&eacute;es</h3>
              <p className="text-xs text-slate-400">Supprimez en masse les donn&eacute;es de l&apos;application. Cette action est irr&eacute;versible.</p>
            </div>
          </div>
          <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${openSections.delete ? "rotate-180" : ""}`} />
        </button>
        {openSections.delete && <div className="px-6 pb-6 border-t border-slate-100 pt-5">

        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { key: "installations", label: "Installations", desc: "Toutes les installations et garanties" },
              { key: "invoices", label: "Factures", desc: "Factures et lignes de facturation" },
              { key: "products", label: "Produits", desc: "Catalogue produits" },
              { key: "clients", label: "Clients", desc: "Tous les clients" },
            ].map(({ key, label, desc }) => (
              <label
                key={key}
                className={`flex flex-col gap-1 rounded-lg border-2 p-3 cursor-pointer transition-colors ${
                  deleteTypes.includes(key)
                    ? "border-red-400 bg-red-50"
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={deleteTypes.includes(key)}
                    onChange={(e) => {
                      if (e.target.checked) setDeleteTypes([...deleteTypes, key]);
                      else setDeleteTypes(deleteTypes.filter((t) => t !== key));
                      setDeleteConfirm("");
                      setDeleteResult(null);
                    }}
                    className="rounded border-slate-300 text-red-600 focus:ring-red-500"
                  />
                  <span className="text-sm font-medium text-slate-900">{label}</span>
                </div>
                <span className="text-xs text-slate-400">{desc}</span>
              </label>
            ))}
          </div>

          {deleteTypes.length > 0 && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                <p className="text-sm text-red-700 font-medium">
                  Vous allez supprimer : {deleteTypes.map((t) => {
                    const labels: Record<string, string> = { installations: "Installations", invoices: "Factures", products: "Produits", clients: "Clients" };
                    return labels[t];
                  }).join(", ")}
                </p>
              </div>
              <p className="text-xs text-red-600">
                Tapez <strong>SUPPRIMER</strong> pour confirmer :
              </p>
              <input
                type="text"
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                placeholder="SUPPRIMER"
                className="w-full rounded-lg border border-red-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
              />
              <button
                disabled={deleteConfirm !== "SUPPRIMER" || deleting}
                onClick={async () => {
                  setDeleting(true);
                  setDeleteResult(null);
                  try {
                    const res = await fetch("/api/data", {
                      method: "DELETE",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ types: deleteTypes }),
                    });
                    const data = await res.json();
                    if (res.ok) {
                      setDeleteResult({ success: true, message: data.message });
                      setDeleteTypes([]);
                      setDeleteConfirm("");
                    } else {
                      setDeleteResult({ success: false, message: data.error || "Erreur" });
                    }
                  } catch {
                    setDeleteResult({ success: false, message: "Erreur de connexion" });
                  } finally {
                    setDeleting(false);
                  }
                }}
                className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                Supprimer d&eacute;finitivement
              </button>
            </div>
          )}

          {deleteResult && (
            <div className={`rounded-lg border p-3 text-sm ${
              deleteResult.success ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"
            }`}>
              {deleteResult.message}
            </div>
          )}
        </div>
      </div>}
      </div>}
    </>
  );
}
