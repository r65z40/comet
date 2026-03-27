import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import fs from "fs/promises";
import path from "path";

const BACKUP_DIR = path.join(process.cwd(), "backups");

// POST /api/backup/upload — upload a backup file
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "Aucun fichier fourni" }, { status: 400 });
    }

    // Validate filename - only allow .sql, .gz, .sql.gz, .dump extensions
    const filename = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    if (!/\.(sql|gz|dump|sql\.gz|tar\.gz)$/i.test(filename)) {
      return NextResponse.json(
        { error: "Format non supporté. Formats acceptés : .sql, .gz, .sql.gz, .tar.gz, .dump" },
        { status: 400 }
      );
    }

    // Max 500MB
    if (file.size > 500 * 1024 * 1024) {
      return NextResponse.json({ error: "Fichier trop volumineux (max 500 Mo)" }, { status: 400 });
    }

    await fs.mkdir(BACKUP_DIR, { recursive: true });

    const buffer = Buffer.from(await file.arrayBuffer());
    const destPath = path.join(BACKUP_DIR, filename);

    // Check if file already exists
    try {
      await fs.access(destPath);
      return NextResponse.json({ error: "Un fichier avec ce nom existe déjà" }, { status: 409 });
    } catch {
      // File doesn't exist — good
    }

    await fs.writeFile(destPath, buffer);

    const sizeFormatted =
      file.size > 1024 * 1024
        ? `${(file.size / (1024 * 1024)).toFixed(1)} Mo`
        : `${(file.size / 1024).toFixed(0)} Ko`;

    return NextResponse.json({
      success: true,
      backup: {
        filename,
        size: file.size,
        sizeFormatted,
        createdAt: new Date().toISOString(),
        type: "manual",
        location: "local",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
