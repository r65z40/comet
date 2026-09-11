import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { writeFile, mkdir, unlink } from "fs/promises";
import path from "path";
import { validateFileExtension } from "@/lib/upload-validation";

// Allow large uploads (500MB)
export const runtime = "nodejs";
export const maxDuration = 300;

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "knowledge");
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

const ALLOWED_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-excel",
  "application/vnd.ms-powerpoint",
  "text/plain",
  "text/csv",
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/zip",
]);

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
    return NextResponse.json({ error: "Fichier trop volumineux (max 50 Mo)" }, { status: 400 });
  }

  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ error: "Type de fichier non autorisé" }, { status: 400 });
  }

  const article = await prisma.kbArticle.findUnique({ where: { id: articleId } });
  if (!article) return NextResponse.json({ error: "Article non trouvé" }, { status: 404 });

  await mkdir(UPLOAD_DIR, { recursive: true });

  // Validate file extension
  const ext = validateFileExtension(file.name);
  if (!ext) {
    return NextResponse.json({ error: "Extension de fichier non autorisée" }, { status: 400 });
  }

  const rawExt = path.extname(file.name);
  const baseName = path.basename(file.name, rawExt).replace(/[^a-zA-Z0-9_-]/g, "_");
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
