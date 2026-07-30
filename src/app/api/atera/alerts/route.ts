import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { cacheGet, cacheSet } from "@/lib/cache";

const ATERA_BASE_URL = "https://app.atera.com/api/v3";
const CACHE_TTL = 60_000;

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const limitParam = searchParams.get("limit") || "50";
  const limit = parseInt(limitParam);
  const cacheKey = `atera:alerts:${limit}`;

  const cached = cacheGet<{ alerts: AteraAlert[]; total: number }>(cacheKey);
  if (cached) return NextResponse.json(cached);

  const settings = await prisma.setting.findMany({
    where: { key: { in: ["atera_api_key", "atera_enabled"] } },
  });
  const map: Record<string, string> = {};
  for (const s of settings) map[s.key] = s.value;

  if (!map.atera_api_key) return NextResponse.json({ error: "Clé API Atera non configurée" }, { status: 400 });
  if (map.atera_enabled !== "true") return NextResponse.json({ error: "Atera désactivé" }, { status: 400 });

  try {
    const alerts: AteraAlert[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore && alerts.length < limit) {
      const res = await fetch(
        `${ATERA_BASE_URL}/alerts?itemsInPage=${Math.min(50, limit - alerts.length)}&page=${page}`,
        {
          headers: {
            "X-API-KEY": map.atera_api_key,
            Accept: "application/json",
          },
        },
      );

      if (!res.ok) {
        const text = await res.text();
        return NextResponse.json({ error: `Atera API ${res.status}`, details: text }, { status: res.status });
      }

      const data = await res.json();
      const items = data.items || [];

      for (const item of items) {
        alerts.push({
          id: item.AlertID,
          title: item.Title || item.AlertMessage || "Alerte",
          severity: mapSeverity(item.Severity),
          severityRaw: item.Severity,
          deviceName: item.DeviceName || item.MachineName || null,
          customerName: item.CustomerName || null,
          customerId: item.CustomerID || null,
          alertCategoryId: item.AlertCategoryID || null,
          code: item.Code || null,
          created: item.Created || item.CreatedOn || null,
          archived: item.Archived ?? false,
          source: item.SourceType || null,
        });
      }

      hasMore = items.length > 0 && data.totalPages > page;
      page++;
    }

    const open = alerts.filter((a) => !a.archived);
    const result = { alerts: open, total: open.length };
    cacheSet(cacheKey, result, CACHE_TTL);

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: "Erreur de connexion à Atera", details: String(err) },
      { status: 502 },
    );
  }
}

interface AteraAlert {
  id: number;
  title: string;
  severity: "Critical" | "Warning" | "Information";
  severityRaw: string;
  deviceName: string | null;
  customerName: string | null;
  customerId: number | null;
  alertCategoryId: string | null;
  code: number | null;
  created: string | null;
  archived: boolean;
  source: string | null;
}

function mapSeverity(raw: string): "Critical" | "Warning" | "Information" {
  if (!raw) return "Information";
  const lower = raw.toLowerCase();
  if (lower === "critical" || lower === "fatal") return "Critical";
  if (lower === "warning") return "Warning";
  return "Information";
}
