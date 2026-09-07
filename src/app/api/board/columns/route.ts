import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { boardEvents } from "@/lib/board-events";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const showArchived = searchParams.get("archived") === "true";

  const columns = await prisma.boardColumn.findMany({
    orderBy: { position: "asc" },
    include: {
      cards: {
        where: { archived: showArchived },
        orderBy: { position: "asc" },
        include: {
          client: { select: { id: true, name: true, logoUrl: true } },
          contact: { select: { id: true, firstName: true, lastName: true } },
          tags: { select: { id: true, tag: { select: { id: true, name: true, color: true } } } },
          _count: {
            select: {
              comments: true,
              attachments: true,
              checklist: true,
            },
          },
          checklist: { select: { checked: true } },
        },
      },
    },
  });

  return NextResponse.json(columns);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const body = await req.json();
  const { name, color } = body;

  if (!name?.trim()) {
    return NextResponse.json({ error: "Le nom est requis" }, { status: 400 });
  }

  const maxPos = await prisma.boardColumn.aggregate({ _max: { position: true } });
  const position = (maxPos._max.position ?? -1) + 1;

  const column = await prisma.boardColumn.create({
    data: { name: name.trim(), color: color || "#3b82f6", position },
  });

  boardEvents.emit({ type: "column:create", columnId: column.id, userId: session.user?.id });

  return NextResponse.json(column, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const body = await req.json();

  // Batch reorder: accept { reorder: [{ id, position }, ...] }
  if (body.reorder && Array.isArray(body.reorder)) {
    await prisma.$transaction(
      body.reorder.map((item: { id: string; position: number }) =>
        prisma.boardColumn.update({
          where: { id: item.id },
          data: { position: item.position },
        })
      )
    );
    boardEvents.emit({ type: "column:update", userId: session.user?.id });
    return NextResponse.json({ success: true });
  }

  const { id, name, color, position } = body;

  if (!id) return NextResponse.json({ error: "ID requis" }, { status: 400 });

  const column = await prisma.boardColumn.update({
    where: { id },
    data: {
      ...(name !== undefined && { name: name.trim() }),
      ...(color !== undefined && { color }),
      ...(position !== undefined && { position }),
    },
  });

  boardEvents.emit({ type: "column:update", columnId: id, userId: session.user?.id });

  return NextResponse.json(column);
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  if (session.user?.role !== "ADMIN") return NextResponse.json({ error: "Accès refusé — seuls les administrateurs peuvent supprimer des colonnes" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) return NextResponse.json({ error: "ID requis" }, { status: 400 });

  const column = await prisma.boardColumn.findUnique({
    where: { id },
    include: { _count: { select: { cards: true } } },
  });
  if (!column) return NextResponse.json({ error: "Colonne introuvable" }, { status: 404 });

  await prisma.boardColumn.delete({ where: { id } });

  boardEvents.emit({ type: "column:delete", columnId: id, userId: session.user?.id });

  return NextResponse.json({ success: true, deletedCards: column._count.cards });
}
