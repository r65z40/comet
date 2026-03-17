import { prisma } from "@/lib/db";

let lastRun = 0;
const THROTTLE_MS = 60_000; // Run at most once per minute

/**
 * Auto-corrects installation statuses:
 * Any installation with a valid warranty (endDate > now) that is marked as
 * HORS_PARC or EN_PARC_HORS_GARANTIE should be automatically set to EN_PARC.
 * Excludes RENOUVELE installations (user decision).
 * Throttled to run at most once per minute to avoid unnecessary DB writes.
 */
export async function autoCorrectInstallationStatuses(): Promise<number> {
  const now = Date.now();
  if (now - lastRun < THROTTLE_MS) return 0;
  lastRun = now;

  const result = await prisma.installation.updateMany({
    where: {
      endDate: { gt: new Date() },
      status: { in: ["HORS_PARC", "EN_PARC_HORS_GARANTIE"] },
    },
    data: {
      status: "EN_PARC",
    },
  });

  return result.count;
}
