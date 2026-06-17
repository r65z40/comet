import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createBackup, listBackups, getBackupSettings } from "@/lib/backup";
import { getCloudConfig, cloudTestConnection, CLOUD_SETTING_KEYS } from "@/lib/backup-cloud";
import { prisma } from "@/lib/db";
import { encrypt } from "@/lib/crypto";
import { invalidateSettingsCache } from "@/lib/settings";

const ENCRYPTED_BACKUP_KEYS = new Set(["cloud_s3_secret_key", "cloud_ftp_password"]);

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
      if (typeof value === "string" && value.startsWith("••••")) continue;
      const val = ENCRYPTED_BACKUP_KEYS.has(key) ? encrypt(String(value)) : String(value);
      operations.push(
        prisma.setting.upsert({
          where: { key },
          update: { value: val },
          create: { key, value: val },
        })
      );
    }

    await prisma.$transaction(operations);
    invalidateSettingsCache();

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
