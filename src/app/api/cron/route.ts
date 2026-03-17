import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendExpiryNotifications } from "@/lib/email";

// Paris timezone helper
function getParisTime(): Date {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Paris" }));
}

function getParisHour(): number {
  return getParisTime().getHours();
}

function getParisMinute(): number {
  return getParisTime().getMinutes();
}

function getParisDayOfWeek(): number {
  // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  return getParisTime().getDay();
}

function getParisDayOfMonth(): number {
  return getParisTime().getDate();
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

    if (config.alert_enabled !== "true") {
      return NextResponse.json({ skipped: true, reason: "Alertes désactivées" });
    }

    const frequency = config.alert_frequency || "weekly";
    const alertDay = parseInt(config.alert_day || "1");
    const alertTime = config.alert_time || "08:00";
    const [targetHour, targetMinute] = alertTime.split(":").map(Number);

    const parisHour = getParisHour();
    const parisMinute = getParisMinute();

    // Check if current time matches the configured alert time (10-minute window)
    const isTimeMatch =
      parisHour === targetHour &&
      parisMinute >= targetMinute &&
      parisMinute < targetMinute + 10;

    if (!isTimeMatch) {
      return NextResponse.json({
        skipped: true,
        reason: "Hors créneau",
        parisTime: `${String(parisHour).padStart(2, "0")}:${String(parisMinute).padStart(2, "0")}`,
        targetTime: alertTime,
      });
    }

    // Check day-of-week / day-of-month depending on frequency
    if (frequency === "weekly") {
      const parisDow = getParisDayOfWeek();
      if (parisDow !== alertDay) {
        return NextResponse.json({
          skipped: true,
          reason: `Pas le bon jour (aujourd'hui: ${parisDow}, configuré: ${alertDay})`,
        });
      }
    } else if (frequency === "monthly") {
      const parisDay = getParisDayOfMonth();
      if (parisDay !== alertDay) {
        return NextResponse.json({
          skipped: true,
          reason: `Pas le bon jour du mois (aujourd'hui: ${parisDay}, configuré: ${alertDay})`,
        });
      }
    }
    // "daily" frequency => no day check needed

    // Prevent duplicate sends: check if we already sent today
    const todayStr = getParisTime().toISOString().split("T")[0];
    const existingLog = await prisma.syncLog.findFirst({
      where: {
        type: "EMAIL_ALERT",
        status: "SUCCESS",
        startedAt: { gte: new Date(todayStr + "T00:00:00Z") },
      },
    });

    if (existingLog) {
      return NextResponse.json({
        skipped: true,
        reason: "Alerte déjà envoyée aujourd'hui",
        sentAt: existingLog.startedAt,
      });
    }

    // Send the notifications
    const result = await sendExpiryNotifications();

    // Log the result
    await prisma.syncLog.create({
      data: {
        type: "EMAIL_ALERT",
        status: result.sent ? "SUCCESS" : "SKIPPED",
        message: result.sent
          ? `${result.count} notification(s) envoyée(s)`
          : result.reason || "Aucune notification",
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
