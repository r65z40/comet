import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getEmsisoftConfig, getWorkspaceDetails } from "@/lib/emsisoft";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const config = await getEmsisoftConfig();
  if (!config.enabled || !config.apiKey) {
    return NextResponse.json({ enabled: false });
  }

  const { searchParams } = new URL(req.url);
  const workspaceId = searchParams.get("workspaceId");

  if (!workspaceId) {
    return NextResponse.json({ error: "workspaceId requis" }, { status: 400 });
  }

  try {
    const details = await getWorkspaceDetails(workspaceId, config);
    return NextResponse.json({ enabled: true, devices: details.devices, findings: details.findings });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erreur" },
      { status: 500 },
    );
  }
}
