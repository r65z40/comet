import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getProtectionSummary, testConnection, getEmsisoftConfig } from "@/lib/emsisoft";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const config = await getEmsisoftConfig();
  if (!config.enabled || !config.apiKey) {
    return NextResponse.json({ enabled: false });
  }

  try {
    const summary = await getProtectionSummary(config);
    return NextResponse.json({ enabled: true, ...summary });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erreur Emsisoft" },
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
    const result = await testConnection();
    return NextResponse.json(result);
  }

  return NextResponse.json({ error: "Action inconnue" }, { status: 400 });
}
