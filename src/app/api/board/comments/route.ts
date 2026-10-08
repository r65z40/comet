import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { createNotification } from "@/lib/notifications";
import { boardEvents } from "@/lib/board-events";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const body = await req.json();
  const { cardId, content } = body;

  if (!cardId || !content?.trim()) {
    return NextResponse.json({ error: "cardId et contenu requis" }, { status: 400 });
  }

  const card = await prisma.boardCard.findUnique({ where: { id: cardId } });
  if (!card) return NextResponse.json({ error: "Carte non trouvée" }, { status: 404 });

  const comment = await prisma.cardComment.create({
    data: {
      cardId,
      userId: session.user?.id || null,
      userName: session.user?.name || "Inconnu",
      content: content.trim(),
    },
  });

  // Log history
  await prisma.cardHistory.create({
    data: {
      cardId,
      userId: session.user?.id || null,
      userName: session.user?.name || null,
      action: "COMMENT",
      newValue: content.trim().substring(0, 100),
    },
  });

  // Notify all assignees (primary + multi-assignees) and creator
  const notifiedIds = new Set<string>();
  const allAssigneeIds: string[] = [];
  if (card.assigneeId) allAssigneeIds.push(card.assigneeId);
  if (card.assigneeIds) {
    try {
      const parsed = JSON.parse(card.assigneeIds) as string[];
      for (const id of parsed) {
        if (!allAssigneeIds.includes(id)) allAssigneeIds.push(id);
      }
    } catch {}
  }
  if (card.createdById) allAssigneeIds.push(card.createdById);

  for (const uid of allAssigneeIds) {
    if (uid === session.user?.id || notifiedIds.has(uid)) continue;
    notifiedIds.add(uid);
    await createNotification({
      userId: uid,
      type: "card_comment",
      title: "Nouveau commentaire",
      message: `${session.user?.name || "Un collaborateur"} a commenté sur "${card.title}"`,
      link: `/board?card=${cardId}`,
    });
  }

  // Notify @mentioned users
  const mentionRegex = /@([\w\s]+?)(?:​|$)/g;
  const mentions = [...content.matchAll(mentionRegex)].map((m) => m[1].trim());
  if (mentions.length > 0) {
    const mentionedUsers = await prisma.user.findMany({
      where: { name: { in: mentions } },
      select: { id: true, name: true },
    });
    const alreadyNotified = new Set([...notifiedIds, session.user?.id].filter(Boolean));
    for (const u of mentionedUsers) {
      if (!alreadyNotified.has(u.id)) {
        await createNotification({
          userId: u.id,
          type: "mention",
          title: "Vous avez été mentionné",
          message: `${session.user?.name || "Un collaborateur"} vous a mentionné dans "${card.title}"`,
          link: `/board?card=${cardId}`,
        });
      }
    }
  }

  boardEvents.emit({ type: "comment:create", cardId, userId: session.user?.id });

  return NextResponse.json(comment, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) return NextResponse.json({ error: "ID requis" }, { status: 400 });

  await prisma.cardComment.delete({ where: { id } });

  boardEvents.emit({ type: "comment:delete", userId: session.user?.id });

  return NextResponse.json({ success: true });
}
