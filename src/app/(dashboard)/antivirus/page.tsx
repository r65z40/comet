"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  ShieldOff,
  RefreshCw,
  Search,
  Monitor,
  Building2,
  Bug,
  Link2,
  Unlink,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  CheckCircle,
  Loader2,
  X,
  Server,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Workspace {
  id: string;
  name: string;
  deviceCount: number;
  isExpired: boolean;
  isExpiresSoon: boolean;
  lastAlert: string | null;
  findingType: string | null;
  findingsLastMonth: number;
  totalSeat: number;
  usedSeat: number;
  unusedSeat: number;
  createdAt: string;
}

interface Device {
  id: string;
  name: string;
  groupPath: string;
  lastSeen: string;
  protectionStatus: string;
  operatingSystem: string;
  policyName: string | null;
}

interface Incident {
  id: string;
  deviceName: string;
  type: string;
  severity: string;
  title: string;
  status: string;
  detectedAt: string;
}

interface CometClient {
  id: string;
  name: string;
  emsisoftId: string | null;
  logoUrl: string | null;
}

interface WorkspaceDetails {
  devices: Device[];
  incidents: Incident[];
}

function timeAgo(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "à l'instant";
  if (mins < 60) return `il y a ${mins}min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `il y a ${hours}h`;
  const days = Math.floor(hours / 24);
  return `il y a ${days}j`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

export default function AntivirusPage() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [allClients, setAllClients] = useState<CometClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [expandedWs, setExpandedWs] = useState<Set<string>>(new Set());
  const [wsDetails, setWsDetails] = useState<Record<string, WorkspaceDetails>>({});
  const [wsDetailsLoading, setWsDetailsLoading] = useState<Set<string>>(new Set());
  const [linkingWs, setLinkingWs] = useState<string | null>(null);
  const [clientSearch, setClientSearch] = useState("");
  const [savingLink, setSavingLink] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [emsRes, clientsRes] = await Promise.all([
        fetch("/api/emsisoft", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "workspaces" }) }),
        fetch("/api/clients?limit=200&showAll=true"),
      ]);
      if (!emsRes.ok) throw new Error("Erreur API Emsisoft");
      const emsData = await emsRes.json();
      if (emsData.error) throw new Error(emsData.error);
      setWorkspaces(emsData.workspaces || []);

      if (clientsRes.ok) {
        const cData = await clientsRes.json();
        setAllClients(
          (cData.clients || []).map((c: CometClient) => ({
            id: c.id, name: c.name, emsisoftId: c.emsisoftId, logoUrl: c.logoUrl,
          })),
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function fetchWorkspaceDetails(wsId: string) {
    if (wsDetails[wsId] || wsDetailsLoading.has(wsId)) return;
    setWsDetailsLoading((prev) => new Set(prev).add(wsId));
    try {
      const res = await fetch(`/api/emsisoft/status?workspaceId=${wsId}`);
      if (res.ok) {
        const data = await res.json();
        setWsDetails((prev) => ({ ...prev, [wsId]: { devices: data.devices || [], incidents: data.incidents || [] } }));
      }
    } catch {} finally {
      setWsDetailsLoading((prev) => { const next = new Set(prev); next.delete(wsId); return next; });
    }
  }

  const toggleExpand = (wsId: string) => {
    setExpandedWs((prev) => {
      const next = new Set(prev);
      if (next.has(wsId)) {
        next.delete(wsId);
      } else {
        next.add(wsId);
        fetchWorkspaceDetails(wsId);
      }
      return next;
    });
  };

  async function linkClient(workspaceGuid: string, clientId: string) {
    setSavingLink(clientId);
    try {
      await fetch(`/api/clients/${clientId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emsisoftId: workspaceGuid }),
      });
      setAllClients((prev) =>
        prev.map((c) =>
          c.id === clientId
            ? { ...c, emsisoftId: workspaceGuid }
            : c.emsisoftId === workspaceGuid
              ? { ...c, emsisoftId: null }
              : c,
        ),
      );
      setLinkingWs(null);
      setClientSearch("");
    } catch {} finally {
      setSavingLink(null);
    }
  }

  async function unlinkClient(clientId: string) {
    setSavingLink(clientId);
    try {
      await fetch(`/api/clients/${clientId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emsisoftId: "" }),
      });
      setAllClients((prev) =>
        prev.map((c) => (c.id === clientId ? { ...c, emsisoftId: null } : c)),
      );
    } catch {} finally {
      setSavingLink(null);
    }
  }

  const clientByEmsisoftId = new Map(
    allClients.filter((c) => c.emsisoftId).map((c) => [c.emsisoftId!, c]),
  );
  const unlinkedClients = allClients.filter((c) => !c.emsisoftId);

  const filteredWorkspaces = workspaces.filter((ws) =>
    !search ||
    ws.name.toLowerCase().includes(search.toLowerCase()) ||
    clientByEmsisoftId.get(ws.id)?.name.toLowerCase().includes(search.toLowerCase()),
  );

  const totalDevices = workspaces.reduce((sum, ws) => sum + ws.deviceCount, 0);
  const totalFindings = workspaces.reduce((sum, ws) => sum + ws.findingsLastMonth, 0);
  const linkedCount = workspaces.filter((ws) => clientByEmsisoftId.has(ws.id)).length;
  const expiredCount = workspaces.filter((ws) => ws.isExpired).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <RefreshCw className="h-6 w-6 text-slate-300 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto py-12 px-4">
        <div className="rounded-xl border border-red-200 bg-red-50 p-8 text-center">
          <ShieldX className="h-10 w-10 text-red-400 mx-auto mb-3" />
          <h2 className="text-lg font-semibold text-red-800 mb-2">Erreur Emsisoft</h2>
          <p className="text-sm text-red-600 mb-4">{error}</p>
          <p className="text-xs text-red-400">Vérifiez votre clé API et l&apos;URL dans Paramètres &gt; Intégrations</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-purple-50 p-2.5">
            <ShieldCheck className="h-6 w-6 text-purple-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Antivirus</h1>
            <p className="text-sm text-slate-500">Gestion Emsisoft — Protection des appareils</p>
          </div>
        </div>
        <button
          onClick={fetchData}
          className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
          Actualiser
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-2 mb-2">
            <Building2 className="h-4 w-4 text-blue-500" />
            <span className="text-xs text-slate-500">Workspaces</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{workspaces.length}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-2 mb-2">
            <Monitor className="h-4 w-4 text-emerald-500" />
            <span className="text-xs text-slate-500">Appareils</span>
          </div>
          <p className="text-2xl font-bold text-emerald-600">{totalDevices}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-2 mb-2">
            <Bug className="h-4 w-4 text-amber-500" />
            <span className="text-xs text-slate-500">Détections/mois</span>
          </div>
          <p className={cn("text-2xl font-bold", totalFindings > 0 ? "text-amber-600" : "text-slate-400")}>{totalFindings}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-2 mb-2">
            <Link2 className="h-4 w-4 text-purple-500" />
            <span className="text-xs text-slate-500">Liés</span>
          </div>
          <p className="text-2xl font-bold text-purple-600">{linkedCount}<span className="text-sm font-normal text-slate-400">/{workspaces.length}</span></p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-4 w-4 text-red-500" />
            <span className="text-xs text-slate-500">Expirés</span>
          </div>
          <p className={cn("text-2xl font-bold", expiredCount > 0 ? "text-red-600" : "text-slate-400")}>{expiredCount}</p>
        </div>
      </div>

      {/* Recent alerts */}
      {(() => {
        const recentAlerts = workspaces
          .filter((ws) => ws.lastAlert)
          .sort((a, b) => new Date(b.lastAlert!).getTime() - new Date(a.lastAlert!).getTime())
          .slice(0, 10);

        if (recentAlerts.length === 0) return null;

        return (
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-3 border-b border-slate-100">
              <ShieldAlert className="h-4 w-4 text-red-500" />
              <h2 className="text-sm font-semibold text-slate-900">Dernières alertes</h2>
              <span className="text-[10px] text-slate-400 ml-auto">10 plus récentes</span>
            </div>
            <div className="divide-y divide-slate-100">
              {recentAlerts.map((ws) => {
                const linked = clientByEmsisoftId.get(ws.id);
                return (
                  <div key={`alert-${ws.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 transition-colors">
                    <div className={cn(
                      "h-8 w-8 rounded-lg flex items-center justify-center shrink-0",
                      ws.findingsLastMonth > 10 ? "bg-red-100" : ws.findingsLastMonth > 0 ? "bg-amber-100" : "bg-slate-100"
                    )}>
                      <Bug className={cn(
                        "h-4 w-4",
                        ws.findingsLastMonth > 10 ? "text-red-500" : ws.findingsLastMonth > 0 ? "text-amber-500" : "text-slate-400"
                      )} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-800 truncate">
                          {linked ? linked.name : ws.name}
                        </span>
                        {linked && (
                          <span className="text-[10px] text-slate-400 truncate hidden sm:inline">{ws.name}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        {ws.findingType && (
                          <span className="text-[11px] font-medium text-amber-700 bg-amber-50 rounded px-1.5 py-0.5">{ws.findingType}</span>
                        )}
                        <span className="text-[11px] text-slate-400">
                          {ws.findingsLastMonth} détection{ws.findingsLastMonth > 1 ? "s" : ""} ce mois
                        </span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs text-slate-600 font-medium">{timeAgo(ws.lastAlert!)}</p>
                      <p className="text-[10px] text-slate-400">{formatDate(ws.lastAlert!)}</p>
                    </div>
                    {ws.findingsLastMonth > 10 ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-700 shrink-0">
                        <AlertTriangle className="h-3 w-3" /> Élevé
                      </span>
                    ) : ws.findingsLastMonth > 0 ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700 shrink-0">
                        <Bug className="h-3 w-3" /> Modéré
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700 shrink-0">
                        <CheckCircle className="h-3 w-3" /> OK
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher un workspace ou client..."
          className="w-full pl-10 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
        />
      </div>

      {/* Workspace list */}
      <div className="space-y-3">
        {filteredWorkspaces.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-12 text-center text-slate-400">
            <ShieldCheck className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Aucun workspace trouvé</p>
          </div>
        ) : (
          filteredWorkspaces.map((ws) => {
            const linkedClient = clientByEmsisoftId.get(ws.id);
            const isExpanded = expandedWs.has(ws.id);
            const isLinking = linkingWs === ws.id;
            const details = wsDetails[ws.id];
            const detailsLoading = wsDetailsLoading.has(ws.id);

            return (
              <div key={ws.id} className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                {/* Workspace header */}
                <div
                  className="flex items-center gap-3 p-4 cursor-pointer hover:bg-slate-50 transition-colors"
                  onClick={() => toggleExpand(ws.id)}
                >
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-slate-400 shrink-0" />
                  )}

                  {linkedClient?.logoUrl ? (
                    <img src={linkedClient.logoUrl} alt="" className="h-9 w-9 rounded-lg object-cover shrink-0 border border-slate-200" />
                  ) : linkedClient ? (
                    <div className="h-9 w-9 rounded-lg bg-purple-100 text-purple-600 font-bold text-sm flex items-center justify-center shrink-0">
                      {linkedClient.name.charAt(0).toUpperCase()}
                    </div>
                  ) : (
                    <div className="h-9 w-9 rounded-lg bg-slate-100 text-slate-400 flex items-center justify-center shrink-0">
                      <Building2 className="h-4 w-4" />
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-slate-800 truncate">
                        {linkedClient ? linkedClient.name : ws.name}
                      </h3>
                      {linkedClient && (
                        <span className="text-[10px] text-slate-400 truncate hidden sm:inline">{ws.name}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-[11px] text-slate-500">
                        {ws.deviceCount} appareil{ws.deviceCount > 1 ? "s" : ""}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {ws.usedSeat}/{ws.totalSeat} sièges
                      </span>
                      {ws.findingsLastMonth > 0 && (
                        <span className="text-[11px] text-amber-600 font-medium">
                          {ws.findingsLastMonth} détection{ws.findingsLastMonth > 1 ? "s" : ""}/mois
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {ws.isExpired ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-1 text-[11px] font-medium text-red-700">
                        <ShieldX className="h-3 w-3" /> Expiré
                      </span>
                    ) : ws.isExpiresSoon ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-medium text-amber-700">
                        <AlertTriangle className="h-3 w-3" /> Expire bientôt
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-medium text-emerald-700">
                        <CheckCircle className="h-3 w-3" /> Actif
                      </span>
                    )}

                    {linkedClient ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2 py-1 text-[11px] font-medium text-purple-700">
                        <Link2 className="h-3 w-3" /> Lié
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-1 text-[11px] text-slate-400">
                        Non lié
                      </span>
                    )}
                  </div>
                </div>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="border-t border-slate-100 bg-slate-50/50">
                    {/* Workspace stats */}
                    <div className="p-4 space-y-4">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="rounded-lg bg-white border border-slate-200 p-3">
                          <p className="text-[10px] text-slate-400 mb-0.5">Appareils</p>
                          <p className="text-lg font-bold text-slate-900">{ws.deviceCount}</p>
                        </div>
                        <div className="rounded-lg bg-white border border-slate-200 p-3">
                          <p className="text-[10px] text-slate-400 mb-0.5">Sièges</p>
                          <p className="text-lg font-bold text-slate-900">{ws.usedSeat}<span className="text-sm text-slate-400">/{ws.totalSeat}</span></p>
                          <p className="text-[10px] text-slate-400">{ws.unusedSeat} disponible{ws.unusedSeat > 1 ? "s" : ""}</p>
                        </div>
                        <div className="rounded-lg bg-white border border-slate-200 p-3">
                          <p className="text-[10px] text-slate-400 mb-0.5">Détections/mois</p>
                          <p className={cn("text-lg font-bold", ws.findingsLastMonth > 0 ? "text-amber-600" : "text-slate-400")}>{ws.findingsLastMonth}</p>
                          {ws.findingType && <p className="text-[10px] text-slate-400">{ws.findingType}</p>}
                        </div>
                        <div className="rounded-lg bg-white border border-slate-200 p-3">
                          <p className="text-[10px] text-slate-400 mb-0.5">Dernière alerte</p>
                          <p className="text-sm font-medium text-slate-700">
                            {ws.lastAlert ? timeAgo(ws.lastAlert) : "Aucune"}
                          </p>
                          {ws.lastAlert && <p className="text-[10px] text-slate-400">{formatDate(ws.lastAlert)}</p>}
                        </div>
                      </div>

                      <div className="flex items-center gap-4 text-[11px] text-slate-400">
                        <span>GUID: <span className="font-mono text-slate-500">{ws.id}</span></span>
                        <span>Créé le {formatDate(ws.createdAt)}</span>
                      </div>
                    </div>

                    {/* Devices & Incidents from sub-endpoints */}
                    <div className="border-t border-slate-200 p-4 space-y-4">
                      {detailsLoading ? (
                        <div className="flex items-center gap-2 text-sm text-slate-400 py-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Chargement des détails...
                        </div>
                      ) : details ? (
                        <>
                          {/* Devices */}
                          {details.devices.length > 0 && (
                            <div>
                              <p className="text-xs font-medium text-slate-500 mb-2 flex items-center gap-1.5">
                                <Server className="h-3.5 w-3.5" />
                                Appareils ({details.devices.length})
                              </p>
                              <div className="space-y-1">
                                {details.devices.map((device) => {
                                  const statusMap: Record<string, { bg: string; icon: typeof ShieldCheck; label: string }> = {
                                    protected: { bg: "bg-emerald-100 text-emerald-700", icon: ShieldCheck, label: "Protégé" },
                                    at_risk: { bg: "bg-red-100 text-red-700", icon: ShieldAlert, label: "À risque" },
                                    offline: { bg: "bg-slate-100 text-slate-500", icon: ShieldOff, label: "Hors ligne" },
                                  };
                                  const st = statusMap[device.protectionStatus] || { bg: "bg-slate-100 text-slate-500", icon: Monitor, label: device.protectionStatus || "Inconnu" };
                                  const StatusIcon = st.icon;
                                  return (
                                    <div key={device.id} className="flex items-center justify-between rounded-lg bg-white border border-slate-200 px-3 py-2">
                                      <div className="flex items-center gap-2 min-w-0">
                                        <Monitor className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                        <span className="text-sm text-slate-700 truncate">{device.name}</span>
                                        {device.groupPath && <span className="text-[10px] text-slate-400 truncate hidden sm:inline">{device.groupPath}</span>}
                                      </div>
                                      <div className="flex items-center gap-2 shrink-0">
                                        {device.operatingSystem && <span className="text-[10px] text-slate-400 hidden md:inline">{device.operatingSystem}</span>}
                                        {device.lastSeen && <span className="text-[10px] text-slate-400">{timeAgo(device.lastSeen)}</span>}
                                        <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium", st.bg)}>
                                          <StatusIcon className="h-3 w-3" />
                                          {st.label}
                                        </span>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* Incidents */}
                          {details.incidents.length > 0 && (
                            <div>
                              <p className="text-xs font-medium text-slate-500 mb-2 flex items-center gap-1.5">
                                <ShieldAlert className="h-3.5 w-3.5" />
                                Alertes récentes ({details.incidents.length > 50 ? "50+" : details.incidents.length})
                              </p>
                              <div className="space-y-1">
                                {details.incidents.slice(0, 50).map((incident, idx) => {
                                  const sevMap: Record<string, string> = {
                                    critical: "bg-red-100 text-red-700",
                                    high: "bg-orange-100 text-orange-700",
                                    medium: "bg-amber-100 text-amber-700",
                                    low: "bg-slate-100 text-slate-600",
                                    info: "bg-blue-100 text-blue-600",
                                  };
                                  return (
                                    <div key={incident.id || idx} className="flex items-center justify-between rounded-lg bg-white border border-slate-200 px-3 py-2">
                                      <div className="flex items-center gap-2 min-w-0">
                                        <Bug className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                                        <span className="text-sm text-slate-700 truncate">{incident.title || incident.type || "Alerte"}</span>
                                      </div>
                                      <div className="flex items-center gap-2 shrink-0">
                                        {incident.deviceName && <span className="text-[10px] text-slate-400">{incident.deviceName}</span>}
                                        {incident.detectedAt && formatDate(incident.detectedAt) && (
                                          <span className="text-[10px] text-slate-400">{formatDate(incident.detectedAt)}</span>
                                        )}
                                        <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium", sevMap[incident.severity] || sevMap.low)}>
                                          {incident.severity || "info"}
                                        </span>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {details.devices.length === 0 && details.incidents.length === 0 && (
                            <p className="text-xs text-slate-400 py-1">Aucun détail supplémentaire disponible pour ce workspace.</p>
                          )}
                        </>
                      ) : null}
                    </div>

                    {/* Client linking */}
                    <div className="border-t border-slate-200 p-4">
                      <p className="text-xs font-medium text-slate-500 mb-2">Client Comet associé</p>
                      {linkedClient ? (
                        <div className="flex items-center justify-between bg-white rounded-lg border border-purple-200 p-3">
                          <Link href={`/clients/${linkedClient.id}`} className="flex items-center gap-2 text-sm font-medium text-purple-700 hover:text-purple-900">
                            {linkedClient.logoUrl ? (
                              <img src={linkedClient.logoUrl} alt="" className="h-6 w-6 rounded object-cover border border-slate-200" />
                            ) : (
                              <div className="h-6 w-6 rounded bg-purple-100 text-purple-600 text-xs font-bold flex items-center justify-center">
                                {linkedClient.name.charAt(0).toUpperCase()}
                              </div>
                            )}
                            {linkedClient.name}
                          </Link>
                          <button
                            onClick={(e) => { e.stopPropagation(); unlinkClient(linkedClient.id); }}
                            disabled={savingLink === linkedClient.id}
                            className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-700 transition-colors disabled:opacity-50"
                          >
                            {savingLink === linkedClient.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Unlink className="h-3 w-3" />}
                            Dissocier
                          </button>
                        </div>
                      ) : isLinking ? (
                        <div className="bg-white rounded-lg border border-slate-200 p-3 space-y-2">
                          <div className="flex items-center gap-2">
                            <Search className="h-3.5 w-3.5 text-slate-400" />
                            <input
                              type="text"
                              value={clientSearch}
                              onChange={(e) => setClientSearch(e.target.value)}
                              placeholder="Chercher un client..."
                              className="flex-1 text-sm border-0 focus:outline-none bg-transparent"
                              autoFocus
                            />
                            <button onClick={() => { setLinkingWs(null); setClientSearch(""); }} className="p-1 text-slate-400 hover:text-slate-600">
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          <div className="max-h-[200px] overflow-y-auto divide-y divide-slate-100">
                            {unlinkedClients
                              .filter((c) => !clientSearch || c.name.toLowerCase().includes(clientSearch.toLowerCase()))
                              .slice(0, 30)
                              .map((client) => (
                                <button
                                  key={client.id}
                                  onClick={() => linkClient(ws.id, client.id)}
                                  disabled={savingLink === client.id}
                                  className="w-full flex items-center gap-2 px-2 py-1.5 text-left hover:bg-purple-50 transition-colors rounded disabled:opacity-50"
                                >
                                  {savingLink === client.id ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin text-purple-500" />
                                  ) : client.logoUrl ? (
                                    <img src={client.logoUrl} alt="" className="h-5 w-5 rounded object-cover border border-slate-200" />
                                  ) : (
                                    <div className="h-5 w-5 rounded bg-slate-100 text-slate-400 text-[10px] font-bold flex items-center justify-center">
                                      {client.name.charAt(0).toUpperCase()}
                                    </div>
                                  )}
                                  <span className="text-sm text-slate-700 truncate">{client.name}</span>
                                </button>
                              ))}
                            {unlinkedClients.filter((c) => !clientSearch || c.name.toLowerCase().includes(clientSearch.toLowerCase())).length === 0 && (
                              <p className="text-xs text-slate-400 py-2 text-center">Aucun client trouvé</p>
                            )}
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={(e) => { e.stopPropagation(); setLinkingWs(ws.id); }}
                          className="flex items-center gap-2 text-xs text-purple-600 hover:text-purple-800 font-medium transition-colors"
                        >
                          <Link2 className="h-3.5 w-3.5" />
                          Associer un client Comet
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
