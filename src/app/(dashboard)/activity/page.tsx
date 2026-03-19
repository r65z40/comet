"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  Activity, Filter, User, Clock, ArrowRight,
  Plus, Pencil, Trash2, RotateCcw, Download, RefreshCw, LogIn,
  Layers,
} from "lucide-react";

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

const ACTION_CONFIG: Record<string, { label: string; color: string; icon: typeof Plus }> = {
  CREATE: { label: "Création", color: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: Plus },
  UPDATE: { label: "Modification", color: "bg-blue-50 text-blue-700 border-blue-200", icon: Pencil },
  DELETE: { label: "Suppression", color: "bg-red-50 text-red-700 border-red-200", icon: Trash2 },
  RESTORE: { label: "Restauration", color: "bg-amber-50 text-amber-700 border-amber-200", icon: RotateCcw },
  EXPORT: { label: "Export", color: "bg-purple-50 text-purple-700 border-purple-200", icon: Download },
  SYNC: { label: "Synchronisation", color: "bg-cyan-50 text-cyan-700 border-cyan-200", icon: RefreshCw },
  LOGIN: { label: "Connexion", color: "bg-slate-100 text-slate-600 border-slate-200", icon: LogIn },
  BULK_DELETE: { label: "Suppression en lot", color: "bg-red-50 text-red-700 border-red-200", icon: Trash2 },
  BULK_UPDATE: { label: "Modification en lot", color: "bg-blue-50 text-blue-700 border-blue-200", icon: Layers },
};

const ENTITY_CONFIG: Record<string, { label: string; href: string }> = {
  client: { label: "Client", href: "/clients" },
  product: { label: "Produit", href: "/products" },
  installation: { label: "Installation", href: "/installations" },
  invoice: { label: "Facture", href: "/invoices" },
  user: { label: "Utilisateur", href: "/settings" },
  settings: { label: "Paramètres", href: "/settings" },
};

function getEntityLink(entity: string, entityId: string | null): string | null {
  const config = ENTITY_CONFIG[entity];
  if (!config || !entityId) return null;
  if (entity === "user" || entity === "settings") return null;
  return `${config.href}/${entityId}`;
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return "À l'instant";
  if (diffMin < 60) return `Il y a ${diffMin} min`;
  if (diffHours < 24) return `Il y a ${diffHours}h`;
  if (diffDays < 7) return `Il y a ${diffDays}j`;
  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

export default function ActivityPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
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
    setTotalCount(data.pagination?.total || 0);
    setLoading(false);
  }, [page, entityFilter, actionFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Group logs by date
  const groupedLogs: { date: string; entries: LogEntry[] }[] = [];
  let currentGroup: { date: string; entries: LogEntry[] } | null = null;
  for (const log of logs) {
    const dateKey = new Date(log.createdAt).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    if (!currentGroup || currentGroup.date !== dateKey) {
      currentGroup = { date: dateKey, entries: [] };
      groupedLogs.push(currentGroup);
    }
    currentGroup.entries.push(log);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Journal d&apos;activité</h1>
        <p className="text-sm text-slate-500 mt-1">
          Historique de toutes les actions effectuées sur la plateforme
          {totalCount > 0 && <span className="ml-2 text-slate-400">({totalCount} entrées)</span>}
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-slate-400" />
          <select
            value={entityFilter}
            onChange={(e) => { setEntityFilter(e.target.value); setPage(1); }}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 focus:border-primary-500 focus:outline-none"
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
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 focus:border-primary-500 focus:outline-none"
        >
          <option value="">Toutes les actions</option>
          <option value="CREATE">Création</option>
          <option value="UPDATE">Modification</option>
          <option value="DELETE">Suppression</option>
          <option value="RESTORE">Restauration</option>
          <option value="EXPORT">Export</option>
          <option value="SYNC">Synchronisation</option>
          <option value="BULK_DELETE">Suppression en lot</option>
          <option value="BULK_UPDATE">Modification en lot</option>
        </select>
        {(entityFilter || actionFilter) && (
          <button
            onClick={() => { setEntityFilter(""); setActionFilter(""); setPage(1); }}
            className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-500 hover:bg-slate-50 transition-colors"
          >
            Réinitialiser les filtres
          </button>
        )}
      </div>

      {/* Log list */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center p-12">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
          </div>
        ) : logs.length === 0 ? (
          <div className="px-4 py-16 text-center">
            <Activity className="mx-auto h-10 w-10 mb-3 text-slate-300" />
            <p className="text-sm text-slate-500 font-medium">Aucune activité enregistrée</p>
            <p className="text-xs text-slate-400 mt-1">Les actions apparaîtront ici au fur et à mesure</p>
          </div>
        ) : (
          <div>
            {groupedLogs.map((group) => (
              <div key={group.date}>
                {/* Date separator */}
                <div className="sticky top-0 z-10 bg-slate-50 backdrop-blur-sm border-b border-slate-200 px-4 py-2">
                  <p className="text-xs font-semibold text-slate-500 capitalize">{group.date}</p>
                </div>

                {/* Entries for this date */}
                <div className="divide-y divide-slate-100">
                  {group.entries.map((log) => {
                    const actionConf = ACTION_CONFIG[log.action] || { label: log.action, color: "bg-slate-100 text-slate-600 border-slate-200", icon: Activity };
                    const ActionIcon = actionConf.icon;
                    const entityConf = ENTITY_CONFIG[log.entity];
                    const entityLink = getEntityLink(log.entity, log.entityId);

                    return (
                      <div key={log.id} className="flex items-start gap-3 px-4 py-3.5 hover:bg-slate-50/50 transition-colors">
                        {/* Action icon */}
                        <div className={`mt-0.5 shrink-0 rounded-lg border p-1.5 ${actionConf.color}`}>
                          <ActionIcon className="h-3.5 w-3.5" />
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`inline-block rounded-md border px-2 py-0.5 text-xs font-medium ${actionConf.color}`}>
                              {actionConf.label}
                            </span>
                            <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                              {entityConf?.label || log.entity}
                            </span>
                          </div>

                          <div className="mt-1.5">
                            {log.details ? (
                              <p className="text-sm text-slate-800">{log.details}</p>
                            ) : (
                              <p className="text-sm text-slate-500 italic">Aucun détail</p>
                            )}
                          </div>

                          <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-400">
                            <span className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {log.userName || "Système"}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {new Date(log.createdAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                              <span className="text-slate-300 mx-0.5">·</span>
                              {formatRelativeTime(log.createdAt)}
                            </span>
                          </div>
                        </div>

                        {/* Link to entity */}
                        {entityLink && (
                          <Link
                            href={entityLink}
                            className="shrink-0 mt-1 flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-50 hover:text-primary-600 transition-colors"
                          >
                            Voir <ArrowRight className="h-3 w-3" />
                          </Link>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3">
            <p className="text-sm text-slate-500">Page {page} sur {totalPages}</p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(page - 1)}
                disabled={page <= 1}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 disabled:opacity-50 hover:bg-slate-50 transition-colors"
              >
                Précédent
              </button>
              <button
                onClick={() => setPage(page + 1)}
                disabled={page >= totalPages}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 disabled:opacity-50 hover:bg-slate-50 transition-colors"
              >
                Suivant
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
