import { prisma } from "@/lib/db";

// --- In-memory cache ---
interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const CACHE_TTL = {
  accounts: 3 * 60 * 1000,  // 3 min
  usage: 5 * 60 * 1000,     // 5 min
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

export function invalidateOxiboxCache(prefix?: string): void {
  if (!prefix) {
    cache.clear();
    return;
  }
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) cache.delete(key);
  }
}

const OXIBOX_API = "https://api.oxibox.com";

export async function getOxiboxToken(): Promise<string | null> {
  const row = await prisma.setting.findUnique({ where: { key: "oxibox_api_key" } });
  return row?.value || null;
}

async function oxiboxFetch(path: string, token: string) {
  const res = await fetch(`${OXIBOX_API}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Oxibox API ${res.status}: ${text}`);
  }

  return res.json();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getOxiboxAccounts(token: string, opts?: { orgId?: string; include?: string; skip?: number; limit?: number }): Promise<any> {
  const orgId = opts?.orgId;
  const include = opts?.include;
  const skip = opts?.skip ?? 0;
  const limit = opts?.limit ?? 200;

  const cacheKey = `oxibox:accounts:${orgId || "all"}:${include || ""}:${skip}:${limit}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  const params = new URLSearchParams();
  if (include) params.set("include", include);
  if (!orgId) {
    params.set("skip", String(skip));
    params.set("limit", String(limit));
  }

  const path = orgId ? `/status/${encodeURIComponent(orgId)}` : "/status";
  const qs = params.toString();
  const data = await oxiboxFetch(`${path}${qs ? `?${qs}` : ""}`, token);

  cacheSet(cacheKey, data, CACHE_TTL.accounts);
  return data;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getOxiboxUsage(token: string, orgId: string): Promise<any> {
  const cacheKey = `oxibox:usage:${orgId}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  const data = await oxiboxFetch(`/usage/cloud/${encodeURIComponent(orgId)}`, token);
  cacheSet(cacheKey, data, CACHE_TTL.usage);
  return data;
}

export async function testOxiboxConnection(token: string): Promise<{ success: boolean; total?: number; error?: string }> {
  invalidateOxiboxCache();
  try {
    const res = await fetch(`${OXIBOX_API}/status?limit=1`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });
    if (res.ok) {
      const data = await res.json();
      return { success: true, total: data.total ?? 0 };
    }
    return { success: false, error: `HTTP ${res.status}` };
  } catch {
    return { success: false, error: "Impossible de joindre l'API Oxibox" };
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getAllOxiboxAccounts(token: string): Promise<any[]> {
  const cacheKey = "oxibox:all-accounts";
  const cached = cacheGet<unknown[]>(cacheKey);
  if (cached) return cached;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const all: any[] = [];
  let skip = 0;
  const limit = 200;

  while (true) {
    const data = await oxiboxFetch(`/status?skip=${skip}&limit=${limit}`, token);
    const items = data.items || data.data || data;
    if (!Array.isArray(items) || items.length === 0) break;
    all.push(...items);
    if (items.length < limit) break;
    skip += limit;
  }

  cacheSet(cacheKey, all, CACHE_TTL.accounts);
  return all;
}
