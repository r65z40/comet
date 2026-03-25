import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

// Move a card to a different column (and/or reorder within column)
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const body = await req.json();
  const { cardId, targetColumnId, targetPosition } = body;

  if (!cardId || !targetColumnId || targetPosition === undefined) {
    return NextResponse.json({ error: "cardId, targetColumnId et targetPosition requis" }, { status: 400 });
  }

  const card = await prisma.boardCard.findUnique({ where: { id: cardId } });
  if (!card) return NextResponse.json({ error: "Carte non trouvée" }, { status: 404 });

  const sourceColumnId = card.columnId;
  const sourcePosition = card.position;

  await prisma.$transaction(async (tx) => {
    // If moving within the same column
    if (sourceColumnId === targetColumnId) {
      if (targetPosition > sourcePosition) {
        // Moving down: shift cards between old and new position up
        await tx.boardCard.updateMany({
          where: {
            columnId: sourceColumnId,
            position: { gt: sourcePosition, lte: targetPosition },
          },
          data: { position: { decrement: 1 } },
        });
      } else if (targetPosition < sourcePosition) {
        // Moving up: shift cards between new and old position down
        await tx.boardCard.updateMany({
          where: {
            columnId: sourceColumnId,
            position: { gte: targetPosition, lt: sourcePosition },
          },
          data: { position: { increment: 1 } },
        });
      }
    } else {
      // Moving to different column
      // Close gap in source column
      await tx.boardCard.updateMany({
        where: {
          columnId: sourceColumnId,
          position: { gt: sourcePosition },
        },
        data: { position: { decrement: 1 } },
      });

      // Make room in target column
      await tx.boardCard.updateMany({
        where: {
          columnId: targetColumnId,
          position: { gte: targetPosition },
        },
        data: { position: { increment: 1 } },
      });
    }

    // Move the card
    await tx.boardCard.update({
      where: { id: cardId },
      data: { columnId: targetColumnId, position: targetPosition },
    });
  });

  // If column changed, log history and notify
  if (sourceColumnId !== targetColumnId) {
    const [sourceColumn, targetColumn] = await Promise.all([
      prisma.boardColumn.findUnique({ where: { id: sourceColumnId }, select: { name: true } }),
      prisma.boardColumn.findUnique({ where: { id: targetColumnId }, select: { name: true } }),
    ]);

    await prisma.cardHistory.create({
      data: {
        cardId,
        userId: session.user?.id || null,
        userName: session.user?.name || null,
        action: "MOVE",
        field: "column",
        oldValue: sourceColumn?.name || null,
        newValue: targetColumn?.name || null,
      },
    });

    if (card.assigneeId && card.assigneeId !== session.user?.id && targetColumn) {
      await prisma.notification.create({
        data: {
          userId: card.assigneeId,
          title: "Carte déplacée",
          message: `${session.user?.name || "Un collaborateur"} a déplacé "${card.title}" vers "${targetColumn.name}"`,
          link: `/board?card=${cardId}`,
        },
      });
    }
  }

  return NextResponse.json({ success: true });
}
