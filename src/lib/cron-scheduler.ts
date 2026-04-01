import { prisma } from "@/lib/db";
import { sendExpiryNotifications } from "@/lib/email";
import { createBackup, getBackupSettings, rotateBackups, sendBackupFailureNotification } from "@/lib/backup";
import { syncAllFromAtera } from "@/lib/atera";

// Paris timezone helpers
function getParisComponents() {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    weekday: "short",
  });
  const parts = formatter.formatToParts(now);
  const get = (type: string) => parts.find(p => p.type === type)?.value || "";
  return {
    year: parseInt(get("year")),
    month: parseInt(get("month")),
    day: parseInt(get("day")),
    hour: parseInt(get("hour")),
    minute: parseInt(get("minute")),
    weekday: get("weekday"),
  };
}

function getParisDayOfWeek(): number {
  const dayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return dayMap[getParisComponents().weekday] ?? 0;
}

function getParisDayOfMonth(): number {
  return getParisComponents().day;
}

function getParisDateString(): string {
  const c = getParisComponents();
  return `${c.year}-${String(c.month).padStart(2, "0")}-${String(c.day).padStart(2, "0")}`;
}

/**
 * Execute all cron jobs: email alerts + automatic backup.
 * Can be called from the API route or from the built-in scheduler.
 */
export async function executeCronJob(): Promise<{
  alerts: { sent?: boolean; skipped?: boolean; reason?: string; count?: number };
  backup: { done: boolean; reason?: string; filename?: string };
  ateraSync: { synced: number; errors: number };
}> {
  const pc = getParisComponents();
  const parisHour = pc.hour;
  const parisMinute = pc.minute;
  const parisTimeStr = `${String(parisHour).padStart(2, "0")}:${String(parisMinute).padStart(2, "0")}`;
  const todayStr = getParisDateString();

  let alertResult: { sent?: boolean; skipped?: boolean; reason?: string; count?: number } = { skipped: true };
  let backupResult: { done: boolean; reason?: string; filename?: string } = { done: false };

  // === Email Alerts ===
  try {
    const settingKeys = [
      "alert_enabled", "alert_frequency", "alert_day",
      "alert_time", "alert_types", "alert_thresholds",
    ];
    const settings = await prisma.setting.findMany({
      where: { key: { in: settingKeys } },
    });
    const config: Record<string, string> = {};
    for (const s of settings) config[s.key] = s.value;

    if (config.alert_enabled === "true") {
      const frequency = config.alert_frequency || "weekly";
      const alertDay = parseInt(config.alert_day || "1");
      const alertTime = config.alert_time || "08:00";
      const [targetHour, targetMinute] = alertTime.split(":").map(Number);

      const isTimeMatch = parisHour === targetHour && parisMinute >= targetMinute && parisMinute < targetMinute + 15;

      let dayMatch = true;
      if (frequency === "weekly") {
        dayMatch = getParisDayOfWeek() === alertDay;
      } else if (frequency === "monthly") {
        dayMatch = getParisDayOfMonth() === alertDay;
      }

      if (isTimeMatch && dayMatch) {
        const recentCutoff = new Date();
        recentCutoff.setHours(recentCutoff.getHours() - 36);
        const recentLogs = await prisma.syncLog.findMany({
          where: { type: "EMAIL_ALERT", status: "SUCCESS", startedAt: { gte: recentCutoff } },
        });
        const alreadySent = recentLogs.find(log => log.message?.includes(todayStr));

        if (!alreadySent) {
          const result = await sendExpiryNotifications();
          await prisma.syncLog.create({
            data: {
              type: "EMAIL_ALERT",
              status: result.sent ? "SUCCESS" : "SKIPPED",
              message: result.sent
                ? `${todayStr} - ${result.count} notification(s) envoyée(s)`
                : `${todayStr} - ${result.reason || "Aucune notification"}`,
              itemCount: result.sent ? (result.count ?? 0) : 0,
              startedAt: new Date(),
              completedAt: new Date(),
            },
          }).catch(() => {});
          alertResult = result;
        } else {
          alertResult = { skipped: true, reason: "Alerte déjà envoyée aujourd'hui" };
        }
      } else {
        alertResult = { skipped: true, reason: "Hors créneau" };
      }
    } else {
      alertResult = { skipped: true, reason: "Alertes désactivées" };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.syncLog.create({
      data: { type: "EMAIL_ALERT", status: "ERROR", message: `${todayStr} ${parisTimeStr} - ${message}`, startedAt: new Date(), completedAt: new Date() },
    }).catch(() => {});
    alertResult = { skipped: true, reason: message };
  }

  // === Automatic Backup ===
  try {
    backupResult = await runAutoBackup(parisHour, parisMinute, todayStr);
  } catch (backupErr) {
    const backupMsg = backupErr instanceof Error ? backupErr.message : String(backupErr);
    await prisma.syncLog.create({
      data: { type: "BACKUP", status: "ERROR", message: `${todayStr} - ${backupMsg}`, startedAt: new Date(), completedAt: new Date() },
    }).catch(() => {});
    backupResult = { done: false, reason: backupMsg };
  }

  // === Atera Bidirectional Sync ===
  let ateraSyncResult: { synced: number; errors: number; skipped?: boolean } = { synced: 0, errors: 0 };
  try {
    ateraSyncResult = await syncAllFromAtera();
    const statusMsg = ateraSyncResult.skipped
      ? "SKIPPED"
      : ateraSyncResult.errors > 0
        ? "PARTIAL"
        : "SUCCESS";
    const message = ateraSyncResult.skipped
      ? `${todayStr} ${parisTimeStr} - Atera non configuré ou désactivé`
      : `${todayStr} ${parisTimeStr} - Synced: ${ateraSyncResult.synced}, Errors: ${ateraSyncResult.errors}`;
    await prisma.syncLog.create({
      data: {
        type: "ATERA_SYNC",
        status: statusMsg,
        message,
        itemCount: ateraSyncResult.synced,
        startedAt: new Date(),
        completedAt: new Date(),
      },
    }).catch(() => {});
  } catch (ateraErr) {
    const ateraMsg = ateraErr instanceof Error ? ateraErr.message : String(ateraErr);
    await prisma.syncLog.create({
      data: {
        type: "ATERA_SYNC",
        status: "ERROR",
        message: `${todayStr} ${parisTimeStr} - ${ateraMsg}`,
        startedAt: new Date(),
        completedAt: new Date(),
      },
    }).catch(() => {});
  }

  return { alerts: alertResult, backup: backupResult, ateraSync: ateraSyncResult };
}

async function runAutoBackup(
  parisHour: number,
  parisMinute: number,
  todayStr: string
): Promise<{ done: boolean; reason?: string; filename?: string }> {
  const settings = await getBackupSettings();

  if (!settings.enabled) {
    return { done: false, reason: "Backup automatique désactivé" };
  }

  const [targetHour, targetMinute] = settings.time.split(":").map(Number);
  const isTimeMatch = parisHour === targetHour && parisMinute >= targetMinute && parisMinute < targetMinute + 15;

  if (!isTimeMatch) {
    return { done: false, reason: "Hors créneau backup" };
  }

  if (settings.frequency === "weekly") {
    if (getParisDayOfWeek() !== settings.day) return { done: false, reason: "Pas le bon jour pour le backup" };
  } else if (settings.frequency === "monthly") {
    if (getParisDayOfMonth() !== settings.day) return { done: false, reason: "Pas le bon jour du mois pour le backup" };
  }

  const recentCutoff = new Date();
  recentCutoff.setHours(recentCutoff.getHours() - 36);
  const recentLogs = await prisma.syncLog.findMany({
    where: { type: "BACKUP", status: "SUCCESS", startedAt: { gte: recentCutoff } },
  });
  if (recentLogs.find(log => log.message?.includes(todayStr))) {
    return { done: false, reason: "Backup déjà effectué aujourd'hui" };
  }

  try {
    const backup = await createBackup("auto");
    const deleted = await rotateBackups(settings.retention);

    await prisma.syncLog.create({
      data: {
        type: "BACKUP",
        status: "SUCCESS",
        message: `${todayStr} - Backup auto: ${backup.filename} (${backup.sizeFormatted})${deleted > 0 ? ` — ${deleted} ancien(s) supprimé(s)` : ""}`,
        startedAt: new Date(),
        completedAt: new Date(),
      },
    }).catch(() => {});

    return { done: true, filename: backup.filename };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    await prisma.syncLog.create({
      data: { type: "BACKUP", status: "ERROR", message: `${todayStr} - Échec backup auto: ${errMsg}`, startedAt: new Date(), completedAt: new Date() },
    }).catch(() => {});

    if (settings.notifyOnFailure) {
      await sendBackupFailureNotification(errMsg);
    }
    return { done: false, reason: errMsg };
  }
}

// Built-in scheduler — runs executeCronJob every 5 minutes
let schedulerStarted = false;

export function startCronScheduler() {
  if (schedulerStarted) return;
  schedulerStarted = true;

  const INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

  console.log("[cron-scheduler] Built-in cron scheduler started (every 5 min)");

  // Initial delay of 30 seconds to let the app fully start
  setTimeout(() => {
    // Run immediately once
    executeCronJob().catch(err => console.error("[cron-scheduler] Error:", err));

    // Then repeat every 5 minutes
    setInterval(() => {
      executeCronJob().catch(err => console.error("[cron-scheduler] Error:", err));
    }, INTERVAL_MS);
  }, 30_000);
}
