import { prisma } from "@/lib/db";

/**
 * Auto-corrects installation statuses:
 * Any installation with a valid warranty (endDate > now) that is marked as
 * HORS_PARC or EN_PARC_HORS_GARANTIE should be automatically set to EN_PARC.
 * Excludes RENOUVELE installations (user decision).
 * Returns the number of corrected installations.
 */
export async function autoCorrectInstallationStatuses(): Promise<number> {
  const now = new Date();

  const result = await prisma.installation.updateMany({
    where: {
      endDate: { gt: now },
      status: { in: ["HORS_PARC", "EN_PARC_HORS_GARANTIE"] },
    },
    data: {
      status: "EN_PARC",
    },
  });

  return result.count;
}
