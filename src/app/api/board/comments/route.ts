import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { createNotification } from "@/lib/notifications";

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

  // Notify card assignee if they didn't write the comment
  if (card.assigneeId && card.assigneeId !== session.user?.id) {
    await createNotification({
      userId: card.assigneeId,
      type: "card_comment",
      title: "Nouveau commentaire",
      message: `${session.user?.name || "Un collaborateur"} a commenté sur "${card.title}"`,
      link: `/board?card=${cardId}`,
    });
  }

  // Also notify card creator if different from commenter and assignee
  if (card.createdById && card.createdById !== session.user?.id && card.createdById !== card.assigneeId) {
    await createNotification({
      userId: card.createdById,
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
    const alreadyNotified = new Set([session.user?.id, card.assigneeId, card.createdById].filter(Boolean));
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

  return NextResponse.json(comment, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) return NextResponse.json({ error: "ID requis" }, { status: 400 });

  await prisma.cardComment.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
