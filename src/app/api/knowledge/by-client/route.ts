import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

// GET /api/knowledge/by-client?clientId=xxx — articles assigned to a client
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const clientId = new URL(req.url).searchParams.get("clientId");
  if (!clientId) return NextResponse.json({ articles: [] });

  // Find articles where clientIds JSON contains this client
  const allArticles = await prisma.kbArticle.findMany({
    where: { clientIds: { not: null } },
    select: { id: true, title: true, updatedAt: true, clientIds: true, category: { select: { name: true } } },
    orderBy: { updatedAt: "desc" },
  });

  const articles = allArticles.filter(a => {
    if (!a.clientIds) return false;
    try {
      const ids: string[] = JSON.parse(a.clientIds);
      return ids.includes(clientId);
    } catch { return false; }
  });

  return NextResponse.json({ articles });
}
