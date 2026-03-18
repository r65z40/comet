"use client";

import { useEffect, useState, useCallback } from "react";
import { Activity, Filter } from "lucide-react";

interface LogEntry {
  id: string;
  userId: string | null;
  userName: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  details: string | null;
  createdAt: string;
}

const ACTION_COLORS: Record<string, string> = {
  CREATE: "bg-emerald-50 text-emerald-700",
  UPDATE: "bg-blue-50 text-blue-700",
  DELETE: "bg-red-50 text-red-700",
  RESTORE: "bg-amber-50 text-amber-700",
  EXPORT: "bg-purple-50 text-purple-700",
  SYNC: "bg-cyan-50 text-cyan-700",
  LOGIN: "bg-slate-100 text-slate-600",
  BULK_DELETE: "bg-red-50 text-red-700",
  BULK_UPDATE: "bg-blue-50 text-blue-700",
};

const ENTITY_LABELS: Record<string, string> = {
  client: "Client",
  product: "Produit",
  installation: "Installation",
  invoice: "Facture",
  user: "Utilisateur",
  settings: "Paramètres",
};

export default function ActivityPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [entityFilter, setEntityFilter] = useState("");
  const [actionFilter, setActionFilter] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("limit", "50");
    if (entityFilter) params.set("entity", entityFilter);
    if (actionFilter) params.set("action", actionFilter);

    const res = await fetch(`/api/activity?${params}`);
    const data = await res.json();
    setLogs(data.logs || []);
    setTotalPages(data.pagination?.totalPages || 1);
    setLoading(false);
  }, [page, entityFilter, actionFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Journal d&apos;activité</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Historique de toutes les actions effectuées sur la plateforme</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-slate-400" />
          <select
            value={entityFilter}
            onChange={(e) => { setEntityFilter(e.target.value); setPage(1); }}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 focus:border-primary-500 focus:outline-none dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300"
          >
            <option value="">Toutes les entités</option>
            <option value="client">Clients</option>
            <option value="product">Produits</option>
            <option value="installation">Installations</option>
            <option value="invoice">Factures</option>
            <option value="user">Utilisateurs</option>
            <option value="settings">Paramètres</option>
          </select>
        </div>
        <select
          value={actionFilter}
          onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 focus:border-primary-500 focus:outline-none dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300"
        >
          <option value="">Toutes les actions</option>
          <option value="CREATE">Création</option>
          <option value="UPDATE">Modification</option>
          <option value="DELETE">Suppression</option>
          <option value="RESTORE">Restauration</option>
          <option value="EXPORT">Export</option>
          <option value="BULK_DELETE">Suppression en lot</option>
          <option value="BULK_UPDATE">Modification en lot</option>
        </select>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white dark:bg-slate-800 dark:border-slate-700 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center p-8">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
          </div>
        ) : logs.length === 0 ? (
          <div className="px-4 py-12 text-center text-sm text-slate-400">
            <Activity className="mx-auto h-8 w-8 mb-3 text-slate-300" />
            Aucune activité enregistrée
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-700">
            {logs.map((log) => (
              <div key={log.id} className="flex items-center gap-4 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                <div className="shrink-0">
                  <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${ACTION_COLORS[log.action] || "bg-slate-100 text-slate-600"}`}>
                    {log.action}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-900 dark:text-slate-100">
                    <span className="font-medium">{log.userName || "Système"}</span>
                    {" — "}
                    <span className="text-slate-500 dark:text-slate-400">{ENTITY_LABELS[log.entity] || log.entity}</span>
                    {log.details && (
                      <span className="text-slate-400 dark:text-slate-500"> — {log.details}</span>
                    )}
                  </p>
                </div>
                <div className="shrink-0 text-xs text-slate-400">
                  {new Date(log.createdAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-700 px-4 py-3">
            <p className="text-sm text-slate-500">Page {page} sur {totalPages}</p>
            <div className="flex gap-2">
              <button onClick={() => setPage(page - 1)} disabled={page <= 1} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm disabled:opacity-50">Précédent</button>
              <button onClick={() => setPage(page + 1)} disabled={page >= totalPages} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm disabled:opacity-50">Suivant</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
