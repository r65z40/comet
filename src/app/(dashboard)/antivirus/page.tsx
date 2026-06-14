"use client";

import { useEffect, useState, useCallback, useRef } from "react";
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

// Raw data from Emsisoft API — keep all fields
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RawRecord = Record<string, any>;

interface CometClient {
  id: string;
  name: string;
  emsisoftId: string | null;
  logoUrl: string | null;
}

interface WorkspaceDetails {
  devices: RawRecord[];
  findings: RawRecord[];
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

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })
    + " à " + d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

const FINDING_LABELS: Record<string, string> = {
  guid: "ID",
  computerName: "Ordinateur",
  computerGuid: "ID Ordinateur",
  name: "Nom",
  findingType: "Type",
  type: "Type",
  severity: "Sévérité",
  status: "Statut",
  title: "Titre",
  description: "Description",
  message: "Message",
  path: "Chemin",
  filePath: "Chemin fichier",
  fileName: "Fichier",
  hash: "Hash",
  sha256: "SHA256",
  md5: "MD5",
  threatName: "Menace",
  malwareName: "Malware",
  detectionName: "Détection",
  action: "Action",
  actionTaken: "Action prise",
  timestamp: "Date",
  detectedAt: "Détecté le",
  createdAt: "Créé le",
  resolvedAt: "Résolu le",
  changedAt: "Modifié le",
  scanType: "Type de scan",
  source: "Source",
  category: "Catégorie",
  quarantined: "En quarantaine",
  cleaned: "Nettoyé",
  deleted: "Supprimé",
  blocked: "Bloqué",
  deviceName: "Appareil",
  userName: "Utilisateur",
  user: "Utilisateur",
  ipAddress: "Adresse IP",
  ip: "IP",
  operatingSystem: "OS",
  os: "OS",
  policyName: "Politique",
  groupPath: "Groupe",
  group: "Groupe",
};

const HIDDEN_FIELDS = new Set(["id", "workspaceGuid", "workspaceId", "totalCount", "involvedDevices"]);

function FindingCard({ finding }: { finding: RawRecord }) {
  const [expanded, setExpanded] = useState(false);

  const title = finding.threatName || finding.malwareName || finding.detectionName || finding.name || finding.title || finding.findingType || finding.type || "Alerte";
  const computer = finding.computerName || finding.deviceName || finding.device || "";
  const filePath = finding.path || finding.filePath || finding.fileName || "";
  const action = finding.actionTaken || finding.action || "";
  const findingType = finding.findingType || finding.type || finding.scanType || "";
  const user = finding.userName || finding.user || "";

  // Find date — try known fields, then scan all values for ISO date strings
  let dateStr = finding.timestamp || finding.detectedAt || finding.createdAt || finding.changedAt
    || finding.Timestamp || finding.DetectedAt || finding.CreatedAt || finding.ChangedAt
    || finding.date || finding.Date || finding.time || finding.Time
    || finding.lastSeen || finding.LastSeen || "";
  if (!dateStr) {
    for (const v of Object.values(finding)) {
      if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}T/.test(v)) {
        dateStr = v;
        break;
      }
    }
  }
  const dateFormatted = dateStr ? formatDateTime(dateStr) : "";
  const dateRelative = dateStr ? timeAgo(dateStr) : "";

  const isMalware = /malware|trojan|virus|worm|ransom|exploit|pup|adware/i.test(title);
  const isBlock = /block|guard|firewall/i.test(findingType);

  // Parse involvedDevices — can be array of objects or strings
  const involvedDevices: { name: string; guid?: string }[] = [];
  if (Array.isArray(finding.involvedDevices)) {
    for (const d of finding.involvedDevices) {
      if (typeof d === "string") involvedDevices.push({ name: d });
      else if (d && typeof d === "object") involvedDevices.push({ name: d.name || d.computerName || d.guid || "?", guid: d.guid });
    }
  }

  const allFields = Object.entries(finding).filter(
    ([k, v]) => v !== null && v !== undefined && v !== "" && !HIDDEN_FIELDS.has(k),
  );

  return (
    <div className="rounded-lg bg-white border border-slate-200 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left px-3 py-2.5 hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-start gap-2">
          <div className={cn(
            "h-7 w-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5",
            isMalware ? "bg-red-100" : isBlock ? "bg-amber-100" : "bg-blue-100",
          )}>
            {isMalware ? (
              <Bug className="h-3.5 w-3.5 text-red-500" />
            ) : isBlock ? (
              <ShieldAlert className="h-3.5 w-3.5 text-amber-500" />
            ) : (
              <ShieldCheck className="h-3.5 w-3.5 text-blue-500" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className={cn("text-sm font-medium truncate", isMalware ? "text-red-800" : "text-slate-800")}>{title}</p>
              {dateRelative && (
                <span className="text-[10px] text-slate-400 shrink-0 border border-slate-200 rounded px-1.5 py-0.5">{dateRelative}</span>
              )}
            </div>
            {dateFormatted && (
              <p className="text-[10px] text-slate-400 mt-0.5">{dateFormatted}</p>
            )}
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {computer && (
                <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
                  <Monitor className="h-3 w-3" /> {computer}
                </span>
              )}
              {user && (
                <span className="text-[11px] text-slate-400">👤 {user}</span>
              )}
              {findingType && (
                <span className={cn(
                  "text-[10px] font-medium rounded px-1.5 py-0.5",
                  isMalware ? "bg-red-50 text-red-600" : isBlock ? "bg-amber-50 text-amber-600" : "bg-blue-50 text-blue-600",
                )}>{findingType}</span>
              )}
              {action && (
                <span className="text-[10px] font-medium rounded px-1.5 py-0.5 bg-emerald-50 text-emerald-600">{action}</span>
              )}
            </div>
            {filePath && (
              <p className="text-[11px] text-slate-400 mt-0.5 font-mono truncate">{filePath}</p>
            )}
            {/* Involved devices — shown directly */}
            {involvedDevices.length > 0 && (
              <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                <Server className="h-3 w-3 text-slate-400 shrink-0" />
                {involvedDevices.map((d, i) => (
                  <span key={i} className="inline-flex items-center gap-1 text-[10px] font-medium bg-slate-100 text-slate-600 rounded px-1.5 py-0.5">
                    <Monitor className="h-2.5 w-2.5" /> {d.name}
                  </span>
                ))}
              </div>
            )}
          </div>
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-slate-300 shrink-0 mt-1" />
          ) : (
            <ChevronRight className="h-4 w-4 text-slate-300 shrink-0 mt-1" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-slate-100 bg-slate-50/50 px-3 py-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
            {allFields.map(([key, value]) => {
              const label = FINDING_LABELS[key] || key;
              const strValue = typeof value === "object" ? JSON.stringify(value) : String(value);
              const isDate = /^\d{4}-\d{2}-\d{2}T/.test(strValue);
              const displayValue = isDate ? `${formatDateTime(strValue)} (${timeAgo(strValue)})` : strValue;
              const isBool = value === true || value === false;

              return (
                <div key={key} className="flex items-start gap-2 py-0.5">
                  <span className="text-[10px] text-slate-400 w-24 shrink-0 font-medium">{label}</span>
                  {isBool ? (
                    <span className={cn("text-[11px] font-medium", value ? "text-emerald-600" : "text-slate-400")}>
                      {value ? "Oui" : "Non"}
                    </span>
                  ) : (
                    <span className="text-[11px] text-slate-700 break-all min-w-0">{displayValue}</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

const DEVICE_LABELS: Record<string, string> = {
  guid: "ID",
  name: "Nom",
  computerName: "Nom",
  groupPath: "Groupe",
  group: "Groupe",
  lastSeen: "Dernière connexion",
  changedAt: "Dernière activité",
  createdAt: "Ajouté le",
  protectionStatus: "Protection",
  operatingSystem: "Système",
  os: "Système",
  osVersion: "Version OS",
  policyName: "Politique",
  policy: "Politique",
  version: "Version agent",
  agentVersion: "Version agent",
  ipAddress: "IP",
  ip: "IP",
  lastIpAddress: "Dernière IP",
  macAddress: "MAC",
  userName: "Utilisateur",
  user: "Utilisateur",
  lastUser: "Dernier utilisateur",
  domain: "Domaine",
  serialNumber: "N° série",
  manufacturer: "Fabricant",
  model: "Modèle",
  cpu: "Processeur",
  ram: "RAM",
  totalDiskSpace: "Espace disque",
  freeDiskSpace: "Espace libre",
  lastScanTime: "Dernier scan",
  lastUpdateTime: "Dernière MAJ",
  signatureVersion: "Signatures",
  engineVersion: "Moteur",
  isOnline: "En ligne",
  isManaged: "Géré",
  licenseExpiry: "Expiration licence",
};

function DeviceCard({ device }: { device: RawRecord }) {
  const [expanded, setExpanded] = useState(false);

  const name = device.name || device.computerName || "Appareil";
  const os = device.operatingSystem || device.os || device.osVersion || "";
  const ip = device.ipAddress || device.ip || device.lastIpAddress || "";
  const lastSeen = device.lastSeen || device.changedAt || "";
  const user = device.userName || device.user || device.lastUser || "";
  const group = device.groupPath || device.group || "";
  const policy = device.policyName || device.policy || "";
  const isOnline = device.isOnline;
  const version = device.version || device.agentVersion || "";

  const allFields = Object.entries(device).filter(
    ([k, v]) => v !== null && v !== undefined && v !== "" && !HIDDEN_FIELDS.has(k),
  );

  return (
    <div
      className={cn(
        "rounded-lg border bg-white overflow-hidden cursor-pointer transition-all hover:shadow-sm",
        isOnline === true ? "border-emerald-200" : isOnline === false ? "border-slate-200" : "border-slate-200",
      )}
      onClick={() => setExpanded(!expanded)}
    >
      <div className="p-3">
        <div className="flex items-center gap-2 mb-1.5">
          <Monitor className={cn("h-4 w-4 shrink-0", isOnline === true ? "text-emerald-500" : "text-slate-400")} />
          <span className="text-sm font-semibold text-slate-800 truncate">{name}</span>
          {isOnline === true && <span className="h-2 w-2 rounded-full bg-emerald-400 shrink-0" />}
          {isOnline === false && <span className="h-2 w-2 rounded-full bg-slate-300 shrink-0" />}
        </div>
        <div className="space-y-0.5 ml-6">
          {os && <p className="text-[11px] text-slate-500 truncate">{os}</p>}
          {ip && <p className="text-[11px] text-slate-400 font-mono">{ip}</p>}
          {user && <p className="text-[11px] text-slate-400">👤 {user}</p>}
          {group && <p className="text-[10px] text-slate-400 truncate">📁 {group}</p>}
          {policy && <p className="text-[10px] text-purple-500">{policy}</p>}
          {version && <p className="text-[10px] text-slate-400">v{version}</p>}
        </div>
        <div className="flex items-center justify-between mt-2 ml-6">
          {lastSeen && (
            <span className="text-[10px] text-slate-400">{timeAgo(lastSeen)}</span>
          )}
          <ChevronDown className={cn("h-3 w-3 text-slate-300 transition-transform", expanded && "rotate-180")} />
        </div>
      </div>

      {expanded && (
        <div className="border-t border-slate-100 bg-slate-50/50 px-3 py-2">
          <div className="space-y-0.5">
            {allFields.map(([key, value]) => {
              const label = DEVICE_LABELS[key] || key;
              const strValue = typeof value === "object" ? JSON.stringify(value) : String(value);
              const isDate = /^\d{4}-\d{2}-\d{2}T/.test(strValue);
              const displayValue = isDate ? `${formatDateTime(strValue)} (${timeAgo(strValue)})` : strValue;
              const isBool = value === true || value === false;
              return (
                <div key={key} className="flex items-start gap-2 py-0.5">
                  <span className="text-[10px] text-slate-400 w-28 shrink-0 font-medium">{label}</span>
                  {isBool ? (
                    <span className={cn("text-[11px] font-medium", value ? "text-emerald-600" : "text-slate-400")}>
                      {value ? "Oui" : "Non"}
                    </span>
                  ) : (
                    <span className="text-[11px] text-slate-700 break-all min-w-0">{displayValue}</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AntivirusPage() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [allClients, setAllClients] = useState<CometClient[]>([]);
  const [wsLoading, setWsLoading] = useState(true);
  const [clientsLoading, setClientsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [expandedWs, setExpandedWs] = useState<Set<string>>(new Set());
  const [wsDetails, setWsDetails] = useState<Record<string, WorkspaceDetails>>({});
  const [wsDetailsLoading, setWsDetailsLoading] = useState<Set<string>>(new Set());
  const [linkingWs, setLinkingWs] = useState<string | null>(null);
  const [clientSearch, setClientSearch] = useState("");
  const [savingLink, setSavingLink] = useState<string | null>(null);
  const wsRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const fetchWorkspaces = useCallback(async () => {
    setWsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/emsisoft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "workspaces" }),
      });
      if (!res.ok) throw new Error("Erreur API Emsisoft");
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setWorkspaces(data.workspaces || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setWsLoading(false);
    }
  }, []);

  const fetchClients = useCallback(async () => {
    setClientsLoading(true);
    try {
      const res = await fetch("/api/clients?limit=200&showAll=true");
      if (res.ok) {
        const data = await res.json();
        setAllClients(
          (data.clients || []).map((c: CometClient) => ({
            id: c.id, name: c.name, emsisoftId: c.emsisoftId, logoUrl: c.logoUrl,
          })),
        );
      }
    } catch {} finally {
      setClientsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWorkspaces();
    fetchClients();
  }, [fetchWorkspaces, fetchClients]);

  async function fetchWorkspaceDetails(wsId: string) {
    if (wsDetails[wsId] || wsDetailsLoading.has(wsId)) return;
    setWsDetailsLoading((prev) => new Set(prev).add(wsId));
    try {
      const res = await fetch(`/api/emsisoft/status?workspaceId=${wsId}`);
      if (res.ok) {
        const data = await res.json();
        setWsDetails((prev) => ({ ...prev, [wsId]: { devices: data.devices || [], findings: data.findings || [] } }));
      }
    } catch {} finally {
      setWsDetailsLoading((prev) => { const next = new Set(prev); next.delete(wsId); return next; });
    }
  }

  function expandAndScroll(wsId: string) {
    setExpandedWs((prev) => {
      const next = new Set(prev);
      next.add(wsId);
      fetchWorkspaceDetails(wsId);
      return next;
    });
    setTimeout(() => {
      wsRefs.current[wsId]?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
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

  if (error && workspaces.length === 0) {
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

  const recentAlerts = workspaces
    .filter((ws) => ws.lastAlert)
    .sort((a, b) => new Date(b.lastAlert!).getTime() - new Date(a.lastAlert!).getTime())
    .slice(0, 10);

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
          onClick={() => { fetchWorkspaces(); fetchClients(); }}
          disabled={wsLoading}
          className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={cn("h-4 w-4", wsLoading && "animate-spin")} />
          Actualiser
        </button>
      </div>

      {/* Stats */}
      {wsLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="rounded-xl border border-slate-200 bg-white p-4 animate-pulse">
              <div className="h-3 w-16 bg-slate-200 rounded mb-3" />
              <div className="h-7 w-12 bg-slate-200 rounded" />
            </div>
          ))}
        </div>
      ) : (
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
      )}

      {/* Recent alerts — clickable */}
      {recentAlerts.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3 border-b border-slate-100">
            <ShieldAlert className="h-4 w-4 text-red-500" />
            <h2 className="text-sm font-semibold text-slate-900">Dernières alertes</h2>
            <span className="text-[10px] text-slate-400 ml-auto">Cliquez pour voir les détails</span>
          </div>
          <div className="divide-y divide-slate-100">
            {recentAlerts.map((ws) => {
              const linked = clientByEmsisoftId.get(ws.id);
              return (
                <button
                  key={`alert-${ws.id}`}
                  onClick={() => expandAndScroll(ws.id)}
                  className="w-full flex items-center gap-3 px-5 py-3 hover:bg-purple-50/50 transition-colors text-left"
                >
                  <div className={cn(
                    "h-8 w-8 rounded-lg flex items-center justify-center shrink-0",
                    ws.findingsLastMonth > 10 ? "bg-red-100" : ws.findingsLastMonth > 0 ? "bg-amber-100" : "bg-slate-100",
                  )}>
                    <Bug className={cn(
                      "h-4 w-4",
                      ws.findingsLastMonth > 10 ? "text-red-500" : ws.findingsLastMonth > 0 ? "text-amber-500" : "text-slate-400",
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
                  <ChevronRight className="h-4 w-4 text-slate-300 shrink-0" />
                </button>
              );
            })}
          </div>
        </div>
      )}

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
        {wsLoading ? (
          [...Array(3)].map((_, i) => (
            <div key={i} className="rounded-xl border border-slate-200 bg-white p-4 animate-pulse">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-slate-200" />
                <div className="flex-1">
                  <div className="h-4 w-40 bg-slate-200 rounded mb-2" />
                  <div className="h-3 w-56 bg-slate-100 rounded" />
                </div>
                <div className="h-6 w-16 bg-slate-200 rounded-full" />
              </div>
            </div>
          ))
        ) : filteredWorkspaces.length === 0 ? (
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
              <div
                key={ws.id}
                ref={(el) => { wsRefs.current[ws.id] = el; }}
                className={cn(
                  "rounded-xl border bg-white overflow-hidden scroll-mt-4 transition-colors",
                  isExpanded ? "border-purple-300 ring-1 ring-purple-100" : "border-slate-200",
                )}
              >
                {/* Workspace header */}
                <div
                  className="flex items-center gap-3 p-4 cursor-pointer hover:bg-slate-50 transition-colors"
                  onClick={() => toggleExpand(ws.id)}
                >
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-purple-500 shrink-0" />
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

                    {/* Findings first, then Devices */}
                    <div className="border-t border-slate-200 p-4 space-y-4">
                      {detailsLoading ? (
                        <div className="flex items-center gap-2 text-sm text-slate-400 py-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Chargement des détails...
                        </div>
                      ) : details ? (
                        <>
                          {/* Findings / Alerts — 10 max */}
                          {details.findings.length > 0 && (
                            <div>
                              <p className="text-xs font-medium text-slate-500 mb-2 flex items-center gap-1.5">
                                <ShieldAlert className="h-3.5 w-3.5" />
                                Dernières alertes
                              </p>
                              <div className="space-y-2">
                                {details.findings.slice(0, 10).map((f, idx) => (
                                  <FindingCard key={f.guid || f.id || idx} finding={f} />
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Devices — card grid */}
                          {details.devices.length > 0 && (
                            <div>
                              <p className="text-xs font-medium text-slate-500 mb-2 flex items-center gap-1.5">
                                <Server className="h-3.5 w-3.5" />
                                Appareils ({details.devices.length})
                              </p>
                              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                                {details.devices.map((device, idx) => (
                                  <DeviceCard key={device.guid || device.id || idx} device={device} />
                                ))}
                              </div>
                            </div>
                          )}

                          {details.devices.length === 0 && details.findings.length === 0 && (
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
                      ) : clientsLoading ? (
                        <div className="flex items-center gap-2 text-xs text-slate-400">
                          <Loader2 className="h-3 w-3 animate-spin" /> Chargement des clients...
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
