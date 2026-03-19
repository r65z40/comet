import { NextResponse } from "next/server";
import { verifyPortalToken } from "@/lib/portal-auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await verifyPortalToken();
  if (!session) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const client = await prisma.client.findUnique({
    where: { id: session.clientId },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      logoUrl: true,
      city: true,
      portalSettings: true,
    },
  });

  if (!client) {
    return NextResponse.json({ error: "Client non trouvé" }, { status: 404 });
  }

  return NextResponse.json({
    user: { id: session.sub, name: session.name, email: session.email },
    client,
    portalSettings: client.portalSettings,
  });
}
