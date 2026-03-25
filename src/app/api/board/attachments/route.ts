import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { writeFile, mkdir, unlink } from "fs/promises";
import path from "path";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "board");
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = [
  "image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml",
  "application/pdf",
  "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain", "text/csv",
];

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const cardId = formData.get("cardId") as string | null;

  if (!file || !cardId) {
    return NextResponse.json({ error: "Fichier et cardId requis" }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "Fichier trop volumineux (max 10 Mo)" }, { status: 400 });
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "Type de fichier non autorisé" }, { status: 400 });
  }

  // Verify card exists
  const card = await prisma.boardCard.findUnique({ where: { id: cardId } });
  if (!card) return NextResponse.json({ error: "Carte non trouvée" }, { status: 404 });

  await mkdir(UPLOAD_DIR, { recursive: true });

  // Generate unique filename
  const ext = path.extname(file.name);
  const baseName = path.basename(file.name, ext).replace(/[^a-zA-Z0-9_-]/g, "_");
  const uniqueName = `${Date.now()}-${baseName}${ext}`;
  const filePath = path.join(UPLOAD_DIR, uniqueName);

  const bytes = new Uint8Array(await file.arrayBuffer());
  await writeFile(filePath, bytes);

  const attachment = await prisma.cardAttachment.create({
    data: {
      cardId,
      fileName: file.name,
      fileUrl: `/uploads/board/${uniqueName}`,
      fileType: file.type,
      fileSize: file.size,
    },
  });

  return NextResponse.json(attachment, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) return NextResponse.json({ error: "ID requis" }, { status: 400 });

  const attachment = await prisma.cardAttachment.findUnique({ where: { id } });
  if (!attachment) return NextResponse.json({ error: "Pièce jointe non trouvée" }, { status: 404 });

  // Delete file from disk
  try {
    const filePath = path.join(process.cwd(), "public", attachment.fileUrl);
    await unlink(filePath);
  } catch {
    // File may already be deleted
  }

  await prisma.cardAttachment.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
