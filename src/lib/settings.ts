import { prisma } from "@/lib/db";
import { decrypt } from "@/lib/crypto";
import { cacheGet, cacheSet, cacheInvalidate } from "@/lib/cache";

const ENCRYPTED_KEYS = new Set([
  "axonaut_api_key", "smtp_pass", "cloud_s3_secret_key", "cloud_ftp_password",
  "oxibox_api_key", "emsisoft_api_key",
  "spotify_client_secret", "spotify_access_token", "spotify_refresh_token",
]);

const CACHE_TTL = 300_000; // 5 min

export async function getSettings(keys: string[]): Promise<Record<string, string>> {
  const cacheKey = `settings:${keys.sort().join(",")}`;
  const cached = cacheGet<Record<string, string>>(cacheKey);
  if (cached) return cached;

  const settings = await prisma.setting.findMany({
    where: { key: { in: keys } },
  });

  const map: Record<string, string> = {};
  for (const s of settings) {
    map[s.key] = ENCRYPTED_KEYS.has(s.key) ? decrypt(s.value) : s.value;
  }

  cacheSet(cacheKey, map, CACHE_TTL);
  return map;
}

export async function getSetting(key: string): Promise<string | null> {
  const map = await getSettings([key]);
  return map[key] || null;
}

export function invalidateSettingsCache(): void {
  cacheInvalidate("settings:");
}
