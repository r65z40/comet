import { getSettings } from "@/lib/settings";
// --- Self-signed SSL support for self-hosted controllers ---
function isSelfHostedUrl(url: string): boolean {
  try {
    const hostname = new URL(url).hostname;
    return !hostname.endsWith("tplinkcloud.com");
  } catch {
    return false;
  }
}

async function omadaRawFetch(url: string, options: RequestInit = {}): Promise<Response> {
  if (isSelfHostedUrl(url)) {
    const prev = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
    try {
      return await fetch(url, { ...options, cache: "no-store" });
    } finally {
      if (prev === undefined) {
        delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
      } else {
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = prev;
      }
    }
  }
  return fetch(url, { ...options, cache: "no-store" });
}

// --- In-memory cache ---
interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

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

export function invalidateOmadaCache(): void {
  cache.clear();
}

// --- Token management ---
let tokenData: { accessToken: string; expiresAt: number } | null = null;

// --- Config ---
export interface OmadaConfig {
  clientId: string;
  clientSecret: string;
  baseUrl: string;
  omadacId: string;
  enabled: boolean;
}

export async function getOmadaConfig(): Promise<OmadaConfig> {
  const map = await getSettings([
    "omada_client_id",
    "omada_client_secret",
    "omada_base_url",
    "omada_controller_id",
    "omada_enabled",
  ]);
  return {
    clientId: map.omada_client_id || "",
    clientSecret: map.omada_client_secret || "",
    baseUrl: (map.omada_base_url || "").replace(/\/+$/, ""),
    omadacId: map.omada_controller_id || "",
    enabled: map.omada_enabled === "true",
  };
}

// --- Auth ---
async function getAccessToken(config: OmadaConfig): Promise<string> {
  if (tokenData && Date.now() < tokenData.expiresAt) {
    return tokenData.accessToken;
  }

  const url = `${config.baseUrl}/openapi/authorize/token?grant_type=client_credentials`;
  let res: Response;
  try {
    res = await omadaRawFetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        omadacId: config.omadacId,
        client_id: config.clientId,
        client_secret: config.clientSecret,
      }),
    });
  } catch (fetchErr) {
    const msg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
    throw new Error(`CONNECTION_ERROR: ${msg}`);
  }

  const text = await res.text().catch(() => "");
  if (!res.ok) {
    throw new Error(`AUTH_HTTP_${res.status}: ${text}`);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let json: any;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`AUTH_PARSE_ERROR: ${text.slice(0, 200)}`);
  }

  if (json.errorCode !== 0) {
    throw new Error(`AUTH_API_ERROR: code=${json.errorCode} msg=${json.msg || "Unknown"}`);
  }

  const result = json.result;
  tokenData = {
    accessToken: result.accessToken,
    expiresAt: Date.now() + (result.expiresIn - 300) * 1000,
  };

  return tokenData.accessToken;
}

// --- Base fetch ---
async function omadaFetch(path: string, config?: OmadaConfig) {
  const cfg = config ?? (await getOmadaConfig());
  if (!cfg.enabled || !cfg.clientId || !cfg.clientSecret) {
    throw new Error("Omada non configuré");
  }

  const token = await getAccessToken(cfg);
  const url = `${cfg.baseUrl}/openapi/v1/${cfg.omadacId}${path}`;
  const res = await omadaRawFetch(url, {
    headers: {
      Authorization: `AccessToken=${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Omada API ${res.status}: ${text}`);
  }

  const json = await res.json();
  if (json.errorCode !== 0) {
    throw new Error(`Omada API error: ${json.msg || "Unknown"}`);
  }

  return json.result;
}

// --- Types ---
export interface OmadaSite {
  siteId: string;
  name: string;
  region: string;
  timeZone: string;
}

export interface OmadaDevice {
  mac: string;
  name: string;
  type: string;
  model: string;
  firmwareVersion: string;
  ip: string;
  status: number;
  statusCategory: number;
  lastSeen: number;
  uptimeLong: number;
  cpuUtil: number;
  memUtil: number;
  clientNum: number;
  site: string;
  siteId: string;
}

export interface OmadaSummary {
  enabled: boolean;
  totalDevices: number;
  onlineDevices: number;
  offlineDevices: number;
  siteCount: number;
  sites: {
    id: string;
    name: string;
    devices: number;
    online: number;
    offline: number;
  }[];
  devices: OmadaDevice[];
  offlineAlerts: {
    mac: string;
    name: string;
    type: string;
    site: string;
    lastSeen: number;
  }[];
}

// --- API functions ---
export async function getSites(config?: OmadaConfig): Promise<OmadaSite[]> {
  const cached = cacheGet<OmadaSite[]>("omada:sites");
  if (cached) return cached;

  const result = await omadaFetch("/sites?page=1&pageSize=100", config);
  const sites: OmadaSite[] = (result.data || []).map((s: Record<string, string>) => ({
    siteId: s.siteId || s.id,
    name: s.name,
    region: s.region || "",
    timeZone: s.timeZone || "",
  }));

  cacheSet("omada:sites", sites, 5 * 60 * 1000);
  return sites;
}

export async function getDevices(siteId: string, config?: OmadaConfig): Promise<OmadaDevice[]> {
  const cacheKey = `omada:devices:${siteId}`;
  const cached = cacheGet<OmadaDevice[]>(cacheKey);
  if (cached) return cached;

  const result = await omadaFetch(`/sites/${siteId}/devices?page=1&pageSize=200`, config);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const devices: OmadaDevice[] = (result.data || []).map((d: any) => ({
    mac: d.mac || "",
    name: d.name || d.deviceName || d.mac || "Inconnu",
    type: d.type || d.deviceType || "unknown",
    model: d.model || d.modelVersion || "",
    firmwareVersion: d.firmwareVersion || d.fwVersion || "",
    ip: d.ip || d.lanIp || "",
    status: d.status ?? 0,
    statusCategory: d.statusCategory ?? d.status ?? 0,
    lastSeen: d.lastSeen || 0,
    uptimeLong: d.uptimeLong || d.uptime || 0,
    cpuUtil: d.cpuUtil ?? 0,
    memUtil: d.memUtil ?? 0,
    clientNum: d.clientNum ?? 0,
    site: "",
    siteId,
  }));

  cacheSet(cacheKey, devices, 60 * 1000);
  return devices;
}

export async function getOmadaSummary(config?: OmadaConfig): Promise<OmadaSummary> {
  const cached = cacheGet<OmadaSummary>("omada:summary");
  if (cached) return cached;

  const cfg = config ?? (await getOmadaConfig());
  if (!cfg.enabled) return { enabled: false, totalDevices: 0, onlineDevices: 0, offlineDevices: 0, siteCount: 0, sites: [], devices: [], offlineAlerts: [] };

  const sites = await getSites(cfg);
  const allDevices: OmadaDevice[] = [];

  for (const site of sites) {
    const devices = await getDevices(site.siteId, cfg);
    for (const d of devices) {
      d.site = site.name;
    }
    allDevices.push(...devices);
  }

  const siteStats = sites.map((site) => {
    const siteDevices = allDevices.filter((d) => d.siteId === site.siteId);
    const online = siteDevices.filter((d) => d.statusCategory === 1).length;
    return {
      id: site.siteId,
      name: site.name,
      devices: siteDevices.length,
      online,
      offline: siteDevices.length - online,
    };
  });

  const onlineDevices = allDevices.filter((d) => d.statusCategory === 1).length;
  const offlineDevices = allDevices.filter((d) => d.statusCategory !== 1);

  const summary: OmadaSummary = {
    enabled: true,
    totalDevices: allDevices.length,
    onlineDevices,
    offlineDevices: offlineDevices.length,
    siteCount: sites.length,
    sites: siteStats,
    devices: allDevices,
    offlineAlerts: offlineDevices.map((d) => ({
      mac: d.mac,
      name: d.name,
      type: d.type,
      site: d.site,
      lastSeen: d.lastSeen,
    })),
  };

  cacheSet("omada:summary", summary, 60 * 1000);
  return summary;
}

// --- Test connection ---
export async function testOmadaConnection(): Promise<{ success: boolean; error?: string; sites?: number; devices?: number }> {
  try {
    const config = await getOmadaConfig();
    if (!config.clientId || !config.clientSecret || !config.baseUrl || !config.omadacId) {
      return { success: false, error: "Configuration incomplète. Remplissez tous les champs." };
    }

    tokenData = null;

    const abortController = new AbortController();
    const timeout = setTimeout(() => abortController.abort(), 15000);

    try {
      const token = await getAccessToken(config);
      if (!token) return { success: false, error: "Impossible d'obtenir le token d'accès." };

      const sites = await getSites(config);
      let totalDevices = 0;
      for (const site of sites.slice(0, 3)) {
        const devices = await getDevices(site.siteId, config);
        totalDevices += devices.length;
      }

      return { success: true, sites: sites.length, devices: totalDevices };
    } finally {
      clearTimeout(timeout);
      abortController.abort();
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erreur inconnue";
    if (msg.startsWith("CONNECTION_ERROR:")) {
      const detail = msg.replace("CONNECTION_ERROR: ", "");
      if (detail.includes("ECONNREFUSED") || detail.includes("EHOSTUNREACH")) {
        return { success: false, error: "Impossible de se connecter au contrôleur Omada. Vérifiez l'URL." };
      }
      if (detail.includes("CERT") || detail.includes("certificate") || detail.includes("SSL")) {
        return { success: false, error: `Erreur de certificat SSL : ${detail}. Pour un contrôleur local, vérifiez le certificat HTTPS.` };
      }
      return { success: false, error: `Connexion échouée : ${detail}` };
    }
    if (msg.startsWith("AUTH_HTTP_")) {
      const status = msg.match(/AUTH_HTTP_(\d+)/)?.[1] || "?";
      const body = msg.replace(/AUTH_HTTP_\d+: ?/, "");
      if (status === "401" || status === "403") {
        return { success: false, error: `Authentification refusée (HTTP ${status}). Vérifiez que l'app Omada est en mode "Client Credentials" (pas "Authorization Code"), et que le Client ID/Secret sont corrects.` };
      }
      return { success: false, error: `Erreur HTTP ${status} lors de l'authentification : ${body.slice(0, 200)}` };
    }
    if (msg.startsWith("AUTH_API_ERROR:")) {
      return { success: false, error: `Omada a refusé l'authentification : ${msg.replace("AUTH_API_ERROR: ", "")}. Vérifiez que l'app est en mode "Client Credentials".` };
    }
    if (msg.startsWith("AUTH_PARSE_ERROR:")) {
      return { success: false, error: `Réponse inattendue du serveur (pas du JSON). L'URL pointe peut-être vers l'interface web au lieu de l'API.` };
    }
    return { success: false, error: msg };
  }
}
