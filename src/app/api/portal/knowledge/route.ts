import { NextRequest, NextResponse } from "next/server";
import { verifyPortalToken } from "@/lib/portal-auth";
import { prisma } from "@/lib/db";

// GET /api/portal/knowledge — list published articles visible to this client
export async function GET(req: NextRequest) {
  const session = await verifyPortalToken();
  if (!session) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const categoryId = searchParams.get("categoryId");
  const search = searchParams.get("search");

  // Single article
  if (id) {
    const article = await prisma.kbArticle.findUnique({
      where: { id },
      include: {
        category: true,
        attachments: { orderBy: { createdAt: "desc" } },
      },
    });

    if (!article || !article.published) {
      return NextResponse.json({ error: "Article non trouvé" }, { status: 404 });
    }

    // Check visibility
    if (article.visibility === "internal") {
      return NextResponse.json({ error: "Article non trouvé" }, { status: 404 });
    }
    if (article.visibility === "client" && article.clientIds) {
      const allowedIds: string[] = JSON.parse(article.clientIds);
      if (!allowedIds.includes(session.clientId)) {
        return NextResponse.json({ error: "Article non trouvé" }, { status: 404 });
      }
    }

    return NextResponse.json(article);
  }

  // List articles — only published and visible
  const where: Record<string, unknown> = {
    published: true,
    visibility: { not: "internal" },
  };

  if (categoryId) where.categoryId = categoryId;
  if (search) {
    where.OR = [
      { title: { contains: search, mode: "insensitive" } },
      { content: { contains: search, mode: "insensitive" } },
    ];
  }

  const articles = await prisma.kbArticle.findMany({
    where,
    include: {
      category: true,
      _count: { select: { attachments: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  // Filter client-specific articles
  const filtered = articles.filter((a) => {
    if (a.visibility === "client" && a.clientIds) {
      const allowedIds: string[] = JSON.parse(a.clientIds);
      return allowedIds.includes(session.clientId);
    }
    return true;
  });

  // Get categories that have visible articles
  const categories = await prisma.kbCategory.findMany({
    orderBy: { position: "asc" },
  });

  return NextResponse.json({ articles: filtered, categories });
}
