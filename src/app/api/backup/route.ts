import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createBackup, listBackups, getBackupSettings } from "@/lib/backup";
import { prisma } from "@/lib/db";

// GET /api/backup — list all backups + settings
export async function GET() {
  const session = await auth();
  if (!session || session.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  try {
    const [backups, settings] = await Promise.all([
      listBackups(),
      getBackupSettings(),
    ]);

    return NextResponse.json({ backups, settings });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/backup — create a manual backup
export async function POST() {
  const session = await auth();
  if (!session || session.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  try {
    const backup = await createBackup("manual");
    return NextResponse.json({ success: true, backup });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PUT /api/backup — update backup settings
export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session || session.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const allowedKeys = [
      "backup_enabled",
      "backup_frequency",
      "backup_time",
      "backup_day",
      "backup_retention",
      "backup_notify_failure",
    ];

    const operations = [];
    for (const [key, value] of Object.entries(body)) {
      if (!allowedKeys.includes(key)) continue;
      operations.push(
        prisma.setting.upsert({
          where: { key },
          update: { value: String(value) },
          create: { key, value: String(value) },
        })
      );
    }

    await prisma.$transaction(operations);

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
