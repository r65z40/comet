import { prisma } from "@/lib/db";

export interface EmsisoftConfig {
  apiKey: string;
  enabled: boolean;
  apiUrl: string;
}

export async function getEmsisoftConfig(): Promise<EmsisoftConfig> {
  const settings = await prisma.setting.findMany({
    where: { key: { in: ["emsisoft_api_key", "emsisoft_enabled", "emsisoft_api_url"] } },
  });
  const map = Object.fromEntries(settings.map((s) => [s.key, s.value]));
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
  const json = await emisoftFetch("/workspaces", config);
  const items = json.data || json.workspaces || (Array.isArray(json) ? json : []);
  return items.map(mapWorkspace);
}

export async function getDevices(workspaceId: string, config?: EmsisoftConfig): Promise<EmsisoftDevice[]> {
  const json = await emisoftFetch(`/workspaces/${workspaceId}/devices`, config);
  const items = json.data || json.devices || (Array.isArray(json) ? json : []);
  return items.map(mapDevice);
}

export async function getIncidents(workspaceId: string, config?: EmsisoftConfig): Promise<EmsisoftIncident[]> {
  const json = await emisoftFetch(`/workspaces/${workspaceId}/incidents`, config);
  const items = json.data || json.incidents || (Array.isArray(json) ? json : []);
  return items.map(mapIncident);
}

export async function getThreats(workspaceId: string, config?: EmsisoftConfig) {
  const json = await emisoftFetch(`/workspaces/${workspaceId}/threats?limit=50`, config);
  return json.data || json.threats || (Array.isArray(json) ? json : []);
}

export async function testConnection(config?: EmsisoftConfig): Promise<{ success: boolean; error?: string; workspaces?: number }> {
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
  const cfg = config ?? (await getEmsisoftConfig());
  const workspaces = await getWorkspaces(cfg);

  let totalDevices = 0;
  let protectedDevices = 0;
  let atRiskDevices = 0;
  let offlineDevices = 0;
  let openIncidents = 0;
  const recentThreats: { deviceName: string; threat: string; detectedAt: string }[] = [];

  for (const ws of workspaces) {
    try {
      const [devices, incidents] = await Promise.all([
        getDevices(ws.id, cfg),
        getIncidents(ws.id, cfg),
      ]);

      totalDevices += devices.length;
      for (const d of devices) {
        if (d.protectionStatus === "protected") protectedDevices++;
        else if (d.protectionStatus === "at_risk") atRiskDevices++;
        else if (d.protectionStatus === "offline") offlineDevices++;
      }

      openIncidents += incidents.filter((i) => i.status === "open").length;

      for (const i of incidents.filter((x) => x.status === "open").slice(0, 5)) {
        recentThreats.push({
          deviceName: i.deviceName,
          threat: i.title,
          detectedAt: i.detectedAt,
        });
      }
    } catch {}
  }

  return {
    totalDevices,
    protectedDevices,
    atRiskDevices,
    offlineDevices,
    openIncidents,
    recentThreats: recentThreats.slice(0, 10),
    workspaceCount: workspaces.length,
  };
}

export async function getClientDevices(emsisoftId: string, config?: EmsisoftConfig) {
  const cfg = config ?? (await getEmsisoftConfig());
  try {
    const devices = await getDevices(emsisoftId, cfg);
    const incidents = await getIncidents(emsisoftId, cfg);
    return {
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
  } catch {
    return { devices: [], incidents: [], summary: { total: 0, protected: 0, atRisk: 0, offline: 0, openIncidents: 0 } };
  }
}
