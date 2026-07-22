import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getOmadaConfig, getOmadaSummary, testOmadaConnection } from "@/lib/omada";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const config = await getOmadaConfig();
  if (!config.enabled || !config.clientId) {
    return NextResponse.json({ enabled: false });
  }

  try {
    const summary = await getOmadaSummary(config);
    return NextResponse.json(summary);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erreur Omada" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const body = await req.json();

  if (body.action === "test") {
    const result = await testOmadaConnection();
    return NextResponse.json(result);
  }

  return NextResponse.json({ error: "Action inconnue" }, { status: 400 });
}
