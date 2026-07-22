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
  openApiToken = null;
  webSession = null;
}

// --- Config ---
export interface OmadaConfig {
  baseUrl: string;
  omadacId: string;
  enabled: boolean;
  // Open API auth (client credentials)
  clientId: string;
  clientSecret: string;
  // Web session auth (login/password) — fallback
  username: string;
  password: string;
}

export async function getOmadaConfig(): Promise<OmadaConfig> {
  const map = await getSettings([
    "omada_client_id",
    "omada_client_secret",
    "omada_base_url",
    "omada_controller_id",
    "omada_enabled",
    "omada_username",
    "omada_password",
  ]);
  return {
    clientId: map.omada_client_id || "",
    clientSecret: map.omada_client_secret || "",
    baseUrl: (map.omada_base_url || "").replace(/\/+$/, ""),
    omadacId: map.omada_controller_id || "",
    enabled: map.omada_enabled === "true",
    username: map.omada_username || "",
    password: map.omada_password || "",
  };
}

// --- Controller info ---
async function getControllerInfo(baseUrl: string): Promise<{ omadacId: string; controllerVer: string; apiVer: string } | null> {
  try {
    const res = await omadaRawFetch(`${baseUrl}/api/info`);
    if (!res.ok) return null;
    const json = await res.json();
    const r = json.result || json;
    return {
      omadacId: r.omadacId || "",
      controllerVer: r.controllerVer || r.firmwareVer || "",
      apiVer: r.apiVer?.toString() || "",
    };
  } catch {
    return null;
  }
}

// ============================================================
// AUTH MODE 1: Open API (Client Credentials)
// ============================================================
let openApiToken: { accessToken: string; expiresAt: number } | null = null;

async function getOpenApiToken(config: OmadaConfig): Promise<string> {
  if (openApiToken && Date.now() < openApiToken.expiresAt) {
    return openApiToken.accessToken;
  }

  const url = `${config.baseUrl}/openapi/authorize/token?grant_type=client_credentials`;
  const res = await omadaRawFetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      omadacId: config.omadacId,
      client_id: config.clientId,
      client_secret: config.clientSecret,
    }),
  });

  const text = await res.text().catch(() => "");
  if (!res.ok) throw new Error(`AUTH_HTTP_${res.status}: ${text}`);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let json: any;
  try { json = JSON.parse(text); } catch { throw new Error(`AUTH_PARSE_ERROR: ${text.slice(0, 200)}`); }

  if (json.errorCode !== 0) {
    throw new Error(`AUTH_API_ERROR: code=${json.errorCode} msg=${json.msg || "Unknown"}`);
  }

  const result = json.result;
  openApiToken = {
    accessToken: result.accessToken,
    expiresAt: Date.now() + (result.expiresIn - 300) * 1000,
  };
  return openApiToken.accessToken;
}

async function openApiFetch(path: string, config: OmadaConfig) {
  const token = await getOpenApiToken(config);
  const url = `${config.baseUrl}/openapi/v1/${config.omadacId}${path}`;
  const res = await omadaRawFetch(url, {
    headers: {
      Authorization: `AccessToken=${token}`,
      "Content-Type": "application/json",
    },
  });

  const text = await res.text().catch(() => "");
  if (!res.ok) throw new Error(`Omada API ${res.status}: ${text}`);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let json: any;
  try { json = JSON.parse(text); } catch { throw new Error(`Omada API parse error: ${text.slice(0, 200)}`); }

  if (json.errorCode !== 0) {
    throw new Error(`OMADA_API_ERROR: code=${json.errorCode} msg=${json.msg || "Unknown"} path=${path}`);
  }
  return json.result;
}

// ============================================================
// AUTH MODE 2: Web Session (Login/Password)
// ============================================================
let webSession: { csrfToken: string; cookies: string; expiresAt: number } | null = null;

async function getWebSession(config: OmadaConfig): Promise<{ csrfToken: string; cookies: string }> {
  if (webSession && Date.now() < webSession.expiresAt) {
    return { csrfToken: webSession.csrfToken, cookies: webSession.cookies };
  }

  const loginUrl = `${config.baseUrl}/${config.omadacId}/api/v2/login`;
  const res = await omadaRawFetch(loginUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: config.username,
      password: config.password,
    }),
  });

  const text = await res.text().catch(() => "");
  if (!res.ok) throw new Error(`WEB_AUTH_HTTP_${res.status}: ${text}`);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let json: any;
  try { json = JSON.parse(text); } catch { throw new Error(`WEB_AUTH_PARSE: ${text.slice(0, 200)}`); }

  if (json.errorCode !== 0) {
    throw new Error(`WEB_AUTH_ERROR: code=${json.errorCode} msg=${json.msg || "Unknown"}`);
  }

  const csrfToken = json.result?.token || "";
  const setCookies = res.headers.getSetCookie?.() || [];
  const cookies = setCookies.map((c: string) => c.split(";")[0]).join("; ");

  webSession = {
    csrfToken,
    cookies,
    expiresAt: Date.now() + 25 * 60 * 1000, // 25 min session
  };

  return { csrfToken, cookies };
}

async function webSessionFetch(path: string, config: OmadaConfig, method = "GET", body?: unknown) {
  const session = await getWebSession(config);
  const url = `${config.baseUrl}/${config.omadacId}/api/v2${path}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Csrf-Token": session.csrfToken,
    Cookie: session.cookies,
  };

  const res = await omadaRawFetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text().catch(() => "");

  // Session expired — re-login once
  if (res.status === 401 || text.includes("-44112") || text.includes("-44113")) {
    webSession = null;
    const newSession = await getWebSession(config);
    headers["Csrf-Token"] = newSession.csrfToken;
    headers["Cookie"] = newSession.cookies;
    const retry = await omadaRawFetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
    const retryText = await retry.text().catch(() => "");
    if (!retry.ok) throw new Error(`Omada API ${retry.status}: ${retryText}`);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const retryJson: any = JSON.parse(retryText);
    if (retryJson.errorCode !== 0) throw new Error(`OMADA_API_ERROR: code=${retryJson.errorCode} msg=${retryJson.msg}`);
    return retryJson.result;
  }

  if (!res.ok) throw new Error(`Omada API ${res.status}: ${text}`);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let json: any;
  try { json = JSON.parse(text); } catch { throw new Error(`Omada parse error: ${text.slice(0, 200)}`); }

  if (json.errorCode !== 0) {
    throw new Error(`OMADA_API_ERROR: code=${json.errorCode} msg=${json.msg || "Unknown"} path=${path}`);
  }
  return json.result;
}

// ============================================================
// Unified fetch — picks the right auth mode
// ============================================================
function useWebSession(config: OmadaConfig): boolean {
  return !!(config.username && config.password);
}

async function omadaFetch(path: string, config?: OmadaConfig) {
  const cfg = config ?? (await getOmadaConfig());
  if (!cfg.enabled) throw new Error("Omada non configuré");

  if (useWebSession(cfg)) {
    if (!cfg.username || !cfg.password) throw new Error("Omada: identifiants web manquants");
    return webSessionFetch(path, cfg);
  }

  if (!cfg.clientId || !cfg.clientSecret) throw new Error("Omada: Client ID/Secret manquants");
  return openApiFetch(path, cfg);
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

// --- MSP: list customers, then sites per customer ---
interface OmadaCustomer {
  customerId: string;
  name: string;
}

async function getCustomers(config: OmadaConfig): Promise<OmadaCustomer[]> {
  const cached = cacheGet<OmadaCustomer[]>("omada:customers");
  if (cached) return cached;

  const result = await webSessionFetch("/customers?currentPage=1&currentPageSize=200", config);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const customers: OmadaCustomer[] = (result.customers || result.data || []).map((c: any) => ({
    customerId: c.customerId || c.id,
    name: c.name || "",
  }));

  cacheSet("omada:customers", customers, 5 * 60 * 1000);
  return customers;
}

// --- API functions ---
export async function getSites(config?: OmadaConfig): Promise<OmadaSite[]> {
  const cached = cacheGet<OmadaSite[]>("omada:sites");
  if (cached) return cached;

  const cfg = config ?? (await getOmadaConfig());
  const allSites: OmadaSite[] = [];

  if (useWebSession(cfg)) {
    // Try direct sites first
    const directResult = await webSessionFetch("/sites?currentPage=1&currentPageSize=100", cfg);
    const directSites = directResult.data || [];

    if (directSites.length > 0) {
      // Non-MSP controller: sites are at the root
      for (const s of directSites) {
        allSites.push({
          siteId: s.siteId || s.id || s.key,
          name: s.name,
          region: s.region || "",
          timeZone: s.timeZone || "",
        });
      }
    } else {
      // MSP controller: sites are under customers
      const customers = await getCustomers(cfg);
      for (const customer of customers) {
        try {
          const custResult = await webSessionFetch(
            `/customers/${customer.customerId}/sites?currentPage=1&currentPageSize=100`,
            cfg,
          );
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const custSites = custResult.data || [];
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          for (const s of custSites as any[]) {
            allSites.push({
              siteId: s.siteId || s.id || s.key,
              name: `${customer.name} — ${s.name || "Site"}`,
              region: s.region || "",
              timeZone: s.timeZone || "",
            });
          }
        } catch {
          // Skip customers we can't access
        }
      }
    }
  } else {
    const result = await openApiFetch("/sites?page=1&pageSize=100", cfg);
    for (const s of (result.data || []) as Record<string, string>[]) {
      allSites.push({
        siteId: s.siteId || s.id || s.key,
        name: s.name,
        region: s.region || "",
        timeZone: s.timeZone || "",
      });
    }
  }

  cacheSet("omada:sites", allSites, 5 * 60 * 1000);
  return allSites;
}

export async function getDevices(siteId: string, config?: OmadaConfig): Promise<OmadaDevice[]> {
  const cacheKey = `omada:devices:${siteId}`;
  const cached = cacheGet<OmadaDevice[]>(cacheKey);
  if (cached) return cached;

  const cfg = config ?? (await getOmadaConfig());
  let result;

  if (useWebSession(cfg)) {
    result = await webSessionFetch(`/sites/${siteId}/devices?currentPage=1&currentPageSize=200`, cfg);
  } else {
    result = await openApiFetch(`/sites/${siteId}/devices?page=1&pageSize=200`, cfg);
  }

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
export async function testOmadaConnection(): Promise<{ success: boolean; error?: string; sites?: number; devices?: number; debug?: string }> {
  try {
    const config = await getOmadaConfig();
    const isWeb = useWebSession(config);

    if (isWeb) {
      if (!config.username || !config.password || !config.baseUrl || !config.omadacId) {
        return { success: false, error: "Configuration incomplète. Remplissez l'URL, le Controller ID, le nom d'utilisateur et le mot de passe." };
      }
    } else {
      if (!config.clientId || !config.clientSecret || !config.baseUrl || !config.omadacId) {
        return { success: false, error: "Configuration incomplète. Remplissez tous les champs." };
      }
    }

    invalidateOmadaCache();

    const info = await getControllerInfo(config.baseUrl);
    const mode = isWeb ? "Web Session" : "Open API";
    const debugInfo = info
      ? `Mode: ${mode} | Controller v${info.controllerVer}, API v${info.apiVer}, omadacId=${info.omadacId}`
      : `Mode: ${mode} | /api/info non accessible`;

    if (info && info.omadacId && info.omadacId !== config.omadacId) {
      return {
        success: false,
        error: `Le Controller ID ne correspond pas. Saisi: "${config.omadacId}", contrôleur: "${info.omadacId}".`,
        debug: debugInfo,
      };
    }

    // Probe customer/site structure for MSP
    let rawDebug = "";
    if (isWeb) {
      try {
        const session = await getWebSession(config);
        const headers = { "Content-Type": "application/json", "Csrf-Token": session.csrfToken, Cookie: session.cookies };
        const base = `${config.baseUrl}/${config.omadacId}/api/v2`;

        // Try global endpoints first
        const globalPaths = [
          `/devices?currentPage=1&currentPageSize=5`,
          `/maintenance/device?currentPage=1&currentPageSize=5`,
          `/dashboard`,
        ];
        for (const gp of globalPaths) {
          try {
            const gRes = await omadaRawFetch(`${base}${gp}`, { headers });
            const gText = await gRes.text();
            rawDebug += `\n${gp} → ${gText.slice(0, 300)}`;
          } catch (e) {
            rawDebug += `\n${gp} → ERROR: ${e instanceof Error ? e.message : "?"}`;
          }
        }

        // Get first customer and dump full object
        const custRes = await omadaRawFetch(`${base}/customers?currentPage=1&currentPageSize=5`, { headers });
        const custJson = await custRes.json();
        const customers = custJson.result?.customers || custJson.result?.data || [];
        if (customers.length > 0) {
          const fullCustomer = customers[0];
          rawDebug += `\nCustomer[0] keys: ${Object.keys(fullCustomer).join(", ")}`;
          rawDebug += `\nCustomer[0] dump: ${JSON.stringify(fullCustomer).slice(0, 500)}`;

          const cid = fullCustomer.customerId || fullCustomer.id;
          const cname = fullCustomer.name;
          const siteId = fullCustomer.siteId || fullCustomer.site || fullCustomer.defaultSiteId;
          rawDebug += `\nUsing cid=${cid}, name=${cname}, extractedSiteId=${siteId || "none"}`;

          // Try many paths under this customer
          const probePaths = [
            `/customers/${cid}`,
            `/customers/${cid}/devices?currentPage=1&currentPageSize=5`,
            `/customers/${cid}/overview`,
            `/customers/${cid}/dashboard`,
            `/customers/${cid}/setting`,
            `/customers/${cid}/gateway`,
            `/sites/${cid}/setting`,
            `/sites/${cid}/devices?currentPage=1&currentPageSize=5`,
            `/sites/${cid}/dashboard`,
          ];

          // If customer has a siteId field, try that too
          if (siteId && siteId !== cid) {
            probePaths.push(`/sites/${siteId}/devices?currentPage=1&currentPageSize=5`);
            probePaths.push(`/sites/${siteId}/dashboard`);
          }

          for (const sp of probePaths) {
            try {
              const sRes = await omadaRawFetch(`${base}${sp}`, { headers });
              const sText = await sRes.text();
              rawDebug += `\n${sp} → ${sText.slice(0, 300)}`;
            } catch (e) {
              rawDebug += `\n${sp} → ERROR: ${e instanceof Error ? e.message : "?"}`;
            }
          }
        }
      } catch (e) {
        rawDebug += `\nProbe error: ${e instanceof Error ? e.message : "unknown"}`;
      }
    }

    const sites = await getSites(config);
    let totalDevices = 0;
    for (const site of sites) {
      const devices = await getDevices(site.siteId, config);
      totalDevices += devices.length;
    }
    return { success: true, sites: sites.length, devices: totalDevices, debug: debugInfo + rawDebug };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erreur inconnue";

    if (msg.startsWith("CONNECTION_ERROR:") || msg.includes("fetch failed")) {
      const detail = msg.replace("CONNECTION_ERROR: ", "");
      if (detail.includes("ECONNREFUSED") || detail.includes("EHOSTUNREACH")) {
        return { success: false, error: "Impossible de se connecter. Vérifiez l'URL et que le port est ouvert." };
      }
      if (detail.includes("ETIMEDOUT") || detail.includes("timeout")) {
        return { success: false, error: "Connexion timeout. Vérifiez que le port est accessible depuis Internet." };
      }
      return { success: false, error: `Connexion échouée : ${detail}` };
    }
    if (msg.startsWith("AUTH_HTTP_") || msg.startsWith("WEB_AUTH_HTTP_")) {
      const status = msg.match(/HTTP_(\d+)/)?.[1] || "?";
      const body = msg.replace(/\w+_HTTP_\d+: ?/, "");
      if (status === "401" || status === "403") {
        return { success: false, error: `Authentification refusée (HTTP ${status}). Vérifiez vos identifiants.` };
      }
      return { success: false, error: `Erreur HTTP ${status} : ${body.slice(0, 300)}` };
    }
    if (msg.startsWith("AUTH_API_ERROR:")) {
      return { success: false, error: `Open API : ${msg.replace("AUTH_API_ERROR: ", "")}` };
    }
    if (msg.startsWith("WEB_AUTH_ERROR:")) {
      const detail = msg.replace("WEB_AUTH_ERROR: ", "");
      if (detail.includes("-30109")) {
        return { success: false, error: "Nom d'utilisateur ou mot de passe incorrect." };
      }
      return { success: false, error: `Connexion web échouée : ${detail}` };
    }
    if (msg.includes("AUTH_PARSE_ERROR") || msg.includes("WEB_AUTH_PARSE")) {
      return { success: false, error: "Réponse inattendue du serveur. L'URL pointe peut-être vers l'interface web au lieu de l'API." };
    }
    if (msg.startsWith("OMADA_API_ERROR:")) {
      return { success: false, error: `API Omada : ${msg.replace("OMADA_API_ERROR: ", "")}` };
    }
    return { success: false, error: msg };
  }
}
