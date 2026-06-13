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
    apiUrl: map.emsisoft_api_url || "https://manage.emsisoft.com/api/v2",
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
      Authorization: `Basic ${Buffer.from(`${cfg.apiKey}:`).toString("base64")}`,
      Accept: "application/json",
    },
    next: { revalidate: 0 },
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

export async function getWorkspaces(config?: EmsisoftConfig): Promise<EmsisoftWorkspace[]> {
  const data = await emisoftFetch("/workspaces", config);
  return data.workspaces || data || [];
}

export async function getDevices(workspaceId: string, config?: EmsisoftConfig): Promise<EmsisoftDevice[]> {
  const data = await emisoftFetch(`/workspaces/${workspaceId}/devices`, config);
  return data.devices || data || [];
}

export async function getIncidents(workspaceId: string, config?: EmsisoftConfig): Promise<EmsisoftIncident[]> {
  const data = await emisoftFetch(`/workspaces/${workspaceId}/incidents`, config);
  return data.incidents || data || [];
}

export async function getThreats(workspaceId: string, config?: EmsisoftConfig) {
  const data = await emisoftFetch(`/workspaces/${workspaceId}/threats?limit=50`, config);
  return data.threats || data || [];
}

export async function testConnection(config?: EmsisoftConfig): Promise<{ success: boolean; error?: string; workspaces?: number }> {
  try {
    const workspaces = await getWorkspaces(config);
    return { success: true, workspaces: workspaces.length };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erreur inconnue" };
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
