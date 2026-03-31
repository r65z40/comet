import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { syncTicketToAtera, getAteraConfig } from "@/lib/atera";

// GET: List tickets with filters
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const priority = searchParams.get("priority");
  const clientId = searchParams.get("clientId");
  const search = searchParams.get("search");
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "50");

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (priority) where.priority = priority;
  if (clientId) where.clientId = clientId;
  if (search) {
    where.OR = [
      { title: { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } },
      { ticketNumber: { contains: search, mode: "insensitive" } },
    ];
  }

  const [tickets, total] = await Promise.all([
    prisma.ticket.findMany({
      where,
      include: {
        client: { select: { id: true, name: true, logoUrl: true } },
        clientUser: { select: { id: true, name: true, email: true } },
        _count: { select: { comments: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.ticket.count({ where }),
  ]);

  return NextResponse.json({ tickets, total, page, limit });
}

// POST: Create a new ticket (admin)
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  try {
    const body = await req.json();
    const { title, description, priority, type, impact, clientId, clientUserId, assignedTo } = body;

    if (!title || !description || !clientId) {
      return NextResponse.json({ error: "Titre, description et client requis" }, { status: 400 });
    }

    const ticket = await prisma.ticket.create({
      data: {
        title,
        description,
        priority: priority || "Low",
        type: type || "Incident",
        impact: impact || "NoImpact",
        clientId,
        clientUserId: clientUserId || null,
        assignedTo: assignedTo || null,
      },
    });

    // Sync to Atera if configured
    const config = await getAteraConfig();
    if (config?.enabled) {
      syncTicketToAtera(ticket.id).catch((err) =>
        console.error("Atera sync error:", err)
      );
    }

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: session.user?.id,
        userName: session.user?.name || "Admin",
        action: "CREATE",
        entity: "ticket",
        entityId: ticket.id,
        details: `Ticket créé : ${title}`,
      },
    });

    return NextResponse.json(ticket, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}
