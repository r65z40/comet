import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { invalidateEmsisoftCache } from "@/lib/emsisoft";
import { invalidateOxiboxCache } from "@/lib/oxibox";
import { invalidateOmadaCache } from "@/lib/omada";
import { encrypt, decrypt } from "@/lib/crypto";
import { logAudit } from "@/lib/audit";
import { cacheGet, cacheSet, cacheInvalidate } from "@/lib/cache";

const ENCRYPTED_KEYS = new Set([
  "axonaut_api_key", "smtp_pass", "cloud_s3_secret_key", "cloud_ftp_password",
  "oxibox_api_key", "emsisoft_api_key",
  "omada_client_secret", "omada_password",
  "spotify_client_secret", "spotify_access_token", "spotify_refresh_token",
]);

const SETTINGS_CACHE_KEY = "settings:all";
const SETTINGS_CACHE_TTL = 300_000; // 5 min

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  if (session.user?.role !== "ADMIN") return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const isAdmin = true;

  let settings: { key: string; value: string }[];
  const cached = cacheGet<{ key: string; value: string }[]>(SETTINGS_CACHE_KEY);
  if (cached) {
    settings = cached;
  } else {
    settings = await prisma.setting.findMany();
    cacheSet(SETTINGS_CACHE_KEY, settings, SETTINGS_CACHE_TTL);
  }

  const settingsMap: Record<string, string> = {};
  for (const s of settings) {
    if (ENCRYPTED_KEYS.has(s.key)) {
      if (isAdmin) {
        const decrypted = decrypt(s.value);
        settingsMap[s.key] = decrypted ? "••••••••" + decrypted.slice(-4) : "";
      }
    } else {
      settingsMap[s.key] = s.value;
    }
  }

  return NextResponse.json(settingsMap);
}

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const body = await req.json();

  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return NextResponse.json({ error: "Corps de requête invalide" }, { status: 400 });
  }

  const changedKeys: string[] = [];
  const operations = Object.entries(body)
    .filter(([key, value]) => {
      if (typeof key !== "string" || typeof value !== "string") return false;
      if (ENCRYPTED_KEYS.has(key) && (value as string).startsWith("••••")) return false;
      return true;
    })
    .map(([key, value]) => {
      changedKeys.push(key);
      const storeValue = ENCRYPTED_KEYS.has(key) ? encrypt(value as string) : (value as string);
      return prisma.setting.upsert({
        where: { key },
        create: { key, value: storeValue },
        update: { value: storeValue },
      });
    });

  if (operations.length > 0) {
    await prisma.$transaction(operations);
    cacheInvalidate("settings:");

    if (changedKeys.some((k) => k.startsWith("emsisoft_"))) invalidateEmsisoftCache();
    if (changedKeys.some((k) => k.startsWith("oxibox_"))) invalidateOxiboxCache();
    if (changedKeys.some((k) => k.startsWith("omada_"))) invalidateOmadaCache();

    await logAudit({
      userId: session.user.id,
      userName: session.user.name || session.user.email,
      action: "SETTINGS_CHANGE",
      entity: "settings",
      details: `Clés modifiées : ${changedKeys.filter((k) => !ENCRYPTED_KEYS.has(k)).join(", ")}${changedKeys.some((k) => ENCRYPTED_KEYS.has(k)) ? " + credentials" : ""}`,
    });
  }

  return NextResponse.json({ success: true });
}
