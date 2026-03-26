import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const views = await prisma.boardView.findMany({
    where: { userId: session.user?.id || "" },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(views);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { name, filters } = await req.json();
  if (!name?.trim()) {
    return NextResponse.json({ error: "Nom requis" }, { status: 400 });
  }

  const view = await prisma.boardView.create({
    data: {
      name: name.trim(),
      userId: session.user?.id || "",
      filters: JSON.stringify(filters || {}),
    },
  });

  return NextResponse.json(view, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { id, name, filters } = await req.json();
  if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });

  const view = await prisma.boardView.update({
    where: { id },
    data: {
      ...(name !== undefined && { name: name.trim() }),
      ...(filters !== undefined && { filters: JSON.stringify(filters) }),
    },
  });

  return NextResponse.json(view);
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });

  await prisma.boardView.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
