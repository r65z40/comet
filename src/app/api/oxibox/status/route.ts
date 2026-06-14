import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getOxiboxToken, getOxiboxAccounts, testOxiboxConnection } from "@/lib/oxibox";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const token = await getOxiboxToken();
  if (!token) return NextResponse.json({ error: "Clé API Oxibox non configurée" }, { status: 400 });

  const { searchParams } = new URL(req.url);
  const orgId = searchParams.get("orgId") || undefined;
  const include = searchParams.get("include") || undefined;
  const skip = searchParams.get("skip") ? parseInt(searchParams.get("skip")!, 10) : undefined;
  const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!, 10) : undefined;

  try {
    const data = await getOxiboxAccounts(token, { orgId, include, skip, limit });
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
    const result = await testOxiboxConnection(token);
    return NextResponse.json(result);
  }

  return NextResponse.json({ error: "Action inconnue" }, { status: 400 });
}
