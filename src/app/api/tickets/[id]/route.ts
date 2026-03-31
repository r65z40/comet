import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { syncTicketToAtera, getAteraConfig } from "@/lib/atera";

// GET: Get single ticket with comments
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { id } = await params;

  const ticket = await prisma.ticket.findUnique({
    where: { id },
    include: {
      client: { select: { id: true, name: true, logoUrl: true, email: true } },
      clientUser: { select: { id: true, name: true, email: true } },
      comments: { orderBy: { createdAt: "asc" } },
      attachments: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!ticket) {
    return NextResponse.json({ error: "Ticket introuvable" }, { status: 404 });
  }

  return NextResponse.json(ticket);
}

// PUT: Update ticket
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  const { title, description, priority, status, type, impact, assignedTo } = body;

  const data: Record<string, unknown> = {};
  if (title !== undefined) data.title = title;
  if (description !== undefined) data.description = description;
  if (priority !== undefined) data.priority = priority;
  if (type !== undefined) data.type = type;
  if (impact !== undefined) data.impact = impact;
  if (assignedTo !== undefined) data.assignedTo = assignedTo;

  if (status !== undefined) {
    data.status = status;
    if (status === "Resolved") data.resolvedAt = new Date();
    if (status === "Closed") data.closedAt = new Date();
  }

  const ticket = await prisma.ticket.update({
    where: { id },
    data,
  });

  // Sync to Atera
  const config = await getAteraConfig();
  if (config?.enabled && ticket.ateraId) {
    syncTicketToAtera(ticket.id).catch((err) =>
      console.error("Atera sync error:", err)
    );
  }

  await prisma.activityLog.create({
    data: {
      userId: session.user?.id,
      userName: session.user?.name || "Admin",
      action: "UPDATE",
      entity: "ticket",
      entityId: ticket.id,
      details: `Ticket modifié : ${ticket.title}`,
    },
  });

  return NextResponse.json(ticket);
}

// DELETE: Delete ticket
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { id } = await params;

  const ticket = await prisma.ticket.findUnique({ where: { id } });
  if (!ticket) return NextResponse.json({ error: "Ticket introuvable" }, { status: 404 });

  await prisma.ticket.delete({ where: { id } });

  await prisma.activityLog.create({
    data: {
      userId: session.user?.id,
      userName: session.user?.name || "Admin",
      action: "DELETE",
      entity: "ticket",
      entityId: id,
      details: `Ticket supprimé : ${ticket.title}`,
    },
  });

  return NextResponse.json({ success: true });
}
