import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getEmsisoftConfig, getWorkspaces, getIncidents } from "@/lib/emsisoft";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const config = await getEmsisoftConfig();
  if (!config.enabled || !config.apiKey) {
    return NextResponse.json({ enabled: false, incidents: [] });
  }

  const { searchParams } = new URL(req.url);
  const workspaceId = searchParams.get("workspaceId");
  const status = searchParams.get("status") || "open";

  try {
    if (workspaceId) {
      const incidents = await getIncidents(workspaceId, config);
      const filtered = status === "all" ? incidents : incidents.filter((i) => i.status === status);
      return NextResponse.json({ incidents: filtered });
    }

    const workspaces = await getWorkspaces(config);
    const allIncidents = [];
    for (const ws of workspaces) {
      try {
        const incidents = await getIncidents(ws.id, config);
        allIncidents.push(
          ...incidents
            .filter((i) => status === "all" || i.status === status)
            .map((i) => ({ ...i, workspaceId: ws.id, workspaceName: ws.name })),
        );
      } catch {}
    }

    allIncidents.sort((a, b) => new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime());
    return NextResponse.json({ enabled: true, incidents: allIncidents });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erreur" },
      { status: 500 },
    );
  }
}
