import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { bulkActionSchema } from "@/lib/validations";
import { logActivity } from "@/lib/activity";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  if (session.user?.role !== "ADMIN") return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const raw = await req.json();
  const parsed = bulkActionSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Données invalides", details: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const { ids, action, value } = parsed.data;
  const userName = session.user?.name || session.user?.email || "Inconnu";

  if (action === "delete") {
    await prisma.installation.updateMany({
      where: { id: { in: ids } },
      data: { deletedAt: new Date() },
    });
    await logActivity({
      userId: session.user?.id,
      userName,
      action: "BULK_DELETE",
      entity: "installation",
      details: `${ids.length} installation(s) supprimée(s)`,
    });
    return NextResponse.json({ success: true, affected: ids.length });
  }

  if (action === "status" && typeof value === "string") {
    const validStatuses = ["EN_PARC", "HORS_PARC", "RENOUVELE", "EN_PARC_GARANTIE", "EN_PARC_HORS_GARANTIE"];
    if (!validStatuses.includes(value)) {
      return NextResponse.json({ error: "Statut invalide" }, { status: 400 });
    }
    await prisma.installation.updateMany({
      where: { id: { in: ids } },
      data: { status: value },
    });
    await logActivity({
      userId: session.user?.id,
      userName,
      action: "BULK_UPDATE",
      entity: "installation",
      details: `${ids.length} installation(s) → statut ${value}`,
    });
    return NextResponse.json({ success: true, affected: ids.length });
  }

  if (action === "alwaysInFleet" && typeof value === "boolean") {
    await prisma.installation.updateMany({
      where: { id: { in: ids } },
      data: { alwaysInFleet: value },
    });
    await logActivity({
      userId: session.user?.id,
      userName,
      action: "BULK_UPDATE",
      entity: "installation",
      details: `${ids.length} installation(s) → toujours en parc: ${value ? "Oui" : "Non"}`,
    });
    return NextResponse.json({ success: true, affected: ids.length });
  }

  return NextResponse.json({ error: "Action invalide" }, { status: 400 });
}
