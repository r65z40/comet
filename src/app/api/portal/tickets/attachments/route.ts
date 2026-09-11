import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyPortalToken } from "@/lib/portal-auth";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { validateFileExtension } from "@/lib/upload-validation";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "tickets");
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = [
  "image/jpeg", "image/png", "image/gif", "image/webp",
  "application/pdf",
  "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain", "text/csv",
  "application/zip",
];

export async function POST(req: NextRequest) {
  const payload = await verifyPortalToken();
  if (!payload) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const ticketId = formData.get("ticketId") as string | null;

  if (!file || !ticketId) {
    return NextResponse.json({ error: "Fichier et ticketId requis" }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "Fichier trop volumineux (max 10 Mo)" }, { status: 400 });
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "Type de fichier non autorisé" }, { status: 400 });
  }

  // Verify ticket belongs to client
  const ticket = await prisma.ticket.findFirst({
    where: { id: ticketId, clientId: payload.clientId },
  });
  if (!ticket) return NextResponse.json({ error: "Ticket introuvable" }, { status: 404 });

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

  const attachment = await prisma.ticketAttachment.create({
    data: {
      ticketId,
      fileName: file.name,
      fileUrl: `/uploads/tickets/${uniqueName}`,
      fileType: file.type,
      fileSize: file.size,
      uploadedBy: payload.name,
    },
  });

  return NextResponse.json(attachment, { status: 201 });
}
