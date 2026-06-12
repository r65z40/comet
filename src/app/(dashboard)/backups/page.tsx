"use client";

import { useEffect, useState, useCallback, useRef } from "react";
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
  Users,
  X,
  LinkIcon,
  Unlink,
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

interface CometClient {
  id: string;
  name: string;
  oxiboxId: string | null;
  logoUrl: string | null;
}

const STATUS_CONFIG = {
  OK: { label: "OK", color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-200", icon: CheckCircle, dot: "bg-emerald-500", ring: "ring-emerald-200" },
  ALERT: { label: "Alerte", color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-200", icon: AlertTriangle, dot: "bg-amber-500", ring: "ring-amber-200" },
  ERROR: { label: "Erreur", color: "text-red-600", bg: "bg-red-50", border: "border-red-200", icon: XCircle, dot: "bg-red-500", ring: "ring-red-200" },
};

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 o";
  const units = ["o", "Ko", "Mo", "Go", "To"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i > 1 ? 1 : 0)} ${units[i]}`;
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
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const [expandedMachines, setExpandedMachines] = useState<Set<string>>(new Set());
  const [cloudUsage, setCloudUsage] = useState<Record<string, CloudUsage>>({});
  const [loadingUsage, setLoadingUsage] = useState<Set<string>>(new Set());
  const [allClients, setAllClients] = useState<CometClient[]>([]);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [assigningFor, setAssigningFor] = useState<string | null>(null);
  const [clientSearch, setClientSearch] = useState("");
  const assignRef = useRef<HTMLDivElement>(null);

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
      for (const a of all) fetchUsage(a.organizationId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchClients = useCallback(async () => {
    try {
      const res = await fetch("/api/clients?limit=9999");
      if (res.ok) {
        const data = await res.json();
        setAllClients(
          (data.clients || data || []).map((c: CometClient) => ({ id: c.id, name: c.name, oxiboxId: c.oxiboxId, logoUrl: c.logoUrl })),
        );
      }
    } catch {}
  }, []);

  useEffect(() => {
    fetchAccounts();
    fetchClients();
  }, [fetchAccounts, fetchClients]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (assignRef.current && !assignRef.current.contains(e.target as Node)) setAssigningFor(null);
    }
    if (assigningFor) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [assigningFor]);

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
    setLoadingUsage((prev) => { const n = new Set(prev); n.delete(orgId); return n; });
  }

  function loadJobsForAccount(orgId: string) {
    fetch(`/api/oxibox/status?orgId=${encodeURIComponent(orgId)}&include=jobs`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) return;
        setAccounts((prev) => prev.map((a) => (a.organizationId === orgId ? { ...a, machines: data.machines || a.machines } : a)));
      })
      .catch(() => {});
  }

  async function assignClient(oxiboxId: string, clientId: string) {
    await fetch(`/api/clients/${clientId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ oxiboxId }),
    });
    setAssigningFor(null);
    setClientSearch("");
    fetchClients();
  }

  async function unlinkClient(clientId: string) {
    await fetch(`/api/clients/${clientId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ oxiboxId: "" }),
    });
    fetchClients();
  }

  const clientByOxiboxId = new Map(allClients.filter((c) => c.oxiboxId).map((c) => [c.oxiboxId!, c]));
  const unlinkedClients = allClients.filter((c) => !c.oxiboxId);

  const filtered = accounts
    .filter((a) => {
      if (statusFilter !== "ALL" && a.status !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const matchOrg = a.organizationId.toLowerCase().includes(q);
        const linked = clientByOxiboxId.get(a.organizationId);
        const matchClient = linked?.name.toLowerCase().includes(q);
        const matchMachine = a.machines.some((m) => m.id.toLowerCase().includes(q));
        if (!matchOrg && !matchClient && !matchMachine) return false;
      }
      return true;
    })
    .sort((a, b) => {
      const order = { ERROR: 0, ALERT: 1, OK: 2 };
      const diff = order[a.status] - order[b.status];
      if (diff !== 0) return diff;
      return a.organizationId.localeCompare(b.organizationId);
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
              {lastRefresh && <span className="text-slate-400"> · {timeAgo(lastRefresh.toISOString())}</span>}
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
              <div className={cn("rounded-lg p-1.5", bg)}><Icon className={cn("h-4 w-4", color)} /></div>
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
          <input type="text" placeholder="Rechercher un compte, client, machine..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500" />
        </div>
        <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5">
          {(["ALL", "OK", "ALERT", "ERROR"] as const).map((s) => (
            <button key={s} onClick={() => setStatusFilter(s)} className={cn("px-3 py-1.5 text-xs font-medium rounded-md transition-colors", statusFilter === s ? "bg-white shadow-sm text-slate-800" : "text-slate-500 hover:text-slate-700")}>
              {s === "ALL" ? "Tous" : STATUS_CONFIG[s].label}
            </button>
          ))}
        </div>
      </div>

      {/* Cards grid */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center">
          <Database className="h-10 w-10 text-slate-200 mx-auto mb-3" />
          <p className="text-sm text-slate-400">{accounts.length === 0 ? "Aucun compte Oxibox trouvé" : "Aucun résultat pour ce filtre"}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((account) => {
            const cfg = STATUS_CONFIG[account.status];
            const StatusIcon = cfg.icon;
            const usage = cloudUsage[account.organizationId];
            const linkedClient = clientByOxiboxId.get(account.organizationId);
            const isExpanded = expandedCard === account.organizationId;
            const usagePercent = usage ? Math.round((usage.currentUsage / usage.allocatedQuota) * 100) : null;

            return (
              <div key={account.organizationId} className={cn("rounded-xl border bg-white overflow-hidden transition-shadow hover:shadow-md", account.status === "ERROR" ? "border-red-200" : account.status === "ALERT" ? "border-amber-200" : "border-slate-200")}>
                {/* Status bar top */}
                <div className={cn("h-1", cfg.dot)} />

                <div className="p-4">
                  {/* Header row */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {linkedClient?.logoUrl ? (
                        <img src={linkedClient.logoUrl} alt="" className="h-8 w-8 rounded-lg object-cover shrink-0 border border-slate-200" />
                      ) : linkedClient ? (
                        <div className="h-8 w-8 rounded-lg bg-primary-100 flex items-center justify-center shrink-0 text-xs font-bold text-primary-600">
                          {linkedClient.name.charAt(0).toUpperCase()}
                        </div>
                      ) : null}
                      <div className="min-w-0">
                        <h3 className="text-sm font-bold text-slate-800 truncate">{linkedClient ? linkedClient.name : account.organizationId}</h3>
                        <div className="flex items-center gap-2 mt-0.5">
                          {linkedClient && <span className="text-[10px] text-slate-400 truncate">{account.organizationId}</span>}
                          <span className="flex items-center gap-1 text-[11px] text-slate-400">
                            <Monitor className="h-3 w-3" />
                            {account.machines.length} machine{account.machines.length > 1 ? "s" : ""}
                          </span>
                          {account.ongoingBackup && (
                            <span className="flex items-center gap-1 text-[11px] text-purple-500">
                              <RefreshCw className="h-3 w-3 animate-spin" />
                              En cours
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <span className={cn("shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold", cfg.bg, cfg.color)}>
                      <StatusIcon className="h-3.5 w-3.5" />
                      {cfg.label}
                    </span>
                  </div>

                  {/* Quota bar */}
                  <div className="mb-3">
                    {usage ? (
                      <>
                        <div className="flex items-center justify-between text-[11px] mb-1">
                          <span className="text-slate-400">Stockage</span>
                          <span className="text-slate-600 font-medium">{formatBytes(usage.currentUsage)} / {formatBytes(usage.allocatedQuota)}</span>
                        </div>
                        <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={cn("h-full rounded-full transition-all", usagePercent! > 90 ? "bg-red-500" : usagePercent! > 70 ? "bg-amber-500" : "bg-emerald-500")}
                            style={{ width: `${Math.min(100, usagePercent!)}%` }}
                          />
                        </div>
                        <p className="text-[10px] text-slate-400 mt-0.5 text-right">{usagePercent}%</p>
                      </>
                    ) : loadingUsage.has(account.organizationId) ? (
                      <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden animate-pulse" />
                    ) : (
                      <div className="h-2.5 bg-slate-50 rounded-full" />
                    )}
                  </div>

                  {/* Machines mini-list */}
                  {account.machines.length > 0 && (
                    <div className="space-y-1 mb-3">
                      {account.machines.slice(0, isExpanded ? undefined : 3).map((m) => {
                        const mCfg = STATUS_CONFIG[m.status];
                        return (
                          <div key={m.id} className="flex items-center gap-2 text-[11px] px-2 py-1.5 rounded-lg bg-slate-50">
                            <div className={cn("w-1.5 h-1.5 rounded-full shrink-0", mCfg.dot)} />
                            <Server className="h-3 w-3 text-slate-300 shrink-0" />
                            <span className="text-slate-600 truncate flex-1">{m.id}</span>
                            {m.ongoingBackup && <RefreshCw className="h-2.5 w-2.5 text-purple-400 animate-spin shrink-0" />}
                            <span className={cn("text-[10px] font-medium", mCfg.color)}>{mCfg.label}</span>
                          </div>
                        );
                      })}
                      {!isExpanded && account.machines.length > 3 && (
                        <button onClick={() => { setExpandedCard(account.organizationId); loadJobsForAccount(account.organizationId); }} className="text-[11px] text-primary-600 hover:underline px-2">
                          +{account.machines.length - 3} machine(s)...
                        </button>
                      )}
                    </div>
                  )}

                  {/* Expanded: jobs detail */}
                  {isExpanded && account.machines.length > 0 && (
                    <div className="space-y-2 mb-3 border-t border-slate-100 pt-3">
                      {account.machines.map((machine) => {
                        const mKey = `${account.organizationId}::${machine.id}`;
                        const mExpanded = expandedMachines.has(mKey);
                        return (
                          <div key={machine.id}>
                            <button
                              onClick={() => {
                                if (!machine.jobs) loadJobsForAccount(account.organizationId);
                                setExpandedMachines((prev) => { const n = new Set(prev); if (n.has(mKey)) n.delete(mKey); else n.add(mKey); return n; });
                              }}
                              className="flex items-center gap-1.5 text-[11px] text-slate-500 hover:text-slate-700 w-full text-left"
                            >
                              {mExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                              <Server className="h-3 w-3" />
                              <span className="font-medium">{machine.id}</span>
                              {machine.jobs && <span className="text-slate-300 ml-auto">{machine.jobs.length} job(s)</span>}
                            </button>
                            {mExpanded && machine.jobs && machine.jobs.length > 0 && (
                              <div className="ml-5 mt-1 space-y-1">
                                {machine.jobs.map((job, ji) => {
                                  const jCfg = STATUS_CONFIG[job.status];
                                  const log = job.lastRelevantBackupLog;
                                  return (
                                    <div key={ji} className="flex items-start gap-2 p-2 rounded bg-white border border-slate-100 text-[10px]">
                                      <FolderOpen className="h-3 w-3 text-slate-300 shrink-0 mt-0.5" />
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1.5">
                                          <span className="font-mono text-slate-500 truncate">{job.path}</span>
                                          <span className={cn("font-medium", jCfg.color)}>{jCfg.label}</span>
                                        </div>
                                        {log && (
                                          <div className="flex items-center gap-2 mt-0.5 text-slate-400">
                                            <Clock className="h-2.5 w-2.5" />
                                            {formatDateTime(log.startedAt)} · {formatBytes(log.totalBytesProcessed)} · <span className={log.success ? "text-emerald-500" : "text-red-500"}>{log.success ? "OK" : "Échec"}</span>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                            {mExpanded && !machine.jobs && (
                              <div className="ml-5 mt-1 text-[10px] text-slate-400 flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Chargement...</div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Footer: client link + expand */}
                  <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                    {linkedClient ? (
                      <div className="flex items-center gap-1.5 flex-1 min-w-0">
                        <Link href={`/clients/${linkedClient.id}`} className="flex items-center gap-1.5 text-[11px] font-medium text-primary-600 hover:text-primary-800 truncate">
                          <Users className="h-3 w-3 shrink-0" />
                          Voir le client
                        </Link>
                        <button onClick={() => unlinkClient(linkedClient.id)} className="p-0.5 text-slate-300 hover:text-red-400 transition-colors" title="Dissocier">
                          <Unlink className="h-3 w-3" />
                        </button>
                      </div>
                    ) : (
                      <div className="relative flex-1" ref={assigningFor === account.organizationId ? assignRef : undefined}>
                        <button
                          onClick={() => { setAssigningFor(assigningFor === account.organizationId ? null : account.organizationId); setClientSearch(""); }}
                          className="flex items-center gap-1.5 text-[11px] text-slate-400 hover:text-primary-600 transition-colors"
                        >
                          <LinkIcon className="h-3 w-3" />
                          Assigner à un client
                        </button>
                        {assigningFor === account.organizationId && (
                          <div className="fixed inset-0 z-[60]" onClick={() => setAssigningFor(null)}>
                            <div
                              className="absolute w-72 bg-white border border-slate-200 rounded-xl shadow-xl z-[70]"
                              style={{ left: assignRef.current?.getBoundingClientRect().left ?? 0, top: Math.min(assignRef.current?.getBoundingClientRect().top ?? 0, window.innerHeight - 340) }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div className="p-3 border-b border-slate-100">
                                <div className="relative">
                                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                                  <input
                                    type="text"
                                    placeholder="Rechercher un client..."
                                    value={clientSearch}
                                    onChange={(e) => setClientSearch(e.target.value)}
                                    className="w-full pl-8 pr-8 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 placeholder-slate-400"
                                    autoFocus
                                  />
                                  {clientSearch && (
                                    <button onClick={() => setClientSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500">
                                      <X className="h-3.5 w-3.5" />
                                    </button>
                                  )}
                                </div>
                              </div>
                              <div className="max-h-60 overflow-y-auto p-1.5">
                                {(() => {
                                  const results = unlinkedClients.filter((c) => !clientSearch || c.name.toLowerCase().includes(clientSearch.toLowerCase()));
                                  if (results.length === 0) return (
                                    <p className="text-xs text-slate-400 text-center py-4">Aucun client disponible</p>
                                  );
                                  return results.slice(0, 50).map((c) => (
                                    <button
                                      key={c.id}
                                      onClick={() => assignClient(account.organizationId, c.id)}
                                      className="w-full flex items-center gap-2.5 px-2.5 py-2 text-sm text-slate-700 hover:bg-primary-50 hover:text-primary-700 rounded-lg transition-colors text-left"
                                    >
                                      {c.logoUrl ? (
                                        <img src={c.logoUrl} alt="" className="h-6 w-6 rounded object-cover shrink-0 border border-slate-100" />
                                      ) : (
                                        <div className="h-6 w-6 rounded bg-slate-100 flex items-center justify-center shrink-0 text-[10px] font-bold text-slate-400">
                                          {c.name.charAt(0).toUpperCase()}
                                        </div>
                                      )}
                                      <span className="truncate">{c.name}</span>
                                    </button>
                                  ));
                                })()}
                              </div>
                              {unlinkedClients.filter((c) => !clientSearch || c.name.toLowerCase().includes(clientSearch.toLowerCase())).length > 50 && (
                                <div className="px-3 py-2 border-t border-slate-100 text-[10px] text-slate-400 text-center">
                                  Utilisez la recherche pour affiner les résultats
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    <button
                      onClick={() => {
                        if (isExpanded) { setExpandedCard(null); } else { setExpandedCard(account.organizationId); loadJobsForAccount(account.organizationId); }
                      }}
                      className="text-[11px] text-slate-400 hover:text-slate-600 transition-colors flex items-center gap-0.5 shrink-0"
                    >
                      {isExpanded ? "Réduire" : "Détails"}
                      {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
