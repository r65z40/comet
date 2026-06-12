import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

const OXIBOX_API = "https://api.oxibox.com";

async function getOxiboxToken(): Promise<string | null> {
  const row = await prisma.setting.findUnique({ where: { key: "oxibox_api_key" } });
  return row?.value || null;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const token = await getOxiboxToken();
  if (!token) return NextResponse.json({ error: "Clé API Oxibox non configurée" }, { status: 400 });

  const { searchParams } = new URL(req.url);
  const orgId = searchParams.get("orgId");
  const include = searchParams.get("include");
  const skip = searchParams.get("skip");
  const limit = searchParams.get("limit");

  let url = orgId ? `${OXIBOX_API}/status/${encodeURIComponent(orgId)}` : `${OXIBOX_API}/status`;
  const params = new URLSearchParams();
  if (include) params.set("include", include);
  if (skip) params.set("skip", skip);
  if (limit) params.set("limit", limit);
  const qs = params.toString();
  if (qs) url += `?${qs}`;

  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { error: `Oxibox API error ${res.status}`, details: text },
        { status: res.status },
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: "Erreur de connexion à Oxibox", details: String(err) },
      { status: 502 },
    );
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const body = await req.json();
  if (body.action === "test") {
    const token = await getOxiboxToken();
    if (!token) return NextResponse.json({ success: false, error: "Clé API non configurée" });

    try {
      const res = await fetch(`${OXIBOX_API}/status?limit=1`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      });
      if (res.ok) {
        const data = await res.json();
        return NextResponse.json({ success: true, total: data.total ?? 0 });
      }
      return NextResponse.json({ success: false, error: `HTTP ${res.status}` });
    } catch {
      return NextResponse.json({ success: false, error: "Impossible de joindre l'API Oxibox" });
    }
  }

  return NextResponse.json({ error: "Action inconnue" }, { status: 400 });
}
