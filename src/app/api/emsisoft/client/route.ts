import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getEmsisoftConfig, getWorkspaces } from "@/lib/emsisoft";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const clientId = searchParams.get("clientId");

  if (!clientId) {
    return NextResponse.json({ error: "clientId requis" }, { status: 400 });
  }

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { id: true, emsisoftId: true },
  });

  if (!client) {
    return NextResponse.json({ error: "Client introuvable" }, { status: 404 });
  }

  if (!client.emsisoftId) {
    return NextResponse.json({ linked: false });
  }

  try {
    const config = await getEmsisoftConfig();
    const workspaces = await getWorkspaces(config);
    const ws = workspaces.find((w) => w.id === client.emsisoftId);

    if (!ws) {
      return NextResponse.json({ linked: true, found: false });
    }

    return NextResponse.json({
      linked: true,
      found: true,
      workspace: {
        name: ws.name,
        deviceCount: ws.deviceCount,
        findingsLastMonth: ws.findingsLastMonth,
        findingType: ws.findingType,
        lastAlert: ws.lastAlert,
        isExpired: ws.isExpired,
        isExpiresSoon: ws.isExpiresSoon,
        totalSeat: ws.totalSeat,
        usedSeat: ws.usedSeat,
        unusedSeat: ws.unusedSeat,
      },
    });
  } catch {
    return NextResponse.json({ linked: true, found: false });
  }
}
