import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const userId = session.user?.id;
  const isAdmin = session.user?.role === "ADMIN";

  const feeds = await prisma.calendarFeed.findMany({
    where: { enabled: true },
    orderBy: { createdAt: "asc" },
    include: {
      visibility: userId ? { where: { userId } } : false,
    },
  });

  const result = feeds.map(feed => {
    const vis = Array.isArray(feed.visibility) ? feed.visibility : [];
    const userHidden = vis.length > 0 ? vis[0].hidden : false;
    return {
      id: feed.id,
      name: feed.name,
      url: isAdmin ? feed.url : undefined,
      color: feed.color,
      enabled: feed.enabled,
      hidden: userHidden,
    };
  });

  return NextResponse.json({ feeds: result });
}

// Admin-only: list all feeds (including disabled)
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const body = await req.json();

  // User toggle visibility
  if (body.action === "toggle_visibility") {
    const { feedId, hidden } = body;
    if (!feedId) return NextResponse.json({ error: "feedId requis" }, { status: 400 });

    await prisma.calendarFeedVisibility.upsert({
      where: { userId_feedId: { userId: session.user!.id!, feedId } },
      update: { hidden: !!hidden },
      create: { userId: session.user!.id!, feedId, hidden: !!hidden },
    });

    return NextResponse.json({ success: true });
  }

  // Admin: create feed
  if (session.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

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
    data: { name, url, color: color || "#3b82f6" },
  });

  return NextResponse.json(feed, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  if (session.user?.role !== "ADMIN") return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const body = await req.json();
  const { id, name, url, color, enabled } = body;

  if (!id) return NextResponse.json({ error: "ID requis" }, { status: 400 });

  const existing = await prisma.calendarFeed.findUnique({ where: { id } });
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
  if (session.user?.role !== "ADMIN") return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID requis" }, { status: 400 });

  await prisma.calendarFeed.delete({ where: { id } }).catch(() => {});
  return NextResponse.json({ success: true });
}
