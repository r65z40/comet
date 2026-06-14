import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getOxiboxToken, getOxiboxUsage } from "@/lib/oxibox";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const token = await getOxiboxToken();
  if (!token) return NextResponse.json({ error: "Clé API Oxibox non configurée" }, { status: 400 });

  const { searchParams } = new URL(req.url);
  const orgId = searchParams.get("orgId");
  if (!orgId) return NextResponse.json({ error: "orgId requis" }, { status: 400 });

  try {
    const data = await getOxiboxUsage(token, orgId);
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: "Erreur de connexion à Oxibox", details: String(err) },
      { status: 502 },
    );
  }
}
