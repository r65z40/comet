import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createBackup, listBackups, getBackupSettings } from "@/lib/backup";
import { getCloudConfig, cloudTestConnection, CLOUD_SETTING_KEYS } from "@/lib/backup-cloud";
import { prisma } from "@/lib/db";

// GET /api/backup — list all backups + settings + cloud config
export async function GET() {
  const session = await auth();
  if (!session || session.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  try {
    const [backups, settings, cloudConfig] = await Promise.all([
      listBackups(),
      getBackupSettings(),
      getCloudConfig(),
    ]);

    // Mask sensitive cloud fields
    const maskedCloud = { ...cloudConfig };
    if (maskedCloud.s3SecretKey && maskedCloud.s3SecretKey.length > 4) {
      maskedCloud.s3SecretKey = "••••••••" + maskedCloud.s3SecretKey.slice(-4);
    }
    if (maskedCloud.ftpPassword && maskedCloud.ftpPassword.length > 4) {
      maskedCloud.ftpPassword = "••••••••" + maskedCloud.ftpPassword.slice(-4);
    }

    return NextResponse.json({ backups, settings, cloud: maskedCloud });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/backup — create a manual backup OR test cloud connection
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  // Check if this is a test connection request
  const contentType = req.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    try {
      const body = await req.json();
      if (body.action === "test_cloud") {
        const result = await cloudTestConnection(body.config);
        return NextResponse.json(result);
      }
    } catch {
      // Not a JSON body — proceed with backup creation
    }
  }

  try {
    const backup = await createBackup("manual");
    return NextResponse.json({ success: true, backup });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PUT /api/backup — update backup settings + cloud config
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
      ...CLOUD_SETTING_KEYS,
    ];

    const operations = [];
    for (const [key, value] of Object.entries(body)) {
      if (!allowedKeys.includes(key)) continue;
      // Skip masked values (don't overwrite secrets with mask)
      if (typeof value === "string" && value.startsWith("••••")) continue;
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
