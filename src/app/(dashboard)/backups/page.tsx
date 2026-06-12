"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  HardDrive,
  RefreshCw,
  Search,
  ChevronDown,
  ChevronRight,
  Monitor,
  Server,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Loader2,
  Clock,
  Database,
  FolderOpen,
  Settings,
  ArrowUpDown,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface BackupLog {
  success: boolean;
  startedAt: string;
  endedAt: string;
  totalBytesProcessed: number;
}

interface BackupJob {
  path: string;
  status: "OK" | "ALERT" | "ERROR";
  ongoingBackup: boolean;
  lastRelevantBackupLog?: BackupLog;
}

interface Machine {
  id: string;
  status: "OK" | "ALERT" | "ERROR";
  ongoingBackup: boolean;
  jobs?: BackupJob[];
}

interface OxiboxAccount {
  organizationId: string;
  status: "OK" | "ALERT" | "ERROR";
  ongoingBackup: boolean;
  machines: Machine[];
}

interface CloudUsage {
  organizationId: string;
  allocatedQuota: number;
  currentUsage: number;
}

interface ClientLink {
  id: string;
  name: string;
  oxiboxId: string | null;
}

const STATUS_CONFIG = {
  OK: { label: "OK", color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-200", icon: CheckCircle, dot: "bg-emerald-500" },
  ALERT: { label: "Alerte", color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-200", icon: AlertTriangle, dot: "bg-amber-500" },
  ERROR: { label: "Erreur", color: "text-red-600", bg: "bg-red-50", border: "border-red-200", icon: XCircle, dot: "bg-red-500" },
};

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 o";
  const units = ["o", "Ko", "Mo", "Go", "To"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i > 1 ? 1 : 0)} ${units[i]}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })} ${d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `il y a ${mins}min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `il y a ${hours}h`;
  const days = Math.floor(hours / 24);
  return `il y a ${days}j`;
}

export default function BackupsPage() {
  const [accounts, setAccounts] = useState<OxiboxAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "OK" | "ALERT" | "ERROR">("ALL");
  const [expandedAccounts, setExpandedAccounts] = useState<Set<string>>(new Set());
  const [expandedMachines, setExpandedMachines] = useState<Set<string>>(new Set());
  const [cloudUsage, setCloudUsage] = useState<Record<string, CloudUsage>>({});
  const [loadingUsage, setLoadingUsage] = useState<Set<string>>(new Set());
  const [clients, setClients] = useState<ClientLink[]>([]);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [sortField, setSortField] = useState<"name" | "status">("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const fetchAccounts = useCallback(async () => {
    setError(null);
    try {
      let all: OxiboxAccount[] = [];
      let skip = 0;
      const limit = 200;
      let hasMore = true;

      while (hasMore) {
        const res = await fetch(`/api/oxibox/status?limit=${limit}&skip=${skip}`);
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || `Erreur ${res.status}`);
        }
        const data = await res.json();
        if (data.data) {
          all = [...all, ...data.data];
          hasMore = all.length < (data.total || 0);
          skip += limit;
        } else if (data.organizationId) {
          all = [data];
          hasMore = false;
        } else {
          hasMore = false;
        }
      }

      setAccounts(all);
      setLastRefresh(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchClients = useCallback(async () => {
    try {
      const res = await fetch("/api/clients?limit=9999");
      if (res.ok) {
        const data = await res.json();
        const list = (data.clients || data || [])
          .filter((c: ClientLink) => c.oxiboxId)
          .map((c: ClientLink) => ({ id: c.id, name: c.name, oxiboxId: c.oxiboxId }));
        setClients(list);
      }
    } catch {}
  }, []);

  useEffect(() => {
    fetchAccounts();
    fetchClients();
  }, [fetchAccounts, fetchClients]);

  async function fetchUsage(orgId: string) {
    if (cloudUsage[orgId] || loadingUsage.has(orgId)) return;
    setLoadingUsage((prev) => new Set(prev).add(orgId));
    try {
      const res = await fetch(`/api/oxibox/usage?orgId=${encodeURIComponent(orgId)}`);
      if (res.ok) {
        const data = await res.json();
        setCloudUsage((prev) => ({ ...prev, [orgId]: data }));
      }
    } catch {}
    setLoadingUsage((prev) => {
      const next = new Set(prev);
      next.delete(orgId);
      return next;
    });
  }

  function toggleAccount(orgId: string) {
    setExpandedAccounts((prev) => {
      const next = new Set(prev);
      if (next.has(orgId)) {
        next.delete(orgId);
      } else {
        next.add(orgId);
        fetchUsage(orgId);
      }
      return next;
    });
  }

  function toggleMachine(key: string) {
    setExpandedMachines((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function loadJobsForAccount(orgId: string) {
    fetch(`/api/oxibox/status?orgId=${encodeURIComponent(orgId)}&include=jobs`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (!data) return;
        setAccounts((prev) =>
          prev.map((a) => (a.organizationId === orgId ? { ...a, machines: data.machines || a.machines } : a)),
        );
      })
      .catch(() => {});
  }

  const clientByOxiboxId = new Map(clients.map((c) => [c.oxiboxId, c]));

  const filtered = accounts
    .filter((a) => {
      if (statusFilter !== "ALL" && a.status !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const matchOrg = a.organizationId.toLowerCase().includes(q);
        const linkedClient = clientByOxiboxId.get(a.organizationId);
        const matchClient = linkedClient?.name.toLowerCase().includes(q);
        const matchMachine = a.machines.some((m) => m.id.toLowerCase().includes(q));
        if (!matchOrg && !matchClient && !matchMachine) return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (sortField === "status") {
        const order = { ERROR: 0, ALERT: 1, OK: 2 };
        const diff = order[a.status] - order[b.status];
        return sortDir === "asc" ? diff : -diff;
      }
      const cmp = a.organizationId.localeCompare(b.organizationId);
      return sortDir === "asc" ? cmp : -cmp;
    });

  const stats = {
    ok: accounts.filter((a) => a.status === "OK").length,
    alert: accounts.filter((a) => a.status === "ALERT").length,
    error: accounts.filter((a) => a.status === "ERROR").length,
    totalMachines: accounts.reduce((sum, a) => sum + a.machines.length, 0),
    ongoingBackups: accounts.filter((a) => a.ongoingBackup).length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-3 text-slate-400">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>Chargement des sauvegardes Oxibox...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50">
            <HardDrive className="h-5 w-5 text-emerald-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Sauvegardes</h1>
            <p className="text-sm text-slate-500">Supervision Oxibox</p>
          </div>
        </div>
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
          <XCircle className="h-8 w-8 text-red-400 mx-auto mb-3" />
          <p className="text-sm font-medium text-red-700 mb-1">{error}</p>
          <p className="text-xs text-red-500 mb-4">Vérifiez la clé API dans les Paramètres &gt; Sauvegardes Oxibox</p>
          <div className="flex items-center justify-center gap-3">
            <button onClick={() => { setLoading(true); fetchAccounts(); }} className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors">
              Réessayer
            </button>
            <Link href="/settings" className="px-4 py-2 text-sm border border-red-200 text-red-700 rounded-lg hover:bg-red-100 transition-colors">
              <Settings className="h-4 w-4 inline mr-1.5" />
              Paramètres
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 -mx-4 sm:-mx-6 px-4 sm:px-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50">
            <HardDrive className="h-5 w-5 text-emerald-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Sauvegardes</h1>
            <p className="text-sm text-slate-500">
              {accounts.length} compte{accounts.length > 1 ? "s" : ""} Oxibox
              {lastRefresh && (
                <span className="text-slate-400"> · Actualisé {timeAgo(lastRefresh.toISOString())}</span>
              )}
            </p>
          </div>
        </div>
        <button
          onClick={() => { setLoading(true); fetchAccounts(); }}
          className="flex items-center gap-1.5 px-3 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
          Actualiser
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: "OK", value: stats.ok, color: "text-emerald-600", bg: "bg-emerald-50", icon: CheckCircle },
          { label: "Alertes", value: stats.alert, color: "text-amber-600", bg: "bg-amber-50", icon: AlertTriangle },
          { label: "Erreurs", value: stats.error, color: "text-red-600", bg: "bg-red-50", icon: XCircle },
          { label: "Machines", value: stats.totalMachines, color: "text-blue-600", bg: "bg-blue-50", icon: Monitor },
          { label: "En cours", value: stats.ongoingBackups, color: "text-purple-600", bg: "bg-purple-50", icon: RefreshCw },
        ].map(({ label, value, color, bg, icon: Icon }) => (
          <div key={label} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-2 mb-1">
              <div className={cn("rounded-lg p-1.5", bg)}>
                <Icon className={cn("h-4 w-4", color)} />
              </div>
              <span className="text-xs text-slate-400">{label}</span>
            </div>
            <p className={cn("text-2xl font-bold", color)}>{value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Rechercher un compte, client, machine..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
        <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5">
          {(["ALL", "OK", "ALERT", "ERROR"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn(
                "px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
                statusFilter === s ? "bg-white shadow-sm text-slate-800" : "text-slate-500 hover:text-slate-700",
              )}
            >
              {s === "ALL" ? "Tous" : STATUS_CONFIG[s].label}
            </button>
          ))}
        </div>
        <button
          onClick={() => {
            if (sortField === "status") setSortDir((d) => (d === "asc" ? "desc" : "asc"));
            else { setSortField("status"); setSortDir("asc"); }
          }}
          className="flex items-center gap-1 px-3 py-2 text-xs text-slate-500 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
        >
          <ArrowUpDown className="h-3.5 w-3.5" />
          Trier par {sortField === "status" ? "statut" : "nom"}
        </button>
      </div>

      {/* Accounts list */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center">
          <Database className="h-10 w-10 text-slate-200 mx-auto mb-3" />
          <p className="text-sm text-slate-400">
            {accounts.length === 0 ? "Aucun compte Oxibox trouvé" : "Aucun résultat pour ce filtre"}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((account) => {
            const cfg = STATUS_CONFIG[account.status];
            const isExpanded = expandedAccounts.has(account.organizationId);
            const usage = cloudUsage[account.organizationId];
            const linkedClient = clientByOxiboxId.get(account.organizationId);

            return (
              <div key={account.organizationId} className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                {/* Account header */}
                <button
                  onClick={() => toggleAccount(account.organizationId)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 transition-colors"
                >
                  {isExpanded ? <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" /> : <ChevronRight className="h-4 w-4 text-slate-400 shrink-0" />}

                  <div className={cn("w-2.5 h-2.5 rounded-full shrink-0", cfg.dot)} />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-800 truncate">{account.organizationId}</span>
                      {linkedClient && (
                        <Link
                          href={`/clients/${linkedClient.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 font-medium hover:bg-blue-100 transition-colors truncate max-w-[200px]"
                        >
                          {linkedClient.name}
                        </Link>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5">
                      <span className="flex items-center gap-1">
                        <Monitor className="h-3 w-3" />
                        {account.machines.length} machine{account.machines.length > 1 ? "s" : ""}
                      </span>
                      {account.ongoingBackup && (
                        <span className="flex items-center gap-1 text-purple-500">
                          <RefreshCw className="h-3 w-3 animate-spin" />
                          Sauvegarde en cours
                        </span>
                      )}
                    </div>
                  </div>

                  <span className={cn("shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border", cfg.bg, cfg.color, cfg.border)}>
                    <cfg.icon className="h-3.5 w-3.5" />
                    {cfg.label}
                  </span>
                </button>

                {/* Expanded: machines */}
                {isExpanded && (
                  <div className="border-t border-slate-100 bg-slate-50/50">
                    {/* Cloud usage */}
                    {usage && (
                      <div className="px-5 py-3 border-b border-slate-100">
                        <div className="flex items-center justify-between text-xs mb-1.5">
                          <span className="text-slate-500 flex items-center gap-1.5">
                            <Database className="h-3.5 w-3.5" />
                            Stockage cloud
                          </span>
                          <span className="text-slate-600 font-medium">
                            {formatBytes(usage.currentUsage)} / {formatBytes(usage.allocatedQuota)}
                          </span>
                        </div>
                        <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all",
                              usage.currentUsage / usage.allocatedQuota > 0.9 ? "bg-red-500" :
                              usage.currentUsage / usage.allocatedQuota > 0.7 ? "bg-amber-500" : "bg-emerald-500",
                            )}
                            style={{ width: `${Math.min(100, (usage.currentUsage / usage.allocatedQuota) * 100)}%` }}
                          />
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1">
                          {Math.round((usage.currentUsage / usage.allocatedQuota) * 100)}% utilisé
                        </p>
                      </div>
                    )}
                    {loadingUsage.has(account.organizationId) && (
                      <div className="px-5 py-2 border-b border-slate-100 flex items-center gap-2 text-xs text-slate-400">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Chargement du stockage...
                      </div>
                    )}

                    {account.machines.length === 0 ? (
                      <div className="px-5 py-6 text-center text-sm text-slate-400">Aucune machine configurée</div>
                    ) : (
                      <div className="divide-y divide-slate-100">
                        {account.machines.map((machine) => {
                          const mCfg = STATUS_CONFIG[machine.status];
                          const mKey = `${account.organizationId}::${machine.id}`;
                          const mExpanded = expandedMachines.has(mKey);
                          const hasJobs = machine.jobs && machine.jobs.length > 0;

                          return (
                            <div key={machine.id}>
                              <button
                                onClick={() => {
                                  if (!machine.jobs) loadJobsForAccount(account.organizationId);
                                  toggleMachine(mKey);
                                }}
                                className="w-full flex items-center gap-3 px-5 py-2.5 text-left hover:bg-white transition-colors"
                              >
                                {mExpanded ? <ChevronDown className="h-3.5 w-3.5 text-slate-400 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 text-slate-400 shrink-0" />}
                                <Server className="h-4 w-4 text-slate-400 shrink-0" />
                                <span className="text-sm text-slate-700 font-medium flex-1 truncate">{machine.id}</span>
                                {machine.ongoingBackup && (
                                  <RefreshCw className="h-3.5 w-3.5 text-purple-500 animate-spin shrink-0" />
                                )}
                                <span className={cn("flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border", mCfg.bg, mCfg.color, mCfg.border)}>
                                  <mCfg.icon className="h-3 w-3" />
                                  {mCfg.label}
                                </span>
                              </button>

                              {/* Jobs */}
                              {mExpanded && hasJobs && (
                                <div className="pl-14 pr-5 pb-3 space-y-1.5">
                                  {machine.jobs!.map((job, ji) => {
                                    const jCfg = STATUS_CONFIG[job.status];
                                    const log = job.lastRelevantBackupLog;
                                    return (
                                      <div key={ji} className="flex items-start gap-3 p-2.5 rounded-lg bg-white border border-slate-100">
                                        <FolderOpen className="h-4 w-4 text-slate-300 shrink-0 mt-0.5" />
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center gap-2">
                                            <span className="text-xs font-mono text-slate-600 truncate">{job.path}</span>
                                            <span className={cn("shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-full border", jCfg.bg, jCfg.color, jCfg.border)}>
                                              {jCfg.label}
                                            </span>
                                            {job.ongoingBackup && <RefreshCw className="h-3 w-3 text-purple-500 animate-spin shrink-0" />}
                                          </div>
                                          {log && (
                                            <div className="flex items-center gap-3 mt-1 text-[10px] text-slate-400">
                                              <span className="flex items-center gap-1">
                                                <Clock className="h-3 w-3" />
                                                {formatDateTime(log.startedAt)}
                                              </span>
                                              <span>{formatBytes(log.totalBytesProcessed)}</span>
                                              <span className={log.success ? "text-emerald-500" : "text-red-500"}>
                                                {log.success ? "Succès" : "Échec"}
                                              </span>
                                              <span className="text-slate-300">{timeAgo(log.endedAt)}</span>
                                            </div>
                                          )}
                                          {!log && (
                                            <p className="text-[10px] text-slate-300 mt-1">Aucune sauvegarde enregistrée</p>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                              {mExpanded && !hasJobs && !machine.jobs && (
                                <div className="pl-14 pr-5 pb-3">
                                  <div className="flex items-center gap-2 text-xs text-slate-400">
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                    Chargement des jobs...
                                  </div>
                                </div>
                              )}
                              {mExpanded && machine.jobs && machine.jobs.length === 0 && (
                                <div className="pl-14 pr-5 pb-3">
                                  <p className="text-xs text-slate-400">Aucun jeu de sauvegarde configuré</p>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
