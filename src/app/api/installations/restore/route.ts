import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { logActivity } from "@/lib/activity";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  if (session.user?.role !== "ADMIN") return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const { ids } = await req.json();
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: "ids requis" }, { status: 400 });
  }

  await prisma.installation.updateMany({
    where: { id: { in: ids }, deletedAt: { not: null } },
    data: { deletedAt: null },
  });

  await logActivity({
    userId: session.user?.id,
    userName: session.user?.name || session.user?.email,
    action: "RESTORE",
    entity: "installation",
    details: `${ids.length} installation(s) restaurée(s)`,
  });

  return NextResponse.json({ success: true, restored: ids.length });
}
