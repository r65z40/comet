import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

const OXIBOX_API = "https://api.oxibox.com";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const row = await prisma.setting.findUnique({ where: { key: "oxibox_api_key" } });
  const token = row?.value;
  if (!token) return NextResponse.json({ error: "Clé API Oxibox non configurée" }, { status: 400 });

  const { searchParams } = new URL(req.url);
  const orgId = searchParams.get("orgId");
  if (!orgId) return NextResponse.json({ error: "orgId requis" }, { status: 400 });

  try {
    const res = await fetch(`${OXIBOX_API}/usage/cloud/${encodeURIComponent(orgId)}`, {
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
