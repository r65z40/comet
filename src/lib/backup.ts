import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";
import { prisma } from "@/lib/db";
import { sendEmail, getSmtpConfig } from "@/lib/email";

const execAsync = promisify(exec);

const BACKUP_DIR = path.join(process.cwd(), "backups");

export interface BackupInfo {
  filename: string;
  size: number;
  sizeFormatted: string;
  createdAt: string;
  type: "auto" | "manual";
}

export interface BackupSettings {
  enabled: boolean;
  frequency: "daily" | "weekly" | "monthly";
  time: string;
  day: number;
  retention: number;
  notifyOnFailure: boolean;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} Go`;
}

function getDbUrlForPgDump(): string {
  const raw = process.env.DATABASE_URL || "";
  // Strip Prisma query params
  return raw.split("?")[0];
}

export async function ensureBackupDir(): Promise<void> {
  await fs.mkdir(BACKUP_DIR, { recursive: true });
}

export async function getBackupSettings(): Promise<BackupSettings> {
  const keys = [
    "backup_enabled",
    "backup_frequency",
    "backup_time",
    "backup_day",
    "backup_retention",
    "backup_notify_failure",
  ];
  const settings = await prisma.setting.findMany({
    where: { key: { in: keys } },
  });
  const map: Record<string, string> = {};
  for (const s of settings) map[s.key] = s.value;

  return {
    enabled: map.backup_enabled === "true",
    frequency: (map.backup_frequency as BackupSettings["frequency"]) || "daily",
    time: map.backup_time || "02:00",
    day: parseInt(map.backup_day || "1"),
    retention: parseInt(map.backup_retention || "7"),
    notifyOnFailure: map.backup_notify_failure !== "false",
  };
}

export async function createBackup(type: "auto" | "manual" = "manual"): Promise<BackupInfo> {
  await ensureBackupDir();

  const dbUrl = getDbUrlForPgDump();
  if (!dbUrl) throw new Error("DATABASE_URL non configurée");

  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const filename = `backup_${type}_${timestamp}.sql.gz`;
  const filepath = path.join(BACKUP_DIR, filename);

  try {
    await execAsync(`pg_dump "${dbUrl}" | gzip > "${filepath}"`, {
      timeout: 300000, // 5 min max
    });

    const stat = await fs.stat(filepath);

    // Verify the backup is not empty
    if (stat.size < 100) {
      await fs.unlink(filepath).catch(() => {});
      throw new Error("Le fichier de backup est vide ou corrompu");
    }

    // Log in activity
    await prisma.activityLog.create({
      data: {
        action: "BACKUP",
        entity: "system",
        details: `Backup ${type} créé: ${filename} (${formatSize(stat.size)})`,
      },
    }).catch(() => {});

    return {
      filename,
      size: stat.size,
      sizeFormatted: formatSize(stat.size),
      createdAt: now.toISOString(),
      type,
    };
  } catch (err) {
    // Clean up failed backup file
    await fs.unlink(filepath).catch(() => {});
    throw err;
  }
}

export async function listBackups(): Promise<BackupInfo[]> {
  await ensureBackupDir();

  const files = await fs.readdir(BACKUP_DIR);
  const backups: BackupInfo[] = [];

  for (const file of files) {
    if (!file.startsWith("backup_") || !file.endsWith(".sql.gz")) continue;

    const filepath = path.join(BACKUP_DIR, file);
    const stat = await fs.stat(filepath);

    const type = file.startsWith("backup_auto_") ? "auto" : "manual";

    backups.push({
      filename: file,
      size: stat.size,
      sizeFormatted: formatSize(stat.size),
      createdAt: stat.mtime.toISOString(),
      type,
    });
  }

  // Sort by date descending (newest first)
  backups.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return backups;
}

export async function deleteBackup(filename: string): Promise<void> {
  // Prevent path traversal
  const safe = path.basename(filename);
  if (!safe.startsWith("backup_") || !safe.endsWith(".sql.gz")) {
    throw new Error("Nom de fichier invalide");
  }

  const filepath = path.join(BACKUP_DIR, safe);
  await fs.unlink(filepath);

  await prisma.activityLog.create({
    data: {
      action: "DELETE",
      entity: "system",
      details: `Backup supprimé: ${safe}`,
    },
  }).catch(() => {});
}

export async function getBackupPath(filename: string): Promise<string> {
  const safe = path.basename(filename);
  if (!safe.startsWith("backup_") || !safe.endsWith(".sql.gz")) {
    throw new Error("Nom de fichier invalide");
  }

  const filepath = path.join(BACKUP_DIR, safe);
  await fs.access(filepath); // throws if not found
  return filepath;
}

export async function restoreBackup(filename: string): Promise<void> {
  const filepath = await getBackupPath(filename);
  const dbUrl = getDbUrlForPgDump();
  if (!dbUrl) throw new Error("DATABASE_URL non configurée");

  // Restore: decompress and pipe to psql
  await execAsync(`gunzip -c "${filepath}" | psql "${dbUrl}"`, {
    timeout: 600000, // 10 min max
  });

  await prisma.activityLog.create({
    data: {
      action: "RESTORE",
      entity: "system",
      details: `Base de données restaurée depuis: ${path.basename(filepath)}`,
    },
  }).catch(() => {});
}

export async function rotateBackups(retention: number): Promise<number> {
  const backups = await listBackups();
  // Only rotate auto backups
  const autoBackups = backups.filter((b) => b.type === "auto");

  let deleted = 0;
  if (autoBackups.length > retention) {
    const toDelete = autoBackups.slice(retention);
    for (const backup of toDelete) {
      await deleteBackup(backup.filename);
      deleted++;
    }
  }

  return deleted;
}

export async function sendBackupFailureNotification(error: string): Promise<void> {
  const smtpConfig = await getSmtpConfig();
  if (!smtpConfig) return;

  // Get notification emails from settings
  const setting = await prisma.setting.findUnique({
    where: { key: "notification_emails" },
  });
  if (!setting?.value) return;

  const emails = setting.value.split(",").map((e) => e.trim()).filter(Boolean);
  if (emails.length === 0) return;

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
      <h2 style="color:#ef4444">⚠ Échec du backup automatique</h2>
      <p style="color:#64748b">Le backup automatique de la base de données COMET CEDELIA a échoué.</p>
      <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px;margin:16px 0">
        <p style="color:#991b1b;margin:0;font-family:monospace;font-size:13px">${error}</p>
      </div>
      <p style="color:#64748b;font-size:13px">
        Date: ${new Date().toLocaleString("fr-FR", { timeZone: "Europe/Paris" })}
      </p>
      <p style="color:#94a3b8;font-size:12px;margin-top:24px">
        Email envoyé automatiquement par COMET CEDELIA
      </p>
    </div>
  `;

  await sendEmail(emails, "[COMET] Échec du backup automatique", html).catch(() => {});
}
