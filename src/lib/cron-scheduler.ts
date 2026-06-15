import { prisma } from "@/lib/db";
import { sendExpiryNotifications } from "@/lib/email";
import { createBackup, getBackupSettings, rotateBackups, sendBackupFailureNotification } from "@/lib/backup";
import { purgeOldNotifications } from "@/lib/notifications";

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
          where: { type: "EMAIL_ALERT", status: "success", startedAt: { gte: recentCutoff } },
        });
        const alreadySent = recentLogs.find(log => log.message?.includes(todayStr));

        if (!alreadySent) {
          const result = await sendExpiryNotifications();
          await prisma.syncLog.create({
            data: {
              type: "EMAIL_ALERT",
              status: result.sent ? "success" : "skipped",
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
      data: { type: "EMAIL_ALERT", status: "error", message: `${todayStr} ${parisTimeStr} - ${message}`, startedAt: new Date(), completedAt: new Date() },
    }).catch(() => {});
    alertResult = { skipped: true, reason: message };
  }

  // === Oxibox daily snapshot + alerts (every run, de-duplicated internally) ===
  try {
    const oxiboxKey = await prisma.setting.findUnique({ where: { key: "oxibox_api_key" } });
    if (oxiboxKey?.value) {
      await runOxiboxJobs(todayStr);
    }
  } catch (err) {
    console.error("[cron-scheduler] Oxibox jobs error:", err);
  }

  // === Quota Alerts (after Oxibox snapshots) ===
  try {
    const { getQuotaAlertConfig, checkAndSendQuotaAlerts } = await import("@/lib/quota-alerts");
    const quotaConfig = await getQuotaAlertConfig();
    if (quotaConfig.enabled && quotaConfig.autoSend) {
      await checkAndSendQuotaAlerts(false);
    }
  } catch (err) {
    console.error("[cron-scheduler] Quota alerts error:", err);
  }

  // === Automatic Backup ===
  try {
    backupResult = await runAutoBackup(parisHour, parisMinute, todayStr);
  } catch (backupErr) {
    const backupMsg = backupErr instanceof Error ? backupErr.message : String(backupErr);
    await prisma.syncLog.create({
      data: { type: "BACKUP", status: "error", message: `${todayStr} - ${backupMsg}`, startedAt: new Date(), completedAt: new Date() },
    }).catch(() => {});
    backupResult = { done: false, reason: backupMsg };
  }

  // === Purge old read notifications (once per day at 3am) ===
  if (parisHour === 3 && parisMinute < 15) {
    try {
      const purged = await purgeOldNotifications(90);
      if (purged > 0) {
        console.log(`[cron-scheduler] Purged ${purged} old notifications`);
      }
    } catch (err) {
      console.error("[cron-scheduler] Notification purge error:", err);
    }
  }

  return { alerts: alertResult, backup: backupResult };
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
    where: { type: "BACKUP", status: "success", startedAt: { gte: recentCutoff } },
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
        status: "success",
        message: `${todayStr} - Backup auto: ${backup.filename} (${backup.sizeFormatted})${deleted > 0 ? ` — ${deleted} ancien(s) supprimé(s)` : ""}`,
        startedAt: new Date(),
        completedAt: new Date(),
      },
    }).catch(() => {});

    return { done: true, filename: backup.filename };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    await prisma.syncLog.create({
      data: { type: "BACKUP", status: "error", message: `${todayStr} - Échec backup auto: ${errMsg}`, startedAt: new Date(), completedAt: new Date() },
    }).catch(() => {});

    if (settings.notifyOnFailure) {
      await sendBackupFailureNotification(errMsg);
    }
    return { done: false, reason: errMsg };
  }
}

async function runOxiboxJobs(todayStr: string) {
  const { getOxiboxToken, getAllOxiboxAccounts, getOxiboxUsage } = await import("@/lib/oxibox");
  const token = await getOxiboxToken();
  if (!token) return;

  // De-duplicate: only run once per day
  const recentSnap = await prisma.syncLog.findFirst({
    where: { type: "OXIBOX_SNAPSHOT", status: "success", message: { contains: todayStr } },
  });
  if (recentSnap) return;

  let allAccounts;
  try {
    allAccounts = await getAllOxiboxAccounts(token);
  } catch { return; }

  if (allAccounts.length === 0) return;

  const today = new Date(todayStr + "T00:00:00.000Z");

  for (const account of allAccounts) {
    const orgId = account.organizationId || account.id;
    let quota: { allocatedQuota?: number; currentUsage?: number } = {};
    try {
      quota = await getOxiboxUsage(token, orgId);
    } catch {}

    await prisma.oxiboxSnapshot.upsert({
      where: { organizationId_date: { organizationId: orgId, date: today } },
      update: {
        status: account.status || "UNKNOWN",
        machineCount: account.machineCount ?? account.machines?.length ?? 0,
        ongoingBackup: account.ongoingBackup || false,
        allocatedQuota: quota.allocatedQuota ? BigInt(quota.allocatedQuota) : null,
        currentUsage: quota.currentUsage ? BigInt(quota.currentUsage) : null,
      },
      create: {
        organizationId: orgId,
        date: today,
        status: account.status || "UNKNOWN",
        machineCount: account.machineCount ?? account.machines?.length ?? 0,
        ongoingBackup: account.ongoingBackup || false,
        allocatedQuota: quota.allocatedQuota ? BigInt(quota.allocatedQuota) : null,
        currentUsage: quota.currentUsage ? BigInt(quota.currentUsage) : null,
      },
    }).catch(() => {});
  }

  await prisma.syncLog.create({
    data: { type: "OXIBOX_SNAPSHOT", status: "success", message: `${todayStr} - ${allAccounts.length} snapshot(s)`, itemCount: allAccounts.length, startedAt: new Date(), completedAt: new Date() },
  }).catch(() => {});

  // Check for ERROR accounts and send alerts
  const errorAccounts = allAccounts.filter((a) => a.status === "ERROR");
  if (errorAccounts.length === 0) return;

  const recentAlert = await prisma.syncLog.findFirst({
    where: { type: "OXIBOX_ALERT", status: "success", message: { contains: todayStr } },
  });
  if (recentAlert) return;

  try {
    const { sendEmail, getNotificationConfig } = await import("@/lib/email");
    const { notifyAdmins } = await import("@/lib/notifications");
    const { emails } = await getNotificationConfig();

    if (emails.length > 0) {
      const html = `
        <h2 style="color:#dc2626">⚠️ Alerte Sauvegardes Oxibox</h2>
        <p>${errorAccounts.length} compte(s) en erreur :</p>
        <ul>${errorAccounts.map((a) => `<li><strong>${a.organizationId || a.id}</strong> — ${a.machineCount ?? a.machines?.length ?? 0} machine(s)</li>`).join("")}</ul>
        <p style="margin-top:16px;font-size:12px;color:#6b7280">Vérifiez les détails sur la page Sauvegardes de Comet.</p>
      `;
      await sendEmail(emails, "🔴 Alerte Sauvegarde Oxibox — Comptes en erreur", html);
    }

    await notifyAdmins({
      type: "backup_error",
      title: "Alerte Sauvegarde Oxibox",
      message: `${errorAccounts.length} compte(s) en erreur : ${errorAccounts.map((a) => a.organizationId || a.id).join(", ")}`,
      link: "/backups",
    });
  } catch {}

  await prisma.syncLog.create({
    data: { type: "OXIBOX_ALERT", status: "success", message: `${todayStr} - ${errorAccounts.length} compte(s) en erreur`, itemCount: errorAccounts.length, startedAt: new Date(), completedAt: new Date() },
  }).catch(() => {});
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
