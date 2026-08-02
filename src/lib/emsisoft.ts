import { prisma } from "@/lib/db";

// --- In-memory cache ---
interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const CACHE_TTL = {
  workspaces: 5 * 60 * 1000,       // 5 min
  protectionSummary: 5 * 60 * 1000, // 5 min
  workspaceDetails: 2 * 60 * 1000,  // 2 min
  clientDevices: 2 * 60 * 1000,     // 2 min
} as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const cache = new Map<string, CacheEntry<any>>();

function cacheGet<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.data as T;
}

function cacheSet<T>(key: string, data: T, ttl: number): void {
  cache.set(key, { data, expiresAt: Date.now() + ttl });
}

export function invalidateEmsisoftCache(prefix?: string): void {
  if (!prefix) {
    cache.clear();
    return;
  }
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) cache.delete(key);
  }
}

export interface EmsisoftConfig {
  apiKey: string;
  enabled: boolean;
  apiUrl: string;
}

export async function getEmsisoftConfig(): Promise<EmsisoftConfig> {
  const { getSettings } = await import("@/lib/settings");
  const map = await getSettings(["emsisoft_api_key", "emsisoft_enabled", "emsisoft_api_url"]);
  return {
    apiKey: map.emsisoft_api_key || "",
    enabled: map.emsisoft_enabled === "true",
    apiUrl: map.emsisoft_api_url || "https://api.emsisoft.com/v1",
  };
}

async function emisoftFetch(path: string, config?: EmsisoftConfig) {
  const cfg = config ?? (await getEmsisoftConfig());
  if (!cfg.enabled || !cfg.apiKey) {
    throw new Error("Emsisoft non configuré");
  }

  const baseUrl = cfg.apiUrl.replace(/\/+$/, "");
  const url = `${baseUrl}${path}`;
  const res = await fetch(url, {
    headers: {
      "Api-Key": cfg.apiKey,
      Accept: "application/json",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Emsisoft API ${res.status}: ${text}`);
  }

  return res.json();
}

export interface EmsisoftWorkspace {
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

export interface EmsisoftDevice {
  id: string;
  name: string;
  groupPath: string;
  lastSeen: string;
  protectionStatus: "protected" | "at_risk" | "offline" | "unknown";
  operatingSystem: string;
  lastThreatDetected: string | null;
  policyName: string | null;
}

export interface EmsisoftIncident {
  id: string;
  deviceId: string;
  deviceName: string;
  type: string;
  severity: "critical" | "high" | "medium" | "low" | "info";
  title: string;
  description: string;
  status: "open" | "resolved" | "dismissed";
  detectedAt: string;
  resolvedAt: string | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapWorkspace(raw: any): EmsisoftWorkspace {
  return {
    id: raw.guid || raw.id || "",
    name: raw.name || "",
    deviceCount: raw.devices ?? raw.deviceCount ?? 0,
    isExpired: raw.isExpired ?? false,
    isExpiresSoon: raw.isExpiresSoon ?? false,
    lastAlert: raw.lastAlert || null,
    findingType: raw.findingType || null,
    findingsLastMonth: raw.findingsLastMonth ?? 0,
    totalSeat: raw.totalSeat ?? 0,
    usedSeat: raw.usedSeat ?? 0,
    unusedSeat: raw.unusedSeat ?? 0,
    createdAt: raw.createdAt || "",
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapDevice(raw: any): EmsisoftDevice {
  return {
    id: raw.guid || raw.id || "",
    name: raw.name || raw.computerName || "",
    groupPath: raw.groupPath || raw.group || "",
    lastSeen: raw.lastSeen || raw.changedAt || "",
    protectionStatus: raw.protectionStatus || "unknown",
    operatingSystem: raw.operatingSystem || raw.os || "",
    lastThreatDetected: raw.lastThreatDetected || null,
    policyName: raw.policyName || raw.policy || null,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapIncident(raw: any): EmsisoftIncident {
  return {
    id: raw.guid || raw.id || "",
    deviceId: raw.deviceId || raw.deviceGuid || "",
    deviceName: raw.deviceName || raw.computerName || "",
    type: raw.type || raw.findingType || "",
    severity: raw.severity || "medium",
    title: raw.title || raw.name || raw.findingType || "",
    description: raw.description || raw.message || "",
    status: raw.status || (raw.resolvedAt ? "resolved" : "open"),
    detectedAt: raw.detectedAt || raw.createdAt || "",
    resolvedAt: raw.resolvedAt || null,
  };
}

export async function getWorkspaces(config?: EmsisoftConfig): Promise<EmsisoftWorkspace[]> {
  const cacheKey = "emsisoft:workspaces";
  const cached = cacheGet<EmsisoftWorkspace[]>(cacheKey);
  if (cached) return cached;

  const json = await emisoftFetch("/workspaces", config);
  const items = json.data || json.workspaces || (Array.isArray(json) ? json : []);
  const result = items.map(mapWorkspace);
  cacheSet(cacheKey, result, CACHE_TTL.workspaces);
  return result;
}

export async function getDevices(workspaceId: string, config?: EmsisoftConfig): Promise<EmsisoftDevice[]> {
  const json = await emisoftFetch(`/workspaces/${workspaceId}/devices`, config);
  const items = json.data || json.devices || (Array.isArray(json) ? json : []);
  return items.map(mapDevice);
}

export async function getIncidents(workspaceId: string, config?: EmsisoftConfig): Promise<EmsisoftIncident[]> {
  const cacheKey = `emsisoft:incidents:${workspaceId}`;
  const cached = cacheGet<EmsisoftIncident[]>(cacheKey);
  if (cached) return cached;
  const json = await emisoftFetch(`/workspaces/${workspaceId}/incidents`, config);
  const items = json.data || json.incidents || (Array.isArray(json) ? json : []);
  const result = items.map(mapIncident);
  cacheSet(cacheKey, result, 60_000);
  return result;
}

export async function getThreats(workspaceId: string, config?: EmsisoftConfig) {
  const json = await emisoftFetch(`/workspaces/${workspaceId}/threats?limit=50`, config);
  return json.data || json.threats || (Array.isArray(json) ? json : []);
}

export async function testConnection(config?: EmsisoftConfig): Promise<{ success: boolean; error?: string; workspaces?: number }> {
  invalidateEmsisoftCache();
  const cfg = config ?? (await getEmsisoftConfig());
  if (!cfg.apiKey) return { success: false, error: "Clé API manquante" };

  const baseUrl = cfg.apiUrl.replace(/\/+$/, "");
  const url = `${baseUrl}/workspaces`;

  try {
    const res = await fetch(url, {
      headers: {
        "Api-Key": cfg.apiKey,
        Accept: "application/json",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { success: false, error: `API ${res.status}: ${text || res.statusText}` };
    }

    const json = await res.json();
    const items = json.data || json.workspaces || (Array.isArray(json) ? json : []);
    return { success: true, workspaces: items.length };
  } catch (err) {
    if (err instanceof Error) {
      if (err.name === "AbortError" || err.name === "TimeoutError") {
        return { success: false, error: `Timeout: le serveur n'a pas répondu en 15s. Vérifiez l'URL API: ${url}` };
      }
      const cause = (err as { cause?: { code?: string } }).cause;
      if (cause?.code === "ENOTFOUND") {
        return { success: false, error: `DNS introuvable pour ${new URL(url).hostname}. Vérifiez l'URL API.` };
      }
      if (cause?.code === "ECONNREFUSED") {
        return { success: false, error: `Connexion refusée par ${new URL(url).hostname}. Vérifiez l'URL API.` };
      }
      if (cause?.code) {
        return { success: false, error: `Erreur réseau (${cause.code}): ${err.message}` };
      }
      return { success: false, error: `${err.name}: ${err.message}` };
    }
    return { success: false, error: "Erreur inconnue" };
  }
}

export async function getProtectionSummary(config?: EmsisoftConfig) {
  const cacheKey = "emsisoft:summary";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cached = cacheGet<any>(cacheKey);
  if (cached) return cached;

  const cfg = config ?? (await getEmsisoftConfig());
  const workspaces = await getWorkspaces(cfg);

  let totalDevices = 0;
  let totalFindings = 0;
  const workspaceSummaries: {
    id: string;
    name: string;
    devices: number;
    findingsLastMonth: number;
    lastAlert: string | null;
    findingType: string | null;
    isExpired: boolean;
    isExpiresSoon: boolean;
    totalSeat: number;
    usedSeat: number;
  }[] = [];

  for (const ws of workspaces) {
    totalDevices += ws.deviceCount;
    totalFindings += ws.findingsLastMonth;
    workspaceSummaries.push({
      id: ws.id,
      name: ws.name,
      devices: ws.deviceCount,
      findingsLastMonth: ws.findingsLastMonth,
      lastAlert: ws.lastAlert,
      findingType: ws.findingType,
      isExpired: ws.isExpired,
      isExpiresSoon: ws.isExpiresSoon,
      totalSeat: ws.totalSeat,
      usedSeat: ws.usedSeat,
    });
  }

  const recentAlerts = workspaceSummaries
    .filter((w) => w.lastAlert)
    .sort((a, b) => new Date(b.lastAlert!).getTime() - new Date(a.lastAlert!).getTime())
    .slice(0, 10)
    .map((w) => ({
      workspaceName: w.name,
      findingType: w.findingType || "Unknown",
      detectedAt: w.lastAlert!,
    }));

  const result = {
    totalDevices,
    totalFindings,
    recentAlerts,
    workspaceCount: workspaces.length,
    workspaces: workspaceSummaries,
  };
  cacheSet(cacheKey, result, CACHE_TTL.protectionSummary);
  return result;
}

export async function getWorkspaceDetails(workspaceId: string, config?: EmsisoftConfig) {
  const cacheKey = `emsisoft:details:${workspaceId}`;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cached = cacheGet<{ devices: any[]; findings: any[] }>(cacheKey);
  if (cached) return cached;

  const cfg = config ?? (await getEmsisoftConfig());
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let rawDevices: any[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let findings: any[] = [];

  try {
    const json = await emisoftFetch(`/workspaces/${workspaceId}/devices`, cfg);
    rawDevices = json.data || json.devices || (Array.isArray(json) ? json : []);
  } catch {}

  // Try /findings first (more common in Emsisoft API), fallback to /incidents
  try {
    const json = await emisoftFetch(`/workspaces/${workspaceId}/findings?Take=50&OrderBy=Timestamp desc`, cfg);
    findings = json.data || json.findings || (Array.isArray(json) ? json : []);
  } catch {
    try {
      const json = await emisoftFetch(`/workspaces/${workspaceId}/incidents?Take=50`, cfg);
      findings = json.data || json.incidents || (Array.isArray(json) ? json : []);
    } catch {}
  }

  const result = { devices: rawDevices, findings };
  cacheSet(cacheKey, result, CACHE_TTL.workspaceDetails);
  return result;
}

export async function getClientDevices(emsisoftId: string, config?: EmsisoftConfig) {
  const cacheKey = `emsisoft:client:${emsisoftId}`;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cached = cacheGet<any>(cacheKey);
  if (cached) return cached;

  const cfg = config ?? (await getEmsisoftConfig());
  try {
    const devices = await getDevices(emsisoftId, cfg);
    const incidents = await getIncidents(emsisoftId, cfg);
    const result = {
      devices,
      incidents: incidents.filter((i) => i.status === "open"),
      summary: {
        total: devices.length,
        protected: devices.filter((d) => d.protectionStatus === "protected").length,
        atRisk: devices.filter((d) => d.protectionStatus === "at_risk").length,
        offline: devices.filter((d) => d.protectionStatus === "offline").length,
        openIncidents: incidents.filter((i) => i.status === "open").length,
      },
    };
    cacheSet(cacheKey, result, CACHE_TTL.clientDevices);
    return result;
  } catch {
    return { devices: [], incidents: [], summary: { total: 0, protected: 0, atRisk: 0, offline: 0, openIncidents: 0 } };
  }
}
