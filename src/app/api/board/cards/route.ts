import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (id) {
    const card = await prisma.boardCard.findUnique({
      where: { id },
      include: {
        column: { select: { id: true, name: true } },
        client: { select: { id: true, name: true } },
        contact: { select: { id: true, firstName: true, lastName: true } },
        tags: { include: { tag: true } },
        comments: { orderBy: { createdAt: "desc" } },
        attachments: { orderBy: { createdAt: "desc" } },
      },
    });

    if (!card) return NextResponse.json({ error: "Carte non trouvée" }, { status: 404 });
    return NextResponse.json(card);
  }

  return NextResponse.json({ error: "ID requis" }, { status: 400 });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const body = await req.json();
  const { columnId, title, description, priority, clientId, contactId, assigneeId, dueDate, links, tagIds } = body;

  if (!columnId || !title?.trim()) {
    return NextResponse.json({ error: "Colonne et titre requis" }, { status: 400 });
  }

  const maxPos = await prisma.boardCard.aggregate({
    where: { columnId },
    _max: { position: true },
  });
  const position = (maxPos._max.position ?? -1) + 1;

  const card = await prisma.boardCard.create({
    data: {
      columnId,
      title: title.trim(),
      description: description || null,
      priority: priority || 3,
      position,
      clientId: clientId || null,
      contactId: contactId || null,
      assigneeId: assigneeId || null,
      createdById: session.user?.id || null,
      dueDate: dueDate ? new Date(dueDate) : null,
      links: links ? JSON.stringify(links) : null,
      ...(tagIds?.length && {
        tags: {
          create: tagIds.map((tagId: string) => ({ tagId })),
        },
      }),
    },
    include: {
      client: { select: { id: true, name: true } },
      contact: { select: { id: true, firstName: true, lastName: true } },
      tags: { include: { tag: true } },
      _count: { select: { comments: true, attachments: true } },
    },
  });

  // Notify assignee if different from creator
  if (assigneeId && assigneeId !== session.user?.id) {
    await prisma.notification.create({
      data: {
        userId: assigneeId,
        title: "Nouvelle carte assignée",
        message: `${session.user?.name || "Un collaborateur"} vous a assigné la carte "${title.trim()}"`,
        link: `/board?card=${card.id}`,
      },
    });
  }

  return NextResponse.json(card, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const body = await req.json();
  const { id, title, description, priority, clientId, contactId, assigneeId, dueDate, links, tagIds } = body;

  if (!id) return NextResponse.json({ error: "ID requis" }, { status: 400 });

  const existingCard = await prisma.boardCard.findUnique({ where: { id } });
  if (!existingCard) return NextResponse.json({ error: "Carte non trouvée" }, { status: 404 });

  const card = await prisma.boardCard.update({
    where: { id },
    data: {
      ...(title !== undefined && { title: title.trim() }),
      ...(description !== undefined && { description }),
      ...(priority !== undefined && { priority }),
      ...(clientId !== undefined && { clientId: clientId || null }),
      ...(contactId !== undefined && { contactId: contactId || null }),
      ...(assigneeId !== undefined && { assigneeId: assigneeId || null }),
      ...(dueDate !== undefined && { dueDate: dueDate ? new Date(dueDate) : null }),
      ...(links !== undefined && { links: links ? JSON.stringify(links) : null }),
    },
    include: {
      client: { select: { id: true, name: true } },
      contact: { select: { id: true, firstName: true, lastName: true } },
      tags: { include: { tag: true } },
      _count: { select: { comments: true, attachments: true } },
    },
  });

  // Update tags if provided
  if (tagIds !== undefined) {
    await prisma.cardTagLink.deleteMany({ where: { cardId: id } });
    if (tagIds.length > 0) {
      await prisma.cardTagLink.createMany({
        data: tagIds.map((tagId: string) => ({ cardId: id, tagId })),
      });
    }
  }

  // Notify if assignee changed
  if (assigneeId && assigneeId !== existingCard.assigneeId && assigneeId !== session.user?.id) {
    await prisma.notification.create({
      data: {
        userId: assigneeId,
        title: "Carte assignée",
        message: `${session.user?.name || "Un collaborateur"} vous a assigné la carte "${card.title}"`,
        link: `/board?card=${card.id}`,
      },
    });
  }

  return NextResponse.json(card);
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) return NextResponse.json({ error: "ID requis" }, { status: 400 });

  await prisma.boardCard.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
