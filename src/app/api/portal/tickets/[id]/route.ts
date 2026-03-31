import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyPortalToken } from "@/lib/portal-auth";

// GET: Get single ticket with comments (client view - no internal comments)
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const payload = await verifyPortalToken();
  if (!payload) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { id } = await params;

  const ticket = await prisma.ticket.findFirst({
    where: { id, clientId: payload.clientId },
    include: {
      comments: {
        where: { isInternal: false },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!ticket) {
    return NextResponse.json({ error: "Ticket introuvable" }, { status: 404 });
  }

  return NextResponse.json(ticket);
}
