import { NextRequest, NextResponse } from "next/server";
import { readFile, stat } from "fs/promises";
import path from "path";
import { auth } from "@/lib/auth";
import { verifyPortalToken } from "@/lib/portal-auth";

const UPLOAD_ROOT = path.join(process.cwd(), "uploads");

const MIME_TYPES: Record<string, string> = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".mp4": "video/mp4",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".zip": "application/zip",
  ".gz": "application/gzip",
  ".txt": "text/plain",
};

// GET /uploads/[...path] — serve uploaded files (authenticated)
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const session = await auth();
  const portalUser = !session ? await verifyPortalToken() : null;
  if (!session && !portalUser) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const { path: segments } = await params;
  const filePath = path.join(UPLOAD_ROOT, ...segments);

  const resolved = path.resolve(filePath);
  if (!resolved.startsWith(UPLOAD_ROOT)) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  try {
    const fileStat = await stat(resolved);
    if (!fileStat.isFile()) {
      return NextResponse.json({ error: "Non trouvé" }, { status: 404 });
    }

    const content = await readFile(resolved);
    const ext = path.extname(resolved).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";

    return new NextResponse(content, {
      headers: {
        "Content-Type": contentType,
        "Content-Length": fileStat.size.toString(),
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "Fichier non trouvé" }, { status: 404 });
  }
}
