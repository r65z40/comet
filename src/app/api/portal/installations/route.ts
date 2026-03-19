import { NextResponse } from "next/server";
import { verifyPortalToken } from "@/lib/portal-auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await verifyPortalToken();
  if (!session) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const installations = await prisma.installation.findMany({
    where: { clientId: session.clientId, deletedAt: null },
    include: {
      product: { select: { id: true, name: true, code: true } },
    },
    orderBy: { endDate: "asc" },
  });

  const portalSettings = await prisma.clientPortalSettings.findUnique({
    where: { clientId: session.clientId },
  });

  return NextResponse.json({ installations, portalSettings });
}
