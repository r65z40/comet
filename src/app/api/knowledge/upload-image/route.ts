import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { validateImageExtension } from "@/lib/upload-validation";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "knowledge", "images");

// POST /api/knowledge/upload-image — upload image for rich text editor
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "Fichier requis" }, { status: 400 });
  }

  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "Seules les images sont acceptées" }, { status: 400 });
  }

  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: "Image trop volumineuse (max 10 Mo)" }, { status: 400 });
  }

  await mkdir(UPLOAD_DIR, { recursive: true });

  // Validate image extension (reject .svg and other dangerous types)
  const ext = validateImageExtension(file.name);
  if (!ext) {
    return NextResponse.json({ error: "Extension de fichier non autorisée" }, { status: 400 });
  }

  const rawExt = path.extname(file.name);
  const baseName = path.basename(file.name, rawExt).replace(/[^a-zA-Z0-9_-]/g, "_");
  const uniqueName = `${Date.now()}-${baseName}${ext}`;
  const filePath = path.join(UPLOAD_DIR, uniqueName);

  const bytes = new Uint8Array(await file.arrayBuffer());
  await writeFile(filePath, bytes);

  return NextResponse.json({ url: `/uploads/knowledge/images/${uniqueName}` });
}
