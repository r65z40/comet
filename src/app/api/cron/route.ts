import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendExpiryNotifications } from "@/lib/email";

// Paris timezone helpers using Intl for reliable timezone handling
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
    weekday: get("weekday"), // "Mon", "Tue", etc.
  };
}

function getParisHour(): number {
  return getParisComponents().hour;
}

function getParisMinute(): number {
  return getParisComponents().minute;
}

function getParisDayOfWeek(): number {
  // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
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
 * GET /api/cron
 *
 * This endpoint should be called every minute (or every 5-10 minutes) by an external
 * scheduler (cron job, Docker healthcheck, Vercel cron, etc.).
 *
 * It checks the alert scheduling settings and sends notifications when conditions match.
 *
 * Optional: pass ?secret=YOUR_SECRET as query param for authentication.
 * Set CRON_SECRET env var to enable secret-based auth.
 */
export async function GET(req: NextRequest) {
  // Optional secret-based authentication
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const { searchParams } = new URL(req.url);
    const secret = searchParams.get("secret");
    if (secret !== cronSecret) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }
  }

  try {
    // Load alert settings from database
    const settingKeys = [
      "alert_enabled", "alert_frequency", "alert_day",
      "alert_time", "alert_types", "alert_thresholds",
    ];
    const settings = await prisma.setting.findMany({
      where: { key: { in: settingKeys } },
    });
    const config: Record<string, string> = {};
    for (const s of settings) config[s.key] = s.value;

    const parisHour = getParisHour();
    const parisMinute = getParisMinute();
    const parisTimeStr = `${String(parisHour).padStart(2, "0")}:${String(parisMinute).padStart(2, "0")}`;
    const todayStr = getParisDateString();

    // Helper to log all cron outcomes for debugging
    const logCron = async (status: string, message: string, itemCount = 0) => {
      await prisma.syncLog.create({
        data: {
          type: "EMAIL_ALERT",
          status,
          message: `${todayStr} ${parisTimeStr} - ${message}`,
          itemCount,
          startedAt: new Date(),
          completedAt: new Date(),
        },
      }).catch(() => {});
    };

    if (config.alert_enabled !== "true") {
      await logCron("SKIPPED", "Alertes désactivées");
      return NextResponse.json({ skipped: true, reason: "Alertes désactivées" });
    }

    const frequency = config.alert_frequency || "weekly";
    const alertDay = parseInt(config.alert_day || "1");
    const alertTime = config.alert_time || "08:00";
    const [targetHour, targetMinute] = alertTime.split(":").map(Number);

    // Check if current time matches the configured alert time (15-minute window for 5-min polling)
    const isTimeMatch =
      parisHour === targetHour &&
      parisMinute >= targetMinute &&
      parisMinute < targetMinute + 15;

    if (!isTimeMatch) {
      // Log only once per hour to avoid flooding (log when minute < 5, i.e. first cron call of the hour)
      if (parisMinute < 5) {
        await logCron("SKIPPED", `Hors créneau (heure: ${parisTimeStr}, cible: ${alertTime})`);
      }
      return NextResponse.json({
        skipped: true,
        reason: "Hors créneau",
        parisTime: parisTimeStr,
        targetTime: alertTime,
      });
    }

    // Check day-of-week / day-of-month depending on frequency
    if (frequency === "weekly") {
      const parisDow = getParisDayOfWeek();
      if (parisDow !== alertDay) {
        await logCron("SKIPPED", `Pas le bon jour (aujourd'hui: ${parisDow}, configuré: ${alertDay})`);
        return NextResponse.json({
          skipped: true,
          reason: `Pas le bon jour (aujourd'hui: ${parisDow}, configuré: ${alertDay})`,
        });
      }
    } else if (frequency === "monthly") {
      const parisDay = getParisDayOfMonth();
      if (parisDay !== alertDay) {
        await logCron("SKIPPED", `Pas le bon jour du mois (aujourd'hui: ${parisDay}, configuré: ${alertDay})`);
        return NextResponse.json({
          skipped: true,
          reason: `Pas le bon jour du mois (aujourd'hui: ${parisDay}, configuré: ${alertDay})`,
        });
      }
    }
    // "daily" frequency => no day check needed

    // Prevent duplicate sends: check if we already sent today (Paris time)
    // Check logs from last 36h to cover timezone edge cases
    const recentCutoff = new Date();
    recentCutoff.setHours(recentCutoff.getHours() - 36);
    const recentLogs = await prisma.syncLog.findMany({
      where: {
        type: "EMAIL_ALERT",
        status: "SUCCESS",
        startedAt: { gte: recentCutoff },
      },
    });
    // Check if any log's message contains today's Paris date
    const existingLog = recentLogs.find(log => log.message?.includes(todayStr));

    if (existingLog) {
      return NextResponse.json({
        skipped: true,
        reason: "Alerte déjà envoyée aujourd'hui",
        sentAt: existingLog.startedAt,
      });
    }

    // Send the notifications
    const result = await sendExpiryNotifications();

    // Log the result (include Paris date for duplicate detection)
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
    });

    return NextResponse.json({
      success: true,
      ...result,
      parisTime: `${String(parisHour).padStart(2, "0")}:${String(parisMinute).padStart(2, "0")}`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    // Log the error
    await prisma.syncLog.create({
      data: {
        type: "EMAIL_ALERT",
        status: "ERROR",
        message,
        startedAt: new Date(),
        completedAt: new Date(),
      },
    }).catch(() => {});

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
