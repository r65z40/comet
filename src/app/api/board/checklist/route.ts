import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { boardEvents } from "@/lib/board-events";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const cardId = searchParams.get("cardId");
  if (!cardId) return NextResponse.json({ error: "cardId requis" }, { status: 400 });

  const items = await prisma.cardChecklistItem.findMany({
    where: { cardId },
    orderBy: { position: "asc" },
  });

  return NextResponse.json(items);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { cardId, text } = await req.json();
  if (!cardId || !text?.trim()) {
    return NextResponse.json({ error: "cardId et text requis" }, { status: 400 });
  }

  const maxPos = await prisma.cardChecklistItem.aggregate({
    where: { cardId },
    _max: { position: true },
  });

  const item = await prisma.cardChecklistItem.create({
    data: {
      cardId,
      text: text.trim(),
      position: (maxPos._max.position ?? -1) + 1,
    },
  });

  boardEvents.emit({ type: "checklist:update", cardId, userId: session.user?.id });

  return NextResponse.json(item, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { id, text, checked } = await req.json();
  if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });

  const item = await prisma.cardChecklistItem.update({
    where: { id },
    data: {
      ...(text !== undefined && { text: text.trim() }),
      ...(checked !== undefined && { checked }),
    },
  });

  boardEvents.emit({ type: "checklist:update", userId: session.user?.id });

  return NextResponse.json(item);
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });

  await prisma.cardChecklistItem.delete({ where: { id } });

  boardEvents.emit({ type: "checklist:update", userId: session.user?.id });

  return NextResponse.json({ success: true });
}
