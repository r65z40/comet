import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getEmsisoftConfig, getWorkspaces, getDevices } from "@/lib/emsisoft";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const config = await getEmsisoftConfig();
  if (!config.enabled || !config.apiKey) {
    return NextResponse.json({ enabled: false, devices: [] });
  }

  const { searchParams } = new URL(req.url);
  const workspaceId = searchParams.get("workspaceId");

  try {
    if (workspaceId) {
      const devices = await getDevices(workspaceId, config);
      return NextResponse.json({ devices });
    }

    const workspaces = await getWorkspaces(config);
    const allDevices = [];
    for (const ws of workspaces) {
      try {
        const devices = await getDevices(ws.id, config);
        allDevices.push(...devices.map((d) => ({ ...d, workspaceId: ws.id, workspaceName: ws.name })));
      } catch {}
    }
    return NextResponse.json({ enabled: true, devices: allDevices });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erreur" },
      { status: 500 },
    );
  }
}
