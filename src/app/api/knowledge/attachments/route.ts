import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { writeFile, mkdir, unlink } from "fs/promises";
import path from "path";

// Allow large uploads (500MB)
export const runtime = "nodejs";
export const maxDuration = 300;

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "knowledge");
const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB

// POST /api/knowledge/attachments — upload attachment
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const articleId = formData.get("articleId") as string | null;

  if (!file || !articleId) {
    return NextResponse.json({ error: "Fichier et articleId requis" }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "Fichier trop volumineux (max 500 Mo)" }, { status: 400 });
  }

  const article = await prisma.kbArticle.findUnique({ where: { id: articleId } });
  if (!article) return NextResponse.json({ error: "Article non trouvé" }, { status: 404 });

  await mkdir(UPLOAD_DIR, { recursive: true });

  const ext = path.extname(file.name);
  const baseName = path.basename(file.name, ext).replace(/[^a-zA-Z0-9_-]/g, "_");
  const uniqueName = `${Date.now()}-${baseName}${ext}`;
  const filePath = path.join(UPLOAD_DIR, uniqueName);

  const bytes = new Uint8Array(await file.arrayBuffer());
  await writeFile(filePath, bytes);

  const attachment = await prisma.kbAttachment.create({
    data: {
      articleId,
      fileName: file.name,
      fileUrl: `/uploads/knowledge/${uniqueName}`,
      fileType: file.type,
      fileSize: file.size,
    },
  });

  return NextResponse.json(attachment, { status: 201 });
}

// DELETE /api/knowledge/attachments
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID requis" }, { status: 400 });

  const attachment = await prisma.kbAttachment.findUnique({ where: { id } });
  if (!attachment) return NextResponse.json({ error: "Pièce jointe non trouvée" }, { status: 404 });

  try {
    await unlink(path.join(process.cwd(), "public", attachment.fileUrl));
  } catch { /* File may already be deleted */ }

  await prisma.kbAttachment.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
