import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { deleteBackup, getBackupPath, restoreBackup } from "@/lib/backup";
import fs from "fs/promises";

// GET /api/backup/[filename] — download a backup file
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  const session = await auth();
  if (!session || session.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  try {
    const { filename } = await params;
    const filepath = await getBackupPath(filename);
    const fileBuffer = await fs.readFile(filepath);
    const stat = await fs.stat(filepath);

    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": "application/gzip",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": stat.size.toString(),
      },
    });
  } catch (err) {
    const isNotFound = err instanceof Error && err.message.includes("ENOENT");
    console.error("Backup download error:", err);
    return NextResponse.json(
      { error: isNotFound ? "Fichier de sauvegarde introuvable" : "Erreur lors du téléchargement" },
      { status: isNotFound ? 404 : 500 },
    );
  }
}

// DELETE /api/backup/[filename] — delete a backup file
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  const session = await auth();
  if (!session || session.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  try {
    const { filename } = await params;
    await deleteBackup(filename);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Backup delete error:", err);
    return NextResponse.json({ error: "Erreur lors de la suppression" }, { status: 500 });
  }
}

// POST /api/backup/[filename] — restore from a backup file
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  const session = await auth();
  if (!session || session.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  try {
    const { filename } = await params;
    const { needsRestart, hasEnvKeys } = await restoreBackup(filename);
    return NextResponse.json({
      success: true,
      needsRestart,
      hasEnvKeys,
      message: needsRestart
        ? "Restauration complète. Redémarrez l'application pour appliquer les clés de chiffrement."
        : "Base de données restaurée avec succès",
    });
  } catch (err) {
    console.error("Backup restore error:", err);
    return NextResponse.json({ error: "Erreur lors de la restauration" }, { status: 500 });
  }
}
