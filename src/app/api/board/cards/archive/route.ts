import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { id, archived } = await req.json();
  if (!id || archived === undefined) {
    return NextResponse.json({ error: "id et archived requis" }, { status: 400 });
  }

  const card = await prisma.boardCard.update({
    where: { id },
    data: {
      archived,
      archivedAt: archived ? new Date() : null,
    },
  });

  // Log history
  await prisma.cardHistory.create({
    data: {
      cardId: id,
      userId: session.user?.id || null,
      userName: session.user?.name || null,
      action: "UPDATE",
      field: "archived",
      oldValue: archived ? "Non" : "Oui",
      newValue: archived ? "Oui" : "Non",
    },
  });

  // Notify assignees
  const fullCard = await prisma.boardCard.findUnique({ where: { id }, select: { title: true, assigneeId: true, assigneeIds: true } });
  if (fullCard && archived) {
    const assigneeIds: string[] = [];
    if (fullCard.assigneeId) assigneeIds.push(fullCard.assigneeId);
    if (fullCard.assigneeIds) {
      try {
        const extra = JSON.parse(fullCard.assigneeIds) as string[];
        extra.forEach((aid) => { if (!assigneeIds.includes(aid)) assigneeIds.push(aid); });
      } catch {}
    }

    for (const uid of assigneeIds) {
      if (uid !== session.user?.id) {
        await prisma.notification.create({
          data: {
            userId: uid,
            title: "Carte archivée",
            message: `${session.user?.name || "Un collaborateur"} a archivé la carte "${fullCard.title}"`,
            link: `/board?card=${id}`,
          },
        });
      }
    }
  }

  return NextResponse.json(card);
}

// GET archived cards
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const cards = await prisma.boardCard.findMany({
    where: { archived: true },
    include: {
      column: { select: { id: true, name: true } },
      client: { select: { id: true, name: true, logoUrl: true } },
      tags: { include: { tag: true } },
      _count: { select: { comments: true, attachments: true, checklist: true } },
    },
    orderBy: { archivedAt: "desc" },
  });

  return NextResponse.json(cards);
}
