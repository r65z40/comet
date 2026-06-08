import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const feeds = await prisma.calendarFeed.findMany({
    where: { userId: session.user?.id },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ feeds });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const body = await req.json();
  const { name, url, color } = body;

  if (!name || !url) {
    return NextResponse.json({ error: "Nom et URL requis" }, { status: 400 });
  }

  try {
    new URL(url);
  } catch {
    return NextResponse.json({ error: "URL invalide" }, { status: 400 });
  }

  const feed = await prisma.calendarFeed.create({
    data: {
      userId: session.user!.id!,
      name,
      url,
      color: color || "#3b82f6",
    },
  });

  return NextResponse.json(feed, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const body = await req.json();
  const { id, name, url, color, enabled } = body;

  if (!id) return NextResponse.json({ error: "ID requis" }, { status: 400 });

  const existing = await prisma.calendarFeed.findFirst({
    where: { id, userId: session.user?.id },
  });
  if (!existing) return NextResponse.json({ error: "Non trouvé" }, { status: 404 });

  if (url) {
    try {
      new URL(url);
    } catch {
      return NextResponse.json({ error: "URL invalide" }, { status: 400 });
    }
  }

  const feed = await prisma.calendarFeed.update({
    where: { id },
    data: {
      ...(name !== undefined && { name }),
      ...(url !== undefined && { url }),
      ...(color !== undefined && { color }),
      ...(enabled !== undefined && { enabled }),
    },
  });

  return NextResponse.json(feed);
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID requis" }, { status: 400 });

  const existing = await prisma.calendarFeed.findFirst({
    where: { id, userId: session.user?.id },
  });
  if (!existing) return NextResponse.json({ error: "Non trouvé" }, { status: 404 });

  await prisma.calendarFeed.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
