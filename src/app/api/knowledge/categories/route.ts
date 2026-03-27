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

// GET /api/knowledge/categories
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const categories = await prisma.kbCategory.findMany({
    orderBy: { position: "asc" },
    include: { _count: { select: { articles: true } } },
  });

  return NextResponse.json(categories);
}

// POST /api/knowledge/categories
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { name } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: "Nom requis" }, { status: 400 });

  let slug = slugify(name);
  const existing = await prisma.kbCategory.findUnique({ where: { slug } });
  if (existing) slug = `${slug}-${Date.now()}`;

  const maxPos = await prisma.kbCategory.aggregate({ _max: { position: true } });
  const position = (maxPos._max.position ?? -1) + 1;

  const category = await prisma.kbCategory.create({
    data: { name: name.trim(), slug, position },
  });

  return NextResponse.json(category, { status: 201 });
}

// PUT /api/knowledge/categories
export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { id, name } = await req.json();
  if (!id || !name?.trim()) return NextResponse.json({ error: "ID et nom requis" }, { status: 400 });

  let slug = slugify(name);
  const existing = await prisma.kbCategory.findFirst({ where: { slug, NOT: { id } } });
  if (existing) slug = `${slug}-${Date.now()}`;

  const category = await prisma.kbCategory.update({
    where: { id },
    data: { name: name.trim(), slug },
  });

  return NextResponse.json(category);
}

// DELETE /api/knowledge/categories
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID requis" }, { status: 400 });

  // Set articles in this category to uncategorized
  await prisma.kbArticle.updateMany({ where: { categoryId: id }, data: { categoryId: null } });
  await prisma.kbCategory.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
