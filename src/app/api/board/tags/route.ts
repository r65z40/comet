import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { boardEvents } from "@/lib/board-events";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const tags = await prisma.cardTag.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { cards: true } } },
  });

  return NextResponse.json(tags);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const body = await req.json();
  const { name, color } = body;

  if (!name?.trim()) {
    return NextResponse.json({ error: "Le nom est requis" }, { status: 400 });
  }

  const existing = await prisma.cardTag.findUnique({ where: { name: name.trim() } });
  if (existing) return NextResponse.json({ error: "Ce tag existe déjà" }, { status: 409 });

  const tag = await prisma.cardTag.create({
    data: { name: name.trim(), color: color || "#6b7280" },
  });

  boardEvents.emit({ type: "tag:update", userId: session.user?.id });

  return NextResponse.json(tag, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) return NextResponse.json({ error: "ID requis" }, { status: 400 });

  await prisma.cardTag.delete({ where: { id } });

  boardEvents.emit({ type: "tag:update", userId: session.user?.id });

  return NextResponse.json({ success: true });
}
