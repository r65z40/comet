import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";
import { prisma } from "@/lib/db";
import { sendEmail, getSmtpConfig, getNotificationConfig } from "@/lib/email";
import { cloudUpload, cloudDelete, cloudList, getCloudConfig } from "@/lib/backup-cloud";
import { getSettings } from "@/lib/settings";

const execAsync = promisify(exec);

const BACKUP_DIR = path.join(process.cwd(), "backups");
const UPLOADS_DIR = path.join(process.cwd(), "public", "uploads");

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
  const map = await getSettings([
    "backup_enabled",
    "backup_frequency",
    "backup_time",
    "backup_day",
    "backup_retention",
    "backup_notify_failure",
  ]);

  return {
    enabled: map.backup_enabled === "true",
    frequency: (map.backup_frequency as BackupSettings["frequency"]) || "daily",
    time: map.backup_time || "02:00",
    day: parseInt(map.backup_day || "1"),
    retention: parseInt(map.backup_retention || "7"),
    notifyOnFailure: map.backup_notify_failure !== "false",
  };
}

async function uploadsExist(): Promise<boolean> {
  try {
    const entries = await fs.readdir(UPLOADS_DIR, { recursive: true });
    return entries.length > 0;
  } catch {
    return false;
  }
}

export async function createBackup(type: "auto" | "manual" = "manual"): Promise<BackupInfo> {
  await ensureBackupDir();

  const dbUrl = getDbUrlForPgDump();
  if (!dbUrl) throw new Error("DATABASE_URL non configurée");

  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, "-").slice(0, 19);

  // Create a temp directory for assembling the backup
  const tmpDir = path.join(BACKUP_DIR, `_tmp_${timestamp}`);
  await fs.mkdir(tmpDir, { recursive: true });

  const sqlFile = path.join(tmpDir, "database.sql.gz");

  try {
    // 1. Dump the database (--clean generates DROP before CREATE for clean restore)
    await execAsync(`pg_dump --clean --if-exists --no-owner --no-privileges "${dbUrl}" | gzip > "${sqlFile}"`, {
      timeout: 300000, // 5 min max
    });

    const sqlStat = await fs.stat(sqlFile);
    if (sqlStat.size < 1024) {
      throw new Error(`Le fichier de backup SQL est trop petit (${sqlStat.size} octets) — probablement vide ou corrompu`);
    }

    // 2. Check if uploads exist and copy them
    const hasUploads = await uploadsExist();
    if (hasUploads) {
      await execAsync(`cp -r "${UPLOADS_DIR}" "${path.join(tmpDir, "uploads")}"`, {
        timeout: 120000,
      });
    }

    // 3. Create a tar.gz archive
    const filename = `backup_${type}_${timestamp}.tar.gz`;
    const filepath = path.join(BACKUP_DIR, filename);

    await execAsync(`tar -czf "${filepath}" -C "${tmpDir}" .`, {
      timeout: 300000,
    });

    const stat = await fs.stat(filepath);

    // Upload to cloud if configured
    let cloudUploaded = false;
    try {
      const cloudConfig = await getCloudConfig();
      if (cloudConfig.provider !== "none") {
        await cloudUpload(filepath, filename);
        cloudUploaded = true;
      }
    } catch (cloudErr) {
      const cloudMsg = cloudErr instanceof Error ? `${cloudErr.message}\n${cloudErr.stack}` : String(cloudErr);
      console.error(`[backup] Cloud upload failed for ${type}:`, cloudMsg);
      await prisma.activityLog.create({
        data: {
          action: "BACKUP",
          entity: "system",
          details: `Backup ${type} créé localement mais échec upload cloud: ${cloudMsg.slice(0, 500)}`,
        },
      }).catch(() => {});
    }

    // Log in activity
    const cloudLabel = cloudUploaded ? " + cloud" : "";
    const uploadsLabel = hasUploads ? " + fichiers" : "";
    await prisma.activityLog.create({
      data: {
        action: "BACKUP",
        entity: "system",
        details: `Backup ${type} créé: ${filename} (${formatSize(stat.size)})${uploadsLabel}${cloudLabel}`,
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
    throw err;
  } finally {
    // Cleanup temp directory
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

function isBackupFile(name: string): boolean {
  return name.startsWith("backup_") && (name.endsWith(".tar.gz") || name.endsWith(".sql.gz"));
}

export async function listBackups(): Promise<(BackupInfo & { location: "local" | "cloud" | "both" })[]> {
  await ensureBackupDir();

  // Local backups
  const localMap = new Map<string, BackupInfo & { location: "local" | "cloud" | "both" }>();
  const files = await fs.readdir(BACKUP_DIR);

  for (const file of files) {
    if (!isBackupFile(file)) continue;

    const filepath = path.join(BACKUP_DIR, file);
    const stat = await fs.stat(filepath);
    if (!stat.isFile()) continue;
    const type = file.startsWith("backup_auto_") ? "auto" : "manual";

    localMap.set(file, {
      filename: file,
      size: stat.size,
      sizeFormatted: formatSize(stat.size),
      createdAt: stat.mtime.toISOString(),
      type,
      location: "local",
    });
  }

  // Merge cloud backups
  try {
    const cloudConfig = await getCloudConfig();
    if (cloudConfig.provider !== "none") {
      const cloudFiles = await cloudList();
      for (const cf of cloudFiles) {
        if (localMap.has(cf.name)) {
          localMap.get(cf.name)!.location = "both";
        } else {
          const type = cf.name.startsWith("backup_auto_") ? "auto" : "manual";
          localMap.set(cf.name, {
            filename: cf.name,
            size: cf.size,
            sizeFormatted: formatSize(cf.size),
            createdAt: cf.lastModified.toISOString(),
            type: type as "auto" | "manual",
            location: "cloud",
          });
        }
      }
    }
  } catch {
    // Cloud unavailable — return local only
  }

  const backups = Array.from(localMap.values());
  backups.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return backups;
}

export async function deleteBackup(filename: string): Promise<void> {
  // Prevent path traversal
  const safe = path.basename(filename);
  if (!isBackupFile(safe)) {
    throw new Error("Nom de fichier invalide");
  }

  // Delete local file (may not exist if cloud-only)
  const filepath = path.join(BACKUP_DIR, safe);
  await fs.unlink(filepath).catch(() => {});

  // Delete from cloud
  await cloudDelete(safe).catch(() => {});

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
  if (!isBackupFile(safe)) {
    throw new Error("Nom de fichier invalide");
  }

  await ensureBackupDir();
  const filepath = path.join(BACKUP_DIR, safe);

  // Check if file exists locally
  try {
    await fs.access(filepath);
    return filepath;
  } catch {
    // Not found locally — try to download from cloud
    const { cloudDownload: dlFromCloud } = await import("@/lib/backup-cloud");
    await dlFromCloud(safe, filepath);
    return filepath;
  }
}

export async function restoreBackup(filename: string): Promise<void> {
  const filepath = await getBackupPath(filename);
  const dbUrl = getDbUrlForPgDump();
  if (!dbUrl) throw new Error("DATABASE_URL non configurée");

  // Safety: create a backup of current state before restoring
  try {
    await createBackup("auto");
  } catch (err) {
    console.error("Pre-restore safety backup failed:", err);
  }

  if (filepath.endsWith(".tar.gz")) {
    // New format: tar.gz with database.sql.gz + uploads/
    const tmpDir = path.join(BACKUP_DIR, `_restore_${Date.now()}`);
    await fs.mkdir(tmpDir, { recursive: true });

    try {
      await execAsync(`tar -xzf "${filepath}" -C "${tmpDir}"`, { timeout: 300000 });

      // Restore database
      const sqlFile = path.join(tmpDir, "database.sql.gz");
      const sqlExists = await fs.access(sqlFile).then(() => true).catch(() => false);
      if (sqlExists) {
        await execAsync(`gunzip -c "${sqlFile}" | psql --single-transaction "${dbUrl}"`, { timeout: 600000 });
      }

      // Restore uploads if present
      const uploadsBackup = path.join(tmpDir, "uploads");
      try {
        await fs.access(uploadsBackup);
        await fs.mkdir(UPLOADS_DIR, { recursive: true });
        await execAsync(`cp -r "${uploadsBackup}/"* "${UPLOADS_DIR}/"`, { timeout: 120000 });
      } catch {
        // No uploads in this backup
      }
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    }
  } else {
    // Legacy format: .sql.gz
    await execAsync(`gunzip -c "${filepath}" | psql --single-transaction "${dbUrl}"`, {
      timeout: 600000,
    });
  }

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
  const autoBackups = backups.filter((b) => b.type === "auto");

  let deleted = 0;

  // Count-based: keep only the N most recent auto backups
  if (autoBackups.length > retention) {
    const toDelete = autoBackups.slice(retention);
    for (const backup of toDelete) {
      await deleteBackup(backup.filename);
      deleted++;
    }
  }

  // Age-based: delete auto backups older than retention * 2 days (safety net)
  const maxAgeMs = retention * 2 * 24 * 60 * 60 * 1000;
  const cutoff = Date.now() - maxAgeMs;
  const remaining = (await listBackups()).filter((b) => b.type === "auto");
  for (const backup of remaining) {
    if (new Date(backup.createdAt).getTime() < cutoff) {
      await deleteBackup(backup.filename);
      deleted++;
    }
  }

  return deleted;
}

export async function sendBackupFailureNotification(error: string): Promise<void> {
  const smtpConfig = await getSmtpConfig();
  if (!smtpConfig) return;

  const { emails } = await getNotificationConfig();
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
