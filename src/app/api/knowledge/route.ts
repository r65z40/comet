import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// GET /api/knowledge — list articles (with optional filters)
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const categoryId = searchParams.get("categoryId");
  const search = searchParams.get("search");
  const visibility = searchParams.get("visibility");
  const published = searchParams.get("published");

  // Single article by ID
  if (id) {
    const article = await prisma.kbArticle.findUnique({
      where: { id },
      include: {
        category: true,
        attachments: { orderBy: { createdAt: "desc" } },
      },
    });
    if (!article) return NextResponse.json({ error: "Article non trouvé" }, { status: 404 });
    return NextResponse.json(article);
  }

  // List articles
  const where: Record<string, unknown> = {};
  if (categoryId) where.categoryId = categoryId;
  if (visibility) where.visibility = visibility;
  if (published === "true") where.published = true;
  if (published === "false") where.published = false;
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

  return NextResponse.json(articles);
}

// POST /api/knowledge — create article
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const body = await req.json();
  const { title, content, categoryId, visibility, published, clientIds } = body;

  if (!title?.trim()) {
    return NextResponse.json({ error: "Titre requis" }, { status: 400 });
  }

  let slug = slugify(title);
  const existing = await prisma.kbArticle.findUnique({ where: { slug } });
  if (existing) slug = `${slug}-${Date.now()}`;

  const article = await prisma.kbArticle.create({
    data: {
      title: title.trim(),
      slug,
      content: content || "",
      categoryId: categoryId || null,
      authorId: session.user?.id || null,
      visibility: visibility || "public",
      published: published ?? false,
      clientIds: clientIds ? JSON.stringify(clientIds) : null,
    },
    include: { category: true, attachments: true },
  });

  return NextResponse.json(article, { status: 201 });
}

// PUT /api/knowledge — update article
export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const body = await req.json();
  const { id, title, content, categoryId, visibility, published, clientIds } = body;

  if (!id) return NextResponse.json({ error: "ID requis" }, { status: 400 });

  const data: Record<string, unknown> = {};
  if (title !== undefined) {
    data.title = title.trim();
    let slug = slugify(title);
    const existing = await prisma.kbArticle.findFirst({ where: { slug, NOT: { id } } });
    if (existing) slug = `${slug}-${Date.now()}`;
    data.slug = slug;
  }
  if (content !== undefined) data.content = content;
  if (categoryId !== undefined) data.categoryId = categoryId || null;
  if (visibility !== undefined) data.visibility = visibility;
  if (published !== undefined) data.published = published;
  if (clientIds !== undefined) data.clientIds = clientIds ? JSON.stringify(clientIds) : null;

  const article = await prisma.kbArticle.update({
    where: { id },
    data,
    include: { category: true, attachments: true },
  });

  return NextResponse.json(article);
}

// DELETE /api/knowledge — delete article
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) return NextResponse.json({ error: "ID requis" }, { status: 400 });

  // Delete attachments files first
  const attachments = await prisma.kbAttachment.findMany({ where: { articleId: id } });
  const fs = await import("fs/promises");
  const path = await import("path");
  for (const att of attachments) {
    try {
      await fs.unlink(path.join(process.cwd(), "public", att.fileUrl));
    } catch { /* ignore */ }
  }

  await prisma.kbArticle.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
